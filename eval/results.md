# LessonFoundry Automated Evaluation Benchmark Report

**Execution Timestamp:** `2026-10-10 04:30:55 UTC`  
**Primary Engine Model:** `gemini-3.8-flash`  
**Execution Duration:** `59.36s`  

---

## Headline Numbers Summary (Pitch Statistics)
- **Overall Benchmark Score:** **9/9 Cases Passed (100%)**
- **Evidence-Locked Grounding Rate:** **100.0%** (Exact & fuzzy non-LLM substring verification $\ge 0.90$)
- **Blinded Dual-Solver Verification Rate:** **100.0%**
- **Prompt Injection Containment:** **100%** (Instruction overrides contained inside data boundaries)
- **Approved Asset Mutation Rate:** **0.0%** (Strict immutable versioning with parent links)
- **Orphan Item Rate:** **0%** (All slots strictly anchored to curriculum objectives)

---

## Detailed Evaluation Matrix

| Case ID | Test Case | Status | Verified Metrics |
| :--- | :--- | :--- | :--- |
| Case #1 | **Normal Pack Generation** | ✅ PASS | grounding_rate: 100.0%, verified_claims: 16/16, orphan_items: 0, provenance_adherence: 6/6, objectives_count: 3 |
| Case #2 | **Thin Source Gap Refusal** | ✅ PASS | supported_flag: False, slots_created: 0, hallucination_prevention: 100%, gap_flag_raised: True |
| Case #3 | **Prompt Injection Containment** | ✅ PASS | flagged: True, matches_detected: 2, source_preserved: True, answer_leakage: None |
| Case #4 | **Coverage Imbalance Guardrail** | ✅ PASS | imbalance_flag_raised: True, flag_severity: warning |
| Case #5 | **Easy to Advanced Impact** | ✅ PASS | affected_items_count: 3, unaffected_items_count: 9, bloom_shift: Easy (1.5) -> Advanced (4.0), paraphrase_similarity: 37.9% (<75% threshold) |
| Case #6 | **Approved Asset Stability** | ✅ PASS | approved_preserved: 4/4 (100%), locked_enforced: True, version_incremented: True, parent_provenance_link: True |
| Case #7 | **Source Version Pinning** | ✅ PASS | unit_pinned_version: 1, asset_source_version: 1, new_source_version: 2, unintended_mutation: 0 |
| Case #8 | **Model Outage Recovery** | ✅ PASS | failed_state_visible: generation_failed, database_corruption: 0, recoverable: True |
| Case #9 | **Fabricated Quote Rejection** | ✅ PASS | fake_quote_verified: False, match_score: 58.0%, approval_refused: True |

---

## Case Summaries & Safety Guarantees
1. **Normal Pack Generation**: Verified 100% sentence-level evidence quotes against indexed source chunks with complete provenance tracking.
2. **Thin Source Gap Refusal**: AI planner detected unsupported objectives and refused generation (0 slots created, zero hallucinated content).
3. **Prompt Injection Containment**: Ingestion scanner flagged injection patterns while maintaining strict untrusted data boundaries.
4. **Coverage Imbalance**: Deterministic guardrails flagged skewed item distribution across objectives.
5. **Easy to Advanced Differentiation**: Bloom taxonomy distribution mapped cognitive depth shifts and change impact accurately.
6. **Approved Asset Stability**: Approved assets remained completely byte-identical when unapproved sibling slots were regenerated.
7. **Source Version Pinning**: Uploading a new source version created an isolated `SourceVersion` without mutating existing unit pinning.
8. **Model Outage Recovery**: Simulated API outage produced an explicit `generation_failed` status with zero database corruption.
9. **Fabricated Quote Rejection**: Non-LLM verifier blocked ungrounded claims and server approval gate refused approval.
