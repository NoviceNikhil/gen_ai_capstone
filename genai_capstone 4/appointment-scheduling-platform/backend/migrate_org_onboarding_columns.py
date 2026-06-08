"""
Migration: Add onboarding columns to the organizations table.

Run once:
    python3 migrate_org_onboarding_columns.py

Safe to run multiple times — checks existing columns before adding.
"""

from config.database import engine
from sqlalchemy import text


NEW_COLUMNS = [
    ("onboarding_completed", "TINYINT(1) NOT NULL DEFAULT 0"),
    ("org_type",             "VARCHAR(100) NULL"),
    ("address",              "TEXT NULL"),
    ("state",                "VARCHAR(100) NULL"),
    ("city",                 "VARCHAR(100) NULL"),
    ("pincode",              "VARCHAR(10) NULL"),
    ("num_employees",        "INT NULL"),
    ("tax_number",           "VARCHAR(100) NULL"),
    ("bank_details",         "TEXT NULL"),
    ("identity_doc_url",     "VARCHAR(500) NULL"),
]


def get_existing_columns(conn, table="organizations"):
    result = conn.execute(text(f"SHOW COLUMNS FROM `{table}`"))
    return {row[0] for row in result}


def run_migration():
    with engine.connect() as conn:
        existing = get_existing_columns(conn)
        print(f"  Existing columns: {sorted(existing)}\n")

        for col_name, col_def in NEW_COLUMNS:
            if col_name in existing:
                print(f"  – Already exists (skipped): {col_name}")
                continue
            stmt = f"ALTER TABLE organizations ADD COLUMN `{col_name}` {col_def}"
            try:
                conn.execute(text(stmt))
                conn.commit()
                print(f"  ✓ Added: {col_name}")
            except Exception as e:
                print(f"  ✗ Failed to add {col_name}: {e}")


def link_demo_org_admins(conn):
    """Link seeded organisation users to their org records (idempotent)."""
    demo_orgs = [
        ("admin@manipalhospitals.com", "Manipal Hospitals"),
        ("hello@urbanwellness.co", "Urban Wellness Spa & Yoga Studio"),
        ("care@techrepairhome.com", "TechRepair & Home Services"),
        ("consult@elitebusiness.in", "Elite Business Advisory"),
        ("support@learningacademy.edu", "Learning Academy India"),
    ]
    for email, name in demo_orgs:
        conn.execute(
            text(
                """
                UPDATE organizations o
                JOIN users u ON LOWER(u.email) = LOWER(:email)
                SET o.admin_user_id = u.id,
                    o.onboarding_completed = 1,
                    o.is_approved = 1,
                    o.approval_status = 'approved'
                WHERE o.name = :name
                """
            ),
            {"email": email, "name": name},
        )
    conn.commit()
    print("  ✓ Linked demo organisation admin accounts")


if __name__ == "__main__":
    print("Running org onboarding migration…")
    run_migration()
    with engine.connect() as conn:
        link_demo_org_admins(conn)
    print("\nDone.")
