# Provider Approval Workflow - API Guide

## Flow Summary

```
1. Provider completes onboarding
2. Provider submits for approval
3. Admin reviews pending requests
4. Admin approves or rejects
5. Provider receives notification
6. If approved: visible to customers
```

## Endpoints

### 1. Provider Submits Profile for Approval

**Request**
```http
POST /api/provider/onboarding/submit-for-approval
Authorization: Bearer {provider_token}
```

**Response (Success)**
```json
{
  "success": true,
  "message": "Profile submitted for approval",
  "data": {
    "approval_status": "pending",
    "approval_request_id": "550e8400-e29b-41d4-a716-446655440000",
    "message": "Your profile has been submitted for admin approval. You'll be notified once it's reviewed."
  }
}
```

**Notes**
- Provider can only submit once per approval cycle
- If trying to submit again while pending: error "This provider already has a pending approval request"
- Provider can resubmit after rejection

---

### 2. Admin Views Pending Approval Requests

**Request**
```http
GET /api/providers/approval/pending-requests?page=1&limit=10
Authorization: Bearer {admin_token}
```

**Response**
```json
{
  "success": true,
  "message": "Pending approval requests fetched",
  "data": {
    "total": 5,
    "page": 1,
    "limit": 10,
    "total_pages": 1,
    "requests": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "provider_id": "660e8400-e29b-41d4-a716-446655440001",
        "provider_name": "Dr. Raj Kumar",
        "provider_email": "raj@example.com",
        "specialization": "Cardiology",
        "organization_name": "Apollo Hospital",
        "city": "Bengaluru",
        "state": "Karnataka",
        "requested_at": "2024-01-15T10:30:00"
      },
      {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "provider_name": "Dr. Priya Sharma",
        ...
      }
    ]
  }
}
```

**Pagination**
- `page`: Current page (1-indexed)
- `limit`: Items per page (default 10, max 100)
- `total_pages`: Total pages available

---

### 3. Admin Approves Provider

**Request**
```http
POST /api/providers/approval/requests/{request_id}/decide
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "status": "approved",
  "notes": "Profile looks good. Documents verified." 
}
```

**Response (Success)**
```json
{
  "success": true,
  "message": "Provider approved successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "provider_id": "660e8400-e29b-41d4-a716-446655440001",
    "status": "approved",
    "approved_by": "admin-user-id",
    "approval_notes": "Profile looks good. Documents verified.",
    "approved_at": "2024-01-15T11:45:00"
  }
}
```

**What happens**
- `ServiceProvider.approval_status` → "approved"
- Provider notification sent
- Provider now visible to customers in search

---

### 4. Admin Rejects Provider

**Request**
```http
POST /api/providers/approval/requests/{request_id}/decide
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "status": "rejected",
  "notes": "Incomplete tax documentation. Please resubmit with valid tax ID."
}
```

**Response (Success)**
```json
{
  "success": true,
  "message": "Provider rejected",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "provider_id": "660e8400-e29b-41d4-a716-446655440001",
    "status": "rejected",
    "approved_by": "admin-user-id",
    "approval_notes": "Incomplete tax documentation. Please resubmit with valid tax ID.",
    "approved_at": "2024-01-15T11:45:00"
  }
}
```

**What happens**
- `ServiceProvider.approval_status` → "rejected"
- Provider notification sent with reason
- Provider stays invisible to customers
- Provider can resubmit by calling endpoint #1 again

---

### 5. Check Provider Approval Status

**Request**
```http
GET /api/providers/approval/status/{provider_id}
Authorization: Bearer {token}
```

**Response**
```json
{
  "success": true,
  "message": "Provider approval status fetched",
  "data": {
    "provider_id": "660e8400-e29b-41d4-a716-446655440001",
    "approval_status": "approved",
    "request": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "approved",
      "created_at": "2024-01-15T10:30:00",
      "approved_at": "2024-01-15T11:45:00",
      "approval_notes": "Profile looks good. Documents verified."
    }
  }
}
```

**If no approval request yet**
```json
{
  "success": true,
  "message": "Provider approval status fetched",
  "data": {
    "provider_id": "660e8400-e29b-41d4-a716-446655440001",
    "approval_status": "pending",
    "request": null
  }
}
```

---

## Error Responses

### Invalid Status
```json
{
  "success": false,
  "message": "Status must be 'approved' or 'rejected'",
  "error": "Validation Error"
}
```

### Already Processed
```json
{
  "success": false,
  "message": "This request has already been processed",
  "error": "Bad Request"
}
```

### Not Found
```json
{
  "success": false,
  "message": "Provider",
  "error": "Not Found"
}
```

### Duplicate Submission
```json
{
  "success": false,
  "message": "This provider already has a pending approval request",
  "error": "Bad Request"
}
```

### Admin Only
```json
{
  "success": false,
  "message": "Admin access required",
  "error": "Forbidden"
}
```

---

## Frontend Integration

### Provider Onboarding Page
1. Provider fills out profile
2. Provider clicks "Submit for Approval" button
3. Call: `POST /api/provider/onboarding/submit-for-approval`
4. Show message: "Profile submitted for approval. You'll be notified once it's reviewed."
5. Show approval status badge: "Pending Approval"

### Admin Dashboard - Provider Management
1. Add section: "Provider Approval Requests"
2. Show count of pending requests
3. List pending requests with pagination
4. For each request, show:
   - Provider name & email
   - Specialization
   - Organization
   - City/State
   - Request date
5. Action buttons:
   - "Approve" → opens dialog for notes (optional)
   - "Reject" → opens dialog for reason (required)
6. After decision, refresh list and show confirmation

### Customer Provider Search
- No UI changes needed
- Backend automatically filters unapproved providers
- Customers only see approved providers

### Provider Dashboard
- Add status indicator showing approval state
- If pending: "Awaiting Admin Approval"
- If approved: "Active" (green check)
- If rejected: "Rejected - Review Feedback" (with option to view notes and resubmit)

---

## State Transitions

```
Provider Signup
    ↓
Status: pending (invisible to customers)
    ↓
[Provider fills onboarding, submits]
    ↓
Still pending (waiting for admin)
    ↓
[Admin reviews]
    ├─→ [Approve] → Status: approved → Visible to customers ✓
    └─→ [Reject] → Status: rejected → Still invisible
        ↓
        [Provider resubmits after fixing issues]
        ↓
        New approval request created (pending)
        ↓
        [Admin reviews again]
        ├─→ [Approve] → Status: approved → Visible to customers ✓
        └─→ [Reject] → Status: rejected → Cycle repeats
```

---

## Testing Scenarios

### Scenario 1: Happy Path
1. Provider signs up
2. Provider completes onboarding
3. Provider submits for approval
4. Admin approves
5. Provider visible to customers ✓

### Scenario 2: Rejection & Resubmission
1. Provider submits profile
2. Admin rejects with feedback
3. Provider receives notification
4. Provider updates profile
5. Provider resubmits
6. Admin approves
7. Provider visible to customers ✓

### Scenario 3: Admin Workflow
1. Multiple providers submit for approval
2. Admin sees pending requests list
3. Admin approves some, rejects others
4. Notifications sent to all providers
5. Approved providers appear in customer search ✓

### Scenario 4: Duplicate Submission
1. Provider submits for approval
2. Provider tries to submit again while pending
3. Error: "This provider already has a pending approval request" ✓

---

## Database State

### service_providers Table
```sql
-- New field added:
ALTER TABLE service_providers 
ADD COLUMN approval_status ENUM('pending', 'approved', 'rejected') 
NOT NULL DEFAULT 'pending';

-- Sample data:
SELECT id, user_id, specialization, approval_status FROM service_providers;
```

### provider_approval_requests Table
```sql
-- New table:
CREATE TABLE provider_approval_requests (
    id CHAR(36) PRIMARY KEY,
    provider_id CHAR(36) NOT NULL UNIQUE,
    status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    approved_by CHAR(36),
    approval_notes TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    approved_at DATETIME,
    FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Sample query:
SELECT * FROM provider_approval_requests 
WHERE status = 'pending' 
ORDER BY created_at DESC;
```

---

## Notes

- Providers can check their own approval status
- Admins can check any provider's approval status
- Approval workflow is independent of provider verification (`is_verified`)
- A provider can be verified but not approved (won't be visible)
- A provider can be approved but not verified (might be visible based on other filters)
- Providers remain invisible until **both**:
  1. `is_verified = true`
  2. `approval_status = "approved"`
  3. `is_accepting_appointments = true`
