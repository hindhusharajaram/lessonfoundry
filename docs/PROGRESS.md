# LessonFoundry Development Progress

## Step Status Tracker

- [x] **STEP A**: Created [`docs/SPEC.md`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/docs/SPEC.md) containing the exact source of truth specification.
- [x] **STEP B**: Created repository layout:
  - `api/` (`main.py`, `deps.py`, `routes_sources.py`, `routes_units.py`, `routes_assets.py`, `routes_student.py`)
  - `engine/` (`model.py`, `planner.py`, `generator.py`, `verifier.py`, `solver.py`, `guardrails.py`, `impact.py`, `injection.py`, `bloom.py`)
  - `db/` (`database.py`, `models.py`, `seed.py`)
  - `eval/`, `tests/`, `data/`, `docs/`, `web/`, `scripts/`
  - `.gitignore`, `requirements.txt`, `.env.example`, `README.md`, `docs/PROGRESS.md`, `docs/HEALTH_SCORE.md`
- [x] **STEP C**: Implemented:
  - [`db/models.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/db/models.py) (SQLAlchemy 2.0 with all 16 tables and constraints)
  - [`db/database.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/db/database.py) (SQLite Foreign Key PRAGMA and session generator)
  - [`scripts/reset_db.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/scripts/reset_db.py) (Drops & creates all tables)
  - FastAPI app skeleton in [`api/main.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/api/main.py) with `/api/health` and role-based header dependencies in [`api/deps.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/api/deps.py).
- [x] **STEP D**: Verified Foundation:
  - Python virtual environment created and all dependencies installed.
  - Database schema initialized via `scripts/reset_db.py`.
  - Comprehensive schema tests created in [`tests/test_schema.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/tests/test_schema.py) and API tests in [`tests/test_api_health.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/tests/test_api_health.py).
  - Pytest suite executed: **6 passed, 0 failed**.
  - Git repository initialized and foundation committed.

---

### Phase 1: Source Ingestion & Gemini Wrapper
- [x] **TASK 1 - Source Ingestion**:
  - Implemented [`api/routes_sources.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/api/routes_sources.py) supporting PDF (PyMuPDF) and TXT / pasted text with whitespace normalization.
  - Implemented SHA256 versioning and immutability (same source with new text creates `version_no + 1`, identical hash reuses version).
  - Implemented sentence chunking (~600-900 chars) with exact offsets (`SourceVersion.text[char_start:char_end] == chunk.text`).
  - Implemented instruction override & prompt injection scanner in [`engine/injection.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/engine/injection.py) preserving full source text.
  - Implemented `GET /api/sources/{id}/versions` with hash, chunk, and injection flag counts.
- [x] **TASK 2 - Gemini Wrapper**:
  - Implemented [`engine/model.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/engine/model.py) using `google-genai` SDK with structured output (`response_schema`), exponential backoff on 429/5xx, and fallback to `GEMINI_MODEL_FALLBACK`.
  - Implemented local JSON repair and re-ask flow with typed `ModelError` / `ModelJSONValidationError`.
  - Implemented call logger to `data/model_calls.jsonl` (never logs API keys).
  - Implemented `build_source_block(chunks)` with untrusted data boundary delimiters.
- [x] **TASK 3 - Benchmark Script**:
  - Implemented [`scripts/benchmark_model.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/scripts/benchmark_model.py) and generated [`docs/model_benchmark.md`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/docs/model_benchmark.md).
- [x] **TASK 4 - Test Suite**:
  - Created [`tests/test_ingest.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/tests/test_ingest.py), [`tests/test_json_repair.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/tests/test_json_repair.py), and [`tests/test_live_smoke.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/tests/test_live_smoke.py).

---

### Phase 2: Units, Planner, Verifier & Evidence-Locked Generator
- [x] **TASK 1 - Units & Objectives API**:
  - Implemented `POST /api/units` (pins latest `SourceVersion`, sets grade, difficulty, constraints).
  - Implemented `GET /api/units` and `GET /api/units/{id}`.
  - Implemented `PUT /api/units/{id}/objectives` requiring at least 2 objectives with `bloom_target`.
- [x] **TASK 2 - Non-LLM Verifier & Planner Engine**:
  - Implemented [`engine/verifier.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/engine/verifier.py) with exact substring matching and fuzzy string matching (threshold $\ge 0.90$) with precise character start/end offsets.
  - Implemented [`engine/planner.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/engine/planner.py) with TF-IDF keyword chunk scoring, AI gap detection with mandatory evidence quote verification, and strict refusal of unsupported objectives (`Objective.supported = False`, `QualityFlag(code="objective_unsupported")`, 0 slots created for unsupported objectives).
  - Implemented blueprint slot distribution balancing core items (explanation, example, revision) and quiz/practice items across supported objectives without orphan slots.
- [x] **TASK 3 - Bloom Taxonomy & Evidence-Locked Generator**:
  - Implemented [`engine/bloom.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/engine/bloom.py) mapping cognitive demand (easy $\rightarrow$ Remember/Understand, medium $\rightarrow$ Apply, advanced $\rightarrow$ Analyze/Evaluate).
  - Implemented [`engine/generator.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/engine/generator.py) generating structured slot content in pedagogical order (explanation $\rightarrow$ example $\rightarrow$ quiz/practice $\rightarrow$ revision) with verbatim quotes on every sentence/step/question/key point.
  - Extracted and verified claims post-generation, recording `Claim` rows, storing full provenance in `AssetVersion`, setting `status="draft"` or `"needs_revision"` on unverified quotes, and `"generation_failed"` on model errors without corrupting other assets.
  - Implemented resume generation capability.
  - Implemented `GET /api/units/{id}/pack` returning structured learning packs grouped by objective with verification ratios and quality flags.

---

### Phase 3: Independent Solver, Guardrails, Approval Gate, Impact Engine & Publishing
- [x] **TASK 1 - Independent Solver**:
  - Implemented [`engine/solver.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/engine/solver.py) that solves questions blinded to answer keys, rationales, and original quotes using ONLY source text.
  - Quote verification of solver's supporting evidence and comparison to answer key; flags `answer_key_mismatch` (severity: error). Documented model family limitation.
- [x] **TASK 2 - Guardrails Engine & Pack Health Diagnostics**:
  - Implemented [`engine/guardrails.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/engine/guardrails.py) with 10 deterministic & semantic quality checks: duplicate questions (Jaccard + RapidFuzz), answer leakage, unsupported claims, objective coverage imbalance, missing coverage, malformed keys, difficulty mismatch, unsupported revision terms, terminology drift, and injection-flagged sources.
  - Created [`docs/HEALTH_SCORE.md`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/docs/HEALTH_SCORE.md) defining the composite 0-100 Pack Health score formula.
  - Implemented `GET /api/units/{id}/health` returning full pack health diagnostics. Automated execution after generation and regeneration.
- [x] **TASK 3 - Approval Gate, Versioning & Simplification**:
  - Implemented `POST /api/assets/{id}/status` in [`api/routes_assets.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/api/routes_assets.py): blocking approval (HTTP 409) if error flags or unverified claims exist, requiring explicit `override=True` with logged reasons in `DecisionLog`, and locking approved assets (`locked=True`).
  - Implemented `POST /api/assets/{id}/regenerate`: refusing on locked/approved assets, creating new `AssetVersion` records with `parent_version_id`, recording `Feedback`, and preserving other assets.
  - Implemented `GET /api/assets/{id}/versions` with provenance and field-level diffs.
  - Implemented `POST /api/assets/{id}/simplify` for lower reading-level variant generation with glossary term and quote preservation.
- [x] **TASK 5 - Change Impact Engine**:
  - Implemented [`engine/impact.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/engine/impact.py) and endpoints `GET /api/units/{id}/impact` and `POST /api/units/{id}/regenerate-affected`. Safely regenerates affected unapproved assets and preserves approved assets as stale items.
- [x] **TASK 6 - Publish & Export & Student Boundary**:
  - Implemented `POST /api/units/{id}/publish` snapshotting approved asset versions to `Publication`.
  - Implemented `GET /api/units/{id}/export` returning clean JSON and standalone print-friendly HTML.
  - Implemented [`api/routes_student.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/api/routes_student.py) enforcing approved-only visibility, stripping answer keys before submission, and grading attempts post-submission.
- [x] **TASK 7 - Advanced Feature Tests & Demo**:
  - Created [`tests/test_advanced_features.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/tests/test_advanced_features.py) with 6 comprehensive end-to-end unit tests.
  - Updated [`scripts/demo_generate.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/scripts/demo_generate.py) running full pipeline from ingestion to publication, grading, and impact analysis.
  - Total Pytest suite: **31 passed, 1 skipped in 5.04s**.

---

### Phase 4: Frontend Studio (`/web`)
- [x] **App Shell & Theme**:
  - Initialized React + Vite + TypeScript + Tailwind CSS in `/web`.
  - Configured design tokens in [`web/src/index.css`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/web/src/index.css) (Inter font, Dark Navy `#0B1437` sidebar, Primary Indigo `#4F46E5`, Page `#F5F7FB`, Card radius `14px`, soft shadows, accessible focus rings).
  - Implemented `RoleContext` supporting teacher and student mode switching via `localStorage` and attaching `X-Role` / `X-Student-Id` headers.
  - Implemented responsive sidebar navigation for Teacher (Home, Create Learning Unit, My Units, Student Analytics, Settings) and Student (My Learning, My Progress, Notes, Settings).
  - Configured Vite reverse proxy to FastAPI backend (`http://127.0.0.1:8000/api`). Zero secrets in frontend.
- [x] **Shared Component Library**:
  - `Card`, `Button`, `StatusPill`, `Badge` (Bloom levels), `Stepper` (5-step wizard indicator), `ProgressBar`, `ProgressRing` (0-100 score gauge), `ErrorBanner` (with retry & technical details), `Modal`, `EmptyState`, `LoadingState`.
  - Type-safe API client in [`web/src/services/api.ts`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/web/src/services/api.ts).
- [x] **Teacher Wizard ("Create New Learning Unit")**:
  - **Step 1 (Upload Source)**: Drag-and-drop / paste text with live character counter, calls `POST /api/sources/upload`, displays extracted stats, SHA256 hash preview, and injection scanner warning banner.
  - **Step 2 (Objectives & Plan)**: Add/edit/remove objectives (min 2), Bloom target select, grade, difficulty, language, answer visibility, and constraints. Runs gap detection with immediate visual refusal feedback on unsupported objectives.
  - **Step 3 (AI Generation)**: Live per-slot execution tracker (explanation, example, formative quiz, practice foundation/advanced, revision) with progress bar and Pack Health score ring preview.
  - **Step 4 (Quality Gate Review)** & **Step 5 (Publish & Export)**: Direct routing to pack review, approval override modal, and class publishing.
- [x] **Unit Pack Inspector & Student Flow**:
  - Full inspector in [`web/src/pages/teacher/UnitPackPage.tsx`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/web/src/pages/teacher/UnitPackPage.tsx) with inline quote highlights, independent solver verification, status approval / override gate, regeneration, and change impact modal.
  - Interactive Student Assessment in [`web/src/pages/student/StudentQuizPage.tsx`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/web/src/pages/student/StudentQuizPage.tsx) with stripped answer keys and post-submission verified feedback.
- [x] **Build & Verification**:
  - `npm.cmd --prefix web run build` succeeds cleanly (`dist/` bundle created).
  - All 31 backend unit tests pass.

---

### Phase 5: Deep Quality Gate, Consistency Graph, Evidence Split Panel & Governance
- [x] **AI Quality Checklist & Flags Drawer**:
  - Implemented [`web/src/components/unit/QualityChecklistCard.tsx`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/web/src/components/unit/QualityChecklistCard.tsx) mapping live health metrics to green/amber/red status across all 7 guardrails.
  - Implemented [`web/src/components/unit/QualityFlagsDrawer.tsx`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/web/src/components/unit/QualityFlagsDrawer.tsx) listing every flag, severity, target asset version, and suggested fix, with interactive "Resolve" and "Override with Reason" actions.
- [x] **Evidence Viewer Split Panel**:
  - Implemented [`web/src/components/unit/EvidenceViewerModal.tsx`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/web/src/components/unit/EvidenceViewerModal.tsx) highlighting exact character offsets (`char_start` to `char_end`) against the full ground truth source text.
- [x] **Differentiated Practice Side-by-Side**:
  - Implemented [`web/src/components/unit/PracticeComparisonView.tsx`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/web/src/components/unit/PracticeComparisonView.tsx) displaying Foundation Practice vs. Advanced Practice side-by-side with Bloom taxonomy badges.
- [x] **Learning Consistency Graph**:
  - Implemented [`web/src/components/unit/LearningConsistencyGraph.tsx`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/web/src/components/unit/LearningConsistencyGraph.tsx) rendering full DAG topology: Objectives &rarr; Explanation &rarr; Example &rarr; Quizzes &rarr; Practice &rarr; Revision.
- [x] **AI Responsibility & Governance Report**:
  - Implemented [`web/src/components/unit/AIResponsibilityReport.tsx`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/web/src/components/unit/AIResponsibilityReport.tsx) and backend endpoint `GET /api/units/{id}/audit` calculating live Grounding, Transparency, Safety, Limitations, Human Authority, and Data Isolation cards from real database tables and `DecisionLog`.
- [x] **Change Impact & Publishing Workflows**:
  - Implemented [`web/src/components/unit/ChangeImpactView.tsx`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/web/src/components/unit/ChangeImpactView.tsx) and [`web/src/components/unit/PublishUnitView.tsx`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/web/src/components/unit/PublishUnitView.tsx).
- [x] **Backend Extensions**:
  - Added `PUT /api/assets/{id}/bloom-tag` with audit logging in [`db/models.py:DecisionLog`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/db/models.py).
  - Added `POST /api/assets/flags/{flag_id}/resolve` with resolution tracking.
  - Added `GET /api/units/{id}/source-text` and `GET /api/units/{id}/audit`.
- [x] **Testing & Verification**:
  - Full production build `npm run build` succeeded cleanly in 735ms.
  - All 31 backend unit tests pass.


