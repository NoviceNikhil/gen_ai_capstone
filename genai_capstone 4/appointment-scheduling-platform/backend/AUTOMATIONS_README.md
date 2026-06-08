# Schedex Platform Automations & Chatbot Tool Layer Integration

This document outlines the core platform automations implemented in the Schedex backend and details how the **Schedully AI Chatbot** retrieves and interacts with these automated states.

---

## 1. Backend Automations (The "How It Works" Section)

The platform runs five primary background/just-in-time automations to maintain database integrity and slot state accuracy:

### A. Auto-Completing Past Appointments
* **How It's Done**: Defined in `appointment_service.py` -> `auto_complete_past_appointments()`. It queries confirmed appointments whose end-times are in the past. If one hour has elapsed since the appointment ended, the status is automatically transitioned to `completed`, and a record is logged in `AppointmentHistory`.
* **Trigger**: Executed just-in-time at the start of any appointment lookup request (e.g., dashboard stats, list queries) to ensure the client always sees an up-to-date schedule.

### B. Expiring Unpaid Payment Holds
* **How It's Done**: Defined in `appointment_service.py` -> `expire_unpaid_payment_holds()`. It scans for appointments created in `pending` status with a consultation fee that remain unpaid after **10 minutes**.
* **Transition**: Transitions status to `cancelled` with the reason `"Payment session expired"`, and immediately sets the associated `AppointmentSlot.is_booked` flag back to `False`.

### C. Waitlist Auto-Locking
* **How It's Done**: When an appointment slot is cancelled or released, the backend calls `assign_lock_to_next_waitlist_customer()`. 
* **Transition**: The next customer in the queue receives a notification and a **30-minute lock window** (`claim_expires_at`) during which only they can book that slot.

### D. Expiring Pending Reschedule Requests
* **How It's Done**: Run inside an async background loop in `main.py` (`expire_reschedule_requests_loop()`) every 10 minutes.
* **Transition**: Pending provider reschedule requests older than **24 hours** are transitioned to `expired`, their held proposed slots are set to `is_booked = False`, and history is logged.

### E. Customer Rejection Auto-Cancellation
* **How It's Done**: Managed in `respond_to_reschedule_request()` under `"reject"`. If a customer rejects a provider's reschedule proposal, the request is rejected, the held slot is released, and the original appointment is automatically cancelled with a **100% refund** (provider-fault policy).

---

## 2. Chatbot Integration: Live Data vs. Tool Layer

### Does the Chatbot use these Automations?
**Yes.** The chatbot integrates directly with these automated states through its **Live Data / Tool Layer (`tool_layer.py`)**. 

### The Execution Mechanism:
1. **Intent Classification**: When a user asks a query about their current schedule (e.g., *"Show my appointments"* or *"Is my 2 PM slot cancelled?"*), the chatbot's planner classifies the intent as `live_data` and lists the required tool hint (`get_appointments`).
2. **The Tool Layer Dispatch**: The chatbot's `tool_layer.py` dispatches an asynchronous HTTP GET request to the Schedex API endpoints:
   * Customers: `GET /api/customer/appointments`
   * Providers: `GET /api/provider/appointments`
3. **State Sync Trigger**: When these endpoints receive the request, the backend immediately triggers the auto-cleanups (`expire_unpaid_payment_holds` and `auto_complete_past_appointments`) **before fetching records from the database**.
4. **Result**: The chatbot immediately receives the correctly updated, post-automation state (e.g., showing a cancelled slot or completed session) and feeds it to the LLM generator to present it to the user.

### Flowchart:
```
[User Query] 
     │
     ▼ (Planner)
[live_data intent] ──► [tool_layer.py: get_appointments]
                             │
                             ▼ (HTTP GET /api/customer/appointments)
                     [Backend Router]
                             │
                             ▼ (Triggers JIT Cleanups)
                     1. auto_complete_past_appointments()
                     2. expire_unpaid_payment_holds()
                             │
                             ▼ (Query DB)
                     [Retrieve Cleaned States] ──► [Return JSON to Chatbot]
                                                          │
                                                          ▼ (Generator)
                                                    [Sanitized LLM Response]
```
