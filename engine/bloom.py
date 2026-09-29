from typing import Dict, List

DIFFICULTY_BLOOM_MAP: Dict[str, List[str]] = {
    "easy": ["Remember", "Understand"],
    "medium": ["Apply"],
    "advanced": ["Analyze", "Evaluate"],
}

BLOOM_PEDAGOGICAL_GUIDELINES: Dict[str, str] = {
    "Remember": "Focus on direct recall of defined terms, facts, or labeled steps verbatim from the source.",
    "Understand": "Focus on explaining concepts in student-friendly terms, identifying main ideas, and summarizing mechanisms.",
    "Apply": "Focus on applying a concept or rule to a new concrete scenario, calculating an outcome, or identifying an example.",
    "Analyze": "Focus on multi-step reasoning, cause-and-effect relationships, comparing contrasting components, or distinguishing evidence.",
    "Evaluate": "Focus on evaluating hypotheses, diagnosing why a distractor/misconception is incorrect based on evidence, or judging the validity of a claim.",
}


def get_bloom_target_for_difficulty(difficulty: str, default: str = "Understand") -> str:
    """Get the primary target Bloom tag for a given unit difficulty."""
    diff_lower = difficulty.lower()
    if diff_lower == "easy":
        return "Understand"
    elif diff_lower == "medium":
        return "Apply"
    elif diff_lower == "advanced":
        return "Analyze"
    return default


def get_bloom_prompt_instruction(bloom_tag: str, difficulty: str) -> str:
    """Generate prompt guidelines for cognitive demand."""
    tag = bloom_tag.title()
    desc = BLOOM_PEDAGOGICAL_GUIDELINES.get(tag, BLOOM_PEDAGOGICAL_GUIDELINES["Understand"])
    return (
        f"Cognitive Demand: Bloom Level '{tag}' (Difficulty: '{difficulty}').\n"
        f"Guideline: {desc}\n"
        f"For questions: Distractors must reflect plausible misconceptions without giving away the answer in the question text."
    )
