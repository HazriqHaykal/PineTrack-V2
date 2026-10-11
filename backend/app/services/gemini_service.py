"""
Google Gemini client
Thin wrapper around the Gemini REST API that returns structured JSON
"""

import json
import logging
import ssl
from typing import Any, Dict

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

# Verify certificates against the operating system's trust store rather than the bundled one.
# Antivirus HTTPS scanning (e.g. Avast) re-signs connections with a root that only the OS trusts.
SSL_CONTEXT = ssl.create_default_context()


class GeminiError(Exception):
    """Gemini is not configured or did not return a usable answer"""


class GeminiService:
    """Service for calling the Gemini generateContent API"""

    TIMEOUT_SECONDS = 30

    @staticmethod
    def is_configured() -> bool:
        return bool(settings.gemini_api_key.strip())

    @staticmethod
    def model_label() -> str:
        return f"gemini:{settings.gemini_model}"

    @staticmethod
    def generate_json(prompt: str, response_schema: Dict[str, Any]) -> Any:
        """
        Ask Gemini for a JSON answer matching response_schema

        Raises:
            GeminiError: no API key, the request failed, or the answer was not valid JSON
        """
        if not GeminiService.is_configured():
            raise GeminiError("GEMINI_API_KEY is not set")

        payload = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.3,
                "responseMimeType": "application/json",
                "responseSchema": response_schema,
            },
        }

        try:
            response = httpx.post(
                GEMINI_URL.format(model=settings.gemini_model),
                headers={"x-goog-api-key": settings.gemini_api_key.strip()},
                json=payload,
                timeout=GeminiService.TIMEOUT_SECONDS,
                verify=SSL_CONTEXT,
            )
        except httpx.HTTPError as e:
            raise GeminiError(f"Could not reach Gemini: {e}") from e

        if response.status_code != 200:
            # Never log the key; the body explains bad keys, unknown models and quota errors
            raise GeminiError(f"Gemini returned HTTP {response.status_code}: {response.text[:300]}")

        try:
            text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text)
        except (KeyError, IndexError, TypeError, ValueError) as e:
            raise GeminiError(f"Unexpected Gemini response: {e}") from e
