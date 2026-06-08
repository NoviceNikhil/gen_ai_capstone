#!/usr/bin/env python3
"""
Migration: Add specific_date column to availability_slots table
Allows per-slot date selection instead of just recurring day_of_week slots
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
sys.path.append(os.path.dirname(__file__))

from sqlalchemy import text, inspect
from config.database import SessionLocal, engine

def migrate_add_specific_date():
    """Add specific_date column for date-based slots"""
    with engine.connect() as conn:
        inspector = inspect(engine)
        columns = [col['name'] for col in inspector.get_columns('availability_slots')]
        
        if 'specific_date' in columns:
            print("[✓] Column 'specific_date' already exists in availability_slots")
            return
        
        print("[*] Adding 'specific_date' column to availability_slots...")
        conn.execute(text("""
            ALTER TABLE availability_slots
            ADD COLUMN specific_date DATE NULL
            COMMENT 'If set, this is a one-time slot for this date'
        """))
        
        print("[*] Creating index on provider_id + specific_date...")
        conn.execute(text("""
            CREATE INDEX idx_provider_specific_date 
            ON availability_slots(provider_id, specific_date)
        """))
        
        print("[*] Creating index on provider_id + day_of_week...")
        conn.execute(text("""
            CREATE INDEX idx_provider_day_of_week 
            ON availability_slots(provider_id, day_of_week)
        """))
        
        conn.commit()
        print("[✓] Migration completed successfully")

if __name__ == "__main__":
    migrate_add_specific_date()
