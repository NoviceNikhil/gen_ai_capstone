# Provider Organization Management - Quick API Reference

## All Endpoints

### Provider Endpoints

```
GET  /api/provider/organization
POST /api/provider/organization/leave
POST /api/provider/organization/{org_id}/request-join
GET  /api/provider/organization/pending-requests
```

### Organization Admin Endpoints (for handling requests)

```
GET  /api/organizations/org-dashboard/join-requests
POST /api/organizations/org-dashboard/join-requests/{request_id}/respond
GET  /api/organizations/org-dashboard/employees
```

---

## cURL Examples

### 1. Get Current Organization

```bash
curl -X GET "http://localhost:8000/api/provider/organization" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Leave Organization

```bash
curl -X POST "http://localhost:8000/api/provider/organization/leave" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### 3. Request to Join Organization

```bash
curl -X POST "http://localhost:8000/api/provider/organization/org-id-123/request-join" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### 4. Get Pending Join Requests

```bash
curl -X GET "http://localhost:8000/api/provider/organization/pending-requests" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## JavaScript/Fetch Examples

### Check Organization Status

```javascript
async function checkOrganization() {
  const response = await fetch('/api/provider/organization', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  
  if (data.data.organization) {
    console.log(`In: ${data.data.organization.name}`);
  } else {
    console.log('Independent provider');
  }
}
```

### Leave Organization

```javascript
async function leaveOrganization() {
  const response = await fetch('/api/provider/organization/leave', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  console.log(data.data.message);
}
```

### Request to Join Organization

```javascript
async function requestJoinOrg(orgId) {
  const response = await fetch(
    `/api/provider/organization/${orgId}/request-join`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  const data = await response.json();
  
  if (data.success) {
    console.log(data.data.message);
  } else {
    console.error(data.message);
  }
}
```

### Check Pending Requests

```javascript
async function checkPendingRequests() {
  const response = await fetch('/api/provider/organization/pending-requests', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  
  data.data.requests.forEach(req => {
    console.log(`${req.organization_name}: ${req.status}`);
  });
}
```

---

## React Hooks

### useProviderOrganization Hook

```javascript
import { useState, useEffect } from 'react';
import api from '@/api';

export function useProviderOrganization() {
  const [org, setOrg] = useState(null);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchOrganization = async () => {
    try {
      setLoading(true);
      const response = await api.get('/provider/organization');
      setOrg(response.data.data.organization);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const response = await api.get('/provider/organization/pending-requests');
      setPending(response.data.data.requests);
    } catch (err) {
      setError(err.message);
    }
  };

  const leaveOrganization = async () => {
    try {
      await api.post('/provider/organization/leave');
      setOrg(null);
      await fetchPendingRequests();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const requestJoinOrganization = async (orgId) => {
    try {
      await api.post(`/provider/organization/${orgId}/request-join`);
      await fetchPendingRequests();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  useEffect(() => {
    fetchOrganization();
    fetchPendingRequests();
  }, []);

  return {
    org,
    pending,
    loading,
    error,
    leaveOrganization,
    requestJoinOrganization,
    refresh: () => {
      fetchOrganization();
      fetchPendingRequests();
    }
  };
}

// Usage in component
function ProviderOrgPanel() {
  const { org, pending, leaveOrganization, requestJoinOrganization } = useProviderOrganization();

  return (
    <div>
      <h2>Organization Management</h2>
      
      {org && (
        <div className="current-org">
          <h3>{org.name}</h3>
          <button onClick={leaveOrganization}>Leave</button>
        </div>
      )}
      
      {!org && (
        <p>You are not in any organization</p>
      )}
      
      {pending.length > 0 && (
        <div className="pending">
          <h3>Pending Requests ({pending.length})</h3>
          {pending.map(req => (
            <div key={req.id}>
              {req.organization_name}: {req.status}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Response Formats

### Success Response

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    "key": "value"
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "error": "Error type"
}
```

---

## Error Codes

| HTTP | Error | Meaning |
|------|-------|---------|
| 200 | N/A | Success |
| 400 | Bad Request | Invalid input or logic error |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Not authorized (not provider) |
| 404 | Not Found | Organization or request not found |

---

## Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Already member of..." | Trying to join while in org | Leave first |
| "Pending request exists" | Already requested this org | Wait for response |
| "Not in organization" | Trying to leave without being in one | Check status first |
| "Org not found/approved" | Org doesn't exist or unapproved | Check org exists and is approved |
| "Only providers can..." | Wrong role | Ensure provider role |

---

## State Transitions

```
INDEPENDENT
    ↓ (POST /request-join)
PENDING (waiting for org admin)
    ├─→ APPROVED → IN ORGANIZATION
    └─→ REJECTED → INDEPENDENT

IN ORGANIZATION
    ↓ (POST /leave)
INDEPENDENT
    ↓ (POST /request-join)
PENDING (for new org)
    ...
```

---

## Workflow Example

```javascript
// Complete workflow
async function switchOrganization(fromOrgId, toOrgId) {
  try {
    // 1. Check current org
    let orgResponse = await api.get('/provider/organization');
    let currentOrg = orgResponse.data.data.organization;
    console.log(`Currently in: ${currentOrg.name}`);
    
    // 2. Leave current org
    await api.post('/provider/organization/leave');
    console.log('Left organization');
    
    // 3. Request new org
    const joinResponse = await api.post(
      `/provider/organization/${toOrgId}/request-join`
    );
    console.log(joinResponse.data.data.message);
    
    // 4. Wait for approval (UI polling or WebSocket)
    // In real app, would wait for notification
    
    // 5. Verify after approval
    orgResponse = await api.get('/provider/organization');
    currentOrg = orgResponse.data.data.organization;
    console.log(`Now in: ${currentOrg.name}`);
    
    return true;
  } catch (error) {
    console.error('Failed to switch orgs:', error);
    return false;
  }
}
```

---

## Database Queries

### Check Provider's Current Organization

```sql
SELECT sp.id, sp.user_id, o.id as org_id, o.name as org_name
FROM service_providers sp
LEFT JOIN organizations o ON sp.organization_id = o.id
WHERE sp.user_id = 'user-uuid';
```

### Get All Pending Join Requests for Provider

```sql
SELECT ojr.id, ojr.organization_id, o.name, ojr.status, ojr.created_at
FROM organization_join_requests ojr
JOIN organizations o ON ojr.organization_id = o.id
WHERE ojr.provider_id = 'provider-uuid'
AND ojr.status = 'pending'
ORDER BY ojr.created_at DESC;
```

### Get Join Requests for Organization

```sql
SELECT ojr.id, ojr.provider_id, sp.specialization, u.full_name, u.email, ojr.created_at
FROM organization_join_requests ojr
JOIN service_providers sp ON ojr.provider_id = sp.id
JOIN users u ON sp.user_id = u.id
WHERE ojr.organization_id = 'org-uuid'
AND ojr.status = 'pending'
ORDER BY ojr.created_at DESC;
```

---

## Performance Notes

- GET endpoints cached with 5min TTL
- JOIN operations use eager loading
- Pagination supported where needed
- Indexes on foreign keys for fast queries

---

## Version

**API Version**: 1.0
**Last Updated**: January 2024
**Status**: Ready for Integration ✅
