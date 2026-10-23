# Care-OAU — Frontend Architecture

This document describes the design patterns, modular directory breakdown, and architectural layers implemented across the **Care-OAU** frontend scaffold.

---

## 1. Architectural Philosophy

Care-OAU adheres to modern web standards without external framework dependencies:
1. **Separation of Concerns:** Distinct separation between DOM structure (`HTML`), visual design tokens (`CSS`), reusable interactive widgets (`Components`), data abstraction (`Services`), and page-specific controllers (`Page Controllers`).
2. **ES6 Native Modules:** Native browser `type="module"` imports eliminate bundler configuration steps (Webpack/Vite/Rollup) during development.
3. **Pluggable Service Layer:** API consumers interact with abstracted services (`AppointmentService`, `QueueService`, `DoctorService`, `MedicalService`), which communicate through `ApiClient`. Switching from demonstration mode to the future Node.js backend requires updating `APP_CONFIG.USE_MOCK_DATA` to `false`.

---

## 2. Layered Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      HTML Presentation                      │
│     Student Portal (/student)   │   Admin Portal (/admin)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Page Controller Layer                    │
│   student/*.js (auth, dashboard, booking, queue, etc.)       │
│   admin/*.js (login, dashboard, queue, doctors, etc.)       │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
┌──────────────▼──────────────┐ ┌──────────────▼──────────────┐
│   Reusable UI Components    │ │     Domain Service Layer    │
│  - Toast System             │ │  - AuthService              │
│  - Modal Dialogs            │ │  - AppointmentService       │
│  - Dropdowns & Multi-select │ │  - QueueService             │
│  - Form Validator           │ │  - DoctorService            │
│  - Header & Sidebar Nav     │ │  - MedicalService           │
└──────────────┬──────────────┘ └──────────────┬──────────────┘
               │                               │
┌──────────────▼───────────────────────────────▼──────────────┐
│                   Core Infrastructure Layer                  │
│  - ApiClient (fetch abstraction + JWT authorization bearer) │
│  - Storage (safe localStorage wrapper + in-memory fallback) │
│  - Utils (date/time, queue tickets, formatters, validation) │
│  - Config (endpoints, storage keys, clinical statuses)      │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                 State / Persistence Engine                  │
│     localStorage (Demo Mode) ──► Node.js + MySQL (Future)   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Directory Breakdown & Responsibilities

### `assets/js/core/`
- **`config.js`:** Application identity, API URLs, simulated storage keys, appointment & queue status constants.
- **`storage.js`:** Resilient client-side storage wrapper. Handles quota errors, JSON serialization/deserialization, and memory fallback.
- **`utils.js`:** Pure utility functions (UK date formatting, 12-hour time formatting, sequential queue number generators, regex format checkers, and badge HTML helpers).
- **`navigation.js`:** Active route highlighting, login session checking, and role-based redirects.
- **`app.js`:** Global bootstrapping script initializing dropdown listeners, mobile drawer backdrop, and theme settings.

### `assets/js/components/`
- **`student-sidebar.js` & `admin-sidebar.js`:** Collapsible desktop navigation and mobile sliding drawer with swipe backdrop.
- **`header.js`:** Reusable top navigation bar featuring current page breadcrumbs, notifications, and user session menu.
- **`toast.js`:** Stackable, animated alert notifications (`success`, `error`, `warning`, `info`).
- **`modal.js`:** Accessible modal dialogs with backdrop blur, focus trapping, ESC key dismiss, and a generic `Modal.confirm()` API.
- **`dropdown.js`:** Global dropdown menus and Monday–Sunday checkbox multi-select components.
- **`form-validation.js`:** Client-side validation checking OAU matric format (`CSC/2020/045`), hospital registration numbers, emails, phone numbers, and password matching.
- **`loading.js`:** Button busy spinner states and full-container loading placeholders.

### `assets/js/services/`
- **`api-client.js`:** Unified HTTP abstraction (`get`, `post`, `put`, `delete`) injecting JWT bearer tokens and standardizing error handling.
- **`auth-service.js`:** Handles student login, registration, email OTP simulation, and staff authentication.
- **`appointment-service.js`:** Manages appointment creation, staff approval/rejection, rescheduling, and receptionist check-in.
- **`queue-service.js`:** Tracks active waiting queue, calculates positions ahead, manages calling console actions.
- **`doctor-service.js`:** Queries doctor rosters, duty days, operating hours, capacity limits, and alternative doctor matches.
- **`medical-service.js`:** Queries clinical services, operating hours, referral requirements, and service capacity.

### `assets/js/data/`
- **`mock-data.js`:** Rich, realistic initial dataset pre-seeded into client storage for Obafemi Awolowo University Health Centre.

---

## 4. Multi-Role Simulated State Synchronization

In demonstration mode:
1. When a student books an appointment in `/student/book-appointment.html`, it is saved in browser storage as **Pending Approval**.
2. Switching to the Staff Portal (`/admin/appointments.html` or `/admin/dashboard.html`) immediately displays this appointment in the triage list.
3. Once the staff approves the request and clicks **Check In Patient**, the system generates a sequential Queue Ticket (e.g., `Q-001`) and pushes the patient to the live queue.
4. Navigating back to the Student Portal (`/student/queue-tracking.html`) dynamically displays the active ticket monitor, live position, and estimated wait time.
