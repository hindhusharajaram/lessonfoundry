#!/usr/bin/env bash
# LessonFoundry Clean Demo Reset Script (Linux/macOS Bash)
# Wipes database, recreates tables, and starts backend and frontend.

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "========================================================="
echo "  LessonFoundry Clean State Demo Reset"
echo "========================================================="

# 1. Stop existing servers
echo "[1/4] Stopping existing processes on ports 8000 and 5173..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# 2. Wipe SQLite DB files
echo "[2/4] Wiping existing SQLite database..."
rm -f data/lessonfoundry.db data/lessonfoundry.db-wal data/lessonfoundry.db-shm

# 3. Re-initialize database schema
echo "[3/4] Initializing fresh database schema..."
if [ -d "venv" ]; then
    source venv/bin/activate
fi

python3 -c "from db.database import init_db; init_db(); print('Database schema initialized cleanly.')"

# 4. Launch backend and frontend
echo "[4/4] Starting backend (FastAPI :8000) and frontend (Vite :5173)..."
echo "---------------------------------------------------------"
echo "Backend:  http://localhost:8000 (API Docs: http://localhost:8000/docs)"
echo "Frontend: http://localhost:5173"
echo "---------------------------------------------------------"

python3 -m uvicorn api.main:app --reload --port 8000 &
BACKEND_PID=$!

cd web
npm run dev &
FRONTEND_PID=$!

echo "LessonFoundry running (Backend PID: $BACKEND_PID, Frontend PID: $FRONTEND_PID)."
wait
