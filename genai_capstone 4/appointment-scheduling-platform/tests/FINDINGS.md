# Adversarial QA Findings

The following flaws were discovered during the adversarial exploration of the Sigslot scheduling platform.

---

### [HIGH] | Category 3: Broken Access Control & IDOR | Missing Admin Role Check
*   **Description**: 
    The admin endpoints in [backend/routers/admin.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/routers/admin.py) use the general authentication dependency `Depends(get_current_user)` instead of the role-enforcing dependency `Depends(require_role("admin"))`.
    Consequently, any authenticated user (including customers and providers) can make direct API calls to admin endpoints, retrieve system statistics, view user lists, and toggle user active states.
*   **Reproduction Steps**:
    1. Log in as a customer (e.g. `neha.verma.customer@app-demo.com`).
    2. Extract the customer JWT token from localStorage.
    3. Make a direct HTTP GET request to `http://localhost:5000/api/admin/dashboard` passing the customer token in the `Authorization: Bearer <token>` header.
    4. The API returns full system statistics and stats payload instead of a `403 Forbidden` error.
*   **File where fix belongs**: [backend/routers/admin.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/routers/admin.py)
*   **Suggested Fix**:
    Replace `Depends(get_current_user)` with `Depends(require_role("admin"))` for all routes in the admin router.

---

### [MEDIUM] | Category 2: Race Conditions & Concurrent Actions | Duplicate Package Purchases
*   **Description**: 
    In [BookAppointment.jsx](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/frontend/src/pages/customer/BookAppointment.jsx), the loyalty package purchase API is called asynchronously before the actual appointment is booked. However, the UI does not immediately set a local loading state to disable the confirmation button when the action begins.
    If a customer double-clicks the button, it can trigger multiple parallel package purchases, resulting in duplicate charges/packages.
*   **Reproduction Steps**:
    1. Select a provider and click a slot to navigate to the Book Appointment page.
    2. Select a loyalty package.
    3. Double-click the "Reserve & Pay" button rapidly.
    4. Two POST requests to `/api/customer/packages/{package_id}/purchase` are dispatched concurrently.
*   **File where fix belongs**: [frontend/src/pages/customer/BookAppointment.jsx](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/frontend/src/pages/customer/BookAppointment.jsx#L37)
*   **Suggested Fix**:
    Introduce a local `submitting` state and disable the button immediately when `handleBook` is invoked.

---

### [HIGH] | Category 4: Form & Input Boundary Testing | DoS via Slot Duration of 0
*   **Description**: 
    In [availability_service.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/services/availability_service.py), `slot_duration_minutes` is not validated to be greater than zero. If a provider submits an availability slot with a duration of 0 or a negative number, the generation loop in `get_available_slots` enters an infinite loop, freezing the server process and exhausting CPU resources.
*   **Reproduction Steps**:
    1. Log in as a provider.
    2. Make a request to set availability with `slot_duration_minutes` set to `0`.
    3. Retrieve the available slots for that provider.
    4. The backend process hangs indefinitely.
*   **File where fix belongs**: [backend/services/availability_service.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/services/availability_service.py#L30) or [backend/schemas/availability.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/schemas/availability.py)
*   **Suggested Fix**:
    Add validation constraints in both the Pydantic schemas and service functions to reject `slot_duration_minutes <= 0`.

---

### [MEDIUM] | Category 8: Empty States & Data Boundary Conditions | Statically Mocked Provider Waitlist and Insights
*   **Description**: 
    The provider-facing waitlist operations [Waitlist.jsx](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/frontend/src/pages/provider/Waitlist.jsx) and insights page [Insights.jsx](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/frontend/src/pages/provider/Insights.jsx) are entirely mocked on the frontend with hardcoded static values. They do not load waitlist or revenue/booking statistics from the database, nor do provider waitlist retrieval endpoints exist in the backend.
*   **Reproduction Steps**:
    1. Log in as a provider.
    2. Navigate to Waitlist Ops or Insights page.
    3. The same hardcoded records appear regardless of the actual database state.
*   **File where fix belongs**: [frontend/src/pages/provider/Waitlist.jsx](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/frontend/src/pages/provider/Waitlist.jsx), [frontend/src/pages/provider/Insights.jsx](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/frontend/src/pages/provider/Insights.jsx)
*   **Suggested Fix**:
    Add the necessary endpoints to the provider router, and update the components to fetch and map data dynamically.
