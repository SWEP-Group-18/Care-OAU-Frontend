# Care-OAU — HTML, CSS and JavaScript Frontend

> **Tagline:** *Your Health. Your Time. Our Care.*  
> **Institution:** Obafemi Awolowo University (OAU) Health Centre, Ile-Ife, Nigeria.  
> **Course:** Software Engineering Practice (SWEP) — Group 18.

A responsive frontend prototype for appointment booking and patient queue tracking for the Obafemi Awolowo University Health Centre.


## Local preview and checks

Run from the project root with Node.js 24 or newer:

```powershell
node tools/serve.cjs
```

Open http://127.0.0.1:3000. No build step is required. Student demo: `21/SCI/1048` or `CSC/2021/045`; staff demo: `STAFF/MED/002`. Use any nonempty password. Registration verification code: `123456`.

```powershell
node tests/static-check.cjs
node tests/regression.mjs
```

Optional browser suite (requires Playwright and its Chromium browser): keep the preview server running, then run `node tests/browser-smoke.cjs`. Set `PLAYWRIGHT_MODULE` to an existing Playwright package path if it is installed outside this project. Screenshots are written to the ignored `.tmp` directory.

The student and staff pages share one appointment schema. Booking checks service hours, duty days, existing reservations, capacity and referral requirements. Queue numbers are assigned after approval and reception check-in on the visit date. Management forms update the same local data used by the student pages. Changes from another tab refresh appointment and queue displays.

This is still a browser-storage demo: sign-in, email verification and password recovery are simulated; no emails are sent and there is no production backend authentication. Browser route guards are navigation controls, not server-side authorization. Existing browser data is preserved; new demo seed records appear in a fresh browser profile.

---

## 🌟 Overview & Core Principles

Care-OAU replaces manual crowding, chaotic paper queues, and long corridor waiting times with a streamlined digital experience connecting students and healthcare staff.

### Clinical Policies Enforced
1. **Triage Approval Before Confirmation:** All online appointment bookings are initially registered with status **Pending Approval**. Clinical staff review patient symptoms and doctor availability before approving the appointment.
2. **Decoupled Queue Ticketing:** Queue tickets (e.g. `Q-001`) are **never generated during booking**. Tickets are issued exclusively when the student physically arrives and completes staff check-in at the Health Centre reception.
3. **Physician Daily Capacity Limits:** Every doctor has a capped daily consultation quota (e.g., 20–25 patients). When capacity is exhausted, the system suggests suitable alternative doctors on duty or allows selecting a future date. Appointments are never silently reassigned.
4. **Zero Frontend Frameworks:** Built strictly with **HTML5, Vanilla CSS3 (Custom Properties), and Vanilla ES6 JavaScript Modules**. No React, Next.js, TypeScript, Tailwind, or Bootstrap.

---

## 🚀 Quick Start (Local Development)

Because Care-OAU uses native **ECMAScript (ES6) Modules** (`import` / `export`), pages must be served over an HTTP server (to adhere to browser CORS security policies for local modules).

### Option 1: Python 3 (Recommended)
```bash
python -m http.server 3000
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

### Option 2: Node.js (`npx serve`)
```bash
npx -y serve .
```

### Option 3: VS Code Live Server
Right-click `index.html` in VS Code and click **"Open with Live Server"**.

---

## 🔑 Demonstration Credentials & Role Access

This scaffold contains a built-in state engine with pre-seeded mock data. Sign in to either portal; use separate browser profiles for independent concurrent sessions:

| Portal | Access URL | Default Test Credentials | Key Features |
|---|---|---|---|
| **Landing Page** | `/index.html` | Public access | Student sign-in, registration and staff portal link |
| **Student Portal** | `/student/auth.html` | Matric: `CSC/2021/045`<br>Password: Any password | 4-step booking wizard, doctor schedules, queue tracker |
| **Staff & Admin Console** | `/admin/login.html` | Staff ID: `STAFF/MED/002`<br>Password: Any password | Triage approvals, patient check-in, live callboard |

*Note: For email verification in the student registration flow, use the demonstration OTP code **`123456`**.*

---

## 📁 Repository Structure

```text
Care-OAU-Frontend/
│
├── index.html                           # Central landing page & portal switcher
├── README.md                            # Project documentation & quickstart
├── .gitignore                           # Git ignore specifications
├── .editorconfig                        # Standardized editor settings
│
├── student/                             # Student Portal HTML Pages
│   ├── auth.html                        # Login & Registration tabs
│   ├── verify-email.html                # 6-digit OTP verification with timer
│   ├── forgot-password.html             # Password recovery request
│   ├── reset-password.html              # New password configuration
│   ├── dashboard.html                   # Student overview & quick booking
│   ├── doctors.html                     # Real-time doctor availability & rosters
│   ├── book-appointment.html           # 4-step appointment booking wizard
│   ├── my-appointments.html             # Filterable appointments table
│   └── queue-tracking.html              # Real-time queue ticket monitor
│
├── admin/                               # Staff & Admin Portal HTML Pages
│   ├── login.html                       # Restricted clinical staff login
│   ├── dashboard.html                   # Operational metrics & quick caller
│   ├── appointments.html                # Request triage, check-in & referrals
│   ├── queue-management.html            # Patient callboard & consultation status
│   ├── doctor-management.html           # Doctor rosters & daily capacity limits
│   └── service-management.html          # Medical services & operating schedules
│
├── assets/
│   ├── css/                             # Modulated Vanilla CSS Architecture
│   │   ├── variables.css                # Brand tokens, colors, spacing, elevation
│   │   ├── reset.css                    # Modern CSS reset baseline
│   │   ├── global.css                   # Typography, grid, flex, cards, utilities
│   │   ├── components.css               # Buttons, badges, modals, toasts, wizard
│   │   ├── layouts.css                  # Left sidebar, sticky header, containers
│   │   ├── auth.css                     # Auth forms & OTP digit boxes
│   │   ├── student.css                  # Student dashboard, cards & queue monitor
│   │   ├── admin.css                    # Staff caller card, filter bars
│   │   └── responsive.css               # Mobile sliding drawer & tablet grids
│   │
│   ├── js/                              # Modular ES6 JavaScript Architecture
│   │   ├── core/
│   │   │   ├── app.js                   # Application bootstrap script
│   │   │   ├── config.js                # API URLs, storage keys, clinical statuses
│   │   │   ├── navigation.js            # Active link tracking & route guards
│   │   │   ├── storage.js               # Safe localStorage wrapper with fallback
│   │   │   └── utils.js                 # Date/time formatters, ticket generators
│   │   │
│   │   ├── components/
│   │   │   ├── student-sidebar.js       # Collapsible sidebar & mobile drawer
│   │   │   ├── admin-sidebar.js         # Staff console sidebar & mobile drawer
│   │   │   ├── header.js                # Top navigation header & user dropdown
│   │   │   ├── modal.js                 # Modal dialogs & confirmation system
│   │   │   ├── toast.js                 # Animated notification toast system
│   │   │   ├── dropdown.js              # Dropdown menus & Mon-Sun multi-select
│   │   │   ├── form-validation.js       # OAU matric, phone, email & match validator
│   │   │   └── loading.js               # Button busy states & loading spinners
│   │   │
│   │   ├── services/
│   │   │   ├── api-client.js            # Unified HTTP client with JWT injection
│   │   │   ├── auth-service.js          # Authentication & OTP verification service
│   │   │   ├── appointment-service.js   # Appointment lifecycle, approval & check-in
│   │   │   ├── doctor-service.js        # Doctor rosters, schedules & capacity checks
│   │   │   ├── queue-service.js         # Real-time queue caller & position tracking
│   │   │   └── medical-service.js       # Clinical service definitions & quotas
│   │   │
│   │   ├── student/                     # Student Page Controllers
│   │   │   ├── auth.js                  # Login/Register form validation
│   │   │   ├── verify-email.js          # 6-digit OTP input auto-advance
│   │   │   ├── password-recovery.js     # Password reset flows
│   │   │   ├── dashboard.js             # Student metrics & appointment summary
│   │   │   ├── doctors.js               # Rosters, search & capacity checks
│   │   │   ├── booking.js               # 4-step appointment booking wizard
│   │   │   ├── appointments.js          # Appointments table, filters & cancel
│   │   │   └── queue.js                 # Live queue monitor & wait times
│   │   │
│   │   ├── admin/                       # Staff Page Controllers
│   │   │   ├── login.js                 # Staff ID authentication
│   │   │   ├── dashboard.js             # Operational metrics & caller console
│   │   │   ├── appointments.js          # Triage approvals, check-in & referrals
│   │   │   ├── queue.js                 # Callboard execution & emergency calls
│   │   │   ├── doctors.js               # Doctor schedules & capacity controls
│   │   │   └── services.js              # Service config & Mon-Sun multi-select
│   │   │
│   │   └── data/
│   │       └── mock-data.js             # Central OAU Health Centre initial dataset
│   │
│   ├── images/
│   │   └── .gitkeep                     # Image asset directory
│   │
│   └── icons/
│       └── .gitkeep                     # Icon asset directory
│
├── docs/                                # Technical & Architectural Documentation
│   ├── PROJECT_OVERVIEW.md              # Executive summary, pillars & portal roles
│   ├── FRONTEND_ARCHITECTURE.md         # Layered modular design & state sync
│   ├── PAGE_STRUCTURE.md                # Page responsibilities & interactive controls
│   ├── DESIGN_SYSTEM.md                 # Design tokens, color palette & typography
│   ├── USER_FLOWS.md                    # Step-by-step user interaction journeys
│   ├── API_CONTRACTS.md                 # Proposed Node.js + Express + MySQL schema
│   ├── TEAM_WORKFLOW.md                 # Git branch model, commits & conventions
│   └── TESTING_CHECKLIST.md             # Quality assurance verification checklist
│
└── tests/
    └── manual-test-cases.md             # Step-by-step acceptance test scenarios
```

---

## 🎨 Design System Summary

- **Primary Teal:** `#0F766E`
- **Secondary Navy:** `#102A43`
- **Accent Mint:** `#E8F7F3`
- **Canvas Background:** `#F7FAFC`
- **Surface White:** `#FFFFFF`
- **Typography:** Inter (`300`, `400`, `500`, `600`, `700`) via Google Fonts.

---

## ⚠️ Prototype Demonstration Notice

This project currently operates as a self-contained frontend prototype:
- All mock state is stored safely in `localStorage` with in-memory fallback.
- No real medical records, passwords, or patient credentials should be entered.
- Simulated email verification does not connect to real mail servers; use code **`123456`**.
- To integrate with the production backend, set `USE_MOCK_DATA: false` in `assets/js/core/config.js`.

---

## 👥 Contributors

**SWEP 2026 Group 18** — Obafemi Awolowo University, Ile-Ife.
