# Schedully — Schedex Product Knowledge Base

This document is the baked-in knowledge base for the Schedully RAG chatbot.
It is ingested at startup and used to answer product help questions for all roles.

---

## Booking an Appointment (Customer)

To book an appointment:
1. Go to **Providers** in the left sidebar under your customer dashboard.
2. Search or browse providers by name, category, or location.
3. Click on a provider to view their profile, availability, and services.
4. Select a date and available time slot on the booking page.
5. Choose a service offering if the provider has multiple options.
6. Fill in any intake form questions the provider has set up.
7. Click **Book Appointment** and complete payment if required.

If the slot is full, you will be offered the option to join the **waitlist**.
You will receive a notification when a slot opens, giving you a 30-minute window to claim it.

---

## Appointment Statuses

| Status | Meaning |
|---|---|
| **pending** | Booked but not yet confirmed by the provider. Payment may be pending. |
| **confirmed** | Provider has accepted the appointment. |
| **completed** | The appointment has taken place. |
| **cancelled** | The appointment was cancelled by either party. |

---

## Cancelling an Appointment (Customer)

To cancel:
1. Go to **My Appointments** in your dashboard.
2. Find the appointment and click on it.
3. Click **Cancel Appointment**.
4. You will see a cancellation preview showing any penalty and expected refund.
5. Confirm the cancellation.

**Cancellation policy:** If you cancel within the provider's late-cancellation window (typically 24 hours before the appointment), a penalty fee may be deducted from your refund. The exact penalty percentage is set by each provider.

---

## Rescheduling an Appointment

Both customers and providers can request to reschedule an appointment.
- The other party receives a notification and has 24 hours to respond.
- If the request expires without a response, it is automatically cancelled.
- Reschedule requests can be accepted or declined.

---

## Payments

Schedex uses **Razorpay** for payment processing.
- Payment is collected when booking a confirmed appointment.
- You can view your payment history under **Payments** in your dashboard.
- Refunds are processed automatically upon cancellation (minus any applicable penalty).

---

## Waitlist

If a provider's slot is full:
1. You will be offered to join the **waitlist** for your preferred date.
2. When a cancellation occurs, the top customer in the waitlist is notified.
3. You have **30 minutes** to claim the slot before it passes to the next person.
4. You can leave a waitlist at any time from **My Waitlist** in your dashboard.

---

## Submitting a Review (Customer)

After a completed appointment:
1. Go to **My Appointments** and open the completed appointment.
2. Click **Leave a Review**.
3. Rate the provider (1–5 stars) and optionally leave a comment.

Reviews can only be submitted for completed appointments. One review per appointment.

---

## Provider Profile and Onboarding

New providers must complete onboarding before appearing in the marketplace:
1. Fill in your professional details (specialization, experience, consultation fee, location).
2. Upload required documents: identity proof, tax number, bank details, and certificates/licences.
3. Submit your profile for **admin approval** from the onboarding page.
4. Once approved, your profile becomes visible to customers.

Your **approval status** can be checked at any time from your dashboard or profile page.

---

## Provider Availability

To set your available hours:
1. Go to **Availability** in your sidebar.
2. Add availability slots by selecting the day of the week, start time, end time, and slot duration.
3. You can also add specific-date overrides (e.g. for holidays).
4. Customers can only book slots within your configured availability.

---

## Provider Services & Offerings

You can configure multiple service offerings:
- **Standard Session** — default offering
- **Intro Call** — shorter discovery call
- **Extended Session** — longer in-depth session

Go to **Services** in your sidebar to add, edit, or deactivate offerings.
You can also set up an **intake form** that customers fill in before booking.

---

## Provider Insights & Reports

The **Insights** page at `/provider/insights` shows:
- Revenue and booking trends (last 7, 15, 30, 60, or 90 days)
- Demand by hour of day
- Service type preference breakdown
- Cancellation reasons

You can export your monthly appointment schedule as an XLSX file using the **Export Schedule** button on the Insights page. This file can then be uploaded to Schedully to ask questions about your schedule data.

---

## Admin — Managing Providers

Admins can:
- View all providers at `/admin/providers`
- Approve or reject provider profiles submitted for review
- Verify or unverify a provider's account
- Debug why a provider is not visible in the marketplace using the debug endpoint

A provider is visible in the marketplace when:
1. `is_verified` = true (admin must set this)
2. `is_accepting_appointments` = true (provider must enable this)
3. `approval_status` = "approved" (provider must submit, admin must approve)

---

## Admin — Managing Users

At `/admin/users`, admins can:
- Browse all customers, providers, and organization accounts
- Activate or deactivate user accounts

---

## Admin — Organizations

Organizations group multiple providers under one brand.
- Providers can request to join an organization from their **Organization** page.
- Organization admins approve or reject join requests.
- Admins can approve or reject organization creation requests at `/admin/organization-requests`.

---

## Admin Reports

From the admin dashboard, you can download Excel reports:
- **All Appointments** — with filters for status and date range
- **All Users** — full user list
- **All Providers** — provider list with ratings and fees

These XLSX files can be uploaded to Schedully to ask questions about platform data.

---

## Google Calendar Sync (Provider)

Providers can sync their Schedex appointments with Google Calendar:
1. Go to **Calendar Sync** in the sidebar.
2. Click **Connect Google Calendar** and authorize access.
3. Use **Sync Now** to push confirmed appointments to your Google Calendar.
4. You can disconnect at any time.

---

## Notifications

Notifications appear in the bell icon in the top navigation.
You will receive notifications for:
- New appointment bookings
- Appointment cancellations or status changes
- Reschedule requests
- Waitlist slot availability
- Organization join request responses

---

## Disputes

If you have an issue with an appointment:
1. Go to the appointment detail page.
2. Click **Raise Dispute**.
3. Provide a reason. The admin team will review and resolve it.

Resolution options: full refund, or discharge (no refund).

---

## Account Management

- **Update Profile**: Go to your profile page to update your name, phone, and email.
- **Change Password**: Use "Forgot Password" on the login page to reset.
- **Delete Account**: Go to Settings → Delete Account. Your account is soft-deleted and can be restored within 30 days.

---

## Packages (Provider)

Providers can offer session packages:
- A package bundles multiple sessions at a discounted price.
- Customers can purchase a package from the provider's booking page.
- Package sessions are deducted as appointments are booked.

Go to **Services** → **Packages** tab to manage your packages.
