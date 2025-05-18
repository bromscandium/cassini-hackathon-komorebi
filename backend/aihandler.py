import openai
from mylogger import logger
import os 
from dotenv import load_dotenv
import requests
from config import EXCEL_ANALYSIS, EXCEL_ANALYSIS_JSON_SCHEMA
import asyncio
import json


load_dotenv()
OPENAI_API = os.getenv("OPENAI_API_KEY")
TAVILI_API = os.getenv("TAVILI_API_KEY")

model = "gpt-4o-search-preview-2025-03-11"


async def call_openai_api(conversation: list[dict], json_schema: str = None, model: str = "o4-mini-2025-04-16") -> str:
    """
    Asynchronously call the OpenAI API and return the parsed response content as a string.
    """
    client = openai.Client()
    client.api_key = OPENAI_API  # Ensure OPENAI_API is defined correctly

    params = {
        "model": model,
        "messages": conversation,
    }
    if json_schema is not None:
        params["response_format"] = json_schema

    try:
        response = client.beta.chat.completions.parse(**params)
        logger.info("Full response: %s", response)
        
        content = response.choices[0]
        logger.info("Content: %s", content)
        
        if not content:
            raise ValueError("OpenAI API returned an empty response")

        return content
    except Exception as e:
        logger.error(f"OpenAI API error: {e}")
        raise e

async def call_tavilli_api(query: str) -> str:
    """
    Asynchronously call the Tavilli API and return the parsed response content as a string.
    """
    url = "https://api.tavily.com/search"

    payload = {
        "query": query,
        "topic": "general",
        "search_depth": "advanced",
        "chunks_per_source": 3,
        "max_results": 5,
        "time_range": None,
        "days": 7,
        "include_answer": True,
        "include_raw_content": False,
        "include_images": False,
        "include_image_descriptions": False,
        "include_domains": [],
        "exclude_domains": []
    }
    headers = {
        "Authorization": TAVILI_API,
        "Content-Type": "application/json"
    }

    response = requests.request("POST", url, json=payload, headers=headers)

    return response.text


async def excel_str_to_resources(excel_str: str) -> list:
    """
    Convert an Excel string representation to a list of resources.
    """
    system_prompt = EXCEL_ANALYSIS.format(text=excel_str)
    conversation = [{"role": "system", "content": system_prompt}]
    
    response = await call_openai_api(conversation, json_schema=EXCEL_ANALYSIS_JSON_SCHEMA)
    
    response_json = json.loads(response.message.content)
    resources = response_json.get("resources", [])
    return resources



