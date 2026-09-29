# Competitive Positioning

## Landscape

| Competitor | Core Strength |
| :--- | :--- |
| **MagicSchool AI** | Broadest teacher tool suite — 60+ prompt-based generators covering lesson plans, rubrics, IEPs, and communication templates across every subject and grade. |
| **Diffit** | One-click reading-level adaptation — paste any article or topic and instantly receive leveled passages, vocabulary lists, and comprehension questions tuned to a specific Lexile band. |
| **Eduaide** | Structured pedagogical output — generates content explicitly tagged to Bloom's taxonomy and standards frameworks, with multiple export formats for LMS integration. |
| **NotebookLM** | Source-grounded conversation — users upload documents and receive AI responses that cite specific passages, reducing hallucination through retrieval-augmented generation over a personal corpus. |

## Where LessonFoundry Is Different

Every tool above solves a real problem. NotebookLM grounds responses in uploaded sources. Eduaide tags outputs to Bloom's levels. MagicSchool covers the widest surface area of teacher workflows. We don't claim to have invented grounded generation or taxonomy-aware prompting — those ideas exist independently across the market.

What doesn't exist elsewhere is a **single integrated trust pipeline** that chains five verification stages together so that every generated artifact must survive all of them before it reaches a student:

1. **Evidence-Locked Generation** — every sentence carries a verbatim source quote, verified by a non-LLM substring matcher (≥ 0.90 threshold), not by the same model that wrote it.
2. **Independent Solver Verification** — a separate, blinded model call answers each assessment item using only the source text, without seeing the answer key. Disagreements are flagged automatically.
3. **Deterministic Guardrail Checks** — ten algorithmic checks (duplicate detection, answer leakage, Bloom's misalignment, coverage gaps, prompt injection scanning) run without any LLM involvement.
4. **Teacher Approval Gating** — nothing reaches students until a teacher explicitly approves it. The server enforces this, not the UI.
5. **Immutable Version History** — approved assets are never overwritten. Regeneration creates a new version with a `parent_version_id` link. Every version records the model, prompt version, source hash, and verification outcome.

Other platforms offer one or two of these as standalone features. LessonFoundry is the first to make them **sequential prerequisites** — generation feeds verification, verification feeds guardrails, guardrails feed approval, and approval gates publication. Skip a stage and the asset cannot advance.

The result is a Pack Health Score (0–100) that teachers can read at a glance and auditors can trace back to specific source sentences. That auditable chain of custody, not any single feature in isolation, is the product.
