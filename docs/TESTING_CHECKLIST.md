# Care-OAU — Frontend Testing & Quality Assurance Checklist

Use this comprehensive verification checklist before each release, presentation, or backend integration milestone.

---

## 1. Visual & Responsive Design

- [ ] **CSS Design Tokens:** Brand palette applied accurately (`--color-teal`: `#0F766E`, `--color-navy`: `#102A43`, `--color-mint`: `#E8F7F3`, `--color-bg`: `#F7FAFC`).
- [ ] **Desktop Left Sidebar:** Renders at 260px; toggles smoothly to 76px collapsed state on `#sidebar-toggle-btn` click; preference persists in storage.
- [ ] **Mobile Sliding Drawer:** On screens `<= 768px`, sidebar is hidden off-screen; clicking `#mobile-menu-toggle` slides drawer out with semi-transparent backdrop overlay; clicking backdrop closes drawer.
- [ ] **Responsive Tables:** Tables wrap gracefully in `.table-responsive` with smooth horizontal touch-scrolling on mobile devices.
- [ ] **Typography & Legibility:** Inter font loads crisply from Google Fonts with fallback to system sans-serif.

---

## 2. Authentication & Student Onboarding

- [ ] **Login & Register Switch:** Tab switches between Sign In and Create Account without page reload.
- [ ] **Matric & Hospital Number Validation:** Accepts valid OAU matric format (`CSC/2021/045`, `OAU/HC/12345`); highlights invalid formats with `.is-invalid` and helpful error text.
- [ ] **Phone & Email Validation:** Rejects non-email inputs and non-Nigerian phone formats.
- [ ] **Password Matching:** Confirms that `password` and `confirmPassword` inputs match before submission.
- [ ] **OTP Input Mechanics:** In `verify-email.html`, entering a digit advances focus to next box; Backspace moves focus backwards; pasting a 6-digit code fills all inputs.
- [ ] **Demonstration Notice:** Prototype disclaimer is clearly visible, noting simulated authentication.

---

## 3. Student Consultation Workflows

- [ ] **Doctor Schedules & Day Filters:** Clicking day buttons (Mon, Tue, etc.) filters displayed doctors; search bar responds to keystrokes.
- [ ] **Physician Capacity Meter:** Progress bar reflects `currentLoad / dailyCapacity`; displays "Full Today" when at quota.
- [ ] **Alternative Doctor Recommendation:** Clicking a doctor who has reached capacity presents a modal with available same-service practitioners; never silently reassigns.
- [ ] **4-Step Booking Wizard:**
  - [ ] Cannot advance past Step 1 without selecting a medical service.
  - [ ] Cannot advance past Step 2 without choosing an available doctor.
  - [ ] Cannot advance past Step 3 without selecting date and time slot.
  - [ ] Step 4 displays comprehensive summary and policy notice.
  - [ ] Submitted appointment record initializes with status **Pending Approval** and `queueNumber: null`.

---

## 4. Hospital Arrival Check-in & Live Queue Tracking

- [ ] **Check-in Restriction:** Only appointments marked **Approved** can be checked in.
- [ ] **Sequential Ticket Issuance:** On receptionist check-in, system generates next ticket (e.g., `Q-001`, `Q-002`) and places patient in live waiting queue.
- [ ] **Student Queue Monitor:** `queue-tracking.html` shows active ticket number, current status, count of patients ahead, currently serving ticket, and estimated wait time.
- [ ] **Empty State Guidance:** When student has no checked-in appointment, shows helpful explanation that queue tickets require on-site reception check-in.

---

## 5. Staff Console & Clinic Operations

- [ ] **Staff Login:** Requires staff ID (`STAFF/MED/002`) and password; prohibits public signup.
- [ ] **Rapid Triage:** Staff can approve, reject (with reason modal), or reschedule appointments.
- [ ] **Queue Callboard Console:**
  - [ ] "Call Next Patient" calls first waiting ticket and updates display.
  - [ ] "Start Consultation" transitions ticket to *In Consultation*.
  - [ ] "Complete Visit" transitions ticket and linked appointment to *Completed*.
  - [ ] "Mark No Show" records patient absence.
  - [ ] "Emergency Triage Override" generates priority emergency ticket (`EMG-xx`).
- [ ] **Doctor Management:** Modal correctly adds/edits doctors with working day checkboxes and daily capacity limits.
- [ ] **Service Management:** Modal uses Monday–Sunday multi-select checkbox component, sets daily quota, and toggles referral requirements.
