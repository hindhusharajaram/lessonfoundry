# LessonFoundry Clean Demo Reset Script (Windows PowerShell)
# Wipes database, recreates tables, seeds initial sample source, and starts services.

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "  LessonFoundry Clean State Demo Reset" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
Set-Location $ProjectRoot

# 1. Kill any existing uvicorn or vite processes if running on ports 8000/5173
Write-Host "[1/4] Stopping existing development servers..." -ForegroundColor Yellow
Get-Process -Name "python", "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -match "uvicorn" -or $_.CommandLine -match "api.main"
} | Stop-Process -Force -ErrorAction SilentlyContinue

# 2. Wipe SQLite DB files
Write-Host "[2/4] Wiping existing SQLite database..." -ForegroundColor Yellow
$DbPath = Join-Path $ProjectRoot "data\lessonfoundry.db"
$WalPath = Join-Path $ProjectRoot "data\lessonfoundry.db-wal"
$ShmPath = Join-Path $ProjectRoot "data\lessonfoundry.db-shm"

if (Test-Path $DbPath) { Remove-Item $DbPath -Force }
if (Test-Path $WalPath) { Remove-Item $WalPath -Force }
if (Test-Path $ShmPath) { Remove-Item $ShmPath -Force }

# 3. Re-initialize database schema
Write-Host "[3/4] Initializing fresh database schema..." -ForegroundColor Yellow
$PythonExe = Join-Path $ProjectRoot "venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    $PythonExe = "python"
}

& $PythonExe -c "from db.database import init_db; init_db(); print('Database schema initialized cleanly.')"

# 4. Launch backend and frontend
Write-Host "[4/4] Starting backend (FastAPI :8000) and frontend (Vite :5173)..." -ForegroundColor Green
Write-Host "---------------------------------------------------------" -ForegroundColor Cyan
Write-Host "Backend:  http://localhost:8000 (API Docs: http://localhost:8000/docs)" -ForegroundColor White
Write-Host "Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "---------------------------------------------------------" -ForegroundColor Cyan

# Start Backend in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot'; & '$PythonExe' -m uvicorn api.main:app --reload --port 8000"

# Start Frontend in new window
$WebDir = Join-Path $ProjectRoot "web"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$WebDir'; npm run dev"

Write-Host "LessonFoundry is now running with a fresh database." -ForegroundColor Green
