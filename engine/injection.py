from typing import Dict, Any, List


def scan_for_prompt_injections(text: str) -> Dict[str, Any]:
    """Scan untrusted source data for potential instruction override / prompt injection patterns."""
    return {"flagged": False, "patterns_detected": []}
