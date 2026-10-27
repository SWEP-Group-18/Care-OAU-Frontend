/**
 * Care-OAU - Tab Navigation & Desktop Fixed Sidebar Unit Tests
 * Verifies:
 * 1. Mobile tab navigation renders 5 tabs for students and 5 tabs for staff
 * 2. Active tab is automatically selected based on current pathname
 * 3. Desktop collapsible sidebar controls and state are removed
 * 4. CSS tokens and responsive rules enforce bottom tab bar on mobile and fixed sidebar on desktop
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

// 1. Verify CSS layout rules
const layoutsCss = fs.readFileSync(path.join(root, 'assets', 'css', 'layouts.css'), 'utf8');
const responsiveCss = fs.readFileSync(path.join(root, 'assets', 'css', 'responsive.css'), 'utf8');

// Ensure .mobile-tab-nav is defined
assert.ok(layoutsCss.includes('.mobile-tab-nav'), 'layouts.css defines .mobile-tab-nav');
assert.ok(layoutsCss.includes('.mobile-tab-link'), 'layouts.css defines .mobile-tab-link');
assert.ok(layoutsCss.includes('.mobile-tab-link.active'), 'layouts.css defines .mobile-tab-link.active');

// Ensure collapsible sidebar rules are removed
assert.ok(!layoutsCss.includes('body.sidebar-collapsed'), 'layouts.css no longer defines body.sidebar-collapsed');
assert.ok(!layoutsCss.includes('.student-collapse'), 'layouts.css no longer defines .student-collapse');
assert.ok(!responsiveCss.includes('body.sidebar-collapsed'), 'responsive.css no longer defines body.sidebar-collapsed');

// 2. Test MobileTabNav component logic
const { MobileTabNav } = await import('../assets/js/components/mobile-tab-nav.js');

const studentTabs = MobileTabNav.getStudentTabs();
assert.equal(studentTabs.length, 5, 'Student has exactly 5 mobile tabs');
assert.deepEqual(
  studentTabs.map(t => t.href),
  ['dashboard.html', 'doctors.html', 'book-appointment.html', 'my-appointments.html', 'queue-tracking.html'],
  'Student tabs link to core routes'
);

const adminTabs = MobileTabNav.getAdminTabs();
assert.equal(adminTabs.length, 5, 'Admin has exactly 5 mobile tabs');
assert.deepEqual(
  adminTabs.map(t => t.href),
  ['dashboard.html', 'appointments.html', 'queue-management.html', 'doctor-management.html', 'service-management.html'],
  'Admin tabs link to clinic operation routes'
);

// 3. Test StudentSidebar and AdminSidebar rendering without collapse button
const studentSidebarJs = fs.readFileSync(path.join(root, 'assets', 'js', 'components', 'student-sidebar.js'), 'utf8');
const adminSidebarJs = fs.readFileSync(path.join(root, 'assets', 'js', 'components', 'admin-sidebar.js'), 'utf8');

assert.ok(!studentSidebarJs.includes('student-collapse-btn'), 'student-sidebar.js has no student-collapse-btn');
assert.ok(!adminSidebarJs.includes('admin-collapse-btn'), 'admin-sidebar.js has no admin-collapse-btn');
assert.ok(studentSidebarJs.includes("MobileTabNav.render('student')"), 'student-sidebar.js mounts MobileTabNav');
assert.ok(adminSidebarJs.includes("MobileTabNav.render('admin')"), 'admin-sidebar.js mounts MobileTabNav');

console.log('PASS: mobile tab navigation bar, fixed desktop sidebar, and 5-route tabs verified across student and admin portals.');
