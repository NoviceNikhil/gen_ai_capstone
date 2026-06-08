# Provider Approval - Quick Reference

## The Story
> After provider login/signup, they submit their onboarding form for approval. Admin reviews and approves. Once approved, provider is visible to customers. Until then, they remain invisible.

## Files to Know

| File | Purpose |
|------|---------|
| `models/provider_approval.py` | Tracks approval requests |
| `models/service_provider.py` | Added `approval_status` field |
| `services/provider_approval_service.py` | Business logic |
| `routers/provider_approval.py` | Admin approval endpoints |
| `routers/provider.py` | Provider submit endpoint |
| `services/customer_service.py` | Filter approved providers |

## Database

```sql
-- New field in service_providers:
approval_status ENUM('pending', 'approved', 'rejected')

-- New table:
provider_approval_requests (id, provider_id, status, approved_by, approval_notes, created_at, approved_at)
```

Run: `python backend/migrate_add_provider_approval.py`

## API Endpoints

### Provider: Submit for Approval
```
POST /api/provider/onboarding/submit-for-approval
```

### Admin: View Pending
```
GET /api/providers/approval/pending-requests?page=1&limit=10
```

### Admin: Approve/Reject
```
POST /api/providers/approval/requests/{request_id}/decide
Body: { "status": "approved", "notes": "..." }
```

### Anyone: Check Status
```
GET /api/providers/approval/status/{provider_id}
```

## Key Changes

**Models**: Added `approval_status` to ServiceProvider
**Services**: Only show approved providers to customers
**Routes**: New approval workflow endpoints
**DB**: New table for tracking requests

## What Still Works

✅ Everything - No breaking changes
✅ Auth, appointments, payments, notifications
✅ Admin still sees all providers
✅ Customers just see fewer (approved ones only)

## Testing

```bash
# 1. Apply migration
python backend/migrate_add_provider_approval.py

# 2. Provider submits
curl -X POST http://localhost:8000/api/provider/onboarding/submit-for-approval \
  -H "Authorization: Bearer {token}"

# 3. Admin views
curl http://localhost:8000/api/providers/approval/pending-requests \
  -H "Authorization: Bearer {admin_token}"

# 4. Admin approves
curl -X POST http://localhost:8000/api/providers/approval/requests/{id}/decide \
  -H "Authorization: Bearer {admin_token}" \
  -d '{"status":"approved","notes":"OK"}'

# 5. Check provider visible to customer
curl http://localhost:8000/api/customer/providers
```

## States

- **pending**: Not visible to customers, waiting for admin
- **approved**: Visible to customers
- **rejected**: Not visible to customers, can resubmit

## Notifications

When submitted: → Admin gets notified
When approved: → Provider gets notified (now visible)
When rejected: → Provider gets notified (with reason)

## FAQ

**Q: Can provider submit twice?**
A: No, only one pending request. Must wait or it must be rejected.

**Q: Can provider resubmit after rejection?**
A: Yes, call submit endpoint again.

**Q: Do existing endpoints break?**
A: No, all existing endpoints work as before.

**Q: Are unapproved providers hidden or deleted?**
A: Hidden - they're in DB but filtered in queries.

**Q: Can admin bypass approval?**
A: Yes, admin can manually set approval_status in DB.

**Q: Do approved providers appear immediately?**
A: Yes, customer searches will include them.

---

**To use this workflow:**
1. Run migration
2. Restart server
3. Provider fills onboarding → submits → waits
4. Admin reviews pending → approves/rejects
5. Customer searches → sees only approved
