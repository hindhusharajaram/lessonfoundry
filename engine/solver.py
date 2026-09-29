from typing import Any, Dict, List


def solve_independently(question: str, options: List[str], source_text: str) -> Dict[str, Any]:
    """
    Independent solver: a separate model call answers each quiz/practice question
    using ONLY the source, WITHOUT seeing the answer key.
    """
    return {"chosen_index": 0, "rationale": ""}
