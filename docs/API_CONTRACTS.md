# Care-OAU — Proposed Backend API Contracts

This specification defines the proposed RESTful API endpoints for the future **Node.js + Express + MySQL** backend implementation.

---

## 1. Authentication Endpoints

### `POST /api/auth/student/register`
Creates a new student account.
- **Request Body:**
  ```json
  {
    "fullName": "Oluwaseun Adeleke",
    "matricNo": "CSC/2021/045",
    "email": "oadeleke@student.oauife.edu.ng",
    "phone": "08123456789",
    "password": "SecurePassword123"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Account created. Verification OTP dispatched.",
    "studentId": "usr_78192"
  }
  ```

### `POST /api/auth/student/verify-email`
Verifies student institutional email via 6-digit OTP.
- **Request Body:**
  ```json
  {
    "studentId": "usr_78192",
    "code": "123456"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "usr_78192",
      "name": "Oluwaseun Adeleke",
      "matricNo": "CSC/2021/045",
      "role": "student"
    }
  }
  ```

### `POST /api/auth/student/login`
- **Request Body:**
  ```json
  {
    "identifier": "CSC/2021/045",
    "password": "SecurePassword123"
  }
  ```
- **Response (200 OK):** JWT token and user profile.

### `POST /api/auth/admin/login`
- **Request Body:**
  ```json
  {
    "staffId": "STAFF/MED/002",
    "password": "StaffPassword456"
  }
  ```
- **Response (200 OK):** JWT token with `role: "admin"` claim.

---

## 2. Appointment Endpoints

### `GET /api/appointments`
Returns filtered appointment records based on user role and query parameters (`?status=Pending&date=2026-10-24`).

### `POST /api/appointments`
Submits a new appointment request. Enforces **Pending Approval** default status.
- **Headers:** `Authorization: Bearer <jwt>`
- **Request Body:**
  ```json
  {
    "serviceId": "srv_gen_med",
    "doctorId": "doc_01",
    "appointmentDate": "2026-10-25",
    "timeSlot": "10:00 AM",
    "reason": "Severe headache and malaria symptoms"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "appointment": {
      "id": "apt_9921",
      "status": "Pending Approval",
      "queueNumber": null,
      "createdAt": "2026-10-23T00:30:00Z"
    }
  }
  ```

### `PUT /api/appointments/:id/approve`
Clinical triage action approving appointment. Requires staff JWT.

### `PUT /api/appointments/:id/reject`
Rejects appointment with mandatory clinical reason string in body.

### `PUT /api/appointments/:id/check-in`
Reception action verifying on-site patient arrival.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "status": "Checked In",
    "queueNumber": "Q-014",
    "checkedInAt": "2026-10-23T08:30:00Z"
  }
  ```

---

## 3. Queue Management Endpoints

### `GET /api/queue`
Retrieves today's active waiting queue roster.

### `POST /api/queue/call-next`
Calls next patient with status `Waiting` to designated consulting room. Broadcasts real-time socket event.

### `PUT /api/queue/:id/start-consultation`
Transitions ticket to `In Consultation`.

### `PUT /api/queue/:id/complete`
Marks consultation as `Completed`. Automatically transitions linked appointment record to `Completed`.

---

## 4. Doctor & Service Endpoints

### `GET /api/doctors`
Returns list of doctors, operating days, hours, and live `currentLoad` vs `dailyCapacity`.

### `POST /api/doctors` & `PUT /api/doctors/:id`
Creates or updates doctor profile, daily capacity limit, and active days.

### `GET /api/services` & `PUT /api/services/:id`
Manages clinical services, Monday–Sunday operating schedules, and referral requirement flags.

---

## 5. Proposed MySQL Database Relational Schema

```sql
-- Students / Patients Table
CREATE TABLE students (
  id VARCHAR(36) PRIMARY KEY,
  matric_no VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Staff Users Table
CREATE TABLE staff (
  id VARCHAR(36) PRIMARY KEY,
  staff_id VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(30) NOT NULL,
  password_hash VARCHAR(255) NOT NULL
);

-- Clinical Services Table
CREATE TABLE medical_services (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  operating_days JSON NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  daily_capacity INT NOT NULL,
  requires_referral BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE
);

-- Doctors Table
CREATE TABLE doctors (
  id VARCHAR(36) PRIMARY KEY,
  service_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  title VARCHAR(50) NOT NULL,
  working_days JSON NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  daily_capacity INT NOT NULL,
  room VARCHAR(50),
  is_available BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (service_id) REFERENCES medical_services(id)
);

-- Appointments Table
CREATE TABLE appointments (
  id VARCHAR(36) PRIMARY KEY,
  student_id VARCHAR(36) NOT NULL,
  doctor_id VARCHAR(36),
  service_id VARCHAR(36) NOT NULL,
  appointment_date DATE NOT NULL,
  time_slot VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('Pending Approval', 'Approved', 'Rejected', 'Checked In', 'Completed', 'Cancelled') DEFAULT 'Pending Approval',
  queue_number VARCHAR(10) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  FOREIGN KEY (service_id) REFERENCES medical_services(id)
);
```
