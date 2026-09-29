# LessonFoundry Known Limitations & Engineering Tradeoffs

LessonFoundry is built on strict pedagogical and architectural principles. To maintain transparent engineering standards, this document outlines the current system limitations, assumptions, and known edge cases.

---

## 1. Same-Model Family Dual Solver Limitation

### Description
The Blinded Independent Solver (`engine/solver.py`) solves quiz and practice questions without seeing the answer key, rationale, or original quotes. However, both the content generator and the solver currently use the **Gemini model family** (Gemini 2.5 Flash / Gemini 1.5 Flash).

### Implication
While blinding the solver eliminates **confirmation bias** (the model justifying an answer key because it generated it), it **reduces but does not completely eliminate correlated systemic reasoning biases**. If the entire Gemini model family shares a specific interpretation blind spot on a nuanced scientific passage, both the generator and the solver could theoretically agree on an imperfect distractor.

### Planned Mitigation
Support multi-provider solver verification (e.g., cross-validating Gemini-generated items against Claude or open-weight models via Ollama/vLLM) to achieve true cross-architecture consensus.

---

## 2. Student Analytics & Demonstration Seeding

### Description
The Teacher Student Analytics page (`/analytics`) displays student mastery distributions, per-question correctness, and automatic learning gap detectors. 

### Implication
In a fresh hackathon demo environment where a live classroom of 30 students has not yet submitted real quizzes, the system provides simulated cohort data to demonstrate how the learning gap detector flags weak objectives and triggers single-objective reinforcement generation. When real students submit via `/api/student/attempts`, real attempts take precedence.

---

## 3. Demo-Only Role-Based Authentication

### Description
Authentication in LessonFoundry is intentionally lightweight for streamlined judge evaluation. Roles (`teacher` vs `student`) and `student_id` are toggled via the UI header and transmitted via `X-Role` and `X-Student-Id` HTTP headers.

### Implication
- There is no password hashing, JWT session expiry, or OAuth2/SAML integration.
- This design allows judges and testers to switch between the Teacher Studio and Student Assessment views in one click without managing credentials.
- **Production Requirement**: A production deployment requires enterprise SSO (e.g., Google Workspace for Education / Canvas LMS LTI 1.3).

---

## 4. PDF Layout & Multi-Column OCR Limitations

### Description
Source document ingestion uses `pymupdf` (PyMuPDF) to extract clean UTF-8 text and track page numbers.

### Implication
- **Well-Formatted Textbooks & Articles**: Performs flawlessly with exact sentence-boundary offsets.
- **Scanned Hand-Drawn Images / Low-DPI Scans**: Does not run an embedded OCR engine (e.g. Tesseract). Scanned image-only PDFs must be pre-processed or OCR'd prior to upload.
- **Complex Multi-Column Tables**: Extreme multi-column sidebars may interleave sentences, occasionally lowering the non-LLM verifier's fuzzy score below the 0.90 threshold.

---

## 5. Cognitive Demand (Bloom's Taxonomy) Nuance

### Description
LessonFoundry maps learning objectives and questions to Bloom's Revised Taxonomy (*Remember, Understand, Apply, Analyze, Evaluate, Create*) using curated verb lexicons and structural prompt guidance.

### Implication
Bloom's Taxonomy is context-dependent: a question requiring "Analyze" for a Grade 6 student might only require "Remember" for an undergraduate biology major. While LessonFoundry enforces relative cognitive progression (Foundation $\rightarrow$ Advanced), teachers should always review the pedagogical tags during Step 4.
