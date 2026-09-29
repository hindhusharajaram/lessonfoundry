# LessonFoundry Pack Health Score Formula

The **Pack Health Score** is a composite metric on a `0 - 100` scale that evaluates the factual integrity, pedagogical quality, and structural validity of an evidence-locked learning pack.

## Core Component Breakdown

$$\text{Raw Health Score} = 0.40 \times G + 0.25 \times S + 0.15 \times O + 0.10 \times B + 0.10 \times V$$

Where:

1. **Grounding Ratio ($G$) [40% weight]**:
   $$G = \left(\frac{\text{Verified Claims}}{\text{Total Claims}}\right) \times 100$$
   Every claim in explanations, examples, quiz questions, and revision summaries must match verbatim source text verified by the non-LLM verifier.

2. **Independent Solver Verification Rate ($S$) [25% weight]**:
   $$S = \left(\frac{\text{Solver Matched Questions}}{\text{Total Quiz \& Practice Questions}}\right) \times 100$$
   An independent, blinded model call attempts each question using only the source text. Mismatches highlight ambiguous questions or incorrect keys.

3. **Objective Coverage Balance ($O$) [15% weight]**:
   $$O = \max\left(0, 100 - \sum \text{Objective Imbalance Penalties}\right)$$
   Evaluates even distribution of instructional slots across all supported objectives without orphan objectives.

4. **Bloom / Cognitive Demand Alignment ($B$) [10% weight]**:
   $$B = \left(\frac{\text{Properly Scaled Bloom Slots}}{\text{Total Assessed Slots}}\right) \times 100$$
   Ensures foundation vs. advanced practice items differ in cognitive rank and meet target grade standards.

5. **Structural Validity ($V$) [10% weight]**:
   $$V = \max\left(0, 100 - 20 \times (\text{Duplicate Questions} + \text{Answer Leakages} + \text{Malformed Keys})\right)$$

## Quality Flag Deductions

Unresolved quality flags deduct directly from the composite score:
- **Error Flag**: $-10$ points per unresolved error (e.g., `answer_key_mismatch`, `malformed_key`, `unsupported_claim`)
- **Warning Flag**: $-3$ points per unresolved warning (e.g., `duplicate_question`, `answer_leakage`, `difficulty_mismatch`)
- **Info Flag**: $0$ points deduction (informational audit trail)

$$\text{Final Pack Health Score} = \text{clamp}\left(0, 100, \text{Raw Health Score} - \sum \text{Flag Penalties}\right)$$

## Quality Bands
- **90 – 100**: **Exemplary** (Fully grounded, dual-model validated, ready for one-click publishing)
- **75 – 89**: **Good** (Minor warnings or slight terminology drift, acceptable for classroom review)
- **50 – 74**: **Needs Revision** (Unverified claims, answer key mismatch, or structural errors)
- **< 50**: **Action Required** (Multiple severe errors; approval blocked)
