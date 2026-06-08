# Provider Approval Workflow Implementation

## Overview
This implementation adds a provider approval system where:
1. **Provider signs up** → Creates account with `approval_status = "pending"`
2. **Provider completes onboarding** → Submits profile for approval
3. **Admin approves** → Provider becomes visible to customers (`approval_status = "approved"`)
4. **Admin rejects** → Provider remains invisible; provider gets notified with reason

## Changes Made

### 1. Database Models

#### `ServiceProvider` Model (`backend/models/service_provider.py`)
- **Added field**: `approval_status` (ENUM: 'pending', 'approved', 'rejected')
- Default value: `"pending"`
- Prevents unapproved providers from being visible to customers

#### New Model: `ProviderApprovalRequest` (`backend/models/provider_approval.py`)
- Tracks all approval requests for providers
- Fields:
  - `provider_id`: FK to ServiceProvider
  - `status`: pending/approved/rejected
  - `approved_by`: Admin user ID who approved/rejected
  - `approval_notes`: Reason for approval/rejection
  - `approved_at`: Timestamp when approved/rejected
  - `created_at`: When request was created

### 2. Services

#### New Service: `provider_approval_service.py`
Functions:
- `create_approval_request(db, provider_id)`: Creates approval request + notifies admins
- `get_pending_approval_requests(db, page, limit)`: Lists pending requests (admin only)
- `approve_provider(db, request_id, admin_id, notes)`: Approves provider → visible to customers
- `reject_provider(db, request_id, admin_id, notes)`: Rejects provider → stays invisible
- `get_provider_approval_status(db, provider_id)`: Check approval status

#### Modified: `customer_service.py`
- `get_providers()`: Added filter `.filter(ServiceProvider.approval_status == "approved")`
- `get_provider_detail()`: Added filter `.filter(ServiceProvider.approval_status == "approved")`
- Now only approved providers appear in customer searches

### 3. API Endpoints

#### Provider Endpoints (`routers/provider.py`)
**POST** `/api/provider/onboarding/submit-for-approval`
- Provider submits their profile for admin approval
- Creates `ProviderApprovalRequest` record
- Triggers admin notification
- Response: `{ approval_status, approval_request_id, message }`

#### Admin Approval Endpoints (`routers/provider_approval.py`)
**GET** `/api/providers/approval/pending-requests?page=1&limit=10`
- Lists all pending provider approval requests
- Admin only
- Returns: provider details, request date, etc.

**POST** `/api/providers/approval/requests/{request_id}/decide`
- Approve or reject a provider
- Body: `{ status: "approved"|"rejected", notes: "..." }`
- Admin only
- Updates `ServiceProvider.approval_status`
- Sends notification to provider

**GET** `/api/providers/approval/status/{provider_id}`
- Check approval status of a specific provider
- Provider can check their own status
- Admin can check any provider's status

### 4. Database Migration

**File**: `migrate_add_provider_approval.py`
- Adds `approval_status` column to `service_providers` table
- Creates `provider_approval_requests` table
- Safe to run multiple times (checks if columns exist first)

**To run migration**:
```bash
python migrate_add_provider_approval.py
```

### 5. Data Flow

#### Signup Flow
```
Provider Signup
    ↓
User.role = "provider"
ServiceProvider.approval_status = "pending"
    ↓
Provider NOT visible to customers
```

#### Approval Flow
```
Provider completes onboarding
    ↓
Calls: POST /api/provider/onboarding/submit-for-approval
    ↓
ProviderApprovalRequest created (status: pending)
Admin notifications sent
    ↓
Admin views: GET /api/providers/approval/pending-requests
    ↓
Admin decides: POST /api/providers/approval/requests/{id}/decide
    ↓
If approved:
  - ServiceProvider.approval_status = "approved"
  - Provider notification sent
  - Provider NOW visible to customers
Else (rejected):
  - ServiceProvider.approval_status = "rejected"
  - Provider notification with reason
  - Provider stays invisible to customers
```

#### Customer View Flow
```
Customer searches providers
    ↓
Query applies filters:
  - is_verified = true
  - is_accepting_appointments = true
  - approval_status = "approved"  ← NEW FILTER
    ↓
Only approved providers returned
```

## Existing Functionalities Not Disturbed

✅ **Authentication** - No changes to auth flow
✅ **Appointments** - Providers can still manage appointments
✅ **Provider Dashboard** - Providers can still view their profile
✅ **Admin Provider List** - Admins see all providers (with approval status)
✅ **Customer Search** - Now filters approved providers only
✅ **Organization Workflows** - Not affected
✅ **Payment Processing** - Not affected
✅ **Notifications** - New notifications added only for approval workflow
✅ **Availability Management** - Not affected

## API Compatibility

### Breaking Changes
**None** - All existing endpoints continue to work

### New Endpoints
- `POST /api/provider/onboarding/submit-for-approval`
- `GET /api/providers/approval/pending-requests`
- `POST /api/providers/approval/requests/{request_id}/decide`
- `GET /api/providers/approval/status/{provider_id}`

### Modified Behavior
- Customers only see approved providers (filtered at service layer)
- This is transparent to frontend (same endpoint response, fewer providers)

## State Management

Provider can have these approval statuses:
- `"pending"` (default) → Not visible to customers
- `"approved"` → Visible to customers
- `"rejected"` → Not visible to customers (can resubmit)

Provider can resubmit after rejection by calling:
`POST /api/provider/onboarding/submit-for-approval`

New `ProviderApprovalRequest` will be created with previous rejection notes available.

## Notifications

When approval request created:
- All admin users get notification
- Type: "provider_approval"
- Message: "Provider {name} ({email}) has submitted their profile for approval"

When provider approved:
- Provider gets notification
- Type: "provider_approved"
- Message: "Your provider profile has been approved and is now visible to customers!"

When provider rejected:
- Provider gets notification
- Type: "provider_rejected"
- Message: "Your provider profile was not approved. Reason: {admin notes}"

## Testing Checklist

- [ ] Run migration: `python migrate_add_provider_approval.py`
- [ ] Provider signs up → approval_status = "pending"
- [ ] Provider calls submit-for-approval endpoint
- [ ] ProviderApprovalRequest created
- [ ] Admin notification sent
- [ ] Admin views pending requests
- [ ] Admin approves → approval_status = "approved"
- [ ] Provider notification sent
- [ ] Provider appears in customer search
- [ ] Admin rejects → approval_status = "rejected"
- [ ] Provider notification sent with reason
- [ ] Provider doesn't appear in customer search
- [ ] Provider can resubmit
- [ ] Existing endpoints still work
