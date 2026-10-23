# Care-OAU — User Flows & Interaction Workflows

This document details the step-by-step user interactions across the student and medical staff journeys.

---

## Flow 1: Student Registration & Email Verification

```
[Student Visits auth.html]
         │
         ▼
[Selects "Create Account" Tab]
         │
         ▼
[Enters Name, Matric/Reg No, Email, Phone, Password]
         │
         ▼
[Client Format Validation (Matric regex, Email, Match)]
         │
         ▼
[Account Created in Storage (Status: Unverified)]
         │
         ▼
[Redirects to verify-email.html]
         │
         ▼
[Inputs 6-digit OTP code (Demo: 123456)]
         │
         ▼
[Verified! Session Saved ──► Redirects to dashboard.html]
```

---

## Flow 2: 4-Step Appointment Booking Workflow

```
[Student Initiates Booking from Dashboard or Doctors page]
         │
         ▼
[STEP 1: Choose Medical Service]
  - General Medical Consultation
  - Dental Care & Surgery
  - Optometry & Eye Clinic
  - Diagnostic Laboratory
  - Mental Health & Counselling
         │
         ▼
[STEP 2: Choose Doctor & Verify Capacity]
  - Displays doctors on duty for selected service
  - Real-time capacity bar (e.g. 12/25 booked)
  - If capacity exhausted: prompts alternative doctor or future date
         │
         ▼
[STEP 3: Select Date & Time Slot]
  - Date picker (minimum date: today)
  - 12 available clinic slots (e.g., 08:30 AM, 10:00 AM, 02:00 PM)
         │
         ▼
[STEP 4: Symptoms Description & Review]
  - Enters brief medical reason / primary symptoms
  - Reviews summary (Service, Doctor, Date, Slot, Student Name)
  - Reads mandatory notice: "Submitted as Pending Approval"
         │
         ▼
[Submits Appointment]
  - Status saved as "Pending Approval"
  - Queue Number is NULL
  - Redirects to my-appointments.html with success toast
```

---

## Flow 3: Clinical Staff Triage (Approval / Rejection / Rescheduling)

```
[Medical Staff Logs into admin/login.html]
         │
         ▼
[Navigates to Appointments or Triage Dashboard]
         │
         ▼
[Inspects Pending Appointment Request]
         ├── Option A: [APPROVE]
         │       │
         │       ▼
         │   [Status changes to "Approved"]
         │   [Student notified: Ready for on-site check-in]
         │
         ├── Option B: [REJECT]
         │       │
         │       ▼
         │   [Staff enters clinical reason in modal dialog]
         │   [Status changes to "Rejected" with reason notes]
         │
         └── Option C: [RESCHEDULE]
                 │
                 ▼
             [Staff selects alternate date / time slot]
             [Appointment updated with new schedule]
```

---

## Flow 4: Hospital Reception Check-in & Queue Issuance

```
[Approved Student Arrives at Health Centre Reception]
         │
         ▼
[Presents Matric Card to Reception Staff]
         │
         ▼
[Staff locates record on admin/appointments.html]
         │
         ▼
[Staff clicks "Check In Patient"]
         │
         ▼
[System generates sequential Queue Ticket (e.g. Q-001)]
         │
         ▼
[Appointment status changes to "Checked In"]
         │
         ▼
[Patient record pushed to Live Queue in "Waiting" state]
         │
         ▼
[Student tracks live position on /student/queue-tracking.html]
```

---

## Flow 5: Live Queue Calling & Consultation Progression

```
[Patient Waits in Reception Area (Monitors queue-tracking.html)]
         │
         ▼
[Physician clicks "Call Next Patient" on Callboard]
         │
         ▼
[Ticket changes to "Called", assigned room broadcasted]
         │
         ▼
[Patient enters consulting room; Staff clicks "Start Consultation"]
         │
         ▼
[Ticket changes to "In Consultation"]
         │
         ▼
[Consultation concludes; Staff clicks "Complete Visit"]
         │
         ▼
[Ticket and matching appointment updated to "Completed"]
[Next waiting ticket moves up in the queue]
```

---

## Flow 6: Doctor Capacity Exhaustion & Alternative Suggestion

```
[Student selects Doctor whose daily capacity is reached (e.g. 20/20)]
         │
         ▼
[Card displays "Daily Capacity Reached" warning banner]
         │
         ▼
[Direct same-day booking disabled]
         │
         ▼
[Student clicks "Find Alternative Available Doctor"]
         │
         ▼
[Modal displays practitioners in same department with open capacity]
         ├── Option 1: Select recommended alternative doctor
         └── Option 2: Keep desired doctor for future open date
```
