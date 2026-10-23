# Care-OAU — Project Overview

> **Tagline:** *Your Health. Your Time. Our Care.*  
> **Institution:** Obafemi Awolowo University (OAU) Health Centre, Ile-Ife, Osun State, Nigeria.  
> **Course:** Software Engineering Practice (SWEP) — Group 18.

---

## 1. Executive Summary

The Obafemi Awolowo University Health Centre provides primary and specialist healthcare services to thousands of university undergraduates, postgraduates, and staff. Historically, student healthcare encounters suffered from:
- **Corridor Crowding:** Long, uncontrolled waiting queues outside consulting rooms.
- **Lost Study Hours:** Students waiting hours without knowing if or when a doctor will attend to them.
- **Physician Overload:** Imbalanced patient allocation across attending medical officers.
- **Unclear Referral & Triage Status:** Lack of transparent communication on diagnostic test results or specialist availability.

**Care-OAU** is a purpose-built digital healthcare management platform designed to streamline outpatient appointments, introduce strict clinical triage approval, enforce physician daily capacity limits, and provide real-time queue position tracking accessible from any device on campus.

---

## 2. Core Pillars & Principles

### A. Triage Approval Before Confirmation
Online appointment bookings do not instantly guarantee clinic consultation. In accordance with university medical protocols, student requests initially enter the system as **Pending Approval**. Clinical triage staff evaluate symptoms, verify physician schedules, and approve the appointment.

### B. Decoupled Booking & Queue Ticketing
Queue numbers are **never generated during online booking**. A patient only enters the live queue after physical on-site check-in at the Health Centre reception on their scheduled day. This prevents "phantom waiting" and ensures that students present in the clinic lobby are prioritized accurately.

### C. Physician Capacity Transparency
Every medical officer operates within an explicit daily patient intake limit (e.g., 20–25 patients/day). When a doctor's limit is reached:
- The system prevents direct same-day booking.
- Suggests suitable available alternative doctors on duty.
- Never silently reassigns a patient to another doctor without notice.

### D. Zero-Framework Vanilla Architecture
Engineered strictly with **HTML5, modern CSS3, and ES6 JavaScript Modules**. No external heavy frameworks (React, Next.js, Tailwind, Bootstrap) are used, ensuring zero build latency, minimal bundle weight, maximum longevity, and straightforward integration with the upcoming Node.js + Express + MySQL backend.

---

## 3. Portal Roles

| Portal | Target Audience | Primary Responsibilities |
|---|---|---|
| **Student Portal (`/student`)** | Registered OAU Students | Account registration, 6-digit OTP verification, 4-step appointment booking, doctor roster inspection, status tracking, live queue monitor. |
| **Staff & Admin Portal (`/admin`)** | Doctors, Nurses, Reception Staff, Health Centre Administrators | Request triage (approve/reject), arrival check-in with ticket generation, live queue callboard management, physician roster and capacity controls, medical service management. |

---

## 4. Technology Stack

- **Markup:** Semantic HTML5 (ARIA attributes, accessible forms, structured headers).
- **Styling:** Modulated Vanilla CSS3 with CSS Custom Properties (Design Tokens), Flexbox, CSS Grid, and responsive media queries.
- **Logic:** Vanilla ECMAScript 2020+ (ES Modules: `import` / `export`).
- **Data Layer:** Central simulated state engine (`Storage` wrapper) with realistic initial mock data.
- **Future Backend Target:** Node.js + Express REST API + MySQL database.
