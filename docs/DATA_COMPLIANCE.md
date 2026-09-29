# Data Compliance — DPDP Act Alignment

> **Disclaimer:** This document describes how LessonFoundry's existing architecture aligns with principles of India's Digital Personal Data Protection (DPDP) Act, 2023, particularly its provisions for child data. **This is an engineering assessment, not a legal compliance certification.** A formal DPDP compliance audit by qualified legal counsel is required before any production deployment handling real student data.

---

## What the DPDP Act Requires for Child Data

The DPDP Act classifies all individuals under 18 as children and imposes stricter obligations on Data Fiduciaries processing their data, including verifiable parental consent, purpose limitation, and a prohibition on tracking or behavioural monitoring that could cause harm. Educational institutions processing student data must demonstrate accountability and maintain records of processing activities.

## What Is Already Implemented

The following features exist in the current codebase and are directly relevant to child-data handling:

### 1. Synthetic vs. Real Student Separation

The [`Student`](file:///c:/Edu%20Gen%20AI/Edu%20Gen%20AI/db/models.py#L308-L318) model includes a `synthetic` boolean column (`default=False, nullable=False`). Demo and seeded students are explicitly marked `synthetic=True` at creation time — see [`routes_student.py` line 151](file:///c:/Edu%20Gen%20AI/Edu%20Gen%20AI/api/routes_student.py#L151) where auto-created demo students are flagged `synthetic=True`. This provides a schema-level mechanism to distinguish test data from real child data, enabling selective purging, export exclusion, or consent-status filtering without ambiguity.

### 2. Decision Audit Trail

The [`DecisionLog`](file:///c:/Edu%20Gen%20AI/Edu%20Gen%20AI/db/models.py#L289-L305) table records every significant action — content approval, flag resolution, regeneration, publication — with `action`, `actor`, `detail` (JSON), and a UTC `created_at` timestamp. This provides a tamper-evident record of who approved what content and when, which is relevant to the DPDP Act's accountability principle. The log is append-only in practice: entries are never updated or deleted during normal operation.

### 3. Server-Side Answer Key Redaction

Student-facing endpoints enforce data minimisation at the API layer, not the UI. In [`routes_student.py` lines 110–117](file:///c:/Edu%20Gen%20AI/Edu%20Gen%20AI/api/routes_student.py#L110-L117), assessment content served to students is reconstructed to include **only** `question`, `options`, `bloom`, and `difficulty`. The fields `correct_index`, `rationale`, and `quote` are never sent to students before submission. Post-submission results respect the unit's `answer_visibility` setting — when set to `teacher_only`, answer keys, rationales, and source quotes are returned as `None` even after grading ([lines 229–249](file:///c:/Edu%20Gen%20AI/Edu%20Gen%20AI/api/routes_student.py#L229-L249)).

### 4. Cascade Deletion

All student-related tables (`QuizAttempt`, `AttemptAnswer`) are configured with `ondelete="CASCADE"` on their foreign keys. Deleting a `Student` record removes all associated attempts and answers, supporting the right to erasure without orphaned data.

### 5. No External Data Transmission of Student Records

Student responses are graded server-side against locally stored answer keys. No student names, responses, or scores are sent to the Gemini API or any external service. The LLM interaction is limited to content generation and solver verification, both of which operate on curriculum source text, not student data.

## What Is Not Yet Implemented

| Gap | Requirement | Status |
| :--- | :--- | :--- |
| **Parental consent mechanism** | DPDP Act requires verifiable parental consent before processing child data | Not implemented |
| **Data retention policy** | Automated purging of student data after a defined retention period | Not implemented |
| **Consent withdrawal flow** | API endpoint for a parent/guardian to revoke consent and trigger data deletion | Not implemented |
| **Data Processing Impact Assessment** | Formal DPIA document for child data processing | Not prepared |
| **Data Protection Officer** | Appointment of DPO if processing volume exceeds threshold | Organisational decision |
| **Real authentication** | Current header-based auth cannot verify parental identity | Demo-only auth in place |

---

*This document reflects the state of the codebase as of September 2026. It should be updated as compliance features are added and reviewed by legal counsel before any deployment processing real student data.*
