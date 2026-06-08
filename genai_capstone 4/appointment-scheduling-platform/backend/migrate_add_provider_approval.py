#!/usr/bin/env python3
"""
Migration script to add provider approval fields to the database.
Adds:
1. approval_status column to service_providers table
2. Creates provider_approval_requests table
"""

from sqlalchemy import text, inspect
from config.database import engine
from sqlalchemy.orm import Session
from config.database import SessionLocal

def add_provider_approval_fields():
    """Add provider approval status to service_providers table and create approval requests table"""
    
    with engine.connect() as connection:
        inspector = inspect(engine)
        
        # Check if approval_status column exists in service_providers
        columns = [col['name'] for col in inspector.get_columns('service_providers')]
        
        if 'approval_status' not in columns:
            print("Adding approval_status column to service_providers...")
            connection.execute(text(
                """
                ALTER TABLE service_providers 
                ADD COLUMN approval_status ENUM('pending', 'approved', 'rejected') 
                NOT NULL DEFAULT 'pending'
                """
            ))
            connection.commit()
            print("✓ approval_status column added")
        else:
            print("✓ approval_status column already exists")
        
        # Check if provider_approval_requests table exists
        tables = inspector.get_table_names()
        
        if 'provider_approval_requests' not in tables:
            print("Creating provider_approval_requests table...")
            connection.execute(text(
                """
                CREATE TABLE provider_approval_requests (
                    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
                    provider_id CHAR(36) NOT NULL UNIQUE,
                    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
                    approved_by CHAR(36) NULL,
                    approval_notes TEXT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    approved_at DATETIME NULL,
                    FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE CASCADE,
                    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
                )
                """
            ))
            connection.commit()
            print("✓ provider_approval_requests table created")
        else:
            print("✓ provider_approval_requests table already exists")

if __name__ == "__main__":
    try:
        add_provider_approval_fields()
        print("\nMigration completed successfully!")
    except Exception as e:
        print(f"Migration error: {e}")
        raise
