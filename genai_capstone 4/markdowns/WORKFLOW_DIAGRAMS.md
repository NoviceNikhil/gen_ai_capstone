# Provider Approval Workflow - Diagrams

## 1. Complete User Journey

```
┌─────────────────────────────────────────────────────────────┐
│                   PROVIDER JOURNEY                          │
└─────────────────────────────────────────────────────────────┘

  SIGNUP                    ONBOARDING                WAITING
    ┌─────────────────────────────────────────────────────┐
    │ 1. Create Account                                   │
    │    user.role = "provider"                           │
    │    approval_status = "pending"                      │
    │    [NOT visible to customers]                       │
    └────────────────────┬────────────────────────────────┘
                         │
                         ▼
    ┌─────────────────────────────────────────────────────┐
    │ 2. Fill Onboarding Form                             │
    │    - Organization name                              │
    │    - Tax details                                    │
    │    - Bank details                                   │
    │    - Documents                                      │
    │    - Specialization                                 │
    │    - Consultation fee                               │
    └────────────────────┬────────────────────────────────┘
                         │
                         ▼
    ┌─────────────────────────────────────────────────────┐
    │ 3. Submit for Approval                              │
    │    POST /api/provider/onboarding/                   │
    │            submit-for-approval                      │
    │                                                      │
    │    ProviderApprovalRequest created                  │
    │    status = "pending"                               │
    └────────────────────┬────────────────────────────────┘
                         │
                         ▼
    ┌─────────────────────────────────────────────────────┐
    │ 4. Waiting for Admin Review                         │
    │    notification: "Pending admin review"             │
    │    [Still NOT visible to customers]                 │
    │                                                      │
    │    Can check status:                                │
    │    GET /api/providers/approval/status/              │
    └────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼ (APPROVED)                   ▼ (REJECTED)
    
    ┌──────────────────┐          ┌──────────────────┐
    │ 5A. APPROVED     │          │ 5B. REJECTED     │
    │                  │          │                  │
    │ approval_status  │          │ notification:    │
    │ = "approved"     │          │ "Rejection Note" │
    │                  │          │                  │
    │ ✅ VISIBLE       │          │ ❌ STILL HIDDEN  │
    │    to customers  │          │                  │
    │                  │          │ Can:             │
    │ notification:    │          │ - Fix issues     │
    │ "Profile         │          │ - Resubmit       │
    │ Approved!"       │          │                  │
    │                  │          │ [Go to step 3]   │
    └──────────────────┘          └──────────────────┘
         │                              │
         └──────────────┬───────────────┘
                        │
                        ▼
              [END - Provider Status]
```

## 2. Admin Review Flow

```
┌─────────────────────────────────────────────────────────┐
│                  ADMIN DASHBOARD                        │
└─────────────────────────────────────────────────────────┘

  PENDING REQUESTS           REVIEW                DECISION
    ┌──────────────────────────────────────────────────┐
    │ GET /api/providers/approval/pending-requests     │
    │                                                   │
    │ Shows:                                            │
    │ - Provider name & email                          │
    │ - Specialization                                 │
    │ - Organization                                   │
    │ - City/State                                     │
    │ - Submission date                                │
    │ - Documents (links)                              │
    └────────────────────┬─────────────────────────────┘
                         │
                         ▼
    ┌──────────────────────────────────────────────────┐
    │ Admin clicks "Review" on provider request         │
    │                                                   │
    │ Checks:                                           │
    │ - Profile completeness                           │
    │ - Document validity                              │
    │ - Tax compliance                                 │
    │ - Bank details                                   │
    │ - Qualifications                                 │
    └────────────────────┬─────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼ (LOOKS GOOD)                 ▼ (ISSUES)
    
    ┌──────────────────┐          ┌──────────────────┐
    │ Admin clicks     │          │ Admin clicks     │
    │ "Approve"        │          │ "Reject"         │
    │                  │          │                  │
    │ Enters optional  │          │ Enters reason    │
    │ notes:           │          │ (required):      │
    │ "Docs verified"  │          │ "Incomplete      │
    │                  │          │  tax docs"       │
    └────────────┬─────┘          └────────┬─────────┘
                 │                         │
                 ▼                         ▼
    
    POST /api/providers/approval/requests/{id}/decide
    Body: {"status": "approved", "notes": "..."}
                 │
                 ▼
    
    ┌──────────────────────────────────────────┐
    │ POST Success                             │
    │                                          │
    │ Updates:                                 │
    │ - Request.status = "approved"/"rejected" │
    │ - Provider.approval_status = ...         │
    │ - ProviderApprovalRequest.approved_by    │
    │ - ProviderApprovalRequest.approved_at    │
    │                                          │
    │ Notifications sent to provider           │
    │                                          │
    │ List refreshes (shows updated state)     │
    └──────────────────────────────────────────┘
```

## 3. Customer Search Flow

```
┌─────────────────────────────────────────────────────────┐
│              CUSTOMER SEARCHES FOR PROVIDER             │
└─────────────────────────────────────────────────────────┘

  SEARCH REQUEST          DATABASE FILTER         RESULTS
    ┌──────────────────────────────────────────────────┐
    │ GET /api/customer/providers?search=doctor        │
    └────────────────────┬─────────────────────────────┘
                         │
                         ▼
    ┌──────────────────────────────────────────────────┐
    │ Query service_providers table with filters:       │
    │                                                   │
    │ WHERE                                             │
    │   is_verified = TRUE          ✓ (existing)       │
    │   AND                                             │
    │   is_accepting_appointments = TRUE               │
    │                              ✓ (existing)        │
    │   AND                                             │
    │   approval_status = "approved"                    │
    │                              ✓ (NEW FILTER)      │
    │   AND                                             │
    │   (specialization LIKE '%doctor%'                 │
    │   OR full_name LIKE '%doctor%')                   │
    │                              ✓ (search term)     │
    └────────────────────┬─────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼ (IF MATCHES)                 ▼ (IF NOT MATCHED)
    
    ┌──────────────────┐          ┌──────────────────┐
    │ ✅ INCLUDED      │          │ ❌ EXCLUDED      │
    │    in results    │          │     from results │
    │                  │          │                  │
    │ Provider shown   │          │ Provider hidden  │
    │ in search list   │          │ (even if good)   │
    │                  │          │                  │
    │ Can book appt    │          │ Cannot book      │
    │                  │          │                  │
    │ Requirements:    │          │ Reasons:         │
    │ - Verified ✓     │          │ - Not verified   │
    │ - Accepting ✓    │          │ - Not accepting  │
    │ - APPROVED ✓     │          │ - NOT APPROVED   │
    │                  │          │ - Pending review  │
    │                  │          │ - Rejected       │
    └──────────────────┘          └──────────────────┘
                                         │
                                         └─ Resubmit
                                            after fixing
                                            issues
```

## 4. Database State Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   DATABASE TABLES                       │
└─────────────────────────────────────────────────────────┘

  USERS TABLE                    SERVICE_PROVIDERS TABLE
  ┌──────────────┐              ┌──────────────────────────┐
  │ id           │              │ id                       │
  │ full_name    │              │ user_id (FK → users)     │
  │ email        │              │ specialization           │
  │ role         │              │ ...other fields...       │
  │ ...          │              │                          │
  └──────────────┘              │ approval_status  ◄─ NEW  │
         ▲                       │ (pending|                │
         │                       │  approved|               │
         │ (1)                   │  rejected)               │
         │                       │                          │
         │                       └──────────────┬───────────┘
         │                                      │ (1)
         │         PROVIDER_APPROVAL_REQUESTS   │
         │         TABLE (NEW)                  │
         │    ┌────────────────────────────┐   │
         ├────┤ id                         │   │
         │    │ provider_id (FK) ◄─────────┼───┘
         │    │ status (pending|            │
         │    │         approved|           │
         │    │         rejected)           │
         │    │ approved_by (FK → users) ◄─┤
         │    │ approval_notes             │
         │    │ created_at                 │
         │    │ approved_at                │
         │    └────────────────────────────┘
         │
         └─ Admin user who approves


  FLOW:
  Provider (user) → ServiceProvider (approval_status)
                  → ProviderApprovalRequest (tracks requests)
                  → Admin decides
                  → approval_status updated
```

## 5. Status Transition Matrix

```
                    ┌─────────────────────────────┐
                    │   PROVIDER APPROVAL STATES  │
                    └─────────────────────────────┘

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  [PENDING]  ◄─── Initial state (signup)             │
  │      │                                               │
  │      ├─────────────► [APPROVED]                      │
  │      │               (Admin approves)                │
  │      │               ✅ Visible to customers         │
  │      │                                               │
  │      └─────────────► [REJECTED]                      │
  │                      (Admin rejects)                 │
  │                      ❌ Stays hidden                 │
  │                         │                            │
  │                         └──→ Can resubmit ──┐        │
  │                                             │        │
  └─────────────────────────────────────────────┼────────┘
                                                │
                                                ▼
                                           Back to [PENDING]
                                           (new request)


  VISIBILITY TO CUSTOMERS:
  
  [PENDING]        [APPROVED]       [REJECTED]
  ❌ Hidden        ✅ Visible       ❌ Hidden
  (waiting)        (active)         (needs fix)
```

## 6. Notification Flow

```
┌─────────────────────────────────────────────────────────┐
│                   NOTIFICATIONS                         │
└─────────────────────────────────────────────────────────┘

  WHEN SUBMITTED                WHEN APPROVED              WHEN REJECTED
  ┌────────────────────┐        ┌────────────────────┐    ┌────────────────────┐
  │ Notification to    │        │ Notification to    │    │ Notification to    │
  │ ALL ADMINS         │        │ PROVIDER           │    │ PROVIDER           │
  │                    │        │                    │    │                    │
  │ Type:              │        │ Type:              │    │ Type:              │
  │ provider_approval  │        │ provider_approved  │    │ provider_rejected  │
  │                    │        │                    │    │                    │
  │ Message:           │        │ Message:           │    │ Message:           │
  │ "New provider      │        │ "Your profile      │    │ "Your profile was  │
  │ approval request   │        │ approved! Now      │    │ not approved.      │
  │ from Dr. Raj"      │        │ visible to         │    │ Reason: Incomplete │
  │                    │        │ customers"         │    │ tax docs"          │
  │                    │        │                    │    │                    │
  │ Action:            │        │ Action:            │    │ Action:            │
  │ Review pending     │        │ View on platform   │    │ Fix & resubmit     │
  │ requests           │        │ Set availability   │    │ profile            │
  └────────────────────┘        └────────────────────┘    └────────────────────┘
         │                               │                        │
         └───────────────────┬───────────┴────────────────────────┘
                             │
              Stored in Notification table
              Can be viewed in notification center
              Mark as read/unread
```

## 7. Implementation Checklist

```
┌─────────────────────────────────────────────────────────┐
│         PROVIDER APPROVAL - DEPLOYMENT STEPS            │
└─────────────────────────────────────────────────────────┘

  BACKEND CODE                       DEPLOYMENT
  ─────────────────                  ──────────
  ✓ Models created                   □ 1. Stop API server
  ✓ Services created                 □ 2. Pull code changes
  ✓ Routes created                   □ 3. Run migration:
  ✓ Modified customer service           python migrate_*.py
  ✓ Syntax checked                   □ 4. Start API server
  ✓ Documentation done               □ 5. Test endpoints
  
  FRONTEND WORK                      TESTING
  ──────────────                     ───────
  □ Provider submit button           □ Provider flow
  □ Admin approval dashboard         □ Admin approval
  □ Approval status indicator        □ Customer search
  □ Rejection feedback display       □ Existing features
  □ Resubmit capability              □ Database queries
  □ Notification UI                  □ Error handling
```

---

**Visual Summary:**
Provider fills form → Submits → Admin sees in pending list → Admin approves/rejects → Provider notified → If approved, visible to customers → Customers can book
