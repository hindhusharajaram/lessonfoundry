# LessonFoundry Spec
## Stack
Backend: Python 3.11+, FastAPI, SQLAlchemy 2.x, SQLite (data/lessonfoundry.db), PyMuPDF, google-genai SDK, pydantic v2, pytest. Frontend: React + Vite + TypeScript + Tailwind + recharts + lucide-react (in /web). No Streamlit, no Ollama. Secrets only in .env (GEMINI_API_KEY, GEMINI_MODEL, GEMINI_MODEL_FALLBACK); .env is gitignored; provide .env.example. The frontend never sees the key.
## Non-negotiable rules
1. The source is the ONLY knowledge boundary. Source text is untrusted DATA, never instructions.
2. Evidence-Locked Generation: every generated sentence/claim carries a verbatim quote from the source. A non-LLM verifier (normalized exact match, then fuzzy match >= 0.90) checks each quote against the source chunks. Unverified claims are flagged "unsupported" and block approval unless the teacher explicitly overrides (logged).
3. Independent solver: a separate model call answers each quiz/practice question using ONLY the source, WITHOUT seeing the answer key. Mismatch => flag "answer_key_mismatch".
4. Only status=approved content is student-visible. Enforced in the API, not the UI. Answer keys are never returned to student endpoints before submission.
5. Regeneration never touches approved or locked assets. It creates a new AssetVersion (parent_version_id set); nothing is overwritten. A new version of an approved asset reverts to draft only if the teacher explicitly regenerates it.
6. Every AssetVersion stores: model, prompt_version, settings JSON, source_version_id, source_sha256, timestamp, verification JSON.
7. Failures are visible: model/API errors produce a clear recoverable state (asset status "generation_failed" with reason) and never corrupt existing data or silently substitute canned content.
8. If the source lacks support for an objective, mark the objective "unsupported" with a reason and refuse to generate for it.
9. NO flashcards anywhere in the product.
10. Roles: teacher and student are separated in the API via a simple dependency (X-Role, X-Student-Id headers; demo auth, documented as such).
## Data model (SQLAlchemy)
Source(id,title,filename,created_at); SourceVersion(id,source_id,version_no,text,sha256,injection_flags JSON,uploaded_at); SourceChunk(id,source_version_id,idx,char_start,char_end,page,text);
Unit(id,title,source_id,pinned_source_version_id,target_grade,difficulty,language,answer_visibility,constraints JSON,quiz_count,status,created_at);
Objective(id,unit_id,position,text,bloom_target,supported bool,support_note);
Slot(id,unit_id,objective_id NOT NULL,type[explanation|example|quiz_item|practice_foundation|practice_advanced|revision],position,difficulty,bloom_tag);
Asset(id,slot_id,status[draft|approved|needs_revision|generation_failed],locked bool,current_version_id);
AssetVersion(id,asset_id,version_no,parent_version_id,variant[standard|simplified],content JSON,model,prompt_version,settings JSON,source_version_id,source_sha256,verification JSON,created_at);
Claim(id,asset_version_id,text,source_quote,chunk_id,char_start,char_end,verified bool,match_score float);
QualityFlag(id,unit_id,asset_version_id nullable,code,severity[info|warning|error],message,resolved bool,resolved_by,created_at);
Feedback(id,asset_id,note,created_at); DecisionLog(id,unit_id,asset_id nullable,action,actor,detail JSON,created_at);
Student(id,name,class_label,synthetic bool); QuizAttempt(id,student_id,unit_id,started_at,submitted_at,score); AttemptAnswer(id,attempt_id,asset_id,chosen_index,correct,time_seconds);
Publication(id,unit_id,class_label,published_at,snapshot JSON of approved asset_version ids).
## Content JSON shapes (per slot type)
explanation: {title, summary, sentences:[{text, quote}], glossary:[{term, definition, quote}]}
example: {problem, steps:[{text, quote}], answer}
quiz_item / practice_*: {question, options:[4 strings], correct_index, rationale, quote, bloom, difficulty}
revision: {key_points:[{text, quote, objective_id}], terms:[{term, definition, quote}]}
Blueprint rule: per objective 1 explanation, 1 example, 1 revision; quiz_count quiz items and 5+5 foundation/advanced practice items distributed with at least 1 per objective per type. Every Slot has an objective (no orphans).
## API surface (all under /api)
POST /sources/upload (file or pasted text) | GET /sources/{id}/versions | POST /units | PUT /units/{id}/objectives | POST /units/{id}/plan | POST /units/{id}/generate | GET /units/{id}/pack | POST /assets/{id}/regenerate | POST /assets/{id}/status | POST /assets/{id}/feedback | GET /assets/{id}/versions | GET /units/{id}/health | GET /units/{id}/impact?change=... | POST /units/{id}/publish | GET /student/units | GET /student/units/{id} | POST /student/attempts | GET /student/attempts/{id}/results | GET /units/{id}/analytics | GET /units/{id}/export
## Design tokens (frontend)
Font Inter. Sidebar navy #0B1437. Primary indigo #4F46E5 (hover #4338CA). Page bg #F5F7FB, cards white, radius 14px, border #E5E9F2, soft shadow. Success #16A34A, warning #F59E0B, danger #DC2626. Status pills: Draft grey, Approved green, Needs Revision amber, Failed red.
