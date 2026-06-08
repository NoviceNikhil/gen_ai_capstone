# Business Logic Improvement Plan

## Platform Overview
Appointly is an appointment scheduling and marketplace platform connecting customers with verified service providers. It supports automated scheduling, flexible calendar availability, custom intake forms, multi-session loyalty packages, waitlists, and secure payment processing via Razorpay.

## Existing Flow Map
- **User Signup & Authentication**: Users register as customers, providers, or admins; accounts are activated via email-delivered OTP verification, and admins undergo 2FA verification.
- **Provider Discovery & Marketplace**: Customers search for providers by name, category, location, and rating, and view slot availability for specific dates.
- **Appointment Booking**: Customers book slots; supports snapshotting of provider consultation fees or service offering prices, integration with intake responses, and waitlist fulfillment.
- **Loyalty Packages**: Customers purchase multi-session loyalty packages from providers; booking automatically decrements remaining package sessions.
- **Waitlist Management**: Customers join waitlists for fully booked providers; when a slot is released, the waitlisted customer receives an email and a 30-minute lock window to claim it.
- **Appointment Rescheduling**: Customers reschedule future bookings; subject to proximity-based penalty rules (20% penalty fee applied between 2 and 24 hours prior; rescheduling blocked under 2 hours prior).
- **Appointment Cancellation**: Customers or providers cancel appointments. Proximity penalties are applied to customers (100% refund >24h; 80% refund 2-24h; no refund <2h). Released slots trigger waitlist notifications.
- **Payments & Refunds**: Razorpay orders are created for appointments with consultation fees. Success transitions appointments from `pending` to `confirmed`. Cancellations initiate automated processing of full or partial refunds.
- **Organization Management**: Users request organization creation; admins review and approve requests. Organization admins can assign or remove service providers.
- **Admin Management**: Administrators verify service providers, activate or deactivate user accounts, and view global dashboard statistics.
- **Notifications**: Users fetch notifications regarding state changes of bookings (pending, confirmed, cancelled, completed), with unread counts tracked via notification read-markers.

## Inconsistencies Found

### 1. Late Rescheduling Penalty Anomaly
- **What the code does**: When a customer reschedules an appointment late (2-24 hours prior), the system applies a 20% penalty. Instead of charging the customer, the backend docks the provider's payout in the commission ledger and transfers it to the platform's commission. The customer pays nothing extra, and the provider loses 20% of their earnings.
- **What it should do**: If the customer reschedules, they must pay the 20% penalty fee surcharge via the payment gateway before the reschedule is confirmed. If the provider reschedules, the provider's payout is reduced as a penalty.
- **Files affected**: [appointment_service.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/services/appointment_service.py)
- **Business impact**: Heavy loss of provider trust and unfair financial penalties on providers for customer-driven changes.

### 2. Cross-Provider Package Leakage
- **What the code does**: When a customer books a slot, if they don't specify a package, the system auto-queries the first active package the customer owns. It does not check if that package actually belongs to the provider being booked.
- **What it should do**: Restrict automatic package application to packages belonging to the same provider, or providers within the same organization.
- **Files affected**: [appointment_service.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/services/appointment_service.py)
- **Business impact**: Financial leakage where customers use Provider A's prepaid packages to book expensive appointments with Provider B for free.

### 3. Waitlist Day-Locking Scope
- **What the code does**: When a waitlist user is notified of a released slot, the system blocks booking for all other customers by checking for any active notified waitlist entry on the preferred date.
- **What it should do**: Restrict the reservation lock to the specific time slot that was cancelled and released rather than the entire day.
- **Files affected**: [appointment_service.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/services/appointment_service.py)
- **Business impact**: Artificially blocks providers from getting other open slots booked on that day, reducing provider utilization.

### 4. Consent-less and Unapproved Org Provider Assignment
- **What the code does**: Admins or org admins can unilaterally assign any provider to any organization without consent, even if the organization is not yet approved.
- **What it should do**: Prevent assignment to unapproved organizations, and send an invitation that the provider must accept.
- **Files affected**: [organization.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/routers/organization.py)
- **Business impact**: Security, trust, and regulatory issues where providers are linked to spam/unapproved organizations without consent.

### 5. Lack of Buffer Time Support (Calendly Standard)
- **What the code does**: Generates slot inventory back-to-back using start time, end time, and duration without accounting for preparation/transition buffer periods.
- **What it should do**: Allow providers to specify buffer times (e.g. 10 or 15 minutes before/after appointments) and offset generated slot intervals accordingly.
- **Files affected**: [availability.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/models/availability.py), [availability_service.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/services/availability_service.py)
- **Business impact**: Exhaustion and bad customer experience due to back-to-back booking fatigue.

### 6. Missing Daily Booking Cap/Limits
- **What the code does**: Allows unlimited bookings on a day up to the maximum capacity of availability slots.
- **What it should do**: Provide configuration for maximum daily bookings, blocking further bookings once reached.
- **Files affected**: [service_provider.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/models/service_provider.py), [appointment_service.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/services/appointment_service.py)
- **Business impact**: Incapability of scheduling management, resulting in provider burnout.

### 7. Missing Global/Local Timezone Conversion
- **What the code does**: Naively stores naive local date/time in the database, assuming both provider and customer occupy the exact same timezone.
- **What it should do**: Store dates/times in UTC format, carrying timezone conversions dynamically on the frontend/backend clients.
- **Files affected**: Throughout all scheduling routes, models, and frontend displays.
- **Business impact**: Severe scheduling confusion and missed sessions for cross-timezone bookings.

### 8. Lack of Google OAuth Integration
- **What the code does**: Users can only register and log in via traditional email and password forms.
- **What it should do**: Provide "Login/Signup with Google" option.
- **Files affected**: [auth.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/routers/auth.py), [auth_service.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/services/auth_service.py)
- **Business impact**: Slower user onboarding, high barrier to signup, and lack of modern standard convenience.

## Missing Business Logic

### 1. Package Session Replenishment on Cancellation
- **What is missing**: The `Appointment` model has no linkage to a `CustomerPackagePurchase`, and cancellation does not refund/credit back the used session to the package.
- **Where it should live**: 
  - Backend: [appointment.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/models/appointment.py), [appointment_service.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/services/appointment_service.py)
  - Frontend: Booking and cancellation confirmation UI screens.
- **Why it matters**: Customers lose pre-purchased package sessions on cancellation.
- **What breaks without it**: Customer trust and loyalty package value proposition.

### 2. Provider-Initiated Rescheduling Flow
- **What is missing**: Rescheduling is only implemented for customers. Providers cannot reschedule bookings from the backend or frontend.
- **Where it should live**: 
  - Backend: [appointment_service.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/services/appointment_service.py), [provider.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/routers/provider.py)
  - Frontend: Provider appointments list/detail views.
- **Why it matters**: Providers have no way to request a reschedule; they must cancel and force the customer to re-book.
- **What breaks without it**: Platform usability and flexibility during provider emergencies.

## Security Constraints Analysis
- **Password Hashing**: Verified as securely implemented. Appointly hashes passwords using the industry-standard `bcrypt` algorithm via `passlib.context.CryptContext`.
- **OTP Verification Hashing**: Currently, the system uses the same slow `bcrypt` context to hash 6-digit verification OTPs (`hash_otp`). Because bcrypt is designed to be computationally expensive to prevent brute-forcing, running it on short-lived, transient OTP actions causes unnecessary CPU spikes on signup and resend endpoints.
- **Google OAuth Login Credentials Flow**: 
  - Upon signing up with Google, the system will **auto-generate a secure random password** and link the user account matching by email address.
  - No username prompt is required. The user can seamlessly log in with Google, or optionally request a password reset using the standard "Forgot Password" flow to set a credentials password later.

## State Machine Violations

### 1. Unpaid Pending Bookings Double-Booking Slot Lock
- **Scenario**: When booking a slot, the status is set to `pending` and locked. If the customer exits checkout, the slot remains locked for 10 minutes.
- **Violation**: Since slot release runs on the fly during conflicts check (`_check_conflict`), slots can remain showing "booked" in list views even though they are expired, resulting in a mismatch between availability representation and booking capability.

### 2. Transitioning from Cancelled to Confirmed via delayed payment
- **Scenario**: A payment verification webhook/API is triggered *after* the 10-minute timeout has expired (meaning the appointment was already updated to `cancelled`).
- **Violation**: The payment system tries to update the status to `confirmed`. However, `verify_payment` raises `bad_request("Cannot verify payment for cancelled appointment")`, which protects the DB but leaves the transaction marked as paid in Razorpay without the customer getting their confirmed appointment.

## Improvement Recommendations

### CRITICAL: Reschedule Penalty Correction
- **Problem**: Provider payout docked for customer's late reschedule.
- **Recommendation**: Charge customer 20% reschedule fee via gateway during checkout, leaving provider payout intact; if provider is rescheduling, dock provider payout.
- **Files to change**: [appointment_service.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/services/appointment_service.py)
- **Effort estimate**: Medium (2 days)

### CRITICAL: Cross-Provider Package Leakage Filter
- **Problem**: active packages automatically apply to any provider.
- **Recommendation**: Restrict automatic package application to the same provider or providers within the same organization.
- **Files to change**: [appointment_service.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/services/appointment_service.py)
- **Effort estimate**: Low (0.5 days)

### HIGH: Google OAuth Integration & Account Linking
- **Problem**: Absence of fast social sign-in/login options.
- **Recommendation**: Integrate Google OAuth login. Match existing users solely by email address. Auto-generate secure passwords on social registration to preserve standard password-recovery capabilities.
- **Files to change**: [auth.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/routers/auth.py), [auth_service.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/services/auth_service.py)
- **Effort estimate**: Medium (2.5 days)

### HIGH: Timezone Conversion & Standard Synchronization
- **Problem**: Lack of timezone offsets causes mismatched bookings.
- **Recommendation**: Implement full timezone conversion (store UTC in database, convert dynamically for client display).
- **Files to change**: Scheduling controllers, database models, frontend displays.
- **Effort estimate**: High (4 days)

### HIGH: Package Cancellation Session Refund
- **Problem**: Cancelled package bookings do not credit back sessions.
- **Recommendation**: Add `package_purchase_id` to Appointment and credit back the session on early cancellation.
- **Files to change**: [appointment.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/models/appointment.py), [appointment_service.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/services/appointment_service.py)
- **Effort estimate**: Medium (1.5 days)

### HIGH: Consent-Based Provider Org Assignment
- **Problem**: Unilateral organization assignment of providers without consent/verification checks.
- **Recommendation**: Limit assignment to approved organizations and require provider consent (invitation flow).
- **Files to change**: [organization.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/routers/organization.py)
- **Effort estimate**: Medium (2 days)

### MEDIUM: Buffer Times Configuration
- **Problem**: Lack of buffer times causes back-to-back meeting fatigue.
- **Recommendation**: Add configuration for buffer times (e.g. 10-15m before/after) to dynamically offset generated slots.
- **Files to change**: [availability.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/models/availability.py), [availability_service.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/services/availability_service.py)
- **Effort estimate**: Medium (2 days)

### MEDIUM: Daily Booking Caps
- **Problem**: No cap limits lead to provider burnout.
- **Recommendation**: Allow providers to cap daily appointments (e.g. max 6 bookings per day).
- **Files to change**: [service_provider.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/models/service_provider.py), [appointment_service.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/services/appointment_service.py)
- **Effort estimate**: Medium (1 day)

### MEDIUM: Waitlist Slot-Level Locking
- **Problem**: Waitlist notification locks the entire day for a provider.
- **Recommendation**: Restrict the lock to the specific time slot that was released/cancelled.
- **Files to change**: [appointment_service.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/services/appointment_service.py)
- **Effort estimate**: Medium (1.5 days)

### MEDIUM: Fast Hashing for Verification Tokens
- **Problem**: Slow bcrypt algorithm causes unnecessary CPU loads during frequent OTP logins/resends.
- **Recommendation**: Use a faster hash context (such as HMAC-SHA256 or a salted SHA-256) for verification codes, keeping bcrypt reserved strictly for passwords.
- **Files to change**: [security.py](file:///Users/as-mac-1285/Desktop/genai_capstone/appointment-scheduling-platform/backend/utils/security.py)
- **Effort estimate**: Low (0.5 days)

## Questions & Decisions Log

- **Q1: How should the 20% late reschedule penalty fee be handled?**
  - *Decision*: Depends on who is rescheduling. If the provider is rescheduling, their payment will be reduced. If the customer is rescheduling, they will be charged the penalty.
- **Q2: How should active customer packages be applied during booking?**
  - *Decision*: Allow packages to be shared across providers in the same Organization only.
- **Q3: How should package session cancellations be handled?**
  - *Decision*: Add `package_purchase_id` to Appointment and credit back the session on early cancellation.
- **Q4: What should be the lock scope when a waitlisted user is notified of an opening?**
  - *Decision*: Lock the entire day for that provider (current behavior).
- **Q5: How should provider assignment to organizations be managed?**
  - *Decision*: Limit assignment to approved organizations and require provider consent (invitation flow).
- **Q6: Should providers be able to configure buffer times before or after appointments to prevent back-to-back bookings?**
  - *Decision*: Add configuration for buffer times (e.g., 10-15m before/after) to dynamically offset generated slots.
- **Q7: Should there be a minimum scheduling notice (lead time) to prevent last-minute bookings?**
  - *Decision*: Allow immediate booking if slot is in the future on the current day (current behavior).
- **Q8: Should we support daily booking limits (daily limits/caps) for providers?**
  - *Decision*: Allow providers to cap daily appointments (e.g. maximum 6 bookings per day) to prevent burnout.
- **Q9: How should timezone differences between customers and providers be handled?**
  - *Decision*: Implement full timezone conversion (store UTC in database, convert dynamically for client display).
- **Q10: How should account credentials/passwords be handled for users signing up with Google OAuth?**
  - *Decision*: Auto-generate a secure password, save the Google ID, and let the user set a custom password later using 'Forgot Password' if they want to switch to credentials login.
- **Q11: Should we store a Google Provider ID (google_id) in the database to link accounts?**
  - *Decision*: No extra column; match accounts solely by email address.
