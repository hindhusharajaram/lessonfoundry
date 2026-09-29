# Defensibility

## The Moat Is the Pipeline, Not Any Single Stage

No individual component of LessonFoundry is indefensible in isolation. Grounded generation, dual-model verification, deterministic guardrails, and approval workflows all exist as independent concepts. A well-funded competitor could implement any one of them in a few weeks.

The defensibility lies in the fact that these are not independent features — they are **sequential dependencies in a single pipeline**:

1. **Planner** evaluates whether the source text actually supports each objective. Unsupported objectives are refused before generation begins.
2. **Evidence-Locked Generator** produces content where every claim carries a verbatim source quote, verified by a non-LLM substring matcher.
3. **Independent Solver** answers each assessment item blindly — without seeing the answer key — and its supporting quote is independently verified.
4. **Deterministic Guardrails** run ten algorithmic checks (duplicates, answer leakage, Bloom's misalignment, coverage gaps) without any LLM involvement.
5. **Approval Gate** blocks student access until a teacher explicitly approves, enforced server-side.
6. **Immutable Versioning** preserves every version with parent lineage, model metadata, and source hash — approved assets are never overwritten.

Each stage consumes the output of the previous one. The solver needs verified claims to cross-check against. The guardrails need structured slot data from the generator. The approval gate needs guardrail flags to surface. The version history needs the approval state to lock.

To replicate this, a competitor cannot simply add "source grounding" to their existing tool. They would need to redesign their data model to support claim-level provenance, build a separate verification path that doesn't use the same model, implement guardrails that operate on structured pedagogical schemas rather than raw text, and retrofit an approval workflow that integrates with all of the above. That is an architectural decision, not a feature toggle.

We are not claiming this pipeline is impossible to build. We are claiming it is **expensive to retrofit** into a product that was designed around direct LLM-to-user output. The integration cost is the moat.
