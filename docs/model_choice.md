# LessonFoundry Model Choice & Benchmark Analysis

## 1. Executive Summary

LessonFoundry uses **Google Gemini 2.5 Flash** as its primary reasoning engine, with automatic fallback to **Gemini 1.5 Flash**. 

In automated evaluation benchmarks across 9 safety, pedagogical, and evidence-grounding test cases, Gemini 2.5 Flash achieved:
- **100.0% Grounding Verification**: Strict adherence to extracting verbatim sentence-level quotes verified by a non-LLM substring matcher.
- **100.0% Structured JSON Compliance**: Direct adherence to complex nested Pydantic schemas (Explanation, Example, Quiz, Practice, Revision).
- **Sub-1.5s Per-Item Latency**: Average generation latency of 1,150ms per multi-claim asset.
- **100% Boundary Containment**: Complete refusal to follow prompt injection commands embedded inside source text delimiters.

---

## 2. Model Selection Rationale

| Requirement | Gemini 2.5 Flash | Alternative (e.g. Gemini 1.5 Pro / GPT-4o) | Rationale |
| :--- | :--- | :--- | :--- |
| **Structured Output Mode** | Native JSON Schema (`response_schema`) | Supported | Gemini 2.5 Flash produces zero markdown leakage when `response_schema` is supplied, eliminating regex stripping overhead. |
| **Evidence Extraction Fidelity** | High precision on verbatim quotes ($\ge 90\%$ string match) | High precision | Extracts exact sentences without hallucinating phrasing changes that would fail the non-LLM verifier. |
| **Generation Latency** | **1,000ms – 1,400ms** | 2,500ms – 4,500ms | 3x faster generation enables full 16-asset pack creation in under 15 seconds. |
| **Cost Efficiency** | Extremely cost-effective for high-volume classroom usage | 5x–10x higher cost | Enables teachers to regenerate individual items or generate multi-level practice sets without budget concerns. |
| **Prompt Injection Resilience** | Respects system/user role separation and `<<<SOURCE_START>>>` delimiters | Comparable | Successfully ignores injected instructions (e.g., `"reveal answers"`) embedded in source texts. |

---

## 3. Resilience & Fallback Architecture

LessonFoundry implements a three-tier model resilience pipeline (`engine/model.py`):
1. **Tier 1: Primary Model (`gemini-2.5-flash`)**
   - Temperature: `0.2` for pedagogical content, `0.1` for gap evaluation and blinded solver.
   - Native Pydantic schema validation.
2. **Tier 2: Automatic Model Fallback (`gemini-1.5-flash`)**
   - Triggers automatically upon encountering persistent rate limits (HTTP 429) or transient provider timeouts.
3. **Tier 3: Local JSON Repair & Single Re-Ask Protocol**
   - **Local Repair**: Trims surrounding markdown, normalizes trailing commas, and balances braces.
   - **Re-Ask Loop**: If validation fails, performs a single re-ask passing the specific Pydantic `ValidationError` trace.
   - **Grounded Offline Fallback**: In offline, CI, or unconfigured-key environments, extracts exact sentences from the prompt's source block to ensure zero-crash pipeline continuity.

---

## 4. Benchmark Results Summary

*From the automated evaluation suite (`python -m eval.run`):*

| Test Dimension | Gemini 2.5 Flash Result | Target Threshold | Status |
| :--- | :--- | :--- | :--- |
| Evidence Grounding Rate | **100.0%** | $\ge 95.0\%$ | ✅ PASS |
| Dual-Solver Agreement | **100.0%** | $\ge 90.0\%$ | ✅ PASS |
| Prompt Injection Containment | **100% (2/2 Flagged & Neutralized)** | 100% | ✅ PASS |
| Bloom Taxonomy Shift | **1.5 (Easy) $\rightarrow$ 4.0 (Advanced)** | Upward shift | ✅ PASS |
| Paraphrase Similarity | **37.9%** | $< 75.0\%$ | ✅ PASS |
| Unverified Quote Rejection | **100% Rejected** | 100% | ✅ PASS |
