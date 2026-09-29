# Product Roadmap

## Horizon 1 — 0 to 6 Months

**Goal:** Prove the product works in real classrooms and close the gaps that pilot schools will hit immediately.

### Pilot Deployments (1–2 Schools)

Deploy LessonFoundry with a small cohort of teachers covering a specific subject and grade band (e.g., Class 6–8 Science). Collect structured feedback on the generation pipeline, approval workflow usability, and student quiz experience. Measure teacher preparation time saved and Pack Health scores achieved in practice. Publish findings as a case study for institutional sales.

### Regional Language Support

The data model already carries a `language` field on every Unit (`default="English"`), and the `AssetVersion.variant` column supports `standard | simplified` variants with a dedicated simplify endpoint (`POST /assets/{id}/simplify`). Extending this to regional languages means adding a translation variant type (e.g., `variant="hindi"` or `variant="tamil"`) that takes an approved English asset version as its base, generates a translated version through the same structured JSON schema, and re-verifies glossary term consistency. The variant architecture and parent-version lineage already exist — the work is in prompt engineering for accurate curriculum-domain translation and validating that the verifier's fuzzy matching handles transliterated technical terms.

### Offline-First Mode for Low-Bandwidth Schools

The existing export endpoint (`GET /units/{id}/export`) already generates a self-contained HTML document with all approved content embedded. Extending this to a full offline-first mode means packaging the published student quiz experience as a static bundle (HTML + embedded JSON) that can be distributed via USB or local network, with answers synced back to the server when connectivity is available. The `Publication` snapshot model already stores an immutable JSON snapshot of approved asset versions, which provides the data layer for offline delivery. No AI generation happens offline — only consumption and submission.

---

## Horizon 2 — 6 to 18 Months

**Goal:** Scale from individual school pilots to institutional and state-level adoption.

### State Education Board Partnership

Use pilot evidence (case studies, measured outcomes, Pack Health data) to pursue a partnership with one state education board for curriculum-aligned content generation at scale. This requires mapping LessonFoundry's objective and slot structure to the board's official syllabus framework and potentially integrating with state examination patterns. The blueprint planner's configurable `quiz_count`, `difficulty`, and `constraints` JSON fields were designed to accommodate this kind of curriculum customisation without schema changes.

### LMS and DIKSHA Integration

Explore integration with DIKSHA (India's national education platform) and common LMS platforms used by schools (Google Classroom, Canvas). The existing REST API and structured JSON export provide a clean integration surface. The work is in mapping LessonFoundry's slot types and content schemas to DIKSHA's content model (QML for questions, ECML for explanations) and implementing OAuth-based SSO to replace the current header-based demo auth.

### DPDP Act Compliance Certification

Build on the existing architectural foundations documented in [DATA_COMPLIANCE.md](file:///c:/Edu%20Gen%20AI/Edu%20Gen%20AI/docs/DATA_COMPLIANCE.md) — the `Student.synthetic` flag, `DecisionLog` audit trail, server-side answer key redaction, and cascade deletion. Implement the gaps identified there: verifiable parental consent mechanism, automated data retention and purging policies, consent withdrawal API, and a formal Data Processing Impact Assessment. Engage legal counsel to pursue certification before any state-level deployment handling real student data.
