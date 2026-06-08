# Provider Approval System - API Quick Reference

## Admin Endpoints (All in /api/organizations)

### 1️⃣ View Pending Requests (Unified)

```bash
# All requests (provider + org)
GET /api/organizations/approval-requests/all?page=1&limit=10

# Provider requests only
GET /api/organizations/approval-requests/all?request_type=provider&page=1&limit=10

# Organization requests only
GET /api/organizations/approval-requests/all?request_type=organization&page=1&limit=10
```

**Response includes:**
```json
{
  "requests": [
    {
      "id": "req-123",
      "type": "provider",  // or "organization"
      "name": "Dr. Name",
      "email": "email@example.com",
      "description": "Specialization at Organization",
      "requested_at": "2024-01-15T10:30:00"
    }
  ]
}
```

### 2️⃣ Approve Request

```bash
# Approve provider
POST /api/organizations/approval-requests/{request_id}/provider/decide
{
  "status": "approved",
  "notes": "Documents verified"
}

# Approve organization
POST /api/organizations/approval-requests/{request_id}/organization/decide
{
  "status": "approved",
  "notes": "Organization details verified"
}
```

### 3️⃣ Reject Request

```bash
# Reject provider
POST /api/organizations/approval-requests/{request_id}/provider/decide
{
  "status": "rejected",
  "notes": "Incomplete tax documentation"
}

# Reject organization
POST /api/organizations/approval-requests/{request_id}/organization/decide
{
  "status": "rejected",
  "notes": "Requires more information"
}
```

---

## Provider Endpoints (All in /api/provider)

### 1️⃣ Submit for Approval

```bash
POST /api/provider/onboarding/submit-for-approval

# Response
{
  "approval_status": "pending",
  "approval_request_id": "req-456",
  "message": "Your profile has been submitted..."
}
```

### 2️⃣ Check Approval Status

```bash
GET /api/provider/approval-status

# Response
{
  "approval_status": "pending",  // or "approved", "rejected"
  "approval_request": {
    "status": "pending",
    "created_at": "2024-01-15T10:30:00",
    "approved_at": null,
    "approval_notes": null,
    "can_resubmit": false
  }
}
```

---

## cURL Examples

### Admin: View All Pending

```bash
curl -X GET "http://api/api/organizations/approval-requests/all?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

### Admin: Approve Provider

```bash
curl -X POST "http://api/api/organizations/approval-requests/req-123/provider/decide" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "notes": "All documents verified"
  }'
```

### Admin: Reject Provider

```bash
curl -X POST "http://api/api/organizations/approval-requests/req-123/provider/decide" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "rejected",
    "notes": "Tax ID not valid. Please resubmit."
  }'
```

### Provider: Submit for Approval

```bash
curl -X POST "http://api/api/provider/onboarding/submit-for-approval" \
  -H "Authorization: Bearer YOUR_PROVIDER_TOKEN" \
  -H "Content-Type: application/json"
```

### Provider: Check Status

```bash
curl -X GET "http://api/api/provider/approval-status" \
  -H "Authorization: Bearer YOUR_PROVIDER_TOKEN" \
  -H "Content-Type: application/json"
```

---

## JavaScript/Fetch Examples

### Admin: View Pending Requests

```javascript
const response = await fetch(
  'http://api/api/organizations/approval-requests/all?page=1&limit=10',
  {
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  }
);
const data = await response.json();
console.log(data.data.requests);
```

### Admin: Approve

```javascript
const response = await fetch(
  'http://api/api/organizations/approval-requests/req-123/provider/decide',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: 'approved',
      notes: 'Profile verified'
    })
  }
);
const result = await response.json();
```

### Provider: Submit

```javascript
const response = await fetch(
  'http://api/api/provider/onboarding/submit-for-approval',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${providerToken}`
    }
  }
);
const result = await response.json();
console.log(result.data.approval_request_id);
```

### Provider: Check Status

```javascript
const response = await fetch(
  'http://api/api/provider/approval-status',
  {
    headers: {
      'Authorization': `Bearer ${providerToken}`
    }
  }
);
const data = await response.json();
console.log(data.data.approval_status); // "pending", "approved", or "rejected"
console.log(data.data.approval_request);
```

---

## React Hook Example

```javascript
// useProviderApproval.js
import { useState, useEffect } from 'react';
import api from '@/api'; // Your axios instance

export function useProviderApproval() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get('/provider/approval-status');
      setStatus(response.data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitForApproval = async () => {
    try {
      const response = await api.post('/provider/onboarding/submit-for-approval');
      setStatus(response.data.data);
      return response.data.data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return { status, loading, error, submitForApproval, refetch: fetchStatus };
}

// Usage in component
function ProviderDashboard() {
  const { status, submitForApproval } = useProviderApproval();

  return (
    <div>
      <h2>Approval Status: {status?.approval_status}</h2>
      {status?.approval_status === 'pending' && (
        <p>Awaiting admin review...</p>
      )}
      {status?.approval_status === 'rejected' && (
        <>
          <p>Feedback: {status.approval_request?.approval_notes}</p>
          <button onClick={submitForApproval}>Resubmit</button>
        </>
      )}
    </div>
  );
}
```

---

## Status Codes & Errors

### Success (200)
```json
{
  "success": true,
  "message": "...",
  "data": { ... }
}
```

### Bad Request (400)
```json
{
  "success": false,
  "message": "Status must be 'approved' or 'rejected'",
  "error": "Bad Request"
}
```

### Unauthorized (401)
```json
{
  "success": false,
  "message": "Invalid or expired token",
  "error": "Unauthorized"
}
```

### Forbidden (403)
```json
{
  "success": false,
  "message": "Admin access required",
  "error": "Forbidden"
}
```

### Not Found (404)
```json
{
  "success": false,
  "message": "Request not found",
  "error": "Not Found"
}
```

---

## State Flow

```
PENDING
  ├─ GET /approval-status → { status: "pending" }
  ├─ User sees: "Awaiting Review"
  └─ POST /decide with status: "approved" or "rejected"
       ├─→ APPROVED
       │    ├─ GET /approval-status → { status: "approved" }
       │    └─ Visible to customers
       └─→ REJECTED
            ├─ GET /approval-status → { status: "rejected" }
            ├─ User sees: Rejection reason
            └─ User can POST /submit-for-approval again
```

---

## Typical Admin Workflow

```
1. GET /api/organizations/approval-requests/all
   ↓ (displays 5 pending)
   
2. Click on provider "Dr. Raj Kumar"
   ↓
   
3. Review details (name, email, specialization, etc.)
   ↓
   
4. Choose Approve/Reject + Add notes
   ↓
   
5. POST /api/organizations/approval-requests/req-123/provider/decide
   ↓ (backend updates ServiceProvider.approval_status)
   ↓ (backend sends notification to provider)
   
6. GET /api/organizations/approval-requests/all
   ↓ (shows 4 pending - request removed)
```

---

## Typical Provider Workflow

```
1. Complete onboarding form
   ↓
   
2. Click "Submit for Approval"
   ↓
   
3. POST /api/provider/onboarding/submit-for-approval
   ↓ (ProviderApprovalRequest created)
   ↓ (Admin notifications sent)
   
4. GET /api/provider/approval-status
   ↓ (shows status: "pending")
   
5. Wait for admin decision...
   ↓
   
6. GET /api/provider/approval-status
   ↓ (shows status: "approved" or "rejected")
   
   If rejected:
   - Fix issues
   - POST /api/provider/onboarding/submit-for-approval (again)
```

---

## Database Check Queries

```sql
-- View provider approval requests
SELECT id, provider_id, status, created_at, approved_at
FROM provider_approval_requests
WHERE provider_id = 'provider-uuid';

-- Check provider approval status
SELECT id, specialization, approval_status, updated_at
FROM service_providers
WHERE id = 'provider-uuid';

-- View all pending
SELECT 'provider' as type, id, status, created_at FROM provider_approval_requests WHERE status = 'pending'
UNION
SELECT 'organization' as type, id, status, created_at FROM organization_requests WHERE status = 'pending'
ORDER BY created_at DESC;
```

---

## Common Issues & Solutions

**Issue**: Endpoint returns 404
- **Check**: Is the provider/admin authenticated?
- **Fix**: Add Authorization header with valid token

**Issue**: Approval doesn't reflect in UI
- **Check**: Did you GET /approval-status after POST /decide?
- **Fix**: Refresh page or call GET /approval-status again

**Issue**: Provider can't resubmit
- **Check**: Is approval_status = "rejected"?
- **Check**: Is approval_request.can_resubmit = true?
- **Fix**: Only rejected requests can resubmit

**Issue**: Admin can't see request
- **Check**: Is user role = "admin"?
- **Check**: Does request exist with status = "pending"?
- **Fix**: Verify admin token and request status in DB

---

**Version**: 1.0
**Last Updated**: January 2024
**Status**: Ready for Integration ✅
