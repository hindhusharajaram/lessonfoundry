# LessonFoundry

LessonFoundry is a teacher-facing studio that turns one trusted source into a connected, evidence-locked learning pack.

## Core Pillars
1. **Evidence-Locked Generation**: Every claim and question is anchored to exact source text with non-LLM verification.
2. **Zero-Hallucination Boundaries**: Untrusted source data is isolated from instructions.
3. **Dual Model Validation**: Independent solver model validates quiz keys and practice questions.
4. **Pedagogical Integrity**: Aligned to Bloom's taxonomy with foundation & advanced scaffolds (no flashcards).
5. **Clear Separation of Roles**: Teacher studio workflow with strict student-visible published boundaries.

## Getting Started
### Setup Environment
```bash
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python scripts/reset_db.py
```

### Run Server
```bash
uvicorn api.main:app --reload --port 8000
```
