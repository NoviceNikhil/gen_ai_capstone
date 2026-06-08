# Independent Approved Providers Endpoint

## Overview
This endpoint retrieves providers who have been approved by admin but are NOT part of any organization. These are independent/freelance providers operating solo.

## Endpoint

### GET `/api/admin/providers/independent/approved`

Admin-only endpoint to view approved independent providers.

## Authentication
Requires admin role - use admin bearer token in Authorization header

## Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `search` | string | Optional: Search by provider name (case-insensitive) | `John` |
| `page` | integer | Page number (1-indexed) | `1` |
| `limit` | integer | Results per page (max 100) | `20` |

## Request Examples

### Get all independent approved providers
```bash
GET /api/admin/providers/independent/approved
```

### Search for specific provider
```bash
GET /api/admin/providers/independent/approved?search=John&page=1&limit=20
```

### Get second page of results
```bash
GET /api/admin/providers/independent/approved?page=2&limit=20
```

## Response Format

```json
{
  "status": "success",
  "data": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "total_pages": 1,
    "providers": [
      {
        "id": "prov_123",
        "user_id": "user_456",
        "organization_id": null,
        "specialization": "General Physician",
        "experience_years": 12,
        "location": "Bengaluru, Karnataka",
        "avg_rating": 4.8,
        "total_reviews": 186,
        "consultation_fee": 700,
        "is_verified": true,
        "is_accepting_appointments": true,
        "approval_status": "approved",
        "category": {
          "id": 1,
          "name": "Healthcare"
        },
        "user": {
          "id": "user_456",
          "full_name": "Dr. John Smith",
          "email": "john@example.com",
          "phone": "+91 9876543210"
        }
      },
      ...
    ]
  },
  "message": "Independent approved providers fetched"
}
```

## Filter Conditions

A provider is included if:
1. ✅ `approval_status == "approved"` (admin has approved their onboarding)
2. ✅ `organization_id == NULL` (not part of any organization)

Note: Does NOT filter by `is_verified` or `is_accepting_appointments` - shows all approved independent providers regardless of verification or availability status.

## Frontend Usage

### JavaScript/React
```javascript
import { getIndependentApprovedProvidersAPI } from "../../services/apiService";

// Get all independent providers
const result = await getIndependentApprovedProvidersAPI({ 
  page: 1, 
  limit: 20 
});
console.log(result.data.data.providers);

// Search for specific provider
const filtered = await getIndependentApprovedProvidersAPI({ 
  search: "John",
  page: 1, 
  limit: 20 
});
```

## Use Cases

1. **Admin Dashboard**: Show list of independent providers for organization assignment
2. **Provider Management**: Find unaffiliated providers who might benefit from joining an org
3. **Reporting**: Generate reports of solo practitioners
4. **Organization Recruitment**: Find providers to invite to join organization

## Response Sorting

Results are sorted by **rating (highest first)**:
```
ORDER BY avg_rating DESC
```

## Caching

- Results are cached for **120 seconds**
- Cache is invalidated when provider approval status changes
- Cache key: `cache:admin:providers:independent:search={search}:page={page}:limit={limit}`

## Error Handling

### 403 Forbidden
```json
{
  "detail": "Requires admin role"
}
```
- User is not an admin
- Make sure to include valid admin bearer token

### 200 OK (Empty)
```json
{
  "status": "success",
  "data": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "total_pages": 1,
    "providers": []
  }
}
```
- No providers match the criteria
- All independent providers might already be part of organizations
