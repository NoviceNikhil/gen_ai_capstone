# Troubleshooting: Provider Not Visible in Marketplace

## Problem
Provider is created and approved by admin but doesn't appear in customer marketplace.

## Root Cause
Provider must meet **ALL 3** conditions to appear in marketplace:

1. ✅ `is_verified == True` (admin verified)
2. ✅ `is_accepting_appointments == True` (provider enabled appointments)
3. ✅ `approval_status == "approved"` (admin approved onboarding)

## Solution: Use Debug Endpoint

### Step 1: Check Provider Status
Use the debug endpoint to identify which condition is missing:

**Endpoint:**
```
GET /api/admin/providers/debug/{provider_id}
```

**Example:**
```bash
curl -H "Authorization: Bearer {admin_token}" \
  "http://localhost:8000/api/admin/providers/debug/prov_abc123"
```

### Step 2: Response Example

If provider is NOT visible:
```json
{
  "status": "success",
  "data": {
    "provider_id": "prov_abc123",
    "provider_name": "Dr. John Smith",
    "provider_email": "john@example.com",
    "visibility_status": "❌ NOT VISIBLE IN MARKETPLACE",
    "conditions": {
      "is_verified": {
        "value": false,
        "required": true,
        "status": "❌ MISSING - Admin must verify"
      },
      "is_accepting_appointments": {
        "value": true,
        "required": true,
        "status": "✅ OK"
      },
      "approval_status": {
        "value": "approved",
        "required": "approved",
        "status": "✅ OK"
      }
    },
    "missing_conditions": ["is_verified"],
    "next_steps": [
      "Go to Admin → Providers page",
      "Find this provider and click 'Approve' button"
    ]
  }
}
```

## Common Issues & Fixes

### Issue 1: `is_verified == false`
**Status:** ❌ MISSING - Admin must verify

**Solution:**
1. Go to **Admin Dashboard → Providers**
2. Find the provider in the list
3. Click the **"Approve"** button (green button with checkmark)
4. Provider will now be verified

### Issue 2: `is_accepting_appointments == false`
**Status:** ❌ MISSING - Provider must enable

**Solution:**
1. Provider logs into their dashboard
2. Go to **Provider Profile/Settings**
3. Enable "Accepting Appointments" toggle
4. Provider will now be visible

### Issue 3: `approval_status != "approved"`
**Status:** ❌ MISSING - Currently: pending/rejected

**Solution A (if pending):**
1. Go to **Admin Dashboard → Approval Requests**
2. Find the provider request
3. Click **"Review"** → **"Approve"**

**Solution B (if rejected):**
1. Ask provider to fix issues and resubmit
2. Provider goes to **Onboarding page**
3. Clicks **"Resubmit for Approval"**
4. Admin reviews and approves again

## Checklist Before Provider Goes Live

- [ ] Provider account created
- [ ] Provider completed onboarding
- [ ] Provider submitted for approval
- [ ] Admin approved provider (Approval Requests page)
- [ ] Admin verified provider (Providers page, clicked Approve)
- [ ] Provider enabled appointments (Provider Settings)
- [ ] Provider has category assigned
- [ ] Provider has consultation fee set
- [ ] Test: Provider appears in marketplace search

## Quick Test Flow

1. **New Provider Signs Up**
   ```
   is_verified: false
   is_accepting_appointments: true (default)
   approval_status: pending (when submitted)
   ```

2. **Admin Approves Onboarding** (Approval Requests page)
   ```
   is_verified: false (unchanged)
   is_accepting_appointments: true
   approval_status: approved ✅ (updated)
   ```

3. **Admin Verifies Provider** (Providers page, click Approve)
   ```
   is_verified: true ✅ (updated)
   is_accepting_appointments: true
   approval_status: approved
   ```

4. **Provider Now Visible in Marketplace** ✅

## Debug Endpoint Details

### Request
```
GET /api/admin/providers/debug/{provider_id}
Authorization: Bearer {admin_token}
```

### Response Fields

| Field | Purpose |
|-------|---------|
| `provider_id` | Provider unique ID |
| `provider_name` | Provider full name |
| `provider_email` | Provider email |
| `visibility_status` | ✅ VISIBLE or ❌ NOT VISIBLE |
| `conditions` | Details on each condition |
| `missing_conditions` | Array of failed conditions |
| `next_steps` | Actionable steps to fix |

## API Usage (JavaScript)

```javascript
import { debugProviderVisibilityAPI } from "../../services/apiService";

async function checkProviderVisibility(providerId) {
  try {
    const response = await debugProviderVisibilityAPI(providerId);
    const debug = response.data.data;
    
    console.log("Visibility Status:", debug.visibility_status);
    console.log("Missing Conditions:", debug.missing_conditions);
    console.log("Next Steps:", debug.next_steps);
    
    if (debug.missing_conditions.length > 0) {
      console.log("Provider is NOT visible. Follow these steps:");
      debug.next_steps.forEach(step => console.log("- " + step));
    } else {
      console.log("Provider is visible in marketplace!");
    }
  } catch (error) {
    console.error("Debug check failed:", error);
  }
}
```

## Provider Flow Diagram

```
Provider Signup
    ↓
Provider Completes Onboarding
    ↓
Provider Submits for Approval
    ↓ approval_status = "pending"
    ↓
Admin Reviews Onboarding (Approval Requests page)
    ↓
Admin Clicks "Approve"
    ↓ approval_status = "approved" ✅
    ↓
Admin Goes to Providers Page
    ↓
Admin Finds Provider & Clicks "Approve" Button
    ↓ is_verified = true ✅
    ↓
Provider Enabled Appointments
    ↓ is_accepting_appointments = true ✅
    ↓
✅ PROVIDER VISIBLE IN MARKETPLACE
```
