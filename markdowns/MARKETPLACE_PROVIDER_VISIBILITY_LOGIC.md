# Provider Marketplace Visibility Logic

## Overview
This document explains the conditions that determine whether a provider appears in the customer marketplace.

## Required Conditions (ALL must be true)

A provider appears in the marketplace **ONLY if ALL of the following conditions are met:**

### 1. **Provider Must Be Verified**
```
is_verified == True
```
- Admin must explicitly verify the provider's credentials
- Done in the Admin Dashboard → Providers section
- Click "Approve" button to set `is_verified = true`

### 2. **Provider Must Be Accepting Appointments**
```
is_accepting_appointments == True
```
- Default value when provider profile is created: `True`
- Provider can toggle this in their dashboard
- When set to `False`, provider disappears from marketplace
- Used when provider is temporarily unavailable

### 3. **Provider Must Have Approval Status = "approved"**
```
approval_status == "approved"
```
- Set to "pending" when provider first submits onboarding
- Admin reviews and approves/rejects on the Approval Requests dashboard
- This is the main gate - provider won't appear until admin explicitly approves them

## Additional Filters (Optional)

Customers can further filter the marketplace using:

### 1. **Category Filter**
- Show only providers in a specific category (e.g., Healthcare, Education)
- Based on: `ServiceProvider.category_id`

### 2. **Location Filter**
- Show only providers in a specific city/location
- Based on: `ServiceProvider.location`
- Search: `location.ilike("%{location}%")` (case-insensitive)

### 3. **Organization Filter**
- Show only providers from a specific organization
- Based on: `ServiceProvider.organization_id`
- Shows related organizations when category is selected (filtered by category)

### 4. **Rating Filter**
- Show only providers with minimum rating (e.g., 4.5+)
- Based on: `ServiceProvider.avg_rating >= min_rating`

### 5. **Search Filter**
- Multi-token search across multiple fields
- Supports two search modes:
  - **Plus-separated**: `token1+token2` (all tokens must match)
  - **Space-separated**: `token1 token2` (all tokens must match)
- Searches across:
  - Provider name: `User.full_name`
  - Specialization: `ServiceProvider.specialization`
  - Location: `ServiceProvider.location`
  - Category name: `Category.name`
  - Organization name: `Organization.name`

## Sorting

Providers are sorted by **rating (highest first)**:
```
ORDER BY ServiceProvider.avg_rating DESC
```

## Visibility States

### ✅ Visible in Marketplace
- `is_verified = true`
- `is_accepting_appointments = true`
- `approval_status = "approved"`

### ❌ NOT Visible in Marketplace (any of these)
- `is_verified = false` (not yet verified by admin)
- `is_accepting_appointments = false` (provider disabled availability)
- `approval_status = "pending"` (waiting for admin approval)
- `approval_status = "rejected"` (admin rejected the application)

## Flow Example

1. **Provider Signs Up** → Completes onboarding
   - `is_verified` = false
   - `is_accepting_appointments` = true
   - `approval_status` = pending
   - **Result: NOT visible**

2. **Provider Submits for Approval** → Creates approval request
   - Status stays as "pending"
   - **Result: NOT visible** (waiting for admin)

3. **Admin Approves Provider** → Sets approval_status = approved
   - `is_verified` = false (still)
   - `is_accepting_appointments` = true
   - `approval_status` = approved
   - **Result: NOT visible** (needs verification)

4. **Admin Verifies Provider** → Clicks "Approve" in Providers page
   - `is_verified` = true
   - `is_accepting_appointments` = true
   - `approval_status` = approved
   - **Result: ✅ VISIBLE in marketplace**

## Query Implementation

```python
query = db.query(ServiceProvider)
    .filter(ServiceProvider.is_verified == True)
    .filter(ServiceProvider.is_accepting_appointments == True)
    .filter(ServiceProvider.approval_status == "approved")
    .order_by(ServiceProvider.avg_rating.desc())
```

## Database Fields

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `is_verified` | Boolean | False | Admin verification status |
| `is_accepting_appointments` | Boolean | True | Provider availability toggle |
| `approval_status` | Enum | "pending" | Onboarding approval status |
| `avg_rating` | Float | 0.0 | Average customer rating |

## Admin Actions Required

1. **First**: Approve provider profile (Provider Approval Request page)
   - Sets: `approval_status = "approved"`

2. **Then**: Verify provider credentials (Admin Providers page)
   - Sets: `is_verified = true`

Both steps must be completed for provider to appear in marketplace.
