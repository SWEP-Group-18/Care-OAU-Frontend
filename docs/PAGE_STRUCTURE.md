# Care-OAU — Page Structure & Responsibilities

This document provides a comprehensive mapping of all pages across the Care-OAU platform, including their structural layout, interactive controls, inputs, and functional responsibilities.

---

## 1. Landing Page (`/index.html`)

- **Role:** Central gateway connecting students, visitors, and clinical personnel.
- **Layout:** Full-width responsive landing layout with sticky top header and brand hero.
- **Key Sections:**
  - Hero banner with brand tagline: *"Your Health. Your Time. Our Care."*
  - Prototype demonstration disclaimer banner.
  - Core feature highlights (Digital Booking, Live Queue, Physician Capacity).
  - 4-step clinic workflow walkthrough.
  - Direct portal launchers (Student Portal vs. Staff Console).
  - Emergency phone numbers and Health Centre opening hours.

---

## 2. Student Portal (`/student`)

| Page File | Page Title | Functional Responsibilities & Key Elements |
|---|---|---|
| **`auth.html`** | Student Portal Access | Dual-tab switch for **Sign In** and **Create Account**. Inputs: Full Name, Matric / Hospital Reg No (`CSC/2021/045`), Email, Phone, Password, Confirm Password. Client-side regex format validation. Links to password recovery and staff portal. |
| **`verify-email.html`** | Verify Student Email | 6-digit OTP verification inputs with auto-advance, backspace retreat, clipboard paste handling, and 30-second resend countdown timer. Clear demonstration notice (demo code: `123456`). |
| **`forgot-password.html`** | Password Recovery | Accepts student matric number or institutional email. Simulates password reset dispatch and links to new password configuration. |
| **`reset-password.html`** | Set New Password | Inputs for new password and password confirmation with minimum length and matching validation. Submitting updates account password and redirects to login. |
| **`dashboard.html`** | Student Dashboard | Welcome card with student name and matric. 4 metric counters (Approved Visits, Pending Approval, Doctors on Duty, Next Slot). Active appointment summary card, doctor schedule sneak peek, and emergency contact lines. |
| **`doctors.html`** | Doctor Rosters & Schedules | Search input by physician name or specialty. Monday–Sunday day-of-week tab filters. Grid of doctor cards displaying duty days, hours, room, and capacity meter. If capacity is full, suggests suitable available alternative doctors. |
| **`book-appointment.html`** | Book Medical Consultation | 4-step wizard interface: <br>1. **Service Selection** (General Med, Dental, Eye, Lab, Mental Health).<br>2. **Doctor Selection** (Filtered by service, with capacity checks).<br>3. **Date & Time Slot** (Date picker with min today + 12 daily time slots).<br>4. **Symptoms & Review** (Symptoms input, summary review, and mandatory *Pending Approval* policy disclaimer). |
| **`my-appointments.html`** | My Appointments | Filterable appointments table (All, Pending Approval, Approved, Checked In, Completed, Cancelled). Action buttons for viewing appointment details, cancelling pending requests, or launching the live queue monitor if checked in. |
| **`queue-tracking.html`** | Real-time Queue Tracking | Displays live Queue Ticket (e.g. `Q-001`), status pill (*Waiting*, *Called*, *In Consultation*), people ahead counter, currently serving ticket, estimated wait time, and 5-stage visual progression flow. Includes demonstration check-in trigger if an approved appointment exists. |

---

## 3. Staff & Admin Portal (`/admin`)

| Page File | Page Title | Functional Responsibilities & Key Elements |
|---|---|---|
| **`login.html`** | Staff Portal Login | Restricted clinical staff console login. Inputs: Staff ID / Hospital Registration No (`STAFF/MED/002`) and password. No public registration option. |
| **`dashboard.html`** | Medical Operations Dashboard | 4 operational metrics (Pending Triage Requests, Approved Today, Lobby Queue Count, Completed Visits). Quick patient calling console (*Call Next*, *Start Consultation*, *Complete Visit*). Table of pending triage requests and doctor duty workloads. |
| **`appointments.html`** | Appointment Management & Check-in | Comprehensive management table with search and status tabs. Actions: **Approve**, **Reject** with reason modal, **Reschedule** (date/time picker), **Check In Patient** (generates sequential Queue Ticket `Q-xxx`), and **Issue Referral** (Lab, Dental, OAUTHC). |
| **`queue-management.html`** | Queue Callboard Console | Live hospital callboard management. Prominent display of active patient in consulting room. Buttons for *Call Next*, *Start Consultation*, *Complete Visit*, *Mark No Show*, and **Emergency Triage Override** (`EMG-xx`). Roster table with per-row controls. |
| **`doctor-management.html`** | Doctor Scheduling & Capacity | Physician roster management with search and day-of-week filters. Capacity meters showing booked vs. limit. Modal dialog to add/edit doctors, assign services, configure working days (Mon–Sun multi-select), consulting hours, and daily patient intake quotas. |
| **`service-management.html`** | Medical Service Management | Configuration table for clinical services. Modal dialog to add/edit services, configure scope descriptions, operating hours, daily capacity, referral prerequisites (toggle), and active/inactive status. Uses Monday–Sunday multi-select checkbox group. |
