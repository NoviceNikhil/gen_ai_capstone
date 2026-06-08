import os
import sys
from sqlalchemy import create_engine, text
from config.settings import settings

def run_migration():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        tables = ["users", "appointments", "categories", "appointment_slots"]
        for table in tables:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN deleted_at DATETIME DEFAULT NULL"))
                print(f"Added deleted_at to {table}")
            except Exception as e:
                print(f"Skipping {table} or error: {e}")
        conn.commit()

if __name__ == "__main__":
    run_migration()
