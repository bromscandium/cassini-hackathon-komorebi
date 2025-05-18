

EXCEL_ANALYSIS = '''
You are provided with a text from the exel file about the available resources and you need to analyze it and return it in the formatted json format.
'''

EXCEL_ANALYSIS_JSON_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "excel_analysis",
        "schema": {
            "type": "object",
            "properties": {
                "resources": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "resource_name": {"type": "string"},
                            "quantity": {"type": "integer"},
                            "location": {"type": "string"}
                        },
                        "required": ["resource_name", "quantity", "location"]
                    }
                }
            },
            "required": ["resources"]
    }
    }
}


# ---------- prompt ----------
GENERATE_INSIGHTS = """
You are a subject-matter researcher analysing the cascading CONSEQUENCES
of a specified flooding event, including links to economic, societal,
environmental, infrastructure and policy-related knock-on effects **in {location}**.

**Step 1 – Plan**  
Think step-by-step about what you already know and what fresh facts
you still need.

**Step 2 – Draft search queries**  
List up to 6 focussed web-search strings (≤ 200 chars) that will close
those knowledge gaps.

**Step 3 – Follow-ups**  
If more searches are clearly required, create follow-up questions. But don't create too many questions max 10 follow-up questions.

**Step 4 – Synthesis**

**Output – return ONE JSON object with this shape:**  
```json
{{
  "use_internet": <true|false>,
  "search_queries": ["query 1", "query 2", …],
  "final_answer": JSONB
}}
If "use_internet" is true, the "search_queries" field should contain a list of queries but final_answer should return an empty JSON object.
If "use_internet" is false, the "search_queries" field should be empty but final_answer should contain a JSON object with the asked structure.
"""

generate_insights_json_schema = {
    "type": "json_schema",
    "json_schema" : {
        "name": "generate_insights",
    "schema": {         
        "type": "object",
        "properties": {
            "use_internet": {
                "type": "boolean",
                "description": "True if at least one web search is required."
            },
            "search_queries": {
                "type": "array",
                "description": "Focused Tavily search strings; empty if use_internet is false.",
                "items": { "type": "string" }
            },
            "final_answer": {
                "type": "object",
                "description": "Structured one-week outlook of potential threats.",
                "properties": {
                    "time_horizon": {
                        "type": "string",
                        "enum": ["1 week"]
                    },
                    "daily_threats": {
                        "type": "array",
                        "minItems": 7,
                        "maxItems": 7,
                        "items": {
                            "type": "object",
                            "properties": {
                                "day":  {
                                    "type": "integer",
                                    "minimum": 1,
                                    "maximum": 7
                                },
                                "critical_infrastructure_problems": {
                                    "type": "array",
                                    "items": { "type": "string" },
                                    "description": "List of critical infrastructure problems for the day. including as much detail as possible. Such as location of the problem, type of the problem, and the impact of the problem."
                                },
                                "public_health_risks": {
                                    "type": "array",
                                    "items": { "type": "string" },
                                    "description": "List of public health risks for the day. including as much detail as possible. Such as type of disease and the impact of the problem."
                                },
                                "economic_disruptions": {
                                    "type": "array",
                                    "items": { "type": "string" },
                                    "description": "List of economic disruptions for the day. including as much detail as possible. Such as type of the disruption and the impact of the problem."
                                },
                                "environmental_concerns": {
                                    "type": "array",
                                    "items": { "type": "string" },
                                    "description": "List of environmental concerns for the day. including as much detail as possible. Such as type of the concern and the impact of the problem."
                                }
                            },
                            "required": [
                                "day",
                                "critical_infrastructure_problems",
                                "public_health_risks",
                                "economic_disruptions",
                                "environmental_concerns"
                            ]
                        }
                    },
                    "most_potential_threat":
                        {
                            "type": "object",
                            "properties": {
                                'name': {
                                    "type": "string",
                                    "description": "Name of the most potential threat."
                                },
                                'threat_description': {
                                    "type": "string",
                                    "description": "Description of the most potential threat. including as much detail as possible. Such as location of the problem, type of the problem, and the impact of the problem. But keep it 2-3 sentences."
                                },
                                "threat_score": {
                                    "type": "integer",
                                    "description": "Score of the most potential threat. 0-10. 0 means no threat and 10 means very high threat."
                                },
                                
                        }
                    }
                        
                },
                "required": ["time_horizon", "daily_threats", "most_potential_threat"],
            }
        },
        "required": ["use_internet", "search_queries", "final_answer"]
    }
    }
}

tools = [{
    "type": "function",
    "function": {
        "name": "tavily_web_search",
        "description": "Search the web via Tavily and return JSON results.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": { "type": "string" }
            },
            "required": ["query"]
        }
    }
}]

ANALYZE_INSIGHTS = """
You are an expert disaster-response analyst. You have been given:

  • A proposed way of handling the disaster:  
    {solution}

  • Contextual information about the disaster:
    {conversation} 

  • The initial resources available in the area:  
    {resources}

––––– Your task –––––  
1. Assess whether this solution adequately addresses the situation.  
2. Describe likely outcomes and possible unintended consequences.  
3. Update the list of resources:  
   – What additional resources would be needed?  
   – Which existing resources might be depleted or redirected?

   Be realistic when evaluating the solution.

User will try to solve the problem with the given resources. And provide follow-up solutions if the solution is not enough. Once the severity score drops below 5, the user will stop trying to solve the problem.
Also provide a follow-up threat that could be created by the proposed solution - there must always be potential threat. Such as location of the problem, type of the problem, and the impact of the problem. But keep it 2-3 sentences.
––––– Output –––––  
Return **one** JSON object (no extra text) matching this schema:

```json
{{
  "short_response": "<Does the solution solve the situation? Yes/No + why in one sentence.>",
  "feedback": "<Detailed feedback on risks, consequences, and how it could be improved.>",
  "updated_resources": {{
    "Medical Resources": {{
      "Ambulances": <number>,
      "Doctors": <number>,
      "Nurses": <number>,
      "Medical Kits": <number>,
      "Generators": <number>
    }},
    "Logistics & Support": {{
      "Rescue Boats": <number>,
      "Fuel Reserves": <number>,
      "Comm Radios": <number>,
      "Water Units": <number>,
      "Shelter Tents": <number>
    }}
  }},
  "response_analysis": {{
    "medical_relevance": 0–10,
    "logistical_feasibility": 0–10,
    "ethical_considerations": 0–10,
    "context_relevance": 0–10,
    "overall_effectiveness": 0–10
  }},
  "updated_severty_score": {{
    "severity_score": 0–10,
    "severity_description": "<Description of the severity score. 0 means no threat and 10 means very high threat.>"
    }},

    "alternative_solutions": {{
        "solution": "<Description of the alternative solution>",
        "alternative_result": "<Description of the result of the alternative solution>",
        "resources_needed": {{
            "Medical Resources": {{
                "Ambulances": <number>,
                "Doctors": <number>,
                "Nurses": <number>,
                "Medical Kits": <number>,
                "Generators": <number>
            }},
            "Logistics & Support": {{
                "Rescue Boats": <number>,
                "Fuel Reserves": <number>,
                "Comm Radios": <number>,
                "Water Units": <number>,
                "Shelter Tents": <number>
            }}
        }},
        "feedback": "<Feedback on the alternative solution>",
        "response_analysis": {{
            "medical_relevance": 0–10,
            "logistical_feasibility": 0–10,
            "ethical_considerations": 0–10,
            "context_relevance": 0–10,
            "overall_effectiveness": 0–10
        }},
        "updated_severty_score": {{
            "severity_score": 0–10,
            "severity_description": "<Description of the severity score. 0 means no threat and 10 means very high threat.>"
        }}
        "follow_up_threat": {{
            "name": "<Name of the follow-up threat>",
            "threat_description": "<Description of the follow-up threat created by proposed solution there must always be a follow-up threat. including as much detail as possible. Such as location of the problem, type of the problem, and the impact of the problem. But keep it 2-3 sentences.>",
            "threat_score": <number>
        }}
}}
  
"""



ANALYZE_INSIGHTS_JSON_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "analyze_insights",
        "schema": {
            "type": "object",
            "properties": {
                "short_response": {
                    "type": "string",
                    "description": "Short response about the solution. Does it solve the situation or not?"
                },
                "feedback": {
                    "type": "string",
                    "description": "Feedback about the solution. What are the possible consequences of this solution? What could be done better?"
                },
                "updated_resources": {
                    "type": "object",
                    "description": "Updated list of resources. What additional resources would be needed? Which existing resources might be depleted or redirected?",
                    "properties": {
                        "Medical Resources": {
                            "type": "object",
                            "properties": {
                                "Ambulances":    {"type": "integer", "description": "Number of ambulances available."},
                                "Doctors":       {"type": "integer", "description": "Number of doctors available."},
                                "Nurses":        {"type": "integer", "description": "Number of nurses available."},
                                "Medical Kits":  {"type": "integer", "description": "Number of medical kits available."},
                                "Generators":    {"type": "integer", "description": "Number of generators available."}
                            },
                            "required": ["Ambulances", "Doctors", "Nurses", "Medical Kits", "Generators"]
                        },
                        "Logistics & Support": {
                            "type": "object",
                            "properties": {
                                "Rescue Boats":    {"type": "integer", "description": "Number of rescue boats available."},
                                "Fuel Reserves":   {"type": "integer", "description": "Number of fuel reserves available."},
                                "Comm Radios":     {"type": "integer", "description": "Number of communication radios available."},
                                "Water Units":     {"type": "integer", "description": "Number of water units available."},
                                "Shelter Tents":   {"type": "integer", "description": "Number of shelter tents available."}
                            },
                            "required": ["Rescue Boats", "Fuel Reserves", "Comm Radios", "Water Units", "Shelter Tents"]
                        }
                    },
                    "required": ["Medical Resources", "Logistics & Support"]
                },
                "response_analysis": {
                    "type": "object",
                    "description": "Numeric scores (0–10) evaluating different dimensions of the proposed solution.",
                    "properties": {
                        "medical_relevance":       {"type": "number", "minimum": 0, "maximum": 10},
                        "logistical_feasibility":  {"type": "number", "minimum": 0, "maximum": 10},
                        "ethical_considerations":  {"type": "number", "minimum": 0, "maximum": 10},
                        "context_relevance":       {"type": "number", "minimum": 0, "maximum": 10},
                        "overall_effectiveness":   {"type": "number", "minimum": 0, "maximum": 10}
                    },
                    "required": [
                        "medical_relevance",
                        "logistical_feasibility",
                        "ethical_considerations",
                        "context_relevance",
                        "overall_effectiveness"
                    ],


                },
                "updated_severty_score": {
                    "type": "object",
                    "description": "Updated severity score of the situation.",
                    "properties": {
                        "severity_score": {
                            "type": "integer",
                            "minimum": 0,
                            "maximum": 10,
                            "description": "Severity score of the situation or the state of the situation after applying mentioned solution. 0 means no threat and 10 means very high threat."
                        },
                        "severity_description": {
                            "type": "string",
                            "description": "Description of the severity score."
                        }
                    },
                    "required": ["severity_score", "severity_description"]
                },
                "alternative_solutions": {
                    "type": "object",
                    "description": "Alternative solutions and their feedback.",
                    "properties": {
                        "solution": {
                            "type": "string",
                            "description": "Description of the alternative solution. With all the details of the solution. as well as the steps that should be taken"
                        },
                        "alternative_result": {
                            "type": "string",
                            "description": "Description of the result of the alternative solution."
                        },
                        "resources_needed": {
                            "type": "object",
                            "properties": {
                                "Medical Resources": {
                                    "$ref": "#/properties/updated_resources/properties/Medical Resources"
                                },
                                "Logistics & Support": {
                                    "$ref": "#/properties/updated_resources/properties/Logistics & Support"
                                }
                            },
                            "required": ["Medical Resources", "Logistics & Support"]
                        },
                        "feedback": {
                            "type": "string",
                            "description": "Feedback on the alternative solution."
                        },
                        "response_analysis": {
                            "type": "object",
                            "properties": {
                                "medical_relevance":       {"type": "number", "minimum": 0, "maximum": 10},
                                "logistical_feasibility":  {"type": "number", "minimum": 0, "maximum": 10},
                                "ethical_considerations":  {"type": "number", "minimum": 0, "maximum": 10},
                                "context_relevance":       {"type": "number", "minimum": 0, "maximum": 10},
                                "overall_effectiveness":   {"type": "number", "minimum": 0, "maximum": 10}
                            },
                            "required": [
                                "medical_relevance",
                                "logistical_feasibility",
                                "ethical_considerations",
                                "context_relevance",
                                "overall_effectiveness"
                            ]
                        },
                        "updated_severty_score": {
                            "type": "object",
                            "properties": {
                                "severity_score": {
                                    "type": "integer",
                                    "minimum": 0,
                                    "maximum": 10,
                                    "description": "Severity score of the situation. 0 means no threat and 10 means very high threat."
                                },
                                "severity_description": {
                                    "type": "string",
                                    "description": "Description of the severity score."
                                }
                            },
                            "required": ["severity_score", "severity_description"]
                        }
                    },
                    "required": ["solution", "alternative_result", "resources_needed", "feedback", "response_analysis", "updated_severty_score"]
                },
                "follow_up_threat": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Name of the follow-up threat."
                        },
                        "threat_description": {
                            "type": "string",
                            "description": "Description of the follow-up threat created by proposed solution. including as much detail as possible. Such as location of the problem, type of the problem, and the impact of the problem. But keep it 2-3 sentences."
                        },
                        "threat_score": {
                            "type": "integer",
                            "description": "Score of the follow-up threat. 0-10. 0 means no threat and 10 means very high threat."
                        }
                    },
                    "required": ["name", "threat_description", "threat_score"]
                }
            },
            "required": [
                "short_response",
                "feedback",
                "updated_resources",
                "response_analysis",
                "updated_severty_score",
                "alternative_solutions",
                "follow_up_threat"
            ]
        }
    }
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

EXCEL_ANALYSIS = '''
You are provided with a text from the exel file about the available resources and you need to analyze it and return it in the formatted json format.
Here is the text to analyze: {text}
```json
{{resources: [
    {{
        "Medical Resources": {{
            "Ambulances": <number>,
            "Doctors": <number>,
            "Nurses": <number>,
            "Medical Kits": <number>,
            "Generators": <number>

        }},
        "Logistics & Support": {{      
            "Rescue Boats": <number>,
            "Fuel Reserves": <number>,
            "Comm Radios": <number>,
            "Water Units": <number>,
            "Shelter Tents": <number>
        }}
    }}  
]}}
```
You need to analyze the text and return it in the formatted json format.
'''


EXCEL_ANALYSIS_JSON_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "excel_analysis",
        "schema": {
            "type": "object",
            "properties": {
                "resources": {
                    "type": "array",
                    "items": {
                        "Medical Resources": {
                            "type": "object",
                            "properties": {
                                "Ambulances": {"type": "integer"},
                                "Doctors": {"type": "integer"},
                                "Nurses": {"type": "integer"},
                                "Medical Kits": {"type": "integer"},
                                "Generators": {"type": "integer"}
                            },
                            "required": ["Ambulances", "Doctors", "Nurses", "Medical Kits", "Generators"]
                        },
                        "Logistics & Support": {
                            "type": "object",
                            "properties": {
                                "Rescue Boats": {"type": "integer"},
                                "Fuel Reserves": {"type": "integer"},
                                "Comm Radios": {"type": "integer"},
                                "Water Units": {"type": "integer"},
                                "Shelter Tents": {"type": "integer"}
                            },
                            "required": ["Rescue Boats", "Fuel Reserves", "Comm Radios", "Water Units", "Shelter Tents"]
                        }
                    },
                    "required": ["Medical Resources", "Logistics & Support"]
                }
            },
            "required": ["resources"]
        }
    }
    }