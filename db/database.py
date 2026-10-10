import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_DB_PATH = DATA_DIR / "lessonfoundry.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH.as_posix()}")

# For SQLite, enable foreign keys
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if DATABASE_URL.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=10000")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initializes all database tables from models."""
    from sqlalchemy import text
    from db.models import Base as ModelsBase
    ModelsBase.metadata.create_all(bind=engine)

    # Safe migration for existing SQLite database files
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE students ADD COLUMN student_user_id INTEGER REFERENCES users(id)"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE students ADD COLUMN email VARCHAR(255)"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN join_code VARCHAR(16) UNIQUE"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE attendances ADD COLUMN unit_id INTEGER REFERENCES units(id)"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE attendances ADD COLUMN asset_id INTEGER REFERENCES assets(id)"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE attendances ADD COLUMN activity_type VARCHAR(50) DEFAULT 'attended'"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE attendances ADD COLUMN score FLOAT"))
            conn.commit()
        except Exception:
            pass

        # Migrate attendances table if it contains the legacy UNIQUE(session_id, student_id) constraint
        try:
            row = conn.execute(text("SELECT sql FROM sqlite_master WHERE type='table' AND name='attendances'")).fetchone()
            if row and "uq_session_student_attendance" in row[0]:
                conn.execute(text("PRAGMA foreign_keys=OFF;"))
                conn.execute(text("""
                    CREATE TABLE attendances_v2 (
                        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                        session_id INTEGER REFERENCES class_sessions(id) ON DELETE CASCADE,
                        unit_id INTEGER REFERENCES units(id) ON DELETE CASCADE,
                        asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
                        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                        status VARCHAR(50) NOT NULL DEFAULT 'present',
                        activity_type VARCHAR(50) NOT NULL DEFAULT 'attended',
                        score FLOAT,
                        attended_at DATETIME,
                        notes VARCHAR(255)
                    );
                """))
                conn.execute(text("""
                    INSERT INTO attendances_v2 (id, session_id, unit_id, asset_id, student_id, status, activity_type, score, attended_at, notes)
                    SELECT id, session_id, unit_id, asset_id, student_id, status, activity_type, score, attended_at, notes FROM attendances;
                """))
                conn.execute(text("DROP TABLE attendances;"))
                conn.execute(text("ALTER TABLE attendances_v2 RENAME TO attendances;"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_attendances_session_id ON attendances (session_id);"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_attendances_unit_id ON attendances (unit_id);"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_attendances_asset_id ON attendances (asset_id);"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_attendances_student_id ON attendances (student_id);"))
                conn.execute(text("PRAGMA foreign_keys=ON;"))
                conn.commit()
        except Exception as e:
            print("attendances migration error:", e)
