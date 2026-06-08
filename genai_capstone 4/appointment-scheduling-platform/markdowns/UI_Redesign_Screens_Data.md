# Sigslot — Frontend Design & Engineering Specification
**Version:** 2.0  
**Stack:** React (JSX) + Shadcn/UI + Tailwind CSS v3  
**Last Updated:** May 2026  

---

## How to Read This Document

Every screen section follows a fixed structure:

1. **Route & File** — canonical path and component file
2. **Data Contract** — what the component needs, where it comes from, and its shape
3. **Component Map** — Shadcn + custom components used, with variant notes
4. **State Inventory** — every UI state with trigger, visual, and data condition
5. **Loading & Skeleton Spec** — geometry-matched skeletons for every async region
6. **Responsive Rules** — mobile-first breakpoint behaviour
7. **Interaction Model** — user actions, side effects, navigation outcomes
8. **Performance Notes** — render budget, lazy flags, memoisation hints

---

## Design System Foundation

### Aesthetic Direction
**Tone:** Refined utilitarian — clean information hierarchy, controlled density, no decorative noise. Think Linear meets a scheduling tool. Every element earns its place.

**Memorable Detail:** Appointment status badges use a left-border accent (4px solid) rather than background fill — dense, scannable, and visually distinct from every other SaaS tool.

---

### Design Tokens

```css
/* Colors */
--color-bg-base:        #0F0F11;   /* App shell background (dark mode default) */
--color-bg-surface:     #18181B;   /* Card / panel surfaces */
--color-bg-elevated:    #27272A;   /* Dropdowns, modals, tooltips */
--color-border:         #3F3F46;   /* Dividers, input borders */
--color-border-subtle:  #27272A;   /* Subtle separators */

--color-text-primary:   #FAFAFA;
--color-text-secondary: #A1A1AA;
--color-text-muted:     #71717A;
--color-text-inverse:   #09090B;

/* Brand */
--color-brand:          #6366F1;   /* Indigo — primary actions */
--color-brand-hover:    #4F46E5;
--color-brand-muted:    #312E81;   /* Subtle brand fills */

/* Status */
--color-status-pending:   #F59E0B;
--color-status-confirmed: #6366F1;
--color-status-completed: #22C55E;
--color-status-cancelled: #EF4444;
--color-status-rejected:  #EF4444;

/* Semantic */
--color-success:   #22C55E;
--color-warning:   #F59E0B;
--color-error:     #EF4444;
--color-info:      #3B82F6;

/* Typography */
--font-display: 'DM Sans', sans-serif;       /* Headings, labels */
--font-body:    'DM Sans', sans-serif;       /* Body text */
--font-mono:    'JetBrains Mono', monospace; /* IDs, codes, timestamps */

/* Scale */
--text-xs:   0.75rem;   /* 12px */
--text-sm:   0.875rem;  /* 14px */
--text-base: 1rem;      /* 16px */
--text-lg:   1.125rem;  /* 18px */
--text-xl:   1.25rem;   /* 20px */
--text-2xl:  1.5rem;    /* 24px */
--text-3xl:  1.875rem;  /* 30px */
--text-4xl:  2.25rem;   /* 36px */

/* Spacing (8px base grid) */
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;

/* Radii */
--radius-sm:   4px;
--radius-md:   8px;
--radius-lg:   12px;
--radius-xl:   16px;
--radius-full: 9999px;

/* Shadows */
--shadow-sm:  0 1px 2px rgba(0,0,0,0.4);
--shadow-md:  0 4px 12px rgba(0,0,0,0.5);
--shadow-lg:  0 12px 32px rgba(0,0,0,0.6);
--shadow-brand: 0 0 24px rgba(99,102,241,0.25);

/* Animation */
--duration-fast:   150ms;
--duration-base:   250ms;
--duration-slow:   400ms;
--ease-default:    cubic-bezier(0.4, 0, 0.2, 1);
--ease-spring:     cubic-bezier(0.34, 1.56, 0.64, 1);
```

---

### Status Badge Component (Global Reuse)

**Anatomy:**  
`[left-border 4px] [dot 6px] [label text-xs uppercase tracking-wide]`

**Variants:**

| Status      | Border Color              | Dot Color                 | Label      |
|-------------|---------------------------|---------------------------|------------|
| `pending`   | `--color-status-pending`  | `--color-status-pending`  | PENDING    |
| `confirmed` | `--color-status-confirmed`| `--color-status-confirmed`| CONFIRMED  |
| `completed` | `--color-status-completed`| `--color-status-completed`| COMPLETED  |
| `cancelled` | `--color-status-cancelled`| `--color-status-cancelled`| CANCELLED  |
| `rejected`  | `--color-status-rejected` | `--color-status-rejected` | REJECTED   |
| `verified`  | `--color-success`         | `--color-success`         | VERIFIED   |
| `pending_approval` | `--color-warning`  | `--color-warning`         | PENDING APPROVAL |

**Shadcn mapping:** Custom wrapper around `Badge` with `variant="outline"` and injected border-left override.

---

### KPI Metric Card Component (Global Reuse)

Used across Customer Dashboard, Provider Dashboard, Admin Dashboard, Payments, Operations.

**Anatomy:**
```
┌─────────────────────────────┐
│  [Icon 20px]    [Label sm]  │
│  [Value 3xl bold]           │
│  [Delta / subtext xs muted] │
└─────────────────────────────┘
```

**Props:**
```javascript
// PropTypes reference (install prop-types if runtime validation needed)
// KpiCard.propTypes = {
//   icon: PropTypes.elementType.isRequired,
//   label: PropTypes.string.isRequired,
//   value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
//   subtext: PropTypes.string,
//   trend: PropTypes.oneOf(['up', 'down', 'neutral']),
//   loading: PropTypes.bool,
// }
```

**Loading skeleton:** Full card replaced with a shimmer block matching the card's height (approx 96px). No partial skeletons inside a KPI card.

**Shadcn mapping:** `Card`, `CardContent` — surface background `--color-bg-surface`, border `--color-border`.

---

### Skeleton Shimmer Utility

All async regions use this CSS animation — never spinners for content placeholders:

```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-bg-elevated) 25%,
    var(--color-border) 50%,
    var(--color-bg-elevated) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
  border-radius: var(--radius-md);
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; opacity: 0.5; }
}
```

---

## 1. Public & Guest Screens

---

### 1.1 Landing Page

**Route:** `/`  
**File:** `frontend/src/pages/LandingPage.jsx`

#### Data Contract

| Region           | Data                                         | Source     | Type   |
|-----------------|----------------------------------------------|------------|--------|
| Hero badge       | "Over 10,000+ Appointments Completed"        | Static     | string |
| Hero heading     | "The New Standard in Modern Scheduling"      | Static     | string |
| Features grid    | 4 feature objects `{icon, title, desc}`      | Static     | array  |
| Categories grid  | 6 category objects `{emoji, name}`           | Static     | array  |
| Auth state       | `auth.isAuthenticated`, `auth.role`          | Redux      | boolean/string |
| Footer           | Brand name, copyright year, legal links      | Static     | —      |

#### Redux Selectors
```javascript
const isAuthenticated = useSelector(state => state.auth.isAuthenticated);
const role = useSelector(state => state.auth.role);
// role: 'customer' | 'provider' | 'admin' | null
```

#### Component Map

| Region             | Shadcn Component       | Notes                                      |
|--------------------|------------------------|--------------------------------------------|
| CTA Buttons        | `Button`               | `variant="default"` brand fill; `variant="outline"` ghost |
| Feature cards      | `Card`, `CardContent`  | No hover elevation — flat, border-only     |
| Category items     | Custom pill            | `rounded-full`, border, emoji + label      |
| Navbar auth check  | Conditional render     | See Navbar spec §6.1                       |

#### States

| State              | Trigger                        | UI Behaviour                                      |
|--------------------|--------------------------------|---------------------------------------------------|
| Unauthenticated    | `!isAuthenticated`             | Show "Get Started" + "Sign In" in nav; show both CTA cards |
| Authenticated      | `isAuthenticated === true`     | Replace CTAs with "Back to Dashboard" button      |
| Role: customer     | `role === 'customer'`          | Dashboard link → `/customer/dashboard`            |
| Role: provider     | `role === 'provider'`          | Dashboard link → `/provider/dashboard`            |
| Role: admin        | `role === 'admin'`             | Dashboard link → `/admin/dashboard`               |

#### Loading & Skeleton
Page is **fully static** — no async data. No skeleton required. First paint is content paint. Target **FCP < 0.8s**.

#### Responsive Rules

| Breakpoint | Behaviour                                                                 |
|------------|---------------------------------------------------------------------------|
| xs <480px  | Single column. Hero text 2xl. Features stack vertically. Categories 2-col grid. |
| sm 480–768px | Single column. Hero text 3xl. Categories 3-col grid.                    |
| md 768–1024px | Two-column features grid. Categories 3-col grid.                       |
| lg 1024px+ | Full 4-col features grid. 6-col categories (or 3-col × 2 rows). Max-width container centred. |

#### Interaction Model

- `"Get Started for Free"` → `/signup`
- `"Sign In"` → `/login`
- `"Join as Customer"` → `/signup?role=customer`
- `"Register as Provider"` → `/signup?role=provider`
- Category click (authenticated) → `/customer/providers?category={name}`
- Category click (unauthenticated) → `/signup`
- `"Back to Dashboard"` → role-resolved dashboard route

#### Performance Notes
- No images above the fold — icon-only features, emoji categories. Zero image LCP risk.
- Radial background: CSS `radial-gradient` only, no canvas or SVG. No JS on paint.
- Reduced-motion: all entrance animations (fade-up) suppressed.

---

## 2. Authentication Screens

---

### 2.1 Login Page

**Route:** `/login`  
**File:** `frontend/src/pages/auth/Login.jsx`

#### Data Contract

| Field          | Source           | Validation                              |
|----------------|------------------|-----------------------------------------|
| Email          | User input       | Required, valid email format            |
| Password       | User input       | Required, min 8 chars                   |
| Active Providers (branding panel) | Static | "10" — no API call         |
| Live Bookings (branding panel)    | Static | "18" — no API call         |

#### Redux / API
```javascript
// Dispatch on submit
dispatch(loginUser({ email, password }));
// Slice: auth.status = 'idle' | 'loading' | 'succeeded' | 'failed'
// On success: auth.role populated → redirect to role dashboard
// On failure: auth.error string → show toast
```

#### Component Map

| Element              | Shadcn Component  | Notes                                        |
|----------------------|-------------------|----------------------------------------------|
| Email input          | `Input`           | `type="email"`, left `Mail` icon via wrapper |
| Password input       | `Input`           | `type="password"/"text"` toggle, `Lock` icon |
| Show/hide toggle     | `Button`          | `variant="ghost"` `size="icon"`, `Eye`/`EyeOff` icon |
| Submit button        | `Button`          | `variant="default"`, full-width, loading state |
| Error feedback       | `Alert`           | `variant="destructive"`, appears below form  |
| Left branding panel  | Custom `div`      | Hidden on xs/sm, visible md+                 |

#### States

| State      | Trigger                        | UI Behaviour                                          |
|------------|--------------------------------|-------------------------------------------------------|
| Idle       | Page load                      | Form enabled, button default                          |
| Loading    | Submit clicked                 | Button disabled, shows `Loader2` spin icon + "Signing in…" |
| Error      | `auth.status === 'failed'`     | `Alert` with `auth.error` message renders below form  |
| Success    | `auth.status === 'succeeded'`  | Redirect; no success state needed in UI               |
| PW visible | Eye icon toggled               | `type` switches to `text`, icon swaps to `EyeOff`     |

#### Loading & Skeleton
No skeleton — form is static. Button loading state covers the async window.

#### Responsive Rules

| Breakpoint   | Layout                                                        |
|--------------|---------------------------------------------------------------|
| xs/sm <768px | Single column. Branding panel hidden. Form full-width, 24px padding. |
| md 768px+    | Two-column split: left branding panel (40%), right form (60%). |
| lg 1024px+   | Max-width 960px, centred. Branding panel gets richer stat display. |

#### Interaction Model
- Form submit → dispatch `loginUser` → on success: read `auth.role` → push to role dashboard
- `"Forgot Password?"` → `/forgot-password`
- `"Create an account"` → `/signup`
- Already authenticated guard: redirect away from `/login` if `isAuthenticated`

---

### 2.2 Signup Page

**Route:** `/signup`  
**File:** `frontend/src/pages/auth/Signup.jsx`

#### Data Contract

| Field              | Type   | Validation                                          |
|--------------------|--------|-----------------------------------------------------|
| role               | enum   | `'customer' \| 'provider'` — required               |
| fullName           | string | Required, min 2 chars                               |
| phone              | string | Required, 10-digit numeric                          |
| email              | string | Required, valid email                               |
| password           | string | Required — all 4 criteria must pass                 |

Query param: `?role=customer` or `?role=provider` pre-selects the role toggle.

#### Password Strength Criteria State
```javascript
const criteria = {
  length:    password.length >= 8,
  casing:    /[a-z]/.test(password) && /[A-Z]/.test(password),
  number:    /\d/.test(password),
  special:   /[^a-zA-Z0-9]/.test(password),
};
// All 4 must be true to enable submit
```

#### Component Map

| Element               | Shadcn Component   | Notes                                           |
|-----------------------|--------------------|-------------------------------------------------|
| Role toggle           | `ToggleGroup`      | `type="single"`, two items: Customer / Provider |
| Name/Phone/Email      | `Input`            | With `FormField` wrapper from `react-hook-form` |
| Password              | `Input`            | Show/hide toggle, same as Login                 |
| Criteria checklist    | Custom list        | `Check`/`X` icon + label, colour-coded per state |
| Submit button         | `Button`           | Full-width, disabled until all criteria pass    |

#### States

| State          | Trigger                             | UI                                               |
|----------------|-------------------------------------|--------------------------------------------------|
| Role unselected | Page load (no query param)         | Toggle neutral, submit disabled                  |
| Criteria partial | Password typed, < 4 passing       | Failing criteria show red `X`, passing show green `Check` |
| Form valid      | All fields filled + all criteria   | Submit button enabled                            |
| Loading         | Submit in flight                   | Button: `Loader2` + "Creating Account…"          |
| Error           | API returns error                  | `Alert` destructive below form                   |
| Success         | 201 response                       | Redirect to `/verify-otp`                        |

#### Loading & Skeleton
Static form — no skeleton. Loading window covered by button state.

#### Responsive Rules
Identical split to Login page: single column on mobile, two-column on md+. Left panel describes OTP + JWT verification flow — static marketing copy.

---

### 2.3 Verify OTP Page

**Route:** `/verify-otp`  
**File:** `frontend/src/pages/auth/VerifyOtp.jsx`

#### Data Contract

| Data              | Source           | Notes                                       |
|-------------------|------------------|---------------------------------------------|
| `otpEmail`        | Redux auth slice | Displayed as masked hint e.g. `j***@g**.com`|
| 6-digit OTP array | Local state      | `string[6]`, each cell is one character     |
| `isAdmin`         | Redux auth slice | Routes to different verify endpoint         |

#### OTP Input State Machine
```javascript
// 6 refs, one per cell
const inputRefs = useRef([...Array(6)].map(() => createRef()));

// On input: fill cell, auto-advance to next ref
// On backspace: clear cell, retreat to previous ref
// On paste: distribute 6 chars across all cells, focus last
```

#### Component Map

| Element          | Shadcn Component | Notes                                             |
|------------------|------------------|---------------------------------------------------|
| 6 OTP cells      | `Input`          | `maxLength=1`, `inputMode="numeric"`, 52px×52px   |
| Verify button    | `Button`         | Full-width, disabled if any cell empty            |
| Resend link      | `Button`         | `variant="link"`, disabled during cooldown (60s)  |
| Cooldown timer   | Custom text      | Counts down "Resend in 0:42", mono font           |

#### States

| State         | Trigger                         | UI                                              |
|---------------|---------------------------------|-------------------------------------------------|
| Incomplete    | < 6 cells filled                | Submit disabled                                 |
| Ready         | All 6 cells filled              | Submit enabled, cells have `ring-brand`         |
| Loading       | Submit in flight                | All cells disabled, button loading              |
| Error         | Wrong OTP                       | All cells flash red border, clear on next focus |
| Resend active | 60s cooldown elapsed            | Resend link re-enabled                          |
| Resend sent   | Resend clicked                  | Toast "OTP re-sent", cooldown restarts          |

#### Performance Notes
- 6 individual `Input` elements — each has one event listener. Total DOM impact negligible.
- Auto-focus on mount to first cell. No layout shift risk.

---

### 2.4 Forgot Password / Reset Password

These are single-purpose utility screens. Spec is intentionally lean.

**Forgot Password** (`/forgot-password`):
- Single `Input` (email) + `Button` ("Send Reset Link")
- Loading state on button
- Success: replace form with confirmation message — "Check your inbox"
- Back link → `/login`

**Reset Password** (`/reset-password`):
- Two `Input` fields: New Password + Confirm Password
- Inline match validation: show error if passwords diverge on blur
- Submit disabled if mismatch or empty
- Success: redirect to `/login` with success toast

Both screens: single-column, max-width 400px, vertically centred. No left panel needed.

---

## 3. Customer Role Screens

---

### 3.1 Customer Dashboard

**Route:** `/customer/dashboard`  
**File:** `frontend/src/pages/customer/Dashboard.jsx`

#### Data Contract

```javascript
// Redux state shape — customer dashboard slice
// state.customerDashboard = {
//   user: { firstName: '' },
//   metrics: { totalBooked: 0, upcoming: 0, completed: 0, cancelled: 0 },
//   upcomingSessions: [
//     {
//       id: '',
//       providerName: '',
//       date: '',       // ISO 8601 string
//       timeSlot: '',   // e.g. "10:00 AM – 10:30 AM"
//       status: '',     // 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected'
//     }
//   ],
//   loading: false,
//   error: null,
// }
```

#### API Calls on Mount
```javascript
// Dispatch on component mount
dispatch(fetchCustomerDashboard());
// Single endpoint: GET /customer/dashboard
// Returns: metrics + upcomingSessions[]
```

#### Component Map

| Region               | Shadcn / Custom       | Notes                                           |
|----------------------|-----------------------|-------------------------------------------------|
| Metrics grid         | `KpiCard` (custom)    | 4 cards, 2×2 on mobile, 4×1 on lg              |
| Upcoming sessions    | `Card` list           | Max 5 items, "View All" link to `/customer/appointments` |
| Status badges        | `StatusBadge` (custom)| See global spec §Design System                  |
| Provider avatar      | `Avatar`, `AvatarFallback` | First letter, colour seeded from name hash |
| Pro tips widget      | `Card`                | Static rotating content — no async             |
| "Find Provider" CTA  | `Button`              | `variant="default"`, full width on mobile       |

#### States

| State          | Trigger                    | UI                                                        |
|----------------|----------------------------|-----------------------------------------------------------|
| Loading        | `loading === true`         | 4 KPI card skeletons + 3 session item skeletons           |
| Empty sessions | `upcomingSessions.length === 0` | Empty state card: "No upcoming sessions. Find a provider." |
| Error          | `error !== null`           | `Alert` destructive with retry button                     |
| Loaded         | Data available             | Full render                                               |

#### Skeleton Spec
```
KPI Card Skeleton: 96px tall × full card width. Shimmer block.
Session Item Skeleton:
  - Avatar circle: 36px
  - Name line: 140px × 14px
  - Time line: 100px × 12px
  - Badge block: 80px × 20px
  Repeat × 3
```

#### Responsive Rules

| Breakpoint   | Layout                                                       |
|--------------|--------------------------------------------------------------|
| xs <480px    | KPI cards: 2-col grid. Sessions: full-width list. Greeting: text-2xl. |
| sm–md        | KPI cards: 2-col grid. Sessions: full-width list.            |
| lg 1024px+   | KPI cards: 4-col row. Sessions: 2-col with tips widget alongside. |

#### Interaction Model
- Session card click → `/customer/appointments/{id}`
- "Find Provider" → `/customer/providers`
- "View History" → `/customer/appointments`

---

### 3.2 Provider Marketplace

**Route:** `/customer/providers`  
**File:** `frontend/src/pages/customer/ProviderList.jsx`

#### Data Contract

```javascript
// Provider object shape (from API response)
// {
//   id: '',
//   name: '',
//   specialization: '',
//   isVerified: false,
//   avgRating: 0,           // 0–5
//   reviewCount: 0,
//   location: '',
//   category: '',
//   nextAvailableSlot: null, // ISO string or null if no slots
//   consultationFee: 0,      // INR
//   profilePhoto: null,      // URL string or null
// }

// Filter state shape
// const [filters, setFilters] = useState({
//   search: '',     // debounced 300ms before applying
//   category: '',   // empty string = show all
//   location: '',
// });

// Marketplace summary (mixed: API count + static rating)
// { totalCategories: 0, verifiedCount: 0, avgRating: '4.7' }
```

#### Component Map

| Region               | Shadcn / Custom        | Notes                                             |
|----------------------|------------------------|---------------------------------------------------|
| Summary stats        | `KpiCard` (custom)     | 3-card strip, always visible above fold           |
| Search input         | `Input`                | Debounced 300ms, `Search` icon left               |
| Category dropdown    | `Select`               | Options from `/admin/categories` or static list   |
| Location input       | `Input`                | Plain text, no autocomplete required              |
| Quick filter chips   | `Badge` + click handler| `variant="outline"` / `variant="default"` active  |
| Provider card grid   | Custom `ProviderCard`  | See anatomy below                                 |
| Clear button         | `Button`               | `variant="ghost"`, only visible when filters active |
| Empty state          | Custom                 | Illustration + "No providers match your filters"  |
| Loading state        | Skeleton grid          | 6 card skeletons, same geometry as loaded cards   |

#### ProviderCard Anatomy
```
┌──────────────────────────────────┐
│  [Avatar 48px] [Name bold]       │
│               [Specialization sm]│
│               [Verified badge]   │
│  ─────────────────────────────── │
│  ★ 4.8  (124 reviews)            │
│  📍 Mumbai   🏷 Healthcare       │
│  ⏰ Next: Tomorrow 10:00 AM      │
│  ─────────────────────────────── │
│  ₹500 / session         [Book →] │
└──────────────────────────────────┘
```

**Props:**
```javascript
// ProviderCard receives all fields from the provider object (see shape above) plus:
// { onClick: Function }  — called on card click, navigates to provider detail

// PropTypes (optional runtime validation):
// ProviderCard.propTypes = {
//   id: PropTypes.string.isRequired,
//   name: PropTypes.string.isRequired,
//   specialization: PropTypes.string,
//   isVerified: PropTypes.bool,
//   avgRating: PropTypes.number,
//   reviewCount: PropTypes.number,
//   location: PropTypes.string,
//   category: PropTypes.string,
//   nextAvailableSlot: PropTypes.string,  // null = no slots
//   consultationFee: PropTypes.number,
//   profilePhoto: PropTypes.string,       // null = show initials avatar
//   onClick: PropTypes.func.isRequired,
// }
```

**Card States:**
- Default: border `--color-border`, surface `--color-bg-surface`
- Hover: border `--color-brand`, shadow `--shadow-brand`, translate-y -2px
- No available slots: `nextAvailableSlot === null` → show "Unavailable" pill, card opacity 70%

#### Loading & Skeleton
Grid of 6 skeleton cards on initial load. Each card skeleton: 200px tall, shimmer. Matches loaded card geometry.

#### Responsive Rules

| Breakpoint   | Grid Columns | Card Behaviour                            |
|--------------|-------------|-------------------------------------------|
| xs <480px    | 1           | Full width cards                          |
| sm 480–768px | 2           | Filter bar collapses to icon row          |
| md 768–1024px| 2–3         | Summary stats visible                     |
| lg 1024px+   | 3–4         | Sidebar filter panel option (if desired)  |

#### Interaction Model
- Search input: debounce 300ms → `setFilter({search})`; no API call — filter client-side if list < 100, server-side if paginated
- Category select: immediate filter
- Quick chip click: sets category + optional location preset
- Clear button: resets all `FilterState` to defaults
- Card click: navigate to `/customer/providers/{id}`

---

### 3.3 Provider Detail & Booking Core

**Route:** `/customer/providers/:id`  
**File:** `frontend/src/pages/customer/ProviderDetail.jsx`

#### Data Contract

```javascript
// Provider detail object shape (from GET /providers/:id)
// {
//   id: '',
//   name: '',
//   specialization: '',
//   isVerified: false,
//   avgRating: 0,
//   reviewCount: 0,
//   location: '',
//   experience: 0,        // years as number
//   consultationFee: 0,
//   about: '',
//   profilePhoto: null,   // URL string or null
//   weeklyAvailability: [
//     { day: 'Monday', startTime: '09:00', endTime: '17:00', isActive: true }
//   ],
// }

// Slot state shape (from GET /providers/:id/slots?date=)
// {
//   date: '',     // ISO date string of selected date
//   slots: [
//     { time: '10:00 AM', isAvailable: true }
//   ],
//   loading: false,
// }
```

#### API Calls
```javascript
// On mount
dispatch(fetchProviderDetail(id));  // GET /providers/:id

// On date selection
dispatch(fetchAvailableSlots({ providerId: id, date }));  // GET /providers/:id/slots?date=
```

#### Component Map

| Region                | Shadcn / Custom       | Notes                                           |
|-----------------------|-----------------------|-------------------------------------------------|
| Provider sidebar card | `Card`                | Sticky on lg+, scrolls with content on mobile   |
| Rating display        | Custom star row       | Filled/empty star icons, numeric label          |
| Weekly availability   | Custom day-row list   | `Badge` for each active day, time range text    |
| 7-day date picker tabs| Custom scroll tabs    | Horizontal scroll on mobile, 7 pill buttons     |
| Full date input       | `Input type="date"`  | Fallback for dates beyond 7-day window          |
| Slots grid            | Custom button grid    | 3-col grid of time slot pills                   |
| Slot: available       | `Button variant="outline"` | Hover: brand fill                          |
| Slot: selected        | `Button variant="default"` | Brand fill, check icon                     |
| Slot: unavailable     | `Button` disabled     | Muted, strikethrough text                       |
| Waitlist button       | `Button variant="outline"` | Shows when ALL slots unavailable for date  |

#### States

| State               | Trigger                            | UI                                              |
|---------------------|------------------------------------|-------------------------------------------------|
| Loading provider    | Fetching provider detail           | Left sidebar skeleton + right content skeleton  |
| Loaded              | Data available                     | Full render                                     |
| Date selected       | Tab or date input changed          | Slots grid shows loading skeleton               |
| Slots loading       | Fetching slots                     | 6-slot skeleton grid (greyed pills)             |
| Slots loaded        | Slots returned                     | Grid renders with availability state per slot   |
| No slots available  | All slots `isAvailable: false`     | Grid fades, Waitlist button appears             |
| Slot selected       | User clicks available slot         | Slot button fills brand colour, proceed CTA activates |

#### Skeleton Spec
```
Provider Sidebar Skeleton:
  - Avatar circle: 64px
  - Name: 160px × 18px
  - Specialization: 100px × 14px
  - 3 metadata rows: 120px × 12px each

Slots Skeleton: 6 pill blocks, 80px × 36px, shimmer
```

#### Responsive Rules

| Breakpoint   | Layout                                                             |
|--------------|--------------------------------------------------------------------|
| xs–md <1024px | Single column. Sidebar card at top, calendar below, slots below. |
| lg 1024px+   | Two-column: sidebar (300px fixed) + main content (flex-1).        |

---

### 3.4 Book Appointment Form

**Route:** `/customer/book/:providerId`  
**File:** `frontend/src/pages/customer/BookAppointment.jsx`

#### Data Contract

```javascript
// Booking context — passed via React Router location.state or Redux bookingSlice
// {
//   providerId: '',
//   selectedDate: '',   // ISO date string
//   selectedSlot: '',   // e.g. "10:00 AM"
//   consultationFee: 0,
// }

// Service offering shape (from provider profile)
// { id: '', name: '', duration: 0, price: 0 }  // duration in minutes, price in INR

// Loyalty package shape
// { id: '', title: '', sessionsRemaining: 0, discountPercent: 0 }

// Dynamic intake field schema (stored in DB, fetched with provider profile)
// {
//   id: '',
//   label: '',
//   type: '',     // 'text' | 'textarea' | 'select' | 'checkbox'
//   required: false,
//   options: [],  // only present when type === 'select'
// }
```

#### Booking Flow Steps
```
Step 1: Form (service selection + intake fields + notes)
Step 2: Payment (reservation timer + Razorpay SDK modal)
```

#### Reservation Timer
- Slot held for **10 minutes** after Step 1 submit
- Countdown displayed: `"Slot reserved for 9:42"` in mono font
- Timer uses `setInterval` cleared on unmount
- At 0:00: show warning modal, release slot, redirect back to provider detail

#### Component Map

| Element                  | Shadcn / Custom       | Notes                                          |
|--------------------------|-----------------------|------------------------------------------------|
| Session summary box      | `Card`                | Date, time, fee — read-only, non-editable      |
| Service type selector    | `Select`              | Options from `ServiceOffering[]`               |
| Loyalty package selector | `Select`              | Optional, shows only if `LoyaltyPackage[]` exists |
| Dynamic intake fields    | Generated from schema | `Input`, `Textarea`, `Checkbox`, `Select` per type |
| Notes textarea           | `Textarea`            | Optional                                       |
| Right summary card       | `Card`                | Provider info + price ledger                   |
| Price ledger             | Custom table          | Fee rows with total. Mono font for amounts.    |
| Reserve button           | `Button`              | "Reserve & Pay"                                |
| Timer display            | Custom                | Mono font, warning colour at <2 min            |
| Pay button               | `Button`              | "Pay ₹X Securely", triggers Razorpay modal     |
| Pay later                | `Button variant="ghost"` | Skips payment, books without payment        |

#### States

| State             | Trigger                          | UI                                              |
|-------------------|----------------------------------|-------------------------------------------------|
| Form ready        | Page load with booking context   | Step 1 visible                                  |
| Form invalid      | Required intake fields empty     | Submit disabled, field-level error labels       |
| Reserving         | Reserve button clicked           | Button loading, form disabled                   |
| Reserved          | Slot confirmed by backend        | Step 2 revealed, timer starts                   |
| Timer warning     | < 2 minutes remaining            | Timer text turns `--color-warning`              |
| Timer expired     | Reaches 0:00                     | Modal: "Slot expired", redirect to provider     |
| Payment loading   | Razorpay modal open              | Backdrop, waiting for SDK callback              |
| Payment success   | Razorpay `payment.captured`      | Redirect to `/customer/appointments/{id}`       |
| Payment failed    | Razorpay error                   | Toast error, timer resumes, retry available     |

#### Responsive Rules

| Breakpoint   | Layout                                                         |
|--------------|----------------------------------------------------------------|
| xs–md <1024px | Single column. Summary card at top. Form below. Ledger above CTA. |
| lg 1024px+   | Two-column: form (60%) + right summary card sticky (40%).      |

---

### 3.5 Appointment Detail (Customer)

**Route:** `/customer/appointments/:id`  
**File:** `frontend/src/pages/customer/AppointmentDetail.jsx`

#### Data Contract

```javascript
// Appointment detail shape (from GET /customer/appointments/:id)
// {
//   id: '',
//   status: '',           // 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected'
//   provider: { name: '', specialization: '' },
//   date: '',
//   timeSlot: '',
//   fee: 0,
//   isPaid: false,
//   customerNotes: null,
//   cancellationReason: null,
//   statusHistory: [
//     { status: '', timestamp: '', note: null }
//   ],
// }
```

#### Component Map

| Element              | Shadcn / Custom       | Notes                                          |
|----------------------|-----------------------|------------------------------------------------|
| Status badge         | `StatusBadge` (global)| Prominent, at top of page                      |
| Provider card        | `Card`                | Name, spec — read-only display                 |
| Schedule card        | `Card`                | Date + time slot                               |
| Payment ledger       | Custom table          | Fee + Paid/Unpaid indicator                    |
| Audit trail timeline | Custom list           | Vertical line connector, timestamp + status    |
| Cancel button        | `Button variant="destructive"` | Visible only on `pending`/`confirmed` |
| Cancel modal         | `AlertDialog`         | Contains reason `Textarea`                     |

#### Timeline Anatomy
```
● CONFIRMED     Jan 15, 2026 10:32 AM
│
● PENDING       Jan 14, 2026 9:00 AM  [initial creation]
```

Each node: status colour dot + status label bold + timestamp text-sm muted.

#### States

| State           | Trigger                               | UI                                         |
|-----------------|---------------------------------------|--------------------------------------------|
| Loading         | Fetching appointment                  | Full page skeleton                         |
| Loaded          | Data ready                            | Full render                                |
| Cancel eligible | `status === 'pending' \| 'confirmed'` | Cancel button visible                      |
| Modal open      | Cancel clicked                        | `AlertDialog` renders, textarea enabled    |
| Cancelling      | Confirm clicked in modal              | Button loading state inside modal          |
| Cancelled       | API success                           | Status badge updates, button disappears    |

---

### 3.6 Appointment History (Customer)

**Route:** `/customer/appointments`  
**File:** `frontend/src/pages/customer/AppointmentHistory.jsx`

#### Data Contract

```javascript
// Appointment list item shape (from GET /customer/appointments)
// {
//   id: '',
//   providerName: '',
//   date: '',
//   timeSlot: '',
//   isPaid: false,
//   status: '',   // 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'
// }

// Active filter tab — local state
// const [activeTab, setActiveTab] = useState('all');
```

#### Component Map

| Element           | Shadcn / Custom      | Notes                                           |
|-------------------|----------------------|-------------------------------------------------|
| Count summary     | Text + number        | "X appointments total"                          |
| Filter tabs       | `Tabs`, `TabsList`   | One tab per status + "All"                      |
| Appointment rows  | `Card` list          | Clickable, full-width rows                      |
| Paid indicator    | `Badge`              | Green "PAID" / muted "UNPAID"                   |
| Status badge      | `StatusBadge` global | Right-aligned per row                           |
| Export button     | `Button variant="outline"` | `Download` icon + "Export Excel"          |
| Empty state       | Custom               | Per-tab: "No {status} appointments"             |

#### Responsive Rules
Appointment rows: full width at all breakpoints. Status + paid badge stack below provider name on xs.

---

### 3.7 Payments & Invoices (Customer)

**Route:** `/customer/payments`  
**File:** `frontend/src/pages/customer/Payments.jsx`

#### Data Contract

```javascript
// Payment transaction shape (from GET /customer/payments)
// {
//   id: '',
//   providerName: '',
//   status: '',           // appointment status
//   paymentState: '',     // 'paid' | 'pending' | 'cancelled'
//   date: '',
//   timeSlot: '',
//   consultationFee: 0,
//   penaltyFee: null,              // number or null
//   penaltyDescription: null,      // string or null
// }

// Payment metrics shape
// { totalTransactions: 0, paidCount: 0, pendingCount: 0, totalValue: 0 }
```

#### Component Map

| Element            | Shadcn / Custom       | Notes                                          |
|--------------------|-----------------------|------------------------------------------------|
| KPI cards (4)      | `KpiCard` global      | Loading skeleton on fetch                      |
| Filter tabs        | `Tabs`                | Same as appointment history tabs               |
| Transaction cards  | `Card` list           | Provider, state tag, schedule, fee amounts     |
| Penalty row        | Conditional `div`     | Only shown if `penaltyFee !== null`, warning colour |
| Fee amounts        | Text mono             | `--font-mono` for all INR amounts              |

#### INR Formatting Rule
All monetary values rendered with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.

---

### 3.8 Rebook Center

**Route:** `/customer/rebook`  
**File:** `frontend/src/pages/customer/Rebook.jsx`

#### Data Contract

```javascript
// Past provider shape (from GET /customer/rebook)
// {
//   id: '',
//   name: '',
//   specialization: '',
//   lastBookingDate: '',
//   lastBookingTime: '',
//   lastBookingStatus: '',
// }
```

Lightweight screen. Client-side search filter on `PastProvider[]`.

#### Component Map
- `Input` with `Search` icon — client-side filter
- `Card` list: Avatar + provider name + last appointment metadata + "Rebook" button
- "Rebook" button → `/customer/providers/{id}`

---

### 3.9 Reviews & Feedback

**Route:** `/customer/reviews`  
**File:** `frontend/src/pages/customer/Reviews.jsx`

#### Data Contract

```javascript
// Pending review shape (appointments awaiting review)
// { appointmentId: '', providerName: '', date: '', timeSlot: '' }

// Submitted review shape
// { appointmentId: '', providerName: '', date: '', timeSlot: '', rating: 0, comment: null }
// rating: 1–5 integer

// Draft state per pending review (local state map keyed by appointmentId)
// const [drafts, setDrafts] = useState({});
// drafts[appointmentId] = { rating: 0, comment: '' }
// rating 0 = not yet selected — disables submit
```

#### Component Map

| Element              | Shadcn / Custom    | Notes                                            |
|----------------------|--------------------|--------------------------------------------------|
| Pending roster       | `Card` list        | Each card has inline star + textarea form        |
| Star rating          | Custom 5-star row  | `Star` icon filled/outline on hover/select       |
| Comment textarea     | `Textarea`         | Optional, max 500 chars, char count display      |
| Submit button        | `Button`           | Per card, disabled until rating selected         |
| Submitted roster     | `Card` list        | Read-only, shows filled stars + comment          |
| Section headers      | `h2`               | "Pending Reviews" / "Submitted Reviews"          |

#### Star Hover State
Stars fill on hover up to hovered position. Selected state persists. Clicking a selected star deselects (resets to 0).

---

## 4. Provider Role Screens

---

### 4.1 Provider Dashboard

**Route:** `/provider/dashboard`  
**File:** `frontend/src/pages/provider/Dashboard.jsx`

#### Data Contract

```javascript
// Provider dashboard state shape (from GET /provider/dashboard)
// {
//   providerName: '',
//   metrics: { totalAppointments: 0, todaySlots: 0, pending: 0, completed: 0 },
//   todaysQueue: [
//     { id: '', customerName: '', timeSlot: '', status: '' }
//   ],
//   upcomingQueue: [
//     { id: '', customerName: '', date: '', timeSlot: '' }
//   ],
//   pendingDecisionsCount: 0,
// }
```

#### Component Map
Mirrors Customer Dashboard structure. Key differences:

| Element                   | Notes                                                    |
|---------------------------|----------------------------------------------------------|
| Today's queue             | Ordered by time slot asc. Status badge per row.          |
| Upcoming queue            | Shows date + time. Click → `/provider/appointments/{id}` |
| Pending decisions counter | Prominent `Badge` or mini card if count > 0              |
| "Export Schedule" button  | Downloads current month CSV                              |

#### States
Same loading/empty/error pattern as Customer Dashboard.

---

### 4.2 Appointments Queue (Provider)

**Route:** `/provider/appointments`  
**File:** `frontend/src/pages/provider/Appointments.jsx`

#### Data Contract

```javascript
// Provider appointment item shape (from GET /provider/appointments)
// {
//   id: '',
//   customerName: '',
//   date: '',
//   timeSlot: '',
//   customerNotes: null,  // string or null
//   status: '',           // 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected'
// }
```

#### Inline Action Pattern
Actions (Confirm / Reject / Mark Complete) are rendered inline on each card, not in a separate detail screen (optimistic UX for bulk operations).

```javascript
// JSDoc shapes — for reference only, not enforced at runtime
// On action click — optimistic update
dispatch(updateAppointmentStatus({ id, status: 'confirmed' }));
// Revert on API error, show error toast
```

#### Component Map

| Element           | Shadcn / Custom         | Notes                                           |
|-------------------|-------------------------|-------------------------------------------------|
| Filter tabs       | `Tabs`                  | All / Pending / Confirmed / Completed / Cancelled |
| Appointment card  | `Card`                  | Customer name, date/time, notes, status badge   |
| Confirm button    | `Button variant="default"` | Only on `pending`                            |
| Reject button     | `Button variant="destructive"` | Only on `pending`, requires confirm dialog |
| Mark Complete btn | `Button variant="outline"` | Only on `confirmed`                          |
| Action loading    | Button `Loader2` state  | Per-card, not full-page                         |

#### Reject Confirmation
`AlertDialog` with reason field (optional textarea). Prevents accidental rejects.

---

### 4.3 Availability Settings

**Route:** `/provider/availability`  
**File:** `frontend/src/pages/provider/Availability.jsx`

#### Data Contract

```javascript
// Availability slot shape (from GET /provider/availability)
// {
//   id: '',
//   day: '',          // 'Monday' through 'Sunday'
//   startTime: '',    // 'HH:MM' 24-hour format
//   endTime: '',      // 'HH:MM' 24-hour format
//   duration: 30,     // 15 | 30 | 45 | 60 | 90 (minutes)
//   isActive: true,
// }

// New slot form local state
// const [newSlot, setNewSlot] = useState({ day: '', startTime: '', endTime: '', duration: 30 });
```

#### Validation Rules
- `endTime` must be after `startTime`
- Minimum slot window: `endTime - startTime >= duration`
- Duplicate day+time combinations: warn but allow (provider may want overlapping configs)

#### Component Map

| Element           | Shadcn / Custom       | Notes                                              |
|-------------------|-----------------------|----------------------------------------------------|
| Slot list         | `Card` list           | Day label + time range + duration badge + status   |
| Status indicator  | `Badge`               | "Active" green / "Inactive" muted                  |
| Delete button     | `Button variant="ghost" size="icon"` | `Trash2` icon, confirm dialog    |
| "Add Slot" toggle | `Button`              | Reveals form below list                            |
| Day selector      | `Select`              | Mon–Sun options                                    |
| Duration selector | `Select`              | 15/30/45/60/90 min options                         |
| Start/End time    | `Input type="time"`   | 24h format, native time picker                     |
| Save button       | `Button`              | Disabled if form invalid                           |

#### Responsive Rules
Slot list: full-width cards at all breakpoints. New slot form: single column on mobile, 2-col grid on md+.

---

### 4.4 Profile Settings

**Route:** `/provider/profile`  
**File:** `frontend/src/pages/provider/Profile.jsx`

This is the most complex provider screen — four distinct sections.

#### Data Contract

```javascript
// Provider profile form shape (from GET /provider/profile)
// {
//   specialization: '',
//   experience: 0,
//   location: '',
//   consultationFee: 0,
//   category: '',
//   about: '',
//   isAcceptingAppointments: true,
// }

// Service offering shape
// { id: '', title: '', description: '', duration: 0, price: 0 }

// Intake field shape (dynamic form schema)
// { id: '', label: '', type: '', required: false }
// type: 'text' | 'textarea' | 'select' | 'checkbox'

// Loyalty package shape
// { id: '', title: '', sessionCount: 0, discountPercent: 0, price: 0 }
```

#### Page Structure (4 Sections)

**Section 1: Core Profile Form**
- Fields as above. `Checkbox` for "Accepting Appointments".
- `Select` for category (loaded from `/admin/categories`).
- "Save Profile" button: full-width on mobile, right-aligned on lg.
- Saving state: button loading, form disabled.

**Section 2: Service Offerings**
- List of existing offerings: title, duration badge, price — with delete button.
- Inline "Add Offering" form (collapsible): title, description, duration, price.

**Section 3: Intake Form Builder**
- List of existing fields: label + type tag + required indicator + delete.
- "Add Field" button adds a new row with label input + type selector + required toggle.
- "Save Intake Form" saves entire schema.

**Section 4: Loyalty Packages**
- List of packages: title, X sessions, Y% discount, ₹Z price.
- "Add Package" form: title, session count, discount %, package price.

#### Component Map

| Element              | Shadcn / Custom        | Notes                                          |
|----------------------|------------------------|------------------------------------------------|
| Section containers   | `Card`                 | Each section in its own card                   |
| Core form fields     | `Input`, `Textarea`, `Select`, `Checkbox` | `react-hook-form` controlled |
| Offering list        | Custom `div` rows      | Inline delete per row                          |
| Field builder rows   | Dynamic renders        | keyed by `field.id`                            |
| Save buttons         | `Button`               | Loading state per section independently        |
| Delete actions       | `Button ghost size="icon"` + `AlertDialog` | Per-item confirmation |

#### Unsaved Changes Warning
Track `isDirty` per section form. If user navigates away with unsaved changes, show browser `beforeunload` prompt.

---

## 5. Admin Role Screens

---

### 5.1 Admin Dashboard

**Route:** `/admin/dashboard`  
**File:** `frontend/src/pages/admin/Dashboard.jsx`

#### Data Contract

```javascript
// Admin dashboard state shape (from GET /admin/dashboard)
// {
//   metrics: {
//     totalUsers: 0,
//     totalProviders: 0,
//     verifiedProviderPercent: 0,   // 0–100
//     totalTransactions: 0,
//   },
//   appointmentBreakdown: { pending: 0, confirmed: 0, completed: 0, cancelled: 0 },
//   todayBookingsCount: 0,
//   unverifiedProvidersCount: 0,
// }
```

#### Component Map

| Element                   | Shadcn / Custom          | Notes                                        |
|---------------------------|--------------------------|----------------------------------------------|
| KPI cards (4)             | `KpiCard` global         | Platform Users, Service Pros, Trust Score, Transactions |
| Appointment breakdown     | Bar or donut `Chart`     | Recharts `BarChart` or `PieChart`, Shadcn chart wrapper |
| Today's traffic           | Highlighted `KpiCard`    | "New bookings today"                         |
| Critical tasks indicator  | `Alert` or banner        | Shown only if `unverifiedProvidersCount > 0` |
| Report download buttons   | `Button variant="outline"` | 3 buttons: Appointments / Users / Providers  |

#### Chart Spec
- Chart: `BarChart` with 4 bars (status breakdown)
- Bar colours: map to status tokens
- No animations on chart render (reduces CLS risk)
- Responsive: `ResponsiveContainer width="100%" height={200}`
- Loading: skeleton block matching chart height (200px)

---

### 5.2 User Directory Management

**Route:** `/admin/users`  
**File:** `frontend/src/pages/admin/Users.jsx`

#### Data Contract

```javascript
// User record shape (from GET /admin/users)
// {
//   id: '',
//   initials: '',     // derived client-side: firstName[0] + lastName[0]
//   fullName: '',
//   email: '',
//   phone: '',
//   role: '',         // 'admin' | 'provider' | 'customer'
//   isVerified: false,
//   isActive: true,
// }

// User filter local state
// const [filters, setFilters] = useState({ search: '', role: 'all' });
```

#### Component Map

| Element               | Shadcn / Custom          | Notes                                        |
|-----------------------|--------------------------|----------------------------------------------|
| Search input          | `Input`                  | Debounced 300ms                              |
| Role selector         | `Select`                 | All / Customers / Providers / Admins         |
| Users table           | `Table`                  | Shadcn `Table`, `TableHeader`, `TableRow`    |
| Avatar cell           | `Avatar`, `AvatarFallback` | Initials, colour seeded by role            |
| Role badge            | `Badge`                  | Red=Admin, Green=Provider, Blue=Customer     |
| Verification status   | `Badge`                  | Green "Verified" / muted "Unverified"        |
| Active toggle         | `Switch`                 | Optimistic update, revert on error           |
| Export button         | `Button variant="outline"` | "Global Export" + `Download` icon          |
| Loading               | Table row skeletons       | 8 skeleton rows, same column widths          |

#### Switch Optimistic Update Pattern
```javascript
// Immediately flip UI
const handleToggle = (userId, currentState) => {
  dispatch(optimisticToggleUser(userId));
  api.toggleUserStatus(userId, !currentState)
    .catch(() => dispatch(revertToggleUser(userId))); // revert on failure
};
```

#### Responsive Rules
Table scrolls horizontally on xs/sm — `overflow-x: auto` wrapper. Phone column hidden on xs. Role badge truncated to icon on xs.

---

### 5.3 Expert Roster (Provider Verification)

**Route:** `/admin/providers`  
**File:** `frontend/src/pages/admin/Providers.jsx`

#### Data Contract

```javascript
// Admin provider card shape (from GET /admin/providers)
// {
//   id: '',
//   name: '',
//   specialization: '',
//   email: '',
//   isVerified: false,
//   category: '',
//   avgRating: 0,
//   location: '',
//   consultationFee: 0,
// }
```

#### Component Map
Grid of `Card` components. Each card:
- Avatar (initial letter) + Name + Specialization + Email
- Status badge (Verified / Pending Approval)
- Metadata row: category tag, rating, location, fee
- Action buttons: "Approve" (hidden if verified) / "Revoke" (hidden if pending)

"Approve" action:
- `Button variant="default"` → optimistic verify
- `AlertDialog` confirmation for "Revoke" only (destructive)

Filter bar: search input + status selector (All / Verified / Pending Approval).

---

### 5.4 Global Appointment Schedule

**Route:** `/admin/appointments`  
**File:** `frontend/src/pages/admin/Appointments.jsx`

#### Data Contract

```javascript
// Admin appointment row shape (from GET /admin/appointments)
// {
//   id: '',
//   customerName: '',
//   providerName: '',
//   date: '',
//   timeSlot: '',
//   category: '',
//   status: '',     // 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected'
//   isPaid: false,
// }
```

#### Component Map
Dense `Table` layout. Admin screens prioritise data density.

| Column        | Component                | Notes                                         |
|---------------|--------------------------|-----------------------------------------------|
| Customer      | Text                     | Full name                                     |
| Provider      | Text                     | Full name                                     |
| Date & Time   | Text mono                | `--font-mono`                                 |
| Category      | `Badge variant="outline"`| Category name                                 |
| Status        | `StatusBadge` global     | Full-width badge                              |
| Payment       | `Badge`                  | "SETTLED" green / "UNPAID" muted              |

Status filter: button row (All / Pending / Confirmed / Completed / Cancelled / Rejected) — not `Tabs`, use `ToggleGroup` for compact rendering.

"Full Export" button → downloads detailed transaction log.

---

### 5.5 Categories Taxonomy Editor

**Route:** `/admin/categories`  
**File:** `frontend/src/pages/admin/Categories.jsx`

#### Data Contract

```javascript
// Category shape (from GET /admin/categories)
// {
//   id: '',
//   name: '',
//   icon: '',         // emoji character or lucide icon name string
//   description: '',
//   isActive: true,
// }

// Category form local state
// const [form, setForm] = useState({ name: '', icon: '', description: '' });
```

#### Component Map
- Category grid: responsive 2–4 col grid of `Card` components
- Each card: icon (large, 32px) + name bold + description text-sm + active badge + edit/delete icon buttons
- "New Category" button → `Sheet` (slide-over panel) containing the creation form
- Edit button → populates same `Sheet` form
- Delete → `AlertDialog` confirmation
- "Deploy Category" inside `Sheet`: save + close

Using `Sheet` (slide-over) instead of modal keeps category list visible during editing — better admin UX.

---

### 5.6 Operations Console

**Route:** `/admin/operations`  
**File:** `frontend/src/pages/admin/Operations.jsx`

#### Data Contract

```javascript
// Operations data shape (from GET /admin/operations)
// {
//   metrics: { pendingCount: 0, cancelledCount: 0, unverifiedProviders: 0, inactiveUsers: 0 },
//   recentExceptions: [
//     { id: '', providerName: '', customerName: '', date: '', timeSlot: '', status: '' }
//     // status: 'pending' | 'cancelled'
//   ],
//   verificationQueue: [
//     { id: '', name: '', specialization: '', location: '' }
//   ],
// }
```

#### Component Map
- 4 KPI cards — same global pattern
- Recent Exceptions: `Card` list, left-border status accent, provider + customer names, date/time
- Verification Queue: compact list rows, "Approve" button per row (routes to `/admin/providers/{id}` or inline approve)

---

## 6. Shared Shell Components

---

### 6.1 Navigation Header (Navbar)

**File:** `frontend/src/components/Navbar.jsx`

#### Data Contract

```javascript
// Navbar data — pulled from Redux auth + notifications slice
// const { isAuthenticated, role, userName } = useSelector(state => state.auth);
// const { unreadCount, recent, isOpen } = useSelector(state => state.notifications);

// userInitials derived client-side:
// const userInitials = userName ? userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '';

// Notification item shape:
// {
//   id: '',
//   message: '',
//   appointmentDate: '',
//   timeSlot: '',
//   isRead: false,
//   appointmentId: '',
//   role: '',           // 'customer' | 'provider'
// }
```

#### Component Map

| Element                | Shadcn / Custom          | Notes                                         |
|------------------------|--------------------------|-----------------------------------------------|
| Logo                   | Custom text mark         | "Sigslot" — `--font-display` medium          |
| Dashboard link         | `Button variant="ghost"` | Authenticated only                            |
| Notification bell      | `Button variant="ghost" size="icon"` | `Bell` icon + count badge      |
| Unread count badge     | `Badge`                  | Absolute-positioned, `--color-brand` fill, "9+" cap |
| Notification dropdown  | `Popover` or `DropdownMenu` | Max 8 items, scrollable                    |
| Notification item      | Custom `div`             | Message + date/time, unread = bold + dot      |
| User avatar            | `Avatar`, `AvatarFallback` | Initials, brand-coloured background         |
| Logout button          | `Button variant="ghost"` | Inside user menu dropdown                    |
| Sign In link           | `Button variant="ghost"` | Unauthenticated only                         |
| Get Started button     | `Button variant="default"` | Unauthenticated only                       |

#### Notification Badge Logic
```javascript
const displayCount = unreadNotificationCount > 9 
  ? '9+' 
  : String(unreadNotificationCount);
// Badge hidden entirely if count === 0
```

#### Notification Item Click
```javascript
const handleNotificationClick = (notification) => {
  dispatch(markNotificationRead(notification.id));
  const route = `/${notification.role}/appointments/${notification.appointmentId}`;
  navigate(route);
  // close dropdown
};
```

#### Responsive Rules
- xs–md: Logo + bell + avatar only. "Dashboard" link hidden. Menu in hamburger or bottom-sheet.
- lg+: Full nav with all links visible.

---

### 6.2 Navigation Sidebar

**File:** `frontend/src/components/layout/Sidebar.jsx`

#### Data Contract

```javascript
import {
  LayoutDashboard, Search, Calendar, CreditCard,
  Bell, Star, Clock, RotateCcw, User, CalendarCheck,
  Users, UserCheck, Tag, Activity,
} from 'lucide-react';

// Each link: { label, href, icon, badge? }
// badge is optional — number shown as pill on the link (e.g. unread notification count)

const CUSTOMER_LINKS = [
  { label: 'Dashboard',     href: '/customer/dashboard',     icon: LayoutDashboard },
  { label: 'Find Provider', href: '/customer/providers',     icon: Search },
  { label: 'Appointments',  href: '/customer/appointments',  icon: Calendar },
  { label: 'Payments',      href: '/customer/payments',      icon: CreditCard },
  { label: 'Notifications', href: '/customer/notifications', icon: Bell },
  { label: 'Reviews',       href: '/customer/reviews',       icon: Star },
  { label: 'Waitlist',      href: '/customer/waitlist',      icon: Clock },
  { label: 'Rebook',        href: '/customer/rebook',        icon: RotateCcw },
];

const PROVIDER_LINKS = [
  { label: 'Dashboard',    href: '/provider/dashboard',    icon: LayoutDashboard },
  { label: 'Profile',      href: '/provider/profile',      icon: User },
  { label: 'Availability', href: '/provider/availability', icon: CalendarCheck },
  { label: 'Appointments', href: '/provider/appointments', icon: Calendar },
  // ... remaining provider links
];

const ADMIN_LINKS = [
  { label: 'Dashboard',    href: '/admin/dashboard',    icon: LayoutDashboard },
  { label: 'Users',        href: '/admin/users',        icon: Users },
  { label: 'Providers',    href: '/admin/providers',    icon: UserCheck },
  { label: 'Appointments', href: '/admin/appointments', icon: Calendar },
  { label: 'Categories',   href: '/admin/categories',   icon: Tag },
  { label: 'Operations',   href: '/admin/operations',   icon: Activity },
  // ... remaining admin links
];
```

#### Active State
```javascript
const { pathname } = useLocation();
const isActive = (href) => pathname.startsWith(href);
// Active: background `--color-brand-muted`, text `--color-brand`, left border 2px brand
// Hover: background `--color-bg-elevated`
```

#### Responsive Behaviour

| Breakpoint   | Sidebar Behaviour                                          |
|--------------|------------------------------------------------------------|
| xs–md <1024px | Hidden by default. Toggled via hamburger. Renders as drawer (`Sheet`) overlaying content. |
| lg 1024px+   | Fixed-width sidebar (240px), always visible. Main content offset by sidebar width. |

#### Sidebar Link Anatomy
```
[Icon 18px] [Label text-sm] [Badge? right-aligned]
```
Padding: 10px 16px. Border-radius: `--radius-md`. Full-width clickable.

---

## 7. Frontend Data Handling Patterns

### 7.1 Redux Slice Structure (Recommended)

```
store/
├── auth/         authSlice.js     — user, role, tokens, otpEmail
├── customer/     
│   ├── dashboardSlice.js
│   ├── providersSlice.js
│   ├── appointmentsSlice.js
│   ├── paymentsSlice.js
│   └── reviewsSlice.js
├── provider/
│   ├── dashboardSlice.js
│   ├── appointmentsSlice.js
│   ├── availabilitySlice.js
│   └── profileSlice.js
└── admin/
    ├── dashboardSlice.js
    ├── usersSlice.js
    ├── providersSlice.js
    └── appointmentsSlice.js
```

### 7.2 Async State Shape (Standard)

Every slice with async data uses this shape:

```javascript
// Standard async slice shape used in every Redux slice with API data:
// {
//   data: null,      // null until first successful fetch
//   loading: false,
//   error: null,     // string error message or null
// }
// Map to UI: loading → skeleton | error → Alert + retry | data → full render
```

Map to UI: `loading` → skeleton, `error` → `Alert` + retry, `data` → full render.

### 7.3 Optimistic Update Pattern

Used for: status toggles (users), appointment actions (confirm/reject), notification mark-as-read.

```javascript
// 1. Dispatch optimistic action (immediate UI update)
// 2. Fire API call
// 3. On error: dispatch revert action + show error toast
// 4. On success: optionally refresh data
```

### 7.4 Debounce Pattern

All search inputs use 300ms debounce. Use `useCallback` + `useRef` timer:

```javascript
const debounceRef = useRef(null);
const handleSearch = (value) => {
  clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(() => {
    setFilter(prev => ({ ...prev, search: value }));
  }, 300);
};
```

### 7.5 Date & Time Formatting

```javascript
// Display date: "Jan 15, 2026"
new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  .format(new Date(isoString));

// Display time slot: "10:00 AM"
// Stored as string — render as-is

// Appointment ID display: uppercase, monospace, truncated to 8 chars
`#${appointment.id.slice(0, 8).toUpperCase()}`
```

### 7.6 Role Guard Pattern

```javascript
// RouteGuard wrapper
const RoleGuard = ({ allowedRoles, children }) => {
  const { isAuthenticated, role } = useSelector(state => state.auth);
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (!allowedRoles.includes(role)) return <Navigate to="/" />;
  return children;
};

// Usage
<RoleGuard allowedRoles={['customer']}>
  <CustomerDashboard />
</RoleGuard>
```

---

## 8. Performance Targets

| Metric | Target              | Notes                                      |
|--------|---------------------|--------------------------------------------|
| LCP    | ≤ 2.5s on 4G        | No above-fold images on most screens       |
| FCP    | ≤ 1.2s              | App shell pre-loaded, route chunks lazy    |
| CLS    | ≤ 0.1               | Skeletons must match loaded geometry exactly |
| FID    | ≤ 100ms             | No heavy synchronous operations on main thread |

### Lazy Loading Strategy
```javascript
// All role-specific routes lazy-loaded
const CustomerDashboard = lazy(() => import('./pages/customer/Dashboard'));
const ProviderDashboard  = lazy(() => import('./pages/provider/Dashboard'));
const AdminDashboard     = lazy(() => import('./pages/admin/Dashboard'));
// etc.

// Wrap in Suspense with skeleton fallback at route level
<Suspense fallback={<DashboardSkeleton />}>
  <CustomerDashboard />
</Suspense>
```

### Animation Budget
- UI transitions (tabs, dropdowns, badges): max **150ms**
- Page/route transitions: max **250ms**
- Skeleton shimmer: **1.4s** loop (CSS only)
- All animations respect `prefers-reduced-motion: reduce` — fall back to instant/opacity-only

---

## 9. Open Engineering Questions

| # | Question                                                                              | Owner       |
|---|---------------------------------------------------------------------------------------|-------------|
| 1 | Is provider list paginated server-side or fully client-loaded? Client filter only works reliably on datasets < ~200 records. | Backend |
| 2 | What is the Razorpay integration pattern — are order IDs created before or after slot reservation? Race condition risk if after. | Backend / Payments |
| 3 | Notification real-time delivery — polling interval or WebSocket? Affects bell badge freshness. | Backend |
| 4 | Are category options static (seeded) or always fetched from `/admin/categories` in provider profile form? | Backend |
| 5 | Reservation timer duration — is 10 minutes enforced server-side or only client-side? Client-only is gameable. | Backend |
| 6 | Admin sidebar links (Disputes, Compliance, Growth, Automation) are listed but have no screen specs — placeholder routes or deferred features? | Product |