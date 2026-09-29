import re
from typing import Any, Dict, List


# Base signature patterns of instruction override / prompt injection attempts
INJECTION_PATTERNS = [
    (r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions?", "ignore_previous_instructions"),
    (r"disregard\s+(all\s+)?(previous|prior|above)\s+instructions?", "disregard_instructions"),
    (r"reveal\s+(the\s+)?(system\s+prompt|instructions?|api[_\s]key|secret|answer(\s+key)?)", "reveal_secret_or_prompt"),
    (r"you\s+are\s+now\s+(a|an|in|acting\s+as)?", "role_override_attempt"),
    (r"act\s+as\s+(a|an|the)?\s+[a-z0-9_\-\s]{3,30}", "act_as_prompt"),
    (r"system\s*prompt\s*:", "system_prompt_declaration"),
    (r"<\s*\|\s*im_start\s*\|\s*>", "chatml_injection_tag"),
    (r"\[\s*system\s*\]", "system_tag_injection"),
    (r"<<\s*SYS\s*>>", "sys_delimiters_injection"),
    (r"override\s+(all\s+)?rules?", "override_rules"),
    (r"forget\s+(all\s+)?(previous|prior)\s+instructions?", "forget_instructions"),
    (r"developer\s+mode\s+(enabled|on|activated)", "developer_mode_bypass"),
    (r"jailbreak", "jailbreak_keyword"),
    (r"new\s+instructions?:", "new_instructions_directive"),
    (r"do\s+not\s+follow\s+(the\s+)?(original|system)\s+instructions?", "do_not_follow_system"),
]

# Obfuscated patterns like "i.g.n.o.r.e", "i g n o r e"
OBFUSCATED_PATTERNS = [
    (r"i[\s\.\-_]*g[\s\.\-_]*n[\s\.\-_]*o[\s\.\-_]*r[\s\.\-_]*e[\s\.\-_]+(p[\s\.\-_]*r[\s\.\-_]*e[\s\.\-_]*v|i[\s\.\-_]*n[\s\.\-_]*s[\s\.\-_]*t)", "obfuscated_ignore"),
    (r"s[\s\.\-_]*y[\s\.\-_]*s[\s\.\-_]*t[\s\.\-_]*e[\s\.\-_]*m[\s\.\-_]+p[\s\.\-_]*r[\s\.\-_]*o[\s\.\-_]*m[\s\.\-_]*p[\s\.\-_]*t", "obfuscated_system_prompt"),
]


def scan_for_prompt_injections(text: str) -> Dict[str, Any]:
    """
    Scan untrusted source text for potential prompt injection / instruction-override patterns.
    Rule 1: Source text is untrusted DATA, never instructions.
    Rule: Never strip the text; only flag it.
    
    Returns a dict with:
      - flagged: bool
      - count: int
      - matches: List[Dict[str, Any]] (containing pattern_id, snippet, char_start, char_end)
    """
    if not text:
        return {"flagged": False, "count": 0, "matches": []}

    matches: List[Dict[str, Any]] = []

    # 1. Check standard injection patterns
    for pattern_regex, pattern_id in INJECTION_PATTERNS:
        for match in re.finditer(pattern_regex, text, re.IGNORECASE):
            start, end = match.span()
            matched_str = text[start:end]
            # Capture context snippet around the match
            snip_start = max(0, start - 20)
            snip_end = min(len(text), end + 20)
            snippet = text[snip_start:snip_end]

            matches.append({
                "pattern_id": pattern_id,
                "matched_text": matched_str,
                "char_start": start,
                "char_end": end,
                "snippet": snippet,
                "severity": "warning",
            })

    # 2. Check obfuscated patterns
    for pattern_regex, pattern_id in OBFUSCATED_PATTERNS:
        for match in re.finditer(pattern_regex, text, re.IGNORECASE):
            start, end = match.span()
            # Avoid duplicate ranges if already matched
            if any(m["char_start"] <= start and m["char_end"] >= end for m in matches):
                continue
            matched_str = text[start:end]
            snip_start = max(0, start - 20)
            snip_end = min(len(text), end + 20)
            matches.append({
                "pattern_id": pattern_id,
                "matched_text": matched_str,
                "char_start": start,
                "char_end": end,
                "snippet": text[snip_start:snip_end],
                "severity": "warning",
            })

    # Sort matches by character offset
    matches.sort(key=lambda m: m["char_start"])

    return {
        "flagged": len(matches) > 0,
        "count": len(matches),
        "matches": matches,
    }
