# Deferred Provider Payment System

## Overview

The Schedex appointment platform processes provider payments with a **1-hour delay** after appointment completion. This ensures:

- Appointment happens successfully (no-shows are handled)
- Provider is guaranteed to receive payment
- Platform retains service fee before processing payout
- Email notification sent to provider when payment is processed

## Current Payment Flow

### Timeline Example

```
Appointment Schedule: 16:00
Customer Payment: Immediate (upon booking)
Appointment Completes: 16:00
Provider Payout Scheduled: 17:00  ← 1 hour later
Provider Payout Processed: 17:00+  ← Email sent immediately
```

## System Architecture

### 1. **Database Schema**

**`commission_ledger` table additions:**

```sql
payout_scheduled_at    DATETIME     -- When payout should be sent (appointment_time + 1 hour)
payout_status          VARCHAR(50)  -- pending, disbursed, failed
payout_processed_at    DATETIME     -- When payout was actually processed
```

### 2. **Payment Flow Steps**

#### Phase 1: Appointment Booking

```
Customer Books → Payment Created → appointment.is_paid = True
```

#### Phase 2: Payment Verification

```python
verify_payment() is called:
  1. Verify Razorpay signature
  2. Update appointment.is_paid = True
  3. Create CommissionLedger entry:
     - gross_amount = consultation_fee
     - platform_commission = gross_amount × 10% (configurable)
     - provider_payout_amount = gross_amount - platform_commission
     - payout_scheduled_at = appointment_datetime + 1 hour
     - payout_status = "pending"
```

#### Phase 3: Automatic Payout Processing

```python
process_scheduled_payouts() called (every 1-5 minutes):
  1. Find all payouts where payout_scheduled_at <= NOW and status = "pending"
  2. For each payout:
     - Update payout_status = "disbursed"
     - Set payout_processed_at = NOW
     - Send email to provider with:
       * Amount received
       * Appointment details
       * Customer name
  3. Log event for audit trail
```

## API Endpoints

### Process Payouts (Admin/Cron)

```
POST /api/payments/process-payouts

Response:
{
  "success": true,
  "message": "Payout processing completed",
  "data": {
    "status": "success",
    "processed_count": 5,
    "failed_count": 0,
    "errors": [],
    "timestamp": "2026-06-01T17:30:45.123Z"
  }
}
```

### Get Pending Payouts

```
GET /api/payments/pending-payouts

Response:
{
  "success": true,
  "data": [
    {
      "ledger_id": "abc123",
      "appointment_id": "appt456",
      "amount": 630.00,
      "scheduled_at": "2026-06-01T17:00:00Z",
      "status": "pending"
    }
  ]
}
```

### Get Payout History

```
GET /api/payments/payout-history?limit=100

Response:
{
  "success": true,
  "data": [
    {
      "ledger_id": "abc123",
      "appointment_id": "appt456",
      "amount": 630.00,
      "scheduled_at": "2026-06-01T17:00:00Z",
      "processed_at": "2026-06-01T17:05:30Z",
      "status": "disbursed"
    }
  ]
}
```

## Service Functions

### In `services/payout_service.py`

#### `process_scheduled_payouts(db: Session) -> dict`

Main function that processes all due payouts. Called by cron or webhook.

```python
# Process all payouts where scheduled_time has passed
result = process_scheduled_payouts(db)
# Returns: {"status": "success", "processed_count": 5, "failed_count": 0}
```

#### `get_pending_payouts(db: Session) -> list`

Returns all payouts still waiting to be processed.

```python
payouts = get_pending_payouts(db)
# Returns list of pending payout records
```

#### `get_payout_history(db: Session, limit: int = 100) -> list`

Returns recently processed (disbursed or failed) payouts.

```python
history = get_payout_history(db, limit=50)
# Returns last 50 processed payouts
```

## Email Notifications

### Provider Email on Payout

**Subject:** "Payment Processed — Schedex Provider"

**Content includes:**

- Amount received: ₹{amount}
- Appointment date and time
- Customer name
- Note: "Payment has been transferred to your registered bank account"

**Email sent by:** `utils/email.py::send_provider_payment_processed_email()`

## Setup & Configuration

### 1. Database Migration

The `CommissionLedger` table was updated with new columns:

```bash
# This happens automatically when you run the backend
python backend/app.py
```

### 2. Configure via Environment (Optional)

```bash
# .env
PLATFORM_COMMISSION_RATE=0.10  # 10% commission (default)
PAYOUT_DELAY_HOURS=1           # 1 hour after appointment (default)
```

### 3. Set Up Cron Job

For Linux/Mac, add to crontab:

```bash
crontab -e

# Add this line to run every minute
* * * * * cd /path/to/backend && python run_payout_processor.py >> logs/payout_processor.log 2>&1

# Or run every 5 minutes (recommended for less database load):
*/5 * * * * cd /path/to/backend && python run_payout_processor.py >> logs/payout_processor.log 2>&1
```

### 4. Manual Testing

**Test 1: Check pending payouts**

```bash
curl -X GET http://localhost:8000/api/payments/pending-payouts
```

**Test 2: Process payouts manually**

```bash
curl -X POST http://localhost:8000/api/payments/process-payouts
```

**Test 3: View payout history**

```bash
curl -X GET http://localhost:8000/api/payments/payout-history?limit=10
```

**Test 4: Run payout processor script**

```bash
cd backend
python run_payout_processor.py
```

## Commission Breakdown Example

**Appointment Details:**

- Consultation Fee: ₹1000
- Platform Commission Rate: 10%

**Payment Distribution:**

```
Gross Payment:           ₹1000 (paid by customer immediately)
├── Platform Commission:  ₹100 (10%)
└── Provider Payout:      ₹900 (sent 1 hour after appointment)
```

## Database Schema

```sql
-- Enhanced commission_ledger table
CREATE TABLE commission_ledger (
  id CHAR(36) PRIMARY KEY,
  appointment_id CHAR(36) NOT NULL UNIQUE,
  gross_amount DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0.10,
  platform_commission_amount DECIMAL(10,2) NOT NULL,
  provider_payout_amount DECIMAL(10,2) NOT NULL,

  -- NEW: Deferred Payout Fields
  payout_scheduled_at DATETIME NULL,
  payout_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, disbursed, failed
  payout_processed_at DATETIME NULL,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
);
```

## Troubleshooting

### Payouts not processing?

1. Check that `payout_scheduled_at` is in the past: `SELECT * FROM commission_ledger WHERE payout_status = 'pending'`
2. Verify cron job is running: `ps aux | grep payout_processor`
3. Check logs: `tail -f logs/payout_processor.log`
4. Test manually: `python run_payout_processor.py`

### Email not sending?

1. Check email service configured: `grep EMAIL_USER backend/.env`
2. Verify provider email address: `SELECT email FROM users WHERE role = 'provider' LIMIT 1`
3. Check email logs in backend console

### Wrong payout amount?

1. Verify commission rate: `SELECT commission_rate FROM commission_ledger LIMIT 1`
2. Calculate manually: `gross_amount × (1 - commission_rate)`
3. Check for cancellations/refunds that modified the ledger

## Files Modified/Created

**Created:**

- `backend/services/payout_service.py` - Payout processing logic
- `backend/run_payout_processor.py` - Cron-compatible script
- `backend/utils/email.py::send_provider_payment_processed_email()` - Email template

**Modified:**

- `backend/models/appointment_extras.py` - Added payout fields to CommissionLedger
- `backend/services/payment_service.py` - Schedule payout in `verify_payment()`
- `backend/routers/payments.py` - Added payout endpoints
- `backend/utils/email.py` - Added provider payment email function

## References

- Commission Ledger Model: `/backend/models/appointment_extras.py`
- Payout Service: `/backend/services/payout_service.py`
- Payment Router: `/backend/routers/payments.py`
- Email Utilities: `/backend/utils/email.py`
