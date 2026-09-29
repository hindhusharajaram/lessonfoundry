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
        return "Remember"
    elif diff_lower in ["medium", "standard"]:
        return "Understand" if default.lower() in ["understand", "remember"] else "Apply"
    elif diff_lower in ["advanced", "hard"]:
        return "Analyze"
    return default.title() if default else "Understand"


def get_bloom_target_for_question(
    difficulty: str,
    objective_bloom: str = "Understand",
    question_idx: int = 0,
) -> str:
    """
    Determine appropriate Bloom level for an individual question based on its specific difficulty
    and objective context without forcing every item into a single tag.
    """
    diff_lower = (difficulty or "medium").lower()
    obj_bloom_lower = (objective_bloom or "understand").lower()

    if diff_lower in ["easy", "foundation"]:
        # Foundational items test Recall (Remember) or Conceptual Explanation (Understand)
        return "Remember" if question_idx % 2 == 0 else "Understand"

    elif diff_lower in ["medium", "standard"]:
        # Medium items test Understanding, Application, or follow the objective's target
        if obj_bloom_lower in ["apply", "analyze"]:
            return "Apply" if question_idx % 2 == 0 else "Understand"
        else:
            return "Understand" if question_idx % 2 == 0 else "Apply"

    elif diff_lower in ["hard", "advanced"]:
        # Hard items test Analysis (deconstruction/comparison) or Evaluation (critique/diagnostics)
        if obj_bloom_lower == "evaluate":
            return "Evaluate" if question_idx % 2 == 0 else "Analyze"
        else:
            return "Analyze" if question_idx % 2 == 0 else "Evaluate"

    return "Understand"


def get_bloom_prompt_instruction(bloom_tag: str, difficulty: str) -> str:
    """Generate prompt guidelines for cognitive demand."""
    tag = (bloom_tag or "Understand").title()
    desc = BLOOM_PEDAGOGICAL_GUIDELINES.get(tag, BLOOM_PEDAGOGICAL_GUIDELINES["Understand"])
    return (
        f"Cognitive Demand: Bloom Level '{tag}' (Difficulty Level: '{difficulty}').\n"
        f"Pedagogical Guideline: {desc}\n"
        f"For questions: Distractors must reflect plausible misconceptions without giving away the answer in the question text."
    )
