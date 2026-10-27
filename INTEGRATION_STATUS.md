# Care-OAU Frontend — Integration & Sync Architecture Status

## 1. System Integration Overview
The Care-OAU frontend now provides direct, resilient REST API integration across student and administrative health-centre operations:

- **API Base Routing:** `/api/v1` with automatic Vercel reverse proxy to Render backend, avoiding third-party cookie restrictions.
- **Session Credentials:** Unified `ApiClient` enforces `credentials: 'include'` for HttpOnly session cookies.
- **HTTP Verbs:** Full GET, POST, PUT, PATCH, and DELETE support with standardized error parsing.
- **Offline & Mock Resilience:** When network requests fail or in test/demo mode, persistent browser storage provides clean fallback states without application crashes.

---

## 2. Integrated Frontend Services
1. **`DoctorService`:**
   - Synchronizes roster data with `GET /doctors` (students) and `GET /doctors/admin/all` (admins).
   - Saves drafts via `POST /doctors` and publishes via `PATCH /doctors/:id/publish`.
   - Modifies working schedules via `PATCH /doctors/:id/schedule`.
   - Modifies profiles via `PATCH /doctors/:id/profile`.
   - Toggles availability via `PATCH /doctors/:id/availability`.
   - Deactivates doctors via `PATCH /doctors/:id/deactivate`.
2. **`MedicalService`:**
   - Queries health services via `GET /services`.
   - Admin management via `POST /services`, `PATCH /services/:id`, and `PATCH /services/:id/status`.
3. **`AppointmentService`:**
   - Queries student appointments via `GET /appointments/me`.
   - Queries administrative logs via `GET /appointments/admin/all`.
   - Creates bookings via `POST /appointments` with server-side conflict detection (`409 SLOT_CONFLICT`).
   - Cancels visits via `PATCH /appointments/:id/cancel`.
   - Approves/updates status via `PATCH /appointments/:id/status`.
4. **`QueueService`:**
   - Staff check-in on arrival via `POST /queue/check-in` (assigns sequential `Q-001` tickets).
   - Real-time student queue tracker via `GET /queue/me` with live position and calculated wait time.
   - Staff consultation flow via `PATCH /queue/:id/call`, `/start`, `/complete`, `/no-show`.
5. **`SyncManager`:**
   - 10-second polling while browser tab is visible.
   - Pauses when tab is hidden, resumes immediately upon tab focus.
   - Overlap protection preventing simultaneous fetches.
   - Immediate refresh on mutations.

---

## 3. Frontend Test Verification
To run all automated test suites:
```bash
node tests/static-check.cjs
node tests/admin-auth.mjs
node tests/sync-manager.mjs
node tests/doctor-backend-integration.mjs
node tests/medical-backend-integration.mjs
node tests/appointment-backend-integration.mjs
node tests/queue-backend-integration.mjs
```
