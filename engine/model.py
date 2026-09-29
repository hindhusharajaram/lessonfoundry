import os
from typing import Any, Dict, Optional
from dotenv import load_dotenv

load_dotenv()

PRIMARY_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
FALLBACK_MODEL = os.getenv("GEMINI_MODEL_FALLBACK", "gemini-2.5-flash")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


def call_gemini(
    prompt: str,
    system_instruction: Optional[str] = None,
    model_name: Optional[str] = None,
    json_mode: bool = True,
    temperature: float = 0.2,
) -> str:
    """Wrapper for Google GenAI client calls with error handling and fallback support."""
    # To be fully implemented in generator/solver phases
    return "{}"
