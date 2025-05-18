# backend.py
import uuid, asyncio, json
from typing import Dict, Any, Optional, List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi import File, UploadFile, status
import pandas as pd
import io   

# ── your existing helpers ───────────────────────────────────────
from aihandler import call_openai_api, call_tavilli_api, excel_str_to_resources        # noqa
from config    import (GENERATE_INSIGHTS,
                       generate_insights_json_schema,
                       ANALYZE_INSIGHTS,
                       ANALYZE_INSIGHTS_JSON_SCHEMA)
from tools     import dict_to_str                                # noqa

# ── the two agent functions (unchanged except minor tweaks) ─────
from multiagent import multiagent_scene, multiagent_analysis        # assume you moved them to agents.py


# ── pydantic request / response models ──────────────────────────
class StartRequest(BaseModel):
    location: str
    resources: Optional[Dict[str, Any]] = None

class StartResponse(BaseModel):
    session_id: str
    threats: Dict[str, Any]
    conversation: List[Dict[str, Any]]

class SolveRequest(BaseModel):
    session_id: str
    solution: str

class SolveResponse(BaseModel):
    severity_score: int
    updated_resources: Dict[str, Any]
    follow_up_threat: Optional[Dict[str, Any]] = None
    analysis: Dict[str, Any]

class ExcelExtractResponse(BaseModel):
    Dict[str, Any]

# ── FastAPI app setup ───────────────────────────────────────────
app = FastAPI(title="Flood-Response Multi-Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# in-memory cache:  session_id -> session dict
SESSION: Dict[str, Any] = {}


# ── ENDPOINT 1 : start a new session ────────────────────────────
@app.post("/session/start", response_model=StartResponse)
async def start_session(req: StartRequest):
    threats, conversation = await multiagent_scene(req.location)
    resources = req.location

    session_id = str(uuid.uuid4())
    SESSION[session_id] = {
        "conversation": conversation,
        "resources": resources,
        "initial": True       # first analysis needs system prompt
    }

    return StartResponse(
        session_id=session_id,
        threats=threats,
        conversation=conversation,
    )


# ── ENDPOINT 2 : propose / refine a solution ────────────────────
@app.post("/session/solve", response_model=SolveResponse)
async def solve(req: SolveRequest):
    s = SESSION.get(req.session_id)
    if s is None:
        raise HTTPException(status_code=404, detail="Session not found")

    analysis = await multiagent_analysis(
        response=req.solution,
        conversation=s["conversation"],
        resources=s["resources"],
        initial=s["initial"]
    )
    # mark subsequent calls as non-initial
    s["initial"] = False
    s["conversation"] = analysis["updated_conversation"]
    s["resources"] = analysis["updated_resources"]

    severity = int(analysis["updated_severty_score"].get("severity_score", 0))

    return SolveResponse(
        severity_score=severity,
        updated_resources=analysis["updated_resources"],
        follow_up_threat=analysis.get("follow_up_threat"),
        analysis=analysis
    )


class ResourcesResponse(BaseModel):
    resources: List[Dict[str, Any]]     # ← matches your example output

def df_to_tsv(df: pd.DataFrame) -> str:
    return df.to_csv(sep="\t", index=False, header=False, na_rep="")

@app.post(
    "/extract/excel",
    response_model=ResourcesResponse,
    status_code=status.HTTP_201_CREATED,
)
async def extract_excel(file: List[UploadFile] = File(...)):
    """Turn one or more Excel files into a list of resource dicts."""
    resources_out: List[Dict[str, Any]] = []

    for up in file:
        if not up.filename.endswith((".xlsx", ".xls")):
            raise HTTPException(415, f"{up.filename} is not an Excel file")

        buffer = io.BytesIO(await up.read())

        # read every sheet
        try:
            book = pd.read_excel(
                buffer,
                sheet_name=None,
                dtype=str,
                engine="openpyxl" if up.filename.endswith(".xlsx") else "xlrd",
            )
        except Exception as e:
            raise HTTPException(422, f"Cannot parse {up.filename}: {e}")

        # flat text of all sheets
        full_text = "\n".join(df_to_tsv(df) for df in book.values())

        # call your helper – async or sync
        extracted = await excel_str_to_resources(full_text) \
            if asyncio.iscoroutinefunction(excel_str_to_resources) \
            else excel_str_to_resources(full_text)

        # Make sure helper returns a dict; wrap otherwise
        if isinstance(extracted, dict):
            resources_out.append(extracted)
        elif isinstance(extracted, list):
            resources_out.extend(extracted)
        else:
            raise HTTPException(500, "excel_str_to_resources returned unexpected type")

    return ResourcesResponse(resources=resources_out)


# ── run locally ─────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    # development: hot-reload
    uvicorn.run("server:app",
                host="0.0.0.0",
                port=8000,
                reload=True)          # now no warning

