from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes_sources import router as sources_router
from api.routes_units import router as units_router
from api.routes_assets import router as assets_router
from api.routes_student import router as student_router
from api.routes_auth import router as auth_router
from api.routes_teacher import router as teacher_router
from api.routes_attendance import router as attendance_router
from db.database import init_db

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://lessonfoundry.vercel.app",
]

app = FastAPI(
    title="LessonFoundry API",
    description="Evidence-Locked Learning Pack Studio API",
    version="1.0.0",
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/api/health", tags=["health"])
def health_check():
    return {
        "status": "ok",
        "app": "LessonFoundry",
        "version": "1.0.0",
    }


# Mount all API routers under /api and root aliases
app.include_router(auth_router, prefix="/api")
app.include_router(sources_router, prefix="/api")
app.include_router(units_router, prefix="/api")
app.include_router(assets_router, prefix="/api")
app.include_router(student_router, prefix="/api")
app.include_router(teacher_router, prefix="/api")
app.include_router(attendance_router, prefix="/api")
app.include_router(attendance_router)
