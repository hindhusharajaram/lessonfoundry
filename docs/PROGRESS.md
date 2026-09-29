# LessonFoundry Development Progress

## Step Status Tracker

- [x] **STEP A**: Created [`docs/SPEC.md`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/docs/SPEC.md) containing the exact source of truth specification.
- [x] **STEP B**: Created repository layout:
  - `api/` (`main.py`, `deps.py`, `routes_sources.py`, `routes_units.py`, `routes_assets.py`, `routes_student.py`)
  - `engine/` (`model.py`, `planner.py`, `generator.py`, `verifier.py`, `solver.py`, `guardrails.py`, `impact.py`, `injection.py`)
  - `db/` (`database.py`, `models.py`, `seed.py`)
  - `eval/`, `tests/`, `data/`, `docs/`, `web/`, `scripts/`
  - `.gitignore`, `requirements.txt`, `.env.example`, `README.md`, `docs/PROGRESS.md`
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

### Phase 1 Tasks

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
  - Created [`tests/test_ingest.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/tests/test_ingest.py) (hash versioning, exact chunk slice reconstruction, injection flags).
  - Created [`tests/test_json_repair.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/tests/test_json_repair.py) (markdown fences, trailing commas, mocked repair and re-ask, typed errors).
  - Created [`tests/test_live_smoke.py`](file:///c:/Users/USER/OneDrive/Attachments/Edu%20Gen%20AI/tests/test_live_smoke.py) with `@pytest.mark.live`.
