# Admin Approval Workflow - Unified Dashboard

## Overview

Admin dashboard shows BOTH organization and provider approval requests in a unified page, just like the org requests page. Admins can review, approve, and reject both types of requests from one place.

## Admin API Endpoints

### 1. Get All Pending Approval Requests (Unified)

**Endpoint:**
```http
GET /api/organizations/approval-requests/all?request_type=&page=1&limit=10
```

**Query Parameters:**
- `request_type` (optional): Filter by "organization", "provider", or leave empty for both
- `page` (optional): Default 1
- `limit` (optional): Default 10, max 50

**Response:**
```json
{
  "success": true,
  "message": "All approval requests fetched",
  "data": {
    "total": 5,
    "page": 1,
    "limit": 10,
    "total_pages": 1,
    "requests": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "type": "provider",
        "status": "pending",
        "name": "Dr. Raj Kumar",
        "email": "raj@example.com",
        "description": "Cardiology at Apollo Hospital",
        "requested_by": "Dr. Raj Kumar",
        "requested_at": "2024-01-15T10:30:00",
        "request_details": {
          "specialization": "Cardiology",
          "organization": "Apollo Hospital",
          "city": "Bengaluru",
          "state": "Karnataka"
        }
      },
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "type": "organization",
        "status": "pending",
        "name": "Tech Solutions Inc",
        "email": "contact@techsolutions.com",
        "description": "Leading software consulting firm",
        "requested_by": "John Smith",
        "requested_at": "2024-01-14T14:20:00",
        "request_details": {
          "location": "Bengaluru",
          "org_type": "Technology"
        }
      }
    ]
  }
}
```

### 2. Filter by Type

**Get only provider requests:**
```http
GET /api/organizations/approval-requests/all?request_type=provider
```

**Get only organization requests:**
```http
GET /api/organizations/approval-requests/all?request_type=organization
```

### 3. Approve or Reject Request (Unified)

**Endpoint:**
```http
POST /api/organizations/approval-requests/{request_id}/{request_type}/decide
```

**Parameters:**
- `request_id`: ID of the approval request
- `request_type`: "provider" or "organization"

**Request Body:**
```json
{
  "status": "approved",
  "notes": "Profile verified. Documents checked."
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Provider approved successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "provider",
    "status": "approved"
  }
}
```

**What Happens:**
- For **provider** approval:
  - `ServiceProvider.approval_status` → "approved"/"rejected"
  - Provider becomes visible/invisible to customers
  - Provider notification sent with status + notes

- For **organization** approval:
  - `Organization.approval_status` → "approved"/"rejected"
  - `Organization.is_approved` → true/false
  - Organization request status updated
  - Requester notification sent

---

## Admin Dashboard UI Implementation

### Page: Approval Requests (Unified)

```
┌─────────────────────────────────────────────────────────┐
│  ADMIN DASHBOARD - APPROVAL REQUESTS                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Filter:  ☐ All  ☐ Providers  ☐ Organizations       │
│                                                         │
│  [Pending: 5]  [Approved: 12]  [Rejected: 3]          │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  REQUEST LIST                              Page 1 of 1 │
│  ═══════════════════════════════════════════════════  │
│                                                        │
│  1. Dr. Raj Kumar (Provider)                          │
│     📧 raj@example.com | Cardiology | Bengaluru     │
│     Submitted: 15 Jan 2024, 10:30 AM                │
│     [📋 View Details] [✓ Approve] [✗ Reject]       │
│                                                      │
│  2. Tech Solutions Inc (Organization)                │
│     📧 contact@tech.com | Tech Consulting          │
│     Submitted: 14 Jan 2024, 2:20 PM                │
│     [📋 View Details] [✓ Approve] [✗ Reject]       │
│                                                      │
│  3. Dr. Priya Sharma (Provider)                      │
│     📧 priya@example.com | Psychiatry | Mumbai      │
│     Submitted: 12 Jan 2024, 5:15 PM                │
│     [📋 View Details] [✓ Approve] [✗ Reject]       │
│                                                      │
└─────────────────────────────────────────────────────────┘
```

### Approval Modal

```
┌─────────────────────────────────────────────────────────┐
│  REVIEW REQUEST - Dr. Raj Kumar (Provider)              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Type: PROVIDER                                         │
│  Name: Dr. Raj Kumar                                    │
│  Email: raj@example.com                                │
│  Specialization: Cardiology                             │
│  Organization: Apollo Hospital                          │
│  City/State: Bengaluru, Karnataka                       │
│  Submitted: 15 Jan 2024, 10:30 AM                      │
│                                                         │
│  ─────────────────────────────────────────────────      │
│                                                         │
│  DOCUMENTS:                                             │
│  □ Tax ID: ✓ Verified                                  │
│  □ Bank Details: ✓ Verified                            │
│  □ Certificates: ✓ Uploaded (3 files)                 │
│                                                         │
│  ─────────────────────────────────────────────────      │
│                                                         │
│  DECISION:                                              │
│                                                         │
│  Status: ◉ Approve  ○ Reject                           │
│                                                         │
│  Notes (optional):                                      │
│  ┌────────────────────────────────────────────────┐    │
│  │ Profile and documents verified. Good to go.   │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│                              [Cancel] [Submit Decision] │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Frontend Implementation Example

### React Component

```jsx
// AdminApprovalRequests.jsx

import React, { useState, useEffect } from 'react';
import api from '@/api';

export default function AdminApprovalRequests() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState(null); // 'provider', 'organization', null
  const [page, setPage] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [decision, setDecision] = useState('approved');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchRequests();
  }, [page, filter]);

  const fetchRequests = async () => {
    try {
      const params = { page, limit: 10 };
      if (filter) params.request_type = filter;
      
      const response = await api.get('/api/organizations/approval-requests/all', { params });
      setRequests(response.data.data.requests);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    }
  };

  const handleDecision = async () => {
    try {
      await api.post(
        `/api/organizations/approval-requests/${selectedRequest.id}/${selectedRequest.type}/decide`,
        { status: decision, notes }
      );
      setSelectedRequest(null);
      setNotes('');
      fetchRequests(); // Refresh list
    } catch (error) {
      console.error('Failed to process decision:', error);
    }
  };

  return (
    <div className="approval-requests-page">
      <h1>Approval Requests</h1>
      
      {/* Filter buttons */}
      <div className="filters">
        <button 
          className={!filter ? 'active' : ''} 
          onClick={() => setFilter(null)}
        >
          All
        </button>
        <button 
          className={filter === 'provider' ? 'active' : ''} 
          onClick={() => setFilter('provider')}
        >
          Providers
        </button>
        <button 
          className={filter === 'organization' ? 'active' : ''} 
          onClick={() => setFilter('organization')}
        >
          Organizations
        </button>
      </div>

      {/* Requests list */}
      <div className="requests-list">
        {requests.map(request => (
          <div key={request.id} className={`request-card ${request.type}`}>
            <div className="request-header">
              <h3>{request.name}</h3>
              <span className="type-badge">{request.type}</span>
            </div>
            
            <div className="request-info">
              <p>📧 {request.email}</p>
              <p>{request.description}</p>
              <p className="submitted">Submitted: {request.requested_at}</p>
            </div>

            <div className="actions">
              <button 
                className="view-btn"
                onClick={() => setSelectedRequest(request)}
              >
                View & Decide
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Decision modal */}
      {selectedRequest && (
        <div className="modal">
          <div className="modal-content">
            <h2>Review {selectedRequest.type === 'provider' ? 'Provider' : 'Organization'}</h2>
            
            <div className="details">
              <p><strong>Name:</strong> {selectedRequest.name}</p>
              <p><strong>Email:</strong> {selectedRequest.email}</p>
              <p><strong>Description:</strong> {selectedRequest.description}</p>
            </div>

            <div className="decision">
              <label>
                <input 
                  type="radio" 
                  name="decision" 
                  value="approved"
                  checked={decision === 'approved'}
                  onChange={(e) => setDecision(e.target.value)}
                />
                Approve
              </label>
              <label>
                <input 
                  type="radio" 
                  name="decision" 
                  value="rejected"
                  checked={decision === 'rejected'}
                  onChange={(e) => setDecision(e.target.value)}
                />
                Reject
              </label>
            </div>

            <textarea 
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <div className="modal-actions">
              <button onClick={() => setSelectedRequest(null)}>Cancel</button>
              <button onClick={handleDecision}>Submit Decision</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Provider UI Updates

### Provider Dashboard - Approval Status Section

```
┌─────────────────────────────────────────────────────┐
│ PROFILE APPROVAL STATUS                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Status: 🟡 PENDING REVIEW                          │
│                                                     │
│ Your profile has been submitted for admin approval │
│ You will be notified once the review is complete.  │
│                                                     │
│ Submitted: 15 Jan 2024 at 10:30 AM                │
│ Expected Review Time: 2-3 business days           │
│                                                     │
│ [📱 View Details]                                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**After Approval:**
```
┌─────────────────────────────────────────────────────┐
│ PROFILE APPROVAL STATUS                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Status: ✅ APPROVED                                │
│                                                     │
│ Your profile is now active and visible to          │
│ customers. Start accepting appointments!           │
│                                                     │
│ Approved: 16 Jan 2024 at 2:15 PM                 │
│ Admin Notes: Profile looks great. Well documented │
│                                                     │
│ [🎯 View Stats] [📝 Update Profile]               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**After Rejection:**
```
┌─────────────────────────────────────────────────────┐
│ PROFILE APPROVAL STATUS                             │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Status: ❌ REJECTED                                │
│                                                     │
│ Admin Notes:                                        │
│ "Incomplete tax documentation. Please upload      │
│ valid tax ID and resubmit."                        │
│                                                     │
│ Rejected: 16 Jan 2024 at 10:45 AM                │
│                                                     │
│ [✏️ Fix & Resubmit]  [📞 Contact Support]        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Provider API for Status Display

**Get Current Provider's Approval Status:**
```http
GET /api/provider/approval-status
```

**Response:**
```json
{
  "success": true,
  "message": "Approval status fetched",
  "data": {
    "provider_id": "660e8400-e29b-41d4-a716-446655440001",
    "approval_status": "pending",
    "profile_complete": true,
    "approval_request": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "pending",
      "created_at": "2024-01-15T10:30:00",
      "approved_at": null,
      "approval_notes": null,
      "can_resubmit": false
    }
  }
}
```

---

## Database Queries

### View all pending requests

```sql
-- Organizations
SELECT * FROM organization_requests WHERE status = 'pending';

-- Providers
SELECT * FROM provider_approval_requests WHERE status = 'pending';

-- Combined (for understanding)
SELECT 
  id,
  'organization' as type,
  status,
  created_at
FROM organization_requests 
WHERE status = 'pending'
UNION
SELECT 
  id,
  'provider' as type,
  status,
  created_at
FROM provider_approval_requests 
WHERE status = 'pending'
ORDER BY created_at DESC;
```

### Check provider approval after admin decision

```sql
SELECT 
  id,
  user_id,
  specialization,
  approval_status,
  updated_at
FROM service_providers 
WHERE id = 'provider_id_here';
```

---

## Testing Scenario

### Step 1: Provider Submits
```bash
POST /api/provider/onboarding/submit-for-approval
```
- ProviderApprovalRequest created (status: pending)
- ServiceProvider.approval_status = "pending"

### Step 2: Admin Sees Request
```bash
GET /api/organizations/approval-requests/all?request_type=provider
```
- Request appears in list

### Step 3: Admin Approves
```bash
POST /api/organizations/approval-requests/{id}/provider/decide
Body: {"status": "approved", "notes": "Good!"}
```
- ProviderApprovalRequest.status = "approved"
- ServiceProvider.approval_status = "approved"
- Provider notification sent
- ServiceProvider.updated_at updated

### Step 4: Provider Checks Status
```bash
GET /api/provider/approval-status
```
- Shows status: "approved"
- Includes approval notes

### Step 5: Provider Visible to Customers
```bash
GET /api/customer/providers
```
- Approved provider appears in results

---

## Key Changes Summary

| Component | Change |
|-----------|--------|
| Admin Routes | Added unified approval endpoint |
| Provider Routes | Added approval-status endpoint |
| Organization Routes | Enhanced with unified requests page |
| Database | Both request types tracked separately |
| UI | Single dashboard for both types |
| Notifications | Sent to both providers and org admins |

---

**Status**: ✅ **IMPLEMENTATION COMPLETE**
**Ready for**: Frontend Integration + Testing
