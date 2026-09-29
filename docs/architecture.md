# LessonFoundry System Architecture & Workflows

LessonFoundry is an evidence-locked curriculum generation and assessment platform designed to eliminate AI hallucination, enforce pedagogical standards (Bloom's Taxonomy), and maintain immutable chain-of-custody provenance across educational artifacts.

---

## 1. System Architecture Diagram

```mermaid
flowchart TB
    subgraph ClientLayer["🖥️ Presentation Layer (Web Client)"]
        UI["React 19 + TypeScript + Vite + Tailwind CSS"]
        Router["React Router v7 (Teacher & Student Views)"]
        State["Client State & Accessibility Toolbar (Dyslexia Mode)"]
        UI --> Router
        Router --> State
    end

    subgraph APILayer["⚡ API Gateway & Services (FastAPI)"]
        Auth["Role Middleware (X-Role, X-Student-Id)"]
        R_Sources["/api/sources (Upload, Chunking, Ingestion Scan)"]
        R_Units["/api/units (Blueprint, Generation, Health, Analytics)"]
        R_Assets["/api/assets (Version History, Approval, Diffing)"]
        R_Student["/api/student (Redacted Published Packs, Submissions)"]
        Auth --> R_Sources
        Auth --> R_Units
        Auth --> R_Assets
        Auth --> R_Student
    end

    subgraph EngineLayer["⚙️ Evidence-Locked Engine & Guardrails"]
        Planner["Pedagogical Blueprint Planner & Gap Detector"]
        Generator["Structured Schema Generator (Pydantic)"]
        Verifier["Deterministic String Verifier (Exact + Fuzzy Substring >= 0.90)"]
        Solver["Blinded Dual-Solver Engine (Independent Answer & Quote)"]
        Guardrails["10 Automated Guardrails & Pack Health Score (0-100)"]
        Impact["Downstream Change Impact Analyzer"]
    end

    subgraph DataLayer["💾 Persistence Layer (SQLite + WAL Mode)"]
        DB[(lessonfoundry.db)]
        T_Sources["sources & source_versions & source_chunks"]
        T_Units["units & objectives & slots"]
        T_Assets["assets & asset_versions & claims & quality_flags"]
        T_Student["publications & student_attempts & decision_logs"]
        DB --- T_Sources
        DB --- T_Units
        DB --- T_Assets
        DB --- T_Student
    end

    subgraph ExternalServices["🧠 Model Provider"]
        Gemini["Google Gemini 2.5 Flash / 1.5 Flash (Structured JSON Mode)"]
    end

    %% Interactions
    ClientLayer <-->|REST API JSON / HTTP| APILayer
    APILayer --> EngineLayer
    EngineLayer <-->|Pydantic Schemas & JSON Prompting| ExternalServices
    APILayer <-->|SQLAlchemy ORM| DataLayer
    EngineLayer <-->|Provenance & Relational Verification| DataLayer
```

---

## 2. Core Operational Workflow Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Teacher as 👩‍🏫 Teacher
    participant Ingest as 📥 Ingestion & Scanner
    participant Planner as 🗺️ Planner & Gap Detector
    participant Gen as 🧠 Gemini Generator
    participant Verifier as 🔍 Non-LLM Verifier
    participant Solver as ⚖️ Blinded Solver
    participant Health as 🛡️ Guardrails & Health
    participant DB as 💾 Database
    actor Student as 🧑‍🎓 Student

    %% Step 1: Ingestion
    Teacher->>Ingest: Upload Source (PDF / TXT)
    Ingest->>Ingest: Compute SHA-256 Hash + Scan Prompt Injections
    Ingest->>DB: Store SourceVersion & Indexed Sentences (Chunks)
    Ingest-->>Teacher: Source Indexed & Version Pinned

    %% Step 2: Planning & Gap Detection
    Teacher->>Planner: Define Unit Title, Grade, Difficulty, Objectives
    Planner->>Planner: Score chunk relevance & evaluate support
    alt Unsupported Objective
        Planner->>DB: Mark supported=False + raise 'objective_unsupported' QualityFlag
        Planner-->>Teacher: Warning: Refused generation for unsupported objective
    else Supported Objectives
        Planner->>DB: Construct Blueprint Slots (Explanation, Example, Quiz, Practice, Revision)
    end

    %% Step 3: Evidence-Locked Generation & Verification
    Teacher->>Gen: Trigger Pack Generation
    loop For Each Slot
        Gen->>Gen: Wrap chunks in <<<SOURCE_START>>> data boundaries
        Gen->>DB: Fetch sibling slot context (consistency check)
        Gen->>Gen: Call Gemini in JSON Schema mode
        Gen->>Verifier: Extract claims & source quotes
        Verifier->>Verifier: Substring match & rapidfuzz token score (>= 0.90)
        Verifier->>DB: Save Claim records (text, quote, verified, match_score)
        
        opt Quiz / Practice Slots
            Gen->>Solver: Send Question + 4 Options (BLINDED: no key/rationale)
            Solver->>Solver: Call Gemini to independently solve & quote source
            Solver->>Verifier: Verify solver supporting quote
            Solver->>DB: Record verification result (matches_key: bool)
        end
    end

    %% Step 4: Guardrails & Pack Health
    Gen->>Health: Run 10 Unit Guardrails
    Health->>Health: Check duplicates, leakage, imbalance, malformed keys, bloom tags
    Health->>DB: Compute Pack Health Score (0-100) & save QualityFlags
    Health-->>Teacher: Display Review & Approve Wizard (Health Score, Checklist, Flags)

    %% Step 5: Teacher Review, Edit, & Approval
    Teacher->>DB: Review Asset Versions, Override/Resolve Flags, Approve Assets
    opt Single Item Regeneration
        Teacher->>Gen: Regenerate unapproved item #5
        Gen->>DB: Create AssetVersion #2 (parent_version_id=#1). Approved items 1-4 remain byte-identical.
    end
    Teacher->>DB: Publish Unit

    %% Step 6: Student Experience
    DB->>DB: Create immutable Publication snapshot (approved versions only)
    Student->>DB: GET /api/student/units/{id}
    Note over DB,Student: Response strips correct_index, rationales, and quotes
    Student->>DB: POST /api/student/attempts (submit answers)
    DB->>DB: Grade server-side & compute objective mastery
    DB-->>Student: Return results, score, & explanations
    DB-->>Teacher: Update Learning Gap Analytics & Weak-Objective Reinforcement
```

---

## 3. Subsystem Breakdown

### 3.1. Non-LLM Verifier Engine (`engine/verifier.py`)
- **Zero-Trust Grounding**: The verifier operates strictly without LLM calls to prevent hallucination recursion.
- **Matching Pipeline**:
  1. *Exact Substring Search*: Direct containment in chunk text (`score = 1.0`).
  2. *Normalized Clean Search*: Strips smart quotes, trailing punctuation, and whitespace variations (`score = 1.0`).
  3. *Token-Level Fuzzy Match*: Calculates token-set ratio using `rapidfuzz` across sliding sentence windows (`threshold >= 0.90`).
- **Rejection Policy**: Any claim quote scoring `< 0.90` is flagged as unverified and blocked by the approval gate.

### 3.2. Blinded Dual-Solver Engine (`engine/solver.py`)
- **Blinded Execution**: Solves each generated assessment item by feeding only the question stem, 4 option choices, and the relevant source chunks.
- **Strict Isolation**: Never exposes the answer key, authoring rationale, or original quotes to the solver prompt.
- **Double Verification**: The solver must provide its own supporting quote, which is verified by the non-LLM verifier. If the solver disagrees with the answer key or fails quote verification, an `answer_key_mismatch` QualityFlag (Severity: Error) is raised.

### 3.3. Deterministic Guardrails Engine (`engine/guardrails.py`)
The platform continuously runs 10 deterministic guardrails:
1. `duplicate_question`: Identifies semantic duplicates across quiz and practice items via token Jaccard and RapidFuzz similarity ($\ge 80\%$).
2. `answer_leakage`: Detects exact correct answer text or full token sets appearing inside the question stem.
3. `unsupported_claims`: Catches any claim with an unverified source quote.
4. `objective_coverage_imbalance`: Flags units where item distribution is skewed across objectives.
5. `missing_objective_coverage`: Blocks publication if a supported objective has 0 generated items.
6. `malformed_key`: Validates 4 distinct options and valid 0-3 integer answer key.
7. `difficulty_mismatch`: Ensures advanced practice items demonstrate higher average Bloom taxonomy depth than foundation items.
8. `unsupported_revision_concept`: Flags revision glossary terms that were not introduced in the primary explanation.
9. `terminology_drift`: Detects contradictory definitions across different slots for the same objective.
10. `injection_flagged_source`: Audits whether the source contains prompt injection triggers and enforces strict delimiter isolation.

---

## 4. Security & Data Integrity Boundaries

- **Untrusted Source Delimiters**: All ingested texts are enclosed within strict `<<<SOURCE_START>>>` and `<<<SOURCE_END>>>` markers. System prompts explicitly command the model to treat content inside delimiters as untrusted data.
- **Redacted Student Endpoints**: Endpoints under `/api/student/` query only immutable `Publication` records and explicitly filter out `correct_index`, `rationale`, and evidence quotes prior to student submission.
- **Zero Client-Side Secrets**: All API keys and model configurations remain server-side in `.env`.
