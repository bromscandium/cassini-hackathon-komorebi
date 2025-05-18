from aihandler import call_openai_api, call_tavilli_api
from config import GENERATE_INSIGHTS, generate_insights_json_schema, ANALYZE_INSIGHTS, ANALYZE_INSIGHTS_JSON_SCHEMA
import asyncio
import json
from tools import dict_to_str
from typing import List, Dict, Any


async def multiagent_scene(location: str) -> Dict[str, Any]:
    """
    Drive the plan-search-synthesise loop until a complete final_answer is produced.
    Returns the parsed JSON dict that matches generate_insights_json_schema.
    """
    GENERATE_SCENE_PROMPT = GENERATE_INSIGHTS.format(location=location)
    conversation = [{"role": "system", "content": GENERATE_SCENE_PROMPT}]

    loop = asyncio.get_event_loop()

    while True:
        # ---------- ask GPT ----------
        msg = await call_openai_api(conversation, json_schema=generate_insights_json_schema)
        response_json = json.loads(msg.message.content)

        if response_json.get("use_internet", False):
            # Run every query and collect results
            search_results = {}
            for q in response_json.get("search_queries", []):
                search_results[q] = await call_tavilli_api(q)

            print("search_results", search_results)
            conversation += [{
                "role": "user",
                "content": 'here are the results of my searches: ' + dict_to_str(search_results)
            }]
            # continue → GPT will now re-enter the loop with fresh info
            continue

        # ---------- synthesis complete? ----------
        final_ans = response_json.get("final_answer", {})
        threats   = final_ans.get("daily_threats", [])
        most_potential_threats = final_ans.get("most_potential_threat", [])
        conversation += [{
            "role": "user",
            "content": 'here is the most potential threats: ' + dict_to_str(most_potential_threats)
        }]
        if len(threats) == 7:
            # summarize evrth
            # conversation += [{
            #     "role": "system",
            #     "content": 'here is the final answer: ' + dict_to_str(final_ans) + "and here is the full conversation: " + dict_to_str(conversation) + 'finalize and make it better'

            # }]
            # final_answer = loop.run_until_complete(
            #     call_openai_api(conversation, json_schema=generate_insights_json_schema, model="o4-mini-2025-04-16")
            # )
            # response_json = json.loads(final_answer.message.content)
            # final = response_json.get("final_answer", {})

            return final_ans, conversation
        

async def multiagent_analysis(response: str, resources: list, conversation: List[Dict[str, Any]] = None, initial = bool) -> Dict[str, Any]:
    """
    Run the multiagent analysis loop until a complete final_answer is produced.
    Returns the parsed JSON dict that matches generate_insights_json_schema.
    """
    if initial:
        ANALYZE_INSIGHTS_PROMPT = ANALYZE_INSIGHTS.format(solution=response, resources=resources, conversation=conversation)
        conversation += [{"role": "system", "content": ANALYZE_INSIGHTS_PROMPT}]
    else:
        conversation += [{
            "role": "user",
            "content": 'here is the how I proposed to solve the problem: ' + response
        }]
    msg = await call_openai_api(conversation, json_schema=ANALYZE_INSIGHTS_JSON_SCHEMA)
    
    response_json = json.loads(msg.message.content)

    short_response = response_json.get("short_response", {})
    feedback = response_json.get("feedback", {})
    response_analysis = response_json.get("response_analysis", {})
    updated_resources = response_json.get("updated_resources", {})
    alternative_solutions = response_json.get("alternative_solutions", {})
    updated_severty_score = response_json.get("updated_severty_score", {})  
    follow_up_threat = response_json.get("follow_up_threat", {})

    updated_conversation = conversation + [{
        "role": "user",
        "content": 'here is the how I proposed to solve the problem: ' + response + ' and here is the feedback: ' + dict_to_str(feedback) + ' and here is the analysis: ' + dict_to_str(response_analysis) + ' so new severity score is: ' + dict_to_str(updated_severty_score) }]


    return {
        "short_response": short_response,
        "feedback": feedback,
        "response_analysis": response_analysis,
        "updated_resources": updated_resources,
        "alternative_solutions": alternative_solutions,
        "updated_severty_score": updated_severty_score,
        "follow_up_threat": follow_up_threat,
        "updated_conversation": updated_conversation
    }



resources = {
    "Medical Resources": {
        "Ambulances": 10,
        "Doctors": 25,
        "Nurses": 40,
        "Medical Kits": 100,
        "Generators": 15
    },
    "Logistics & Support": {
        "Rescue Boats": 10,
        "Fuel Reserves": 100,
        "Comm Radios": 25,
        "Water Units": 50,
        "Shelter Tents": 20
    }
}



# -------------- run -----------------------------------------------------------
if __name__ == "__main__":
    location = "Valencia, Spain"
    result, conversation = multiagent_scene(location)
    solution = input("Enter the solution: ")
    initial = True
    while True:
        print("solution", solution)
        final = multiagent_analysis(solution, resources, conversation, initial=initial)
        initial = False
        updated_severty_score = final.get("updated_severty_score", {})
        severity_score = updated_severty_score.get("severity_score", 0)
        resources = final.get("updated_resources", {})
        conversation = final.get("updated_conversation", [])
        print("final", final)
        print("severity_score", severity_score)
        if int(severity_score) < 5:
            print("Severity score is acceptable. No further action needed.")
            print(final)
            follow_up_threat = final.get("follow_up_threat", {})
            follow_up_threat_name = follow_up_threat.get("name", "")
            conversation = final.get("updated_conversation", [])
            resources = final.get("updated_resources", {})

            if follow_up_threat_name:
                print("Follow-up threat detected:", follow_up_threat)
                solution = input("Enter the new solution: ")
                conversation += [{
                    "role": "user",
                    "content": 'here is the follow up threat to be treated: ' + follow_up_threat_name + 'with following description: ' + follow_up_threat.get("threat_description", "")
                }]
                continue
            else:
                break
        
        else:
            print("Severity score is high. Need to analyze further.")
            solution = input("Enter the new solution: ")
            continue
    
    




            

