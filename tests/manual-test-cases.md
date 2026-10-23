# Care-OAU — Manual Test Cases & Acceptance Scenarios

This document specifies concrete test scenarios to execute against the Care-OAU frontend prototype to validate end-to-end user journeys before backend integration.

---

## Test Scenario 1: Student Account Creation & OTP Verification

- **Objective:** Verify student onboarding, input validation, and simulated 6-digit OTP verification.
- **Steps:**
  1. Open `student/auth.html` in browser.
  2. Click the **Create Account** tab.
  3. Enter full name: `Oluwaseun Adeleke`.
  4. Enter invalid matric number (e.g., `12345`) and click Submit.
     - **Expected:** Field highlighted in red; error message: *"Enter a valid OAU Matric No (e.g. CSC/2020/045) or Reg No."*
  5. Correct matric number to `CSC/2021/045`.
  6. Enter valid student email, phone, and matching passwords. Click **Create Account & Verify**.
     - **Expected:** Redirected to `student/verify-email.html`.
  7. Enter demo OTP `123456` across the 6 input boxes.
     - **Expected:** Success notification displayed; redirected to `student/dashboard.html`.

---

## Test Scenario 2: 4-Step Appointment Booking Workflow

- **Objective:** Verify appointment creation adheres to the **Pending Approval** default policy.
- **Steps:**
  1. From `student/dashboard.html`, click **Quick Book Appointment**.
  2. **Step 1:** Select **General Medical Consultation**. Click *Continue to Step 2*.
  3. **Step 2:** Select **Dr. O. A. Adeleke**. Verify duty days and capacity meter are visible. Click *Continue to Step 3*.
  4. **Step 3:** Select tomorrow's date. Click time slot **10:00 AM**. Click *Continue to Step 4*.
  5. **Step 4:** In symptoms box, enter: `Fever, chills, and headache for 2 days`.
  6. Review appointment summary. Verify notice reads: *"Your appointment request will be registered with status Pending Approval."*
  7. Click **Submit Appointment Request**.
     - **Expected:** Success toast appears; redirected to `student/my-appointments.html`.
     - **Verification:** The new appointment displays status badge **Pending Approval** with `Queue No: Pending Check-in`.

---

## Test Scenario 3: Physician Capacity Limit & Alternative Doctor

- **Objective:** Ensure that when a doctor's capacity is full, the system alerts the student and suggests alternatives.
- **Steps:**
  1. Navigate to `student/doctors.html`.
  2. Locate **Dr. A. M. Ibrahim** (Consultant Optometrist), who is at capacity limit (20 / 20 booked).
     - **Expected:** Doctor card displays red capacity fill, badge **Daily Capacity Reached**, and button **Find Alternative Available Doctor**.
  3. Click **Find Alternative Available Doctor**.
     - **Expected:** Modal opens displaying other practitioners in that service department with available capacity or an option to select a future date slot.
     - **Verification:** Appointment is never silently reassigned without patient confirmation.

---

## Test Scenario 4: Staff Triage (Approval & Check-in)

- **Objective:** Validate staff triage approval and hospital arrival check-in.
- **Steps:**
  1. Open `admin/login.html`. Sign in with Staff ID `STAFF/MED/002` and password.
  2. Navigate to `admin/appointments.html`.
  3. Locate the appointment created in Scenario 2 (status: *Pending Approval*).
  4. Click **Approve**.
     - **Expected:** Status transitions to **Approved**.
     - **Verification:** The row now displays button **Check In Patient**.
  5. Click **Check In Patient**.
     - **Expected:** Success toast announces: *"Patient checked in! Queue Ticket Q-003 assigned."*
     - **Verification:** Status transitions to **Checked In** and Queue Ticket column displays `Q-003`.

---

## Test Scenario 5: Real-time Queue Tracking & Callboard Synchronization

- **Objective:** Verify that staff callboard actions immediately reflect on the student's live queue monitor.
- **Steps:**
  1. In a student browser tab, navigate to `student/queue-tracking.html`.
     - **Expected:** Glowing Queue Monitor card displays `Q-003`, current status **Waiting in reception area**, and count of patients ahead.
  2. In staff tab, navigate to `admin/queue-management.html`.
  3. Click **Call Next Patient**.
     - **Expected:** Ticket `Q-003` is announced; status changes to **Called** with assigned room.
  4. Switch back to student tab (or click *Refresh Live Status*).
     - **Expected:** Student monitor updates to **Called** with prompt: *"Please proceed immediately to Consulting Room 2"*.
  5. In staff tab, click **Start Consultation**, then **Complete Visit**.
     - **Expected:** Ticket and appointment are marked **Completed**.

---

## Test Scenario 6: Service Management with Monday–Sunday Multi-Select

- **Objective:** Verify configuration of clinical services and Monday–Sunday multi-select functionality.
- **Steps:**
  1. Navigate to `admin/service-management.html`.
  2. Click **Add New Clinical Service**.
  3. Enter title: `Physiotherapy & Rehabilitation`.
  4. Select category: `Specialist Clinic`.
  5. In the **Operating Days** section, select checkboxes for `Mon`, `Wed`, and `Fri`.
     - **Expected:** Multi-select labels toggle to selected brand state.
  6. Set operating hours to `09:00` - `15:00` and daily capacity to `20`.
  7. Check **Requires Medical Officer Referral**. Click **Save Clinical Service**.
     - **Expected:** Modal closes with success notification; table updates with new service row showing days `Mon, Wed, Fri` and referral badge `Required`.
