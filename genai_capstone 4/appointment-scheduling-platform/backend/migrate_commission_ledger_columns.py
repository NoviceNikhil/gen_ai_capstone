#!/usr/bin/env python3
"""
Migration: Add deferred payment columns to commission_ledger table
This script adds payout_scheduled_at, payout_status, and payout_processed_at columns
if they don't already exist.
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
sys.path.append(os.path.dirname(__file__))

from sqlalchemy import inspect, text
from config.database import engine, SessionLocal

def migrate_commission_ledger():
    """Add missing columns to commission_ledger table"""
    
    inspector = inspect(engine)
    
    # Get existing columns in commission_ledger table
    if 'commission_ledger' not in inspector.get_table_names():
        print("❌ commission_ledger table does not exist. Please run the backend to create it first.")
        return False
    
    existing_columns = {col['name'] for col in inspector.get_columns('commission_ledger')}
    
    columns_to_add = {
        'payout_scheduled_at': 'DateTime NULL',
        'payout_status': "VARCHAR(50) NOT NULL DEFAULT 'pending'",
        'payout_processed_at': 'DateTime NULL',
    }
    
    db = SessionLocal()
    try:
        missing_columns = {col: type_ for col, type_ in columns_to_add.items() if col not in existing_columns}
        
        if not missing_columns:
            print("✓ All deferred payment columns already exist in commission_ledger table.")
            return True
        
        print(f"Adding {len(missing_columns)} missing columns to commission_ledger table...")
        
        # Add each missing column
        for col_name, col_type in missing_columns.items():
            try:
                sql = f"ALTER TABLE commission_ledger ADD COLUMN {col_name} {col_type};"
                print(f"  → Running: {sql}")
                db.execute(text(sql))
                print(f"    ✓ Added {col_name}")
            except Exception as e:
                print(f"    ✗ Failed to add {col_name}: {e}")
                return False
        
        db.commit()
        print("\n✓ Migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = migrate_commission_ledger()
    sys.exit(0 if success else 1)
