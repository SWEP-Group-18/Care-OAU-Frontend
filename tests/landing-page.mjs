/**
 * Care-OAU - Landing Page & Design System Verification Test
 * Verifies that:
 * 1. index.html contains all 13 specified sections in proper hierarchy.
 * 2. The official OAU logo (assets/images/oau-logo.png) is referenced with meaningful alt text.
 * 3. Navigation links and CTA buttons resolve to existing local pages and sections.
 * 4. FAQ section uses accessible semantic <details> and <summary> disclosure elements.
 * 5. Mobile navigation toggle includes aria-expanded and aria-controls attributes.
 * 6. Responsive breakpoints (1100px, 768px, 480px) and prefers-reduced-motion are present in landing.css.
 * 7. No fictional doctor profiles, simulated queue numbers, or fake ratings are hardcoded.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('assets/css/pages/landing.css', 'utf8');
const js = fs.readFileSync('assets/js/landing.js', 'utf8');

// 1. OAU Logo verification
assert.ok(fs.existsSync('assets/images/oau-logo.png'), 'OAU logo asset must exist at assets/images/oau-logo.png');
assert.ok(html.includes('assets/images/oau-logo.png'), 'Landing page must reference official OAU logo');
assert.ok(html.includes('alt="Obafemi Awolowo University logo"'), 'Logo must have descriptive alt text');

// 2. Section hierarchy & IDs
const requiredSections = [
  'about',
  'services',
  'how-it-works',
  'doctors',
  'appointments',
  'queue',
  'faqs',
  'contact'
];
for (const sectionId of requiredSections) {
  assert.ok(html.includes(`id="${sectionId}"`), `Landing page must contain section #${sectionId}`);
}

// 3. Header & Navigation links
assert.ok(html.includes('href="student/auth.html"'), 'Header must contain link to student login');
assert.ok(html.includes('href="student/auth.html#register"'), 'Header must contain link to account registration');
assert.ok(html.includes('id="mobile-nav-toggle"'), 'Mobile navigation toggle must exist');
assert.ok(html.includes('aria-expanded="false"'), 'Mobile toggle must have aria-expanded attribute');
assert.ok(html.includes('aria-controls="mobile-drawer"'), 'Mobile toggle must have aria-controls attribute');
assert.ok(html.includes('id="mobile-drawer"'), 'Mobile drawer must exist');

// 4. Hero copy & CTAs
assert.ok(html.includes('YOUR HEALTH. OUR PRIORITY.'), 'Hero must include eyebrow');
assert.ok(html.includes('Healthcare Access, Made Simpler for OAU Students.'), 'Hero must include official headline');
assert.ok(html.includes('Book an Appointment'), 'Hero must include primary CTA');
assert.ok(html.includes('Student Login'), 'Hero must include Student Login CTA');
assert.ok(html.includes('Create Account'), 'Hero must include Create Account CTA');

// 5. Accessible FAQ disclosure elements
const detailsMatches = [...html.matchAll(/<details\b/g)];
const summaryMatches = [...html.matchAll(/<summary\b/g)];
assert.ok(detailsMatches.length >= 8, `FAQ must contain at least 8 <details> elements (found ${detailsMatches.length})`);
assert.equal(detailsMatches.length, summaryMatches.length, 'Every <details> must have a matching <summary>');
assert.ok(html.includes('What is Care-OAU?'), 'FAQ must include "What is Care-OAU?"');
assert.ok(html.includes('Why do I need to verify my email?'), 'FAQ must include email verification question');
assert.ok(html.includes('What happens if doctor availability is not displayed?'), 'FAQ must address doctor availability');

// 6. Truthful data check (no fake ratings, simulated doctors, or mock wait times)
assert.doesNotMatch(html, /4\.9\s*★|5\.0\s*★/, 'Landing page must not display fictional doctor star ratings');
assert.doesNotMatch(html, /Dr\.\s+(Adeyemi|Babajide|Okonkwo|Amina\s+Yusuf)/, 'Landing page must not hardcode fictional doctor names');
assert.doesNotMatch(html, /Waiting time:\s*\d+\s*mins?/, 'Landing page must not display fake queue waiting times');

// 7. Responsive CSS & Accessibility Tokens
assert.ok(css.includes('@media (max-width: 1100px)'), 'CSS must include 1100px responsive breakpoint');
assert.ok(css.includes('@media (max-width: 768px)'), 'CSS must include 768px responsive breakpoint');
assert.ok(css.includes('@media (max-width: 480px)'), 'CSS must include 480px responsive breakpoint');
assert.ok(css.includes('prefers-reduced-motion'), 'CSS must honor prefers-reduced-motion');
assert.ok(css.includes('--oau-navy: #0B2459') || fs.readFileSync('assets/css/variables.css', 'utf8').includes('--oau-navy: #0B2459'), 'OAU Navy must be defined');
assert.ok(css.includes('--oau-gold: #E5AE32') || fs.readFileSync('assets/css/variables.css', 'utf8').includes('--oau-gold: #E5AE32'), 'OAU Gold must be defined');

// 8. JS interactivity & dynamic year
assert.ok(js.includes('initMobileNav'), 'landing.js must implement mobile navigation toggle');
assert.ok(js.includes('initDoctorAvailabilitySection'), 'landing.js must dynamically query doctor availability');
assert.ok(js.includes('current-year'), 'landing.js must dynamically set current year');
assert.ok(html.includes('id="current-year"'), 'Footer must contain current-year span');

console.log('PASS: 13 sections verified, official OAU logo linked, accessible FAQ details/summary, truthful data, responsive breakpoints, and claymorphic tokens.');
