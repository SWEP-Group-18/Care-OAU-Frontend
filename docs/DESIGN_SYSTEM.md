# Care-OAU — Design System & Visual Guidelines

This document specifies the design tokens, color palette, typography, component guidelines, and accessibility standards governing the **Care-OAU** user interface.

---

## 1. Brand Identity

- **Brand Name:** Care-OAU
- **Institution:** Obafemi Awolowo University Health Centre
- **Official Tagline:** *Your Health. Your Time. Our Care.*
- **Aesthetic Direction:** Clean, professional, minimal, healthcare-focused, highly legible, and accessible.

---

## 2. Color Palette & CSS Tokens

Care-OAU utilizes a curated palette designed for clinical trust, optical contrast, and calm assurance:

### Core Brand Colors

| Token Name | Hex Value | Role & Usage |
|---|---|---|
| `--color-teal` | `#0F766E` | **Primary Brand Color.** Used for primary action buttons, active navigation states, links, and key highlights. |
| `--color-teal-hover` | `#115E59` | Hover state for primary buttons and interactive brand elements. |
| `--color-teal-light` | `#14B8A6` | Accents, active indicators, and avatar badges. |
| `--color-teal-subtle` | `#CCFBF1` | Subtle backgrounds and card borders. |
| `--color-navy` | `#102A43` | **Secondary Brand Color.** Deep slate navy used for headings, primary text, dark sidebars, and staff buttons. |
| `--color-navy-hover` | `#1F3A56` | Hover state for navy elements. |
| `--color-mint` | `#E8F7F3` | **Accent / Brand Tint.** Soft mint background for notice banners, badges, and icon backdrops. |
| `--color-mint-dark` | `#99F6E4` | Border color for mint badges and highlighted containers. |
| `--color-white` | `#FFFFFF` | Background for cards, modals, dropdowns, and form inputs. |
| `--color-bg` | `#F7FAFC` | Main application canvas background. |

### Semantic Feedback Colors

| State | Base Color | Light Background | Border Color | Text Color |
|---|---|---|---|---|
| **Success** | `#059669` | `#ECFDF5` | `#A7F3D0` | `#065F46` |
| **Warning / Pending** | `#D97706` | `#FFFBEB` | `#FDE68A` | `#92400E` |
| **Danger / Rejected** | `#DC2626` | `#FEF2F2` | `#FECACA` | `#991B1B` |
| **Info / Approved** | `#2563EB` | `#EFF6FF` | `#BFDBFE` | `#1E40AF` |

---

## 3. Typography

- **Font Family:** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Typographic Scale:**
  - `xs`: `0.75rem` (12px) — Captions, hints, table tags.
  - `sm`: `0.875rem` (14px) — Body text, form labels, buttons.
  - `base`: `1.0rem` (16px) — Lead text, card titles.
  - `md`: `1.125rem` (18px) — Section subtitles.
  - `lg`: `1.25rem` (20px) — Card headers, modal titles.
  - `xl`: `1.5rem` (24px) — Page titles, metric values.
  - `2xl`: `1.875rem` (30px) — Hero sub-headers.
  - `3xl`: `2.25rem`–`3rem` — Main hero display.

---

## 4. Spacing System

Based on an 8-point harmonic grid (with 4px half-steps):
- `--space-1`: `4px`
- `--space-2`: `8px`
- `--space-3`: `12px`
- `--space-4`: `16px`
- `--space-5`: `20px`
- `--space-6`: `24px`
- `--space-8`: `32px`
- `--space-10`: `40px`
- `--space-12`: `48px`
- `--space-16`: `64px`

---

## 5. UI Component Library

### Buttons
- `.btn-teal`: Primary action (e.g. "Book Appointment", "Submit").
- `.btn-navy`: Staff primary action (e.g. "Sign In to Staff Console").
- `.btn-outline-teal`: Secondary action (e.g. "Refresh Live Status").
- `.btn-outline-navy`: Neutral action (e.g. "Staff Console").
- `.btn-ghost`: Subtle action (e.g. "Cancel", table "Details").
- `.btn-danger`: Destructive action (e.g. "Reject Request", "Cancel Appointment").

### Badges / Status Pills
- `.badge-mint`: Institutional highlights.
- `.badge-pending`: Amber warning for initial appointment submissions.
- `.badge-approved`: Soft blue for verified clinical bookings.
- `.badge-teal`: Mint teal for digital check-ins and active queue tickets.
- `.badge-success`: Emerald green for completed visits.
- `.badge-rejected`: Rose red for cancellations or rejections.

### Form Inputs
- Clear 1px border (`#E2E8F0`) with 8px radius.
- Interactive focus ring: `3px rgba(15, 118, 110, 0.15)`.
- Explicit error indicators with `.is-invalid` border and `.form-error` message.
- Icon prefix support using `.input-with-icon`.

### Modals & Dialogs
- Centered dialogs with semi-transparent backdrop blur (`rgba(16, 42, 67, 0.5)`).
- Smooth CSS scale and fade animation.
- ESC key and backdrop click dismiss support.
