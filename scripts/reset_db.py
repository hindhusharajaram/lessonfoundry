import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db.database import Base, engine, DATA_DIR
import db.models  # Ensure all models are registered with Base metadata


def reset_database():
    print(f"Ensuring data directory at: {DATA_DIR}")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    print("Dropping all existing database tables...")
    Base.metadata.drop_all(bind=engine)
    
    print("Creating all tables per schema specification...")
    Base.metadata.create_all(bind=engine)
    
    print("Database reset successfully! Created tables:")
    for table_name in Base.metadata.tables.keys():
        print(f" - {table_name}")


if __name__ == "__main__":
    reset_database()
