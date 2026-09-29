# LessonFoundry 🎓

**Evidence-Locked Curriculum Studio & Student Assessment Platform**

[![Python 3.12](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green.svg)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19.0-cyan.svg)](https://react.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-v4-blueviolet.svg)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Pytest-32%20Passed-brightgreen.svg)]()
[![Benchmark](https://img.shields.io/badge/Evaluation-9%2F9%20Passed%20(100%25)-success.svg)]()

---

## 1. Problem Statement

Teachers spend **10+ hours per week** creating lesson materials, assessments, and differentiated practice. While generic LLM chatbots can generate text quickly, they are **fundamentally unsafe for education**:
1. **Hallucination & Fabricated Citations**: Models invent plausible-sounding facts, fake formulas, and phantom quotes.
2. **Pedagogical Drift**: Questions fail to target specific learning objectives or collapse into low-level rote memorization.
3. **Flawed Answer Keys**: Models generate multiple-choice questions with incorrect or ambiguous answer keys.
4. **Zero Version Control**: Regenerating one question destroys the teacher's edits across the entire pack.
5. **No Evidence Chain**: Students and educators have no way to verify whether generated content directly matches their approved textbook.

---

## 2. The Solution: LessonFoundry

LessonFoundry is an **evidence-locked, pedagogical curriculum studio**:
- **Zero-Trust Non-LLM Verifier**: Every sentence, step, and question requires a verbatim source quote verified by an embedding-free, non-LLM substring matcher ($\ge 0.90$ threshold). Fabricated quotes are instantly blocked.
- **Blinded Independent Solver**: A separate model invocation solves every assessment item with **only the question, choices, and source chunks** (blinded to the answer key and rationale). Discrepancies trigger an error flag.
- **10 Deterministic Guardrails & Pack Health Score (0–100)**: Detects near-duplicates, answer leakage, vocabulary drift, and Bloom's taxonomy misalignment.
- **Immutable Provenance & Versioning**: Approved assets are locked and 100% byte-identical during partial regenerations with clear `parent_version_id` lineage.
- **Student Assessment Portal**: Students take quizzes with server-side grading, stripped keys, and automatic weak-objective reinforcement practice.
- **Accessibility by Design**: Includes Atkinson Hyperlegible typography for dyslexia, high-contrast modes, and adjustable text scaling.

> **Note:** Strictly no flashcard toys. LessonFoundry produces structured, high-rigor pedagogical artifacts (Explanations, Worked Examples, Multi-Tier Quizzes, Tiered Practice, and Revision Summaries).

---

## 3. Evaluation Benchmark Headline Numbers

*Results from the automated evaluation harness (`python -m eval.run` with Gemini 2.5 Flash):*

- **Overall Benchmark Score:** **9 / 9 Cases Passed (100%)**
- **Evidence-Locked Grounding Rate:** **100.0%** (Verified against indexed source chunks)
- **Blinded Dual-Solver Agreement:** **100.0%**
- **Prompt Injection Containment:** **100%** (2/2 injection patterns flagged and neutralized)
- **Approved Asset Mutation Rate:** **0.0%** (Approved assets remain 100% byte-identical during partial regeneration)
- **Orphan Item Rate:** **0%** (Every item is strictly mapped to an approved objective)

---

## 4. Project Structure

```
Edu Gen AI/
├── api/                   # FastAPI backend services
│   ├── main.py            # API entrypoint, CORS, exception handlers
│   ├── routes_sources.py  # Source ingestion, PDF parser, sentence chunker
│   ├── routes_units.py    # Unit planning, generation, pack health, analytics
│   ├── routes_assets.py   # Version history, approval, flag resolution
│   └── routes_student.py  # Redacted student delivery, grading, attempts
├── db/                    # Relational persistence layer
│   ├── database.py        # SQLAlchemy engine & session factory
│   └── models.py          # Relational models (Source, Unit, Slot, AssetVersion, Claim, etc.)
├── engine/                # Core AI & verification engines
│   ├── model.py           # Gemini 2.5 Flash caller with schema validation & fallback
│   ├── verifier.py        # Non-LLM exact & fuzzy substring verifier
│   ├── solver.py          # Blinded dual-solver verification engine
│   ├── guardrails.py      # 10 deterministic guardrails & Pack Health algorithm
│   ├── planner.py         # Objective gap detector & blueprint planner
│   ├── generator.py       # Pydantic-structured pedagogical pack generator
│   ├── impact.py          # Downstream change impact analyzer
│   ├── bloom.py           # Bloom's taxonomy cognitive mapper
│   └── injection.py       # Prompt injection regex scanner
├── eval/                  # Formal evaluation suite
│   ├── run.py             # 9-case evaluation runner
│   ├── results.md         # Formatted benchmark evaluation table
│   └── results.json       # Machine-readable evaluation results
├── data/                  # SQLite storage & sample textbooks
├── docs/                  # Documentation
│   ├── SPEC.md            # Complete product and architecture specification
│   ├── PROGRESS.md        # Detailed prompt implementation changelog
│   ├── architecture.md    # Mermaid system architecture & workflow diagrams
│   ├── model_choice.md    # Gemini 2.5 Flash benchmark analysis
│   ├── limitations.md     # Honest known failure modes & tradeoffs
│   └── DEMO_SCRIPT.md     # Step-by-step judge demonstration guide & Q&A
├── scripts/               # Utility and reset scripts
│   ├── demo_reset.ps1     # Windows clean-state demo reset
│   └── demo_reset.sh      # Linux/macOS clean-state demo reset
├── tests/                 # Comprehensive pytest suite (32 tests)
└── web/                   # React 19 + TypeScript + Vite + Tailwind frontend
    ├── src/
    │   ├── pages/         # Teacher Studio, Review, Analytics, Student Portal
    │   ├── components/    # Navigation, Accessibility Toolbar, Consistency Graph
    │   └── services/      # Axios API client with role-switching headers
    └── package.json
```

---

## 5. Quickstart & Setup Guide

### Prerequisites
- Python 3.10+ (Recommended: Python 3.12)
- Node.js 18+ & npm
- Google Gemini API Key ([Get one free at Google AI Studio](https://aistudio.google.com/))

### Step 1: Clone and Configure Environment

```bash
# Clone the repository
git clone https://github.com/your-repo/lessonfoundry.git
cd lessonfoundry

# Copy environment template
cp .env.example .env
```

Edit `.env` to provide your Gemini API key:
```ini
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_MODEL_FALLBACK=gemini-1.5-flash
DATABASE_URL=sqlite:///data/lessonfoundry.db
```

### Step 2: Install Backend Dependencies

**On Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**On macOS / Linux (Bash):**
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step 3: Install Frontend Dependencies

```bash
cd web
npm install
cd ..
```

---

## 6. How to Run

### Option A: One-Command Clean Demo Reset (Recommended)

**On Windows:**
```powershell
.\scripts\demo_reset.ps1
```

**On macOS / Linux:**
```bash
chmod +x ./scripts/demo_reset.sh
./scripts/demo_reset.sh
```

### Option B: Manual Server Startup

**Terminal 1 (Backend API):**
```bash
# From project root with venv activated
uvicorn api.main:app --reload --port 8000
```
*API will run at `http://localhost:8000` (Docs: `http://localhost:8000/docs`).*

**Terminal 2 (Frontend Web Client):**
```bash
cd web
npm run dev
```
*Web client will run at `http://localhost:5173`.*

---

## 7. Running the Automated Evaluation & Tests

```bash
# 1. Run the 9-case formal evaluation harness
python -m eval.run

# 2. Run the full pytest suite
pytest -v
```

---

## 8. What Was Built During the Hackathon vs. Reused

| Component | Built During Hackathon | Reused / Standard Libraries |
| :--- | :--- | :--- |
| **Evidence-Locked Engine** | **100% Custom** (`engine/verifier.py`, `engine/solver.py`) | RapidFuzz (fuzzy matching library) |
| **Deterministic Guardrails** | **100% Custom** (10 guardrail algorithms + pack health score) | Standard regex / Python builtins |
| **Database Architecture** | **100% Custom** (Relational models with SQLite WAL) | SQLAlchemy ORM |
| **API Services** | **100% Custom** (25+ endpoints for sources, units, assets, student) | FastAPI & Pydantic |
| **Frontend Application** | **100% Custom** (5-step wizard, review drawer, student quiz, dyslexia mode) | Lucide React (icons), Recharts (charts) |
| **Evaluation Harness** | **100% Custom** (`eval/run.py` 9-case benchmark) | Pytest |
