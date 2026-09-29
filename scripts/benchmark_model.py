import os
import sys
import time
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel, Field

# Ensure root directory is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from engine.model import generate_json, ModelError, PRIMARY_MODEL, FALLBACK_MODEL


# Sample Pydantic Schemas matching LessonFoundry content shapes
class ExplanationOutput(BaseModel):
    title: str
    summary: str
    sentences: List[dict] = Field(description="List of {text, quote} pairs")
    glossary: List[dict] = Field(description="List of {term, definition, quote} triples")


class ExampleOutput(BaseModel):
    problem: str
    steps: List[dict] = Field(description="List of {text, quote} pairs")
    answer: str


class QuizItemOutput(BaseModel):
    question: str
    options: List[str] = Field(min_length=4, max_length=4)
    correct_index: int = Field(ge=0, le=3)
    rationale: str
    quote: str
    bloom: str
    difficulty: str


class RevisionOutput(BaseModel):
    key_points: List[dict] = Field(description="List of {text, quote, objective_id}")
    terms: List[dict] = Field(description="List of {term, definition, quote}")


class SupportCheckOutput(BaseModel):
    supported: bool
    confidence: float
    support_note: str
    evidence_quote: str


BENCHMARK_PROMPTS = [
    (
        "Prompt 1: Explanation Generation",
        ExplanationOutput,
        "Source: Photosynthesis is the process used by plants to convert light energy into chemical energy that, through cellular respiration, can later be released to fuel the organism's metabolic activities. The chemical energy is stored in carbohydrate molecules, such as sugars, which are synthesized from carbon dioxide and water.\n\nGenerate an explanation structure for 9th grade biology.",
    ),
    (
        "Prompt 2: Worked Example Generation",
        ExampleOutput,
        "Source: In a classic punnett square with two heterozygous pea plants (Bb x Bb), the dominant allele B codes for purple flowers and recessive allele b codes for white flowers. The expected offspring phenotypic ratio is 3 purple to 1 white.\n\nGenerate a worked example showing how to calculate the probability of white flowers.",
    ),
    (
        "Prompt 3: Quiz Item Generation",
        QuizItemOutput,
        "Source: Mitochondria are membrane-bound cell organelles that generate most of the chemical energy needed to power the cell's biochemical reactions. Chemical energy produced by the mitochondria is stored in a small molecule called adenosine triphosphate (ATP).\n\nGenerate a 4-option multiple choice question testing the function of mitochondria.",
    ),
    (
        "Prompt 4: Revision Key Points",
        RevisionOutput,
        "Source: Newton's First Law states that an object at rest remains at rest, and an object in motion continues in motion with constant velocity unless acted upon by a net external force. This property is known as inertia.\n\nGenerate a concise revision summary.",
    ),
    (
        "Prompt 5: Source Objective Support Check",
        SupportCheckOutput,
        "Source: The water cycle describes how water evaporates from the surface of the earth, rises into the atmosphere, cools and condenses into rain or snow in clouds, and falls again to the surface as precipitation.\n\nTarget Objective: Explain precipitation and evaporation cycles in earth systems.\n\nCheck if the source supports this objective.",
    ),
]


def run_benchmark():
    api_key = os.getenv("GEMINI_API_KEY", "")
    has_valid_key = bool(api_key and api_key.startswith("AIza") and api_key != "your_gemini_api_key_here")

    models_to_test = [PRIMARY_MODEL]
    if FALLBACK_MODEL and FALLBACK_MODEL != PRIMARY_MODEL:
        models_to_test.append(FALLBACK_MODEL)

    results = []
    print(f"Starting Gemini Model Benchmark with {len(BENCHMARK_PROMPTS)} structured prompts...")
    print(f"Models: {models_to_test}")
    if not has_valid_key:
        print("Note: Valid GEMINI_API_KEY not detected in .env; benchmark will record offline connection status.\n")

    for model in models_to_test:
        print(f"=== Testing Model: {model} ===")
        model_results = []
        valid_count = 0
        latencies = []

        for name, schema, prompt in BENCHMARK_PROMPTS:
            print(f"Running: {name} ...", end=" ", flush=True)
            t0 = time.time()
            try:
                if not has_valid_key:
                    raise ModelError("API key not configured in .env (add GEMINI_API_KEY=AIza... to run live benchmark).")
                obj, meta = generate_json(
                    prompt=prompt,
                    schema=schema,
                    model_name=model,
                    temperature=0.2,
                )
                elapsed_ms = meta.get("latency_ms", int((time.time() - t0) * 1000))
                latencies.append(elapsed_ms)
                valid_count += 1
                model_results.append({
                    "prompt_name": name,
                    "status": "VALID",
                    "latency_ms": elapsed_ms,
                    "attempts": meta.get("attempts", 1),
                    "repaired": meta.get("repaired", False),
                })
                print(f"OK ({elapsed_ms}ms, {meta.get('attempts', 1)} attempts)")
            except Exception as e:
                elapsed_ms = int((time.time() - t0) * 1000)
                latencies.append(elapsed_ms)
                err_msg = str(e)
                short_err = err_msg[:50] if len(err_msg) > 50 else err_msg
                model_results.append({
                    "prompt_name": name,
                    "status": f"FAILED ({short_err})",
                    "latency_ms": elapsed_ms,
                    "attempts": 1,
                    "repaired": False,
                })
                print(f"FAILED ({short_err})")

        validity_pct = (valid_count / len(BENCHMARK_PROMPTS)) * 100 if len(BENCHMARK_PROMPTS) > 0 else 0.0
        avg_latency = (sum(latencies) / len(latencies)) if latencies else 0.0
        min_latency = min(latencies) if latencies else 0
        max_latency = max(latencies) if latencies else 0

        results.append({
            "model": model,
            "total_prompts": len(BENCHMARK_PROMPTS),
            "valid_count": valid_count,
            "validity_pct": validity_pct,
            "avg_latency_ms": int(avg_latency),
            "min_latency_ms": min_latency,
            "max_latency_ms": max_latency,
            "details": model_results,
        })
        print()

    # Generate Markdown Report
    md_content = "# Gemini Model Benchmark Report\n\n"
    md_content += f"**Timestamp**: {time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())}\n\n"
    md_content += "## Summary Table\n\n"
    md_content += "| Model | Prompts | Valid JSON | Validity Rate (%) | Avg Latency (ms) | Min Latency (ms) | Max Latency (ms) |\n"
    md_content += "|---|---|---|---|---|---|---|\n"

    for r in results:
        md_content += f"| `{r['model']}` | {r['total_prompts']} | {r['valid_count']} | {r['validity_pct']:.1f}% | {r['avg_latency_ms']} ms | {r['min_latency_ms']} ms | {r['max_latency_ms']} ms |\n"

    md_content += "\n## Prompt-by-Prompt Breakdown\n\n"
    for r in results:
        md_content += f"### Model: `{r['model']}`\n\n"
        md_content += "| Prompt | Status | Latency (ms) | Attempts | Repaired? |\n"
        md_content += "|---|---|---|---|---|\n"
        for d in r["details"]:
            md_content += f"| {d['prompt_name']} | {d['status']} | {d['latency_ms']} | {d['attempts']} | {d['repaired']} |\n"
        md_content += "\n"

    out_file = Path(__file__).resolve().parent.parent / "docs" / "model_benchmark.md"
    out_file.write_text(md_content, encoding="utf-8")
    print(f"Benchmark results saved to: {out_file}\n")
    return results


if __name__ == "__main__":
    run_benchmark()
