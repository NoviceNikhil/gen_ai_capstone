# Provider Organization Management - Complete Guide

## Overview

Providers can now freely manage their organization membership:
- **Leave Organization** - Quit current organization
- **Request to Join** - Join a different approved organization  
- **View Requests** - Track pending join requests
- **Get Organization** - View current organization details

---

## Workflow

```
Provider Scenario 1: Leave & Join New Organization
───────────────────────────────────────────────────

1. Provider in "Organization A"
   
2. Provider calls: POST /api/provider/organization/leave
   └─ Leaves Organization A
   └─ Notifications sent
   
3. Provider is now independent
   
4. Provider finds "Organization B"
   
5. Provider calls: POST /api/provider/organization/{org_id}/request-join
   └─ Sends join request to Organization B admin
   └─ Status: pending
   
6. Organization B admin:
   - Receives notification
   - Reviews request
   - Approves or rejects
   
7. If approved:
   - Provider is now in Organization B
   - Notifications sent
   
8. If rejected:
   - Provider remains independent
   - Can request to join another org
```

---

## API Endpoints

### 1. Get Current Organization

**Endpoint:**
```http
GET /api/provider/organization
Authorization: Bearer {provider_token}
```

**Response (If in organization):**
```json
{
  "success": true,
  "message": "Organization details fetched",
  "data": {
    "organization": {
      "id": "org-123",
      "name": "Apollo Hospital",
      "description": "Leading healthcare provider",
      "location": "Bengaluru",
      "contact_email": "admin@apollo.com",
      "contact_phone": "1234567890"
    }
  }
}
```

**Response (If not in organization):**
```json
{
  "success": true,
  "message": "Provider not in an organization",
  "data": {
    "organization": null
  }
}
```

---

### 2. Leave Organization

**Endpoint:**
```http
POST /api/provider/organization/leave
Authorization: Bearer {provider_token}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully left organization",
  "data": {
    "message": "You have left Apollo Hospital",
    "organization_id": "org-123"
  }
}
```

**What Happens:**
- Provider's `organization_id` set to `null`
- Organization admin notified
- Provider notified
- Can now join another organization

**Error Cases:**
```json
{
  "success": false,
  "message": "Provider is not in any organization",
  "error": "Not in organization"
}
```

---

### 3. Request to Join Organization

**Endpoint:**
```http
POST /api/provider/organization/{org_id}/request-join
Authorization: Bearer {provider_token}
```

**Path Parameters:**
- `org_id`: UUID of the organization to join

**Response (Success):**
```json
{
  "success": true,
  "message": "Join request created successfully",
  "data": {
    "id": "join-req-456",
    "organization_id": "org-456",
    "status": "pending",
    "message": "Join request sent to Tech Solutions. Waiting for approval."
  }
}
```

**Error Cases:**

Already in organization:
```json
{
  "success": false,
  "message": "You are already a member of Apollo Hospital. Leave first to join another.",
  "error": "Bad Request"
}
```

Organization not found/not approved:
```json
{
  "success": false,
  "message": "Approved organization not found",
  "error": "Not Found"
}
```

Duplicate pending request:
```json
{
  "success": false,
  "message": "A pending join request already exists for this organization",
  "error": "Bad Request"
}
```

---

### 4. Get Pending Join Requests

**Endpoint:**
```http
GET /api/provider/organization/pending-requests
Authorization: Bearer {provider_token}
```

**Response:**
```json
{
  "success": true,
  "message": "Pending join requests fetched",
  "data": {
    "requests": [
      {
        "id": "join-req-456",
        "organization_id": "org-456",
        "organization_name": "Tech Solutions",
        "organization_type": "Technology",
        "organization_location": "Bengaluru",
        "requested_at": "2024-01-15T10:30:00",
        "status": "pending"
      },
      {
        "id": "join-req-789",
        "organization_id": "org-789",
        "organization_name": "Medical Center",
        "organization_type": "Healthcare",
        "organization_location": "Mumbai",
        "requested_at": "2024-01-14T15:20:00",
        "status": "pending"
      }
    ],
    "total": 2
  }
}
```

---

## Organization Admin Endpoints (Existing)

### Respond to Join Request

**Endpoint:**
```http
POST /api/organizations/{org_id}/org-dashboard/join-requests/{request_id}/respond
Authorization: Bearer {org_admin_token}
```

**Request Body:**
```json
{
  "status": "approved",
  "approval_notes": "Welcome to the team!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Join request updated",
  "data": {
    "status": "approved"
  }
}
```

---

## Complete Provider Organization Flow

### Step 1: Check Current Organization
```javascript
// GET current org
const orgResponse = await api.get('/api/provider/organization');
const org = orgResponse.data.data.organization;

if (org) {
  console.log(`Currently in: ${org.name}`);
} else {
  console.log('Not in any organization');
}
```

### Step 2: Leave Organization
```javascript
// POST leave request
const leaveResponse = await api.post('/api/provider/organization/leave');
console.log(leaveResponse.data.data.message);
// Output: "You have left Apollo Hospital"
```

### Step 3: Find and Request to Join New Organization
```javascript
// Get list of organizations
const orgsResponse = await api.get('/api/organizations?approved_only=true');
const organizations = orgsResponse.data.data;

// Select and request to join
const newOrg = organizations.find(o => o.name === 'Tech Solutions');
const joinResponse = await api.post(
  `/api/provider/organization/${newOrg.id}/request-join`
);
console.log(joinResponse.data.data.message);
// Output: "Join request sent to Tech Solutions. Waiting for approval."
```

### Step 4: Check Pending Requests
```javascript
// GET pending requests
const pendingResponse = await api.get('/api/provider/organization/pending-requests');
const pending = pendingResponse.data.data.requests;

pending.forEach(req => {
  console.log(`${req.organization_name}: ${req.status}`);
});
```

### Step 5: Wait for Approval
Organization admin reviews join request in their dashboard and approves/rejects.

### Step 6: Verify Membership
```javascript
// Check if now in organization
const newOrgResponse = await api.get('/api/provider/organization');
const currentOrg = newOrgResponse.data.data.organization;

if (currentOrg && currentOrg.name === 'Tech Solutions') {
  console.log('Successfully joined!');
}
```

---

## Notification System

### When Provider Leaves Organization
**Sent to:** Organization Admin
```
Title: "Provider Left Organization"
Message: "Provider Dr. Raj Kumar has left Apollo Hospital"
Type: "provider_left_organization"
Reference: Provider ID
```

**Sent to:** Provider
```
Title: "Left Organization"
Message: "You have successfully left Apollo Hospital. You can now join another organization."
Type: "left_organization"
Reference: Organization ID
```

### When Provider Requests to Join
**Sent to:** Organization Admin
```
Title: "New Join Request"
Message: "Provider Dr. Raj Kumar (Cardiology) has requested to join Tech Solutions"
Type: "organization_join_request"
Reference: Provider ID
```

### When Admin Approves Join Request
**Sent to:** Provider
```
Title: "Join Request Approved"
Message: "Your request to join Tech Solutions has been approved!"
Type: "join_request_approved"
Reference: Organization ID
```

---

## Database Changes

### service_providers Table
```sql
-- Already has this field
organization_id (NULLABLE)
-- Can now be set to NULL to leave, then set to new org_id to join
```

### organization_join_requests Table
```
Existing table used for join requests
Status: "pending" → "approved"/"rejected"
Can have multiple requests if provider left previous
```

---

## Frontend Implementation

### Provider Dashboard - Organization Section

```jsx
// Components to build:

1. CurrentOrganization Component
   - Shows current org or "Not in organization"
   - "Leave Organization" button
   - Conditional based on org_id

2. JoinOrganization Component
   - Search/browse organizations
   - "Request to Join" button
   - Disabled if already in org
   
3. PendingJoinRequests Component
   - Shows list of pending requests
   - Status: "Waiting for approval"
   - Shows request date
   
4. LeaveConfirmation Modal
   - Confirm leaving organization
   - Warning: "You will become independent"
```

### Example UI Flow

```
┌─────────────────────────────────────────┐
│  PROVIDER ORGANIZATION MANAGEMENT       │
├─────────────────────────────────────────┤
│                                         │
│  Current Organization                   │
│  ─────────────────────────────────────  │
│  📍 Apollo Hospital                     │
│     Contact: admin@apollo.com           │
│     Location: Bengaluru                 │
│                                         │
│  [Leave Organization]                  │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Pending Join Requests (2)              │
│  ─────────────────────────────────────  │
│  ⏳ Tech Solutions    [Requested Jan 15]│
│  ⏳ Medical Center    [Requested Jan 14]│
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Browse Organizations                   │
│  ─────────────────────────────────────  │
│  [Search...]                            │
│                                         │
│  Organization List:                     │
│  □ Mayo Clinic                          │
│    Healthcare, Mumbai                   │
│    [Request to Join]                    │
│                                         │
│  □ Fortis Hospital                      │
│    Healthcare, Delhi                    │
│    [Request to Join]                    │
│                                         │
└─────────────────────────────────────────┘
```

---

## Business Rules

✅ **Provider can only be in one organization at a time**
- If in Org A, cannot join Org B directly
- Must leave Org A first

✅ **Can have multiple pending requests**
- Can request multiple organizations
- Can accept from any after leaving current org

✅ **Only approved organizations can be joined**
- Cannot join unapproved organizations
- Organization must have `is_approved = true`

✅ **Join requests are permanent until responded**
- Cannot withdraw join requests via API
- Org admin must approve or reject
- Can request again after rejection

✅ **All changes are logged and notified**
- Notifications to both provider and org admin
- Audit trail maintained

---

## Testing Scenarios

### Scenario 1: Leave and Join New Org
1. Provider in "Org A"
2. Call POST /leave
3. Verify `organization_id` = null
4. Call POST /request-join for "Org B"
5. Verify pending request created
6. Org B admin approves
7. Verify provider in "Org B"

### Scenario 2: Reject Join Request
1. Provider not in org
2. Call POST /request-join
3. Org admin rejects
4. Provider still not in org
5. Can request to join different org
6. Can request same org again

### Scenario 3: Multiple Pending Requests
1. Provider not in org
2. Request to join Org A
3. Request to join Org B
4. Request to join Org C
5. Call GET /pending-requests
6. Show all 3 pending
7. Leave Org A when approved (switch to B)

### Scenario 4: Cannot Join While in Org
1. Provider in "Org A"
2. Try to join "Org B"
3. Should get error: "Already in Org A, leave first"
4. Leave Org A
5. Try again - should succeed

---

## Error Handling

| Scenario | Error | Fix |
|----------|-------|-----|
| Leave when not in org | Not in organization | Check organization status first |
| Join while in org | Already member... | Leave first |
| Join org twice | Pending request exists | Wait for response or contact admin |
| Join unapproved org | Not found | Only approved orgs can be joined |
| Leave without permission | Forbidden | Must be logged as provider |

---

## Related API Endpoints

Organization Admin Endpoints:
- `GET /api/organizations/org-dashboard/employees` - View providers in org
- `GET /api/organizations/org-dashboard/join-requests` - View pending requests
- `POST /api/organizations/org-dashboard/join-requests/{id}/respond` - Approve/reject

---

## Summary

**New Endpoints Added:**
- POST `/api/provider/organization/leave` - Leave organization
- POST `/api/provider/organization/{org_id}/request-join` - Request to join
- GET `/api/provider/organization/pending-requests` - View pending requests
- GET `/api/provider/organization` - View current organization (already exists)

**Benefits:**
- Providers have autonomy to change organizations
- Organizations control who joins
- Clear approval workflow
- Full audit trail via notifications
- No disruption to existing functionality

---

**Status**: ✅ **IMPLEMENTATION COMPLETE**
**Ready for**: Frontend Integration + Testing
