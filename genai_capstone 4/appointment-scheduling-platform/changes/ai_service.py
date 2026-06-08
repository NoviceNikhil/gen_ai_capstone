"""
AI Service for document verification using Groq LLM.
"""

import json
import os
import logging
from groq import Groq

logger = logging.getLogger(__name__)

# Initialize Groq client
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = os.getenv("GROQ_MODEL", "llama3-8b-8192")


def validate_document(extracted_text: str) -> dict:
    """
    Call Groq to validate extracted text for required fields.
    Returns JSON with: degree_found, license_found, specialization_found, missing_fields
    
    Args:
        extracted_text: Text extracted from the document
        
    Returns:
        dict with validation results
    """
    if not extracted_text or len(extracted_text.strip()) == 0:
        return {
            "degree_found": False,
            "license_found": False,
            "specialization_found": False,
            "missing_fields": ["degree", "license number", "specialization"]
        }
    
    prompt = f"""Analyze this healthcare provider document and detect the following:
1. Medical degree (MBBS, MD, MS, etc.)
2. License number (any format)
3. Specialization (if mentioned)

Respond ONLY with valid JSON (no markdown, no explanation):
{{
    "degree_found": true/false,
    "license_found": true/false,
    "specialization_found": true/false,
    "missing_fields": ["list", "of", "missing"]
}}

DOCUMENT TEXT:
{extracted_text}"""

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=500,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )
        
        response_text = response.content[0].text.strip()
        
        # Strip markdown fences if present
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        response_text = response_text.strip()
        result = json.loads(response_text)
        
        return result
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Groq response as JSON: {e}")
        return {
            "degree_found": False,
            "license_found": False,
            "specialization_found": False,
            "missing_fields": ["parsing_error"]
        }
    except Exception as e:
        logger.error(f"Groq API error during validation: {str(e)}")
        return {
            "degree_found": False,
            "license_found": False,
            "specialization_found": False,
            "missing_fields": ["api_error"]
        }


def generate_ai_insight(extracted_text: str, validation_result: dict) -> dict:
    """
    Call Groq to generate admin insight summary.
    Returns JSON with: summary, highlights (array), risk_level
    
    Args:
        extracted_text: Text extracted from the document
        validation_result: Result from validate_document
        
    Returns:
        dict with insight data
    """
    degree_found = validation_result.get("degree_found", False)
    license_found = validation_result.get("license_found", False)
    specialization_found = validation_result.get("specialization_found", False)
    
    # Determine risk level
    if degree_found and license_found and specialization_found:
        risk_hint = "low"
    elif degree_found and license_found:
        risk_hint = "medium"
    else:
        risk_hint = "high"
    
    prompt = f"""Analyze this healthcare provider document and generate a brief admin insight.

Fields found:
- Degree: {degree_found}
- License: {license_found}
- Specialization: {specialization_found}

Respond ONLY with valid JSON (no markdown, no explanation):
{{
    "summary": "2-4 line plain text summary of credentials found",
    "highlights": ["highlight 1", "highlight 2", "highlight 3"],
    "risk_level": "{risk_hint}"
}}

Suggested risk levels:
- "low" if degree + license + specialization all found
- "medium" if degree + license found but specialization missing
- "high" for anything else or unreadable

DOCUMENT TEXT:
{extracted_text}"""

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=500,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )
        
        response_text = response.content[0].text.strip()
        
        # Strip markdown fences if present
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        response_text = response_text.strip()
        result = json.loads(response_text)
        
        # Ensure highlights is a list
        if not isinstance(result.get("highlights"), list):
            result["highlights"] = []
        
        return result
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Groq response as JSON: {e}")
        return {
            "summary": "Unable to generate insight.",
            "highlights": [],
            "risk_level": "high"
        }
    except Exception as e:
        logger.error(f"Groq API error during insight generation: {str(e)}")
        return {
            "summary": "API error occurred.",
            "highlights": [],
            "risk_level": "high"
        }
