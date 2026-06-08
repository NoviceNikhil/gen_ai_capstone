#!/usr/bin/env python
"""
Emergency migration: Add organization_id column to service_providers table.
This fixes the schema mismatch causing 500 errors across the system.
"""

from sqlalchemy import text
from config.database import engine

def add_organization_id_column():
    """Add the missing organization_id foreign key column."""
    with engine.begin() as connection:
        try:
            # Check if column already exists
            result = connection.execute(text("""
                SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'service_providers' AND COLUMN_NAME = 'organization_id'
            """))
            
            if result.fetchone():
                print("✓ Column organization_id already exists")
                return True
            
            # Add the column with proper foreign key constraint
            print("Adding organization_id column to service_providers table...")
            connection.execute(text("""
                ALTER TABLE service_providers
                ADD COLUMN organization_id CHAR(36) NULL
                AFTER category_id
            """))
            print("✓ Column added")
            
            # Add foreign key constraint
            print("Adding foreign key constraint...")
            connection.execute(text("""
                ALTER TABLE service_providers
                ADD CONSTRAINT fk_service_providers_org
                FOREIGN KEY (organization_id) 
                REFERENCES organizations(id) ON DELETE SET NULL
            """))
            print("✓ Foreign key constraint added")
            
            connection.commit()
            return True
            
        except Exception as e:
            print(f"✗ Migration failed: {e}")
            return False

if __name__ == "__main__":
    success = add_organization_id_column()
    if success:
        print("\n✓ Database migration completed successfully!")
        print("You can now run the seeder: python seed_demo_data.py --reset-demo")
    else:
        print("\n✗ Migration failed. Please check your database connection.")
        exit(1)
