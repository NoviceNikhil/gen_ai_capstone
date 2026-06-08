#!/usr/bin/env python
"""
Migration: Add Google OAuth columns to users.
"""

from sqlalchemy import text

from config.database import engine


def _column_exists(connection, column_name: str) -> bool:
    result = connection.execute(
        text(
            """
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'users'
              AND COLUMN_NAME = :column_name
            """
        ),
        {"column_name": column_name},
    )
    return result.fetchone() is not None


def _index_exists(connection, index_name: str) -> bool:
    result = connection.execute(
        text(
            """
            SELECT INDEX_NAME
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'users'
              AND INDEX_NAME = :index_name
            """
        ),
        {"index_name": index_name},
    )
    return result.fetchone() is not None


def add_google_auth_columns() -> bool:
    """Add auth_provider and oauth_id columns expected by the User model."""
    with engine.begin() as connection:
        try:
            if not _column_exists(connection, "auth_provider"):
                print("Adding auth_provider column to users table...")
                connection.execute(
                    text(
                        """
                        ALTER TABLE users
                        ADD COLUMN auth_provider VARCHAR(50) NOT NULL DEFAULT 'local'
                        AFTER phone
                        """
                    )
                )
                print("✓ auth_provider column added")
            else:
                print("✓ auth_provider column already exists")

            if not _column_exists(connection, "oauth_id"):
                print("Adding oauth_id column to users table...")
                connection.execute(
                    text(
                        """
                        ALTER TABLE users
                        ADD COLUMN oauth_id VARCHAR(255) NULL
                        AFTER auth_provider
                        """
                    )
                )
                print("✓ oauth_id column added")
            else:
                print("✓ oauth_id column already exists")

            if not _index_exists(connection, "idx_users_oauth_id"):
                print("Adding oauth_id unique index...")
                connection.execute(
                    text(
                        """
                        CREATE UNIQUE INDEX idx_users_oauth_id
                        ON users (oauth_id)
                        """
                    )
                )
                print("✓ oauth_id unique index added")
            else:
                print("✓ oauth_id unique index already exists")

            return True
        except Exception as exc:
            print(f"✗ Google auth column migration failed: {exc}")
            return False


if __name__ == "__main__":
    if add_google_auth_columns():
        print("\n✓ Database migration completed successfully!")
    else:
        print("\n✗ Migration failed. Please check your database connection.")
        raise SystemExit(1)
