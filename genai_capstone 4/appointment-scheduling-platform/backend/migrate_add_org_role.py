#!/usr/bin/env python
"""
Migration: Update User role enum to include 'organization'.
"""

from sqlalchemy import text
from config.database import engine

def add_organization_role():
    """Update role ENUM in users table."""
    with engine.begin() as connection:
        try:
            print("Updating ENUM for role column in users table...")
            connection.execute(text("""
                ALTER TABLE users
                MODIFY COLUMN role ENUM('customer', 'provider', 'admin', 'organization') NOT NULL DEFAULT 'customer'
            """))
            print("✓ ENUM updated successfully")
            return True
            
        except Exception as e:
            print(f"✗ Migration failed: {e}")
            return False

if __name__ == "__main__":
    success = add_organization_role()
    if success:
        print("\n✓ Database migration completed successfully!")
    else:
        print("\n✗ Migration failed. Please check your database connection.")
        exit(1)
