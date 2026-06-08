# Database Seeding Guide

## Overview
The seeding script (`backend/seeding/seed.py`) does **NOT require dropping the entire database**. It's designed to be **idempotent** — you can run it multiple times without losing existing production data.

## How It Works

### Smart Data Reset (Not Database Reset)
The `reset_demo_data()` function is selective:
- It **ONLY deletes demo data** marked with the `[DEMO:` marker
- It **PRESERVES all production data** that doesn't have the demo marker
- It tracks demo users by email pattern (`*@app-demo.com`)
- It tracks demo appointments by notes prefix (`[DEMO:`)

### No Full Database Drop Required
```bash
# Run with --reset-demo flag to clear previous demo data first
python backend/seeding/seed.py --reset-demo

# Or run without flag to preserve existing data (upsert mode)
python backend/seeding/seed.py
```

## Key Features

### 1. Selective Cleanup (with `--reset-demo`)
Only removes:
- Users with emails ending in `@app-demo.com`
- Service providers created from demo users
- Availability slots for demo providers
- Appointments marked with `[DEMO:` in notes
- Organizations created by the seed script
- Related payment/refund records

**Keeps intact:**
- All production users and data
- Any real appointments booked by real users
- Real provider profiles
- Custom organizations not created by seed

### 2. Upsert Mode (without `--reset-demo`)
- Checks if demo users already exist by email
- Updates existing demo records instead of duplicating
- Creates new records only if they don't exist
- Perfect for incremental seeding

### 3. Idempotent Design
- Can run multiple times safely
- Each provider/user check: `if not user: create_user()`
- Service offerings are upserted by provider + title
- Availability slots are updated by day_of_week

## Usage Examples

### Fresh Demo Data (Clean Slate)
```bash
# Clear old demo data, seed new demo data
cd appointment-scheduling-platform
python backend/seeding/seed.py --reset-demo
```

### Preserve Production Data (Recommended for Live DBs)
```bash
# Don't clear anything, just ensure demo data exists
cd appointment-scheduling-platform
python backend/seeding/seed.py
```

### After Backend Changes
```bash
# Safe to re-run if you modified models/schemas
python backend/seeding/seed.py --reset-demo
```

## Database Prerequisite

Before seeding, ensure:
1. MySQL server is running
2. Database `appointment_scheduling` exists
3. `.env` has correct `SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_PORT`
4. SQLAlchemy models are up-to-date with schema

**To create the database if it doesn't exist:**
```bash
# Via MySQL CLI
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS appointment_scheduling;"

# Or via SQLAlchemy (from Python)
# The seed script does: Base.metadata.create_all(bind=engine)
# This creates missing tables automatically
```

## What Gets Seeded

### Users
- 1 admin: `nikhilchathapuram@gmail.com` / `Admin123`
- 8 named customers (e.g., `neha.verma.customer@app-demo.com`) / `Customer123`
- 13 named providers (e.g., `aisha.mehta.provider@app-demo.com`) / `Provider123`
- 1000 generated customers (`customer_0001@app-demo.com` to `customer_1000@app-demo.com`)
- 1000 generated providers (`provider_0001@app-demo.com` to `provider_1000@app-demo.com`)

### Data
- 5 service categories (Healthcare, Beauty & Wellness, Home Services, Business Consulting, Education)
- 5 organizations (Manipal Hospitals, Apollo Clinics, Lakmé Salon, Urban Company, etc.)
- Provider availability schedules (3 slots per provider)
- Service offerings per provider (Standard, Intro, Extended sessions)
- ~2050+ appointments across 30 days with realistic distributions
- Payment records for paid appointments
- Refund records for cancelled appointments
- Provider reviews with realistic ratings

### Data Retention
All data is marked with the `[DEMO:` prefix in appointment notes and uses `@app-demo.com` emails for user identification. This makes it safe to:
- Run seeding multiple times
- Run alongside production data
- Safely delete only demo data with `--reset-demo`

## Troubleshooting

### Error: "Missing required tables"
**Solution:** The database schema doesn't match models. Run:
```bash
# Let SQLAlchemy create the schema
python backend/seeding/seed.py --reset-demo
```

### Error: "Database does not match the SQLAlchemy models"
**Solution:** Migrate your database to match current models, then seed.

### Error: "Pending payments found in seeded data"
**Solution:** This is a validation check. All seeded payments must be `paid`, `refunded`, or `failed`. Check the seed data doesn't have `status="pending"`.

### Port/Connection Errors
**Solution:** Verify `.env` settings:
```
SQL_HOST=localhost
SQL_PORT=3306
SQL_DB_USER=root
SQL_PASSWORD=your_password
SQL_DB_NAME=appointment_scheduling
```

## Pro Tips

1. **Backup before seeding in production** (if you do decide to seed real DB)
2. **Use `--reset-demo` in dev/test, use no flag in production** to avoid accidental deletion
3. **Monitor logs** — the script prints detailed progress
4. **Customer summary** — script logs how many appointments exist for key demo users
5. **Reuse existing data** — without `--reset-demo`, upserts allow incremental updates

## Next Steps

Once seeded:
1. Start the backend: `python backend/main.py` (if using Uvicorn)
2. Frontend accesses real data via API endpoints
3. Log in with any demo user to test
4. Modify appointment data via real API endpoints (changes persist across seeding runs if not `--reset-demo`)

