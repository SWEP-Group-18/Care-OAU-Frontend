import { Utils } from '../core/utils.js';
/**
 * Care-OAU - Student Sidebar Component
 * Matches Figma visual specifications, left navigation, collapse toggle, and mobile drawer.
 */

import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { Navigation } from '../core/navigation.js';

export const StudentSidebar = {
  render() {
    const sidebarEl = document.querySelector('.sidebar');
    if (!sidebarEl) return;

    // Check stored collapse state
    const isCollapsed = Storage.get(APP_CONFIG.STORAGE_KEYS.SIDEBAR_COLLAPSED, false);
    if (isCollapsed && window.innerWidth > 820) {
      document.body.classList.add('sidebar-collapsed');
    }

    const user = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER) || {
      name: 'Amina Yusuf',
      matricNo: '21/SCI/1048',
      role: 'student'
    };

    const initials = (user.name || 'AY')
      .split(' ')
      .map(n => n.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase();

    sidebarEl.innerHTML = `
      <div class="sidebar-top">
        <a href="dashboard.html" class="logo logo-inverse" style="text-decoration: none;">
          <span class="logo-mark">
            <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" class="brand-symbol">
              <path d="M27.5 11.5a11 11 0 1 0 0 17" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M14 20h4l2.1-4 3.2 8 2.1-4H30" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="logo-text-wrap">
            <strong>Care-OAU</strong>
            <small>Your Health. Your Time. Our Care.</small>
          </span>
        </a>
        <button type="button" class="sidebar-close" id="sidebar-close-btn" aria-label="Close navigation">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="sidebar-section-label">Student portal</div>

      <nav class="sidebar-nav">
        <a href="dashboard.html" class="sidebar-link" title="Dashboard">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span>Dashboard</span>
        </a>

        <a href="doctors.html" class="sidebar-link" title="Doctor Availability">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"></path>
            <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"></path>
            <circle cx="20" cy="10" r="2"></circle>
          </svg>
          <span>Doctor Availability</span>
        </a>

        <a href="book-appointment.html" class="sidebar-link" title="Book Appointment">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>Book Appointment</span>
        </a>

        <a href="my-appointments.html" class="sidebar-link" title="My Appointments">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
            <rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect>
            <path d="m9 14 2 2 4-4"></path>
          </svg>
          <span>My Appointments</span>
        </a>

        <a href="queue-tracking.html" class="sidebar-link" title="Queue Tracking">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>Queue Tracking</span>
        </a>
      </nav>

      <div class="student-sidebar-account">
        <div class="sidebar-profile-card">
          <span class="avatar">${initials}</span>
          <span class="profile-name">
            <strong>${Utils.escapeHtml(user.name)}</strong>
            <small>${user.matricNo || 'Student'}</small>
          </span>
        </div>
        <a href="../admin/login.html" class="sidebar-action-btn" title="Open Staff Portal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span>Staff Portal</span>
        </a>
        <button type="button" class="sidebar-action-btn" id="btn-sidebar-logout" title="Sign out">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span>Sign out</span>
        </button>
      </div>

      <button type="button" class="student-collapse" id="student-collapse-btn" aria-label="Toggle sidebar collapse">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        <span>Collapse sidebar</span>
      </button>
    `;

    this.ensureScrim();
    this.bindEvents(sidebarEl);
    Navigation.highlightActiveLink();
  },

  ensureScrim() {
    let scrim = document.querySelector('.sidebar-scrim');
    if (!scrim) {
      scrim = document.createElement('div');
      scrim.className = 'sidebar-scrim';
      document.body.appendChild(scrim);
    }
  },

  bindEvents(sidebarEl) {
    // Desktop Collapse Toggle
    const collapseBtn = sidebarEl.querySelector('#student-collapse-btn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
        Storage.set(APP_CONFIG.STORAGE_KEYS.SIDEBAR_COLLAPSED, isCollapsed);
        const span = collapseBtn.querySelector('span');
        if (span) {
          span.textContent = isCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
        }
      });
    }

    // Mobile Hamburger & Drawer
    const scrim = document.querySelector('.sidebar-scrim');
    const closeBtn = sidebarEl.querySelector('#sidebar-close-btn');

    const openDrawer = () => {
      sidebarEl.classList.add('open');
      if (scrim) scrim.classList.add('active');
      document.body.style.overflow = 'hidden';
    };

    const closeDrawer = () => {
      sidebarEl.classList.remove('open');
      if (scrim) scrim.classList.remove('active');
      document.body.style.overflow = '';
    };

    const mobileToggle = document.getElementById('mobile-menu-toggle');
    if (mobileToggle) {
      mobileToggle.onclick = (e) => {
        e.stopPropagation();
        if (sidebarEl.classList.contains('open')) {
          closeDrawer();
        } else {
          openDrawer();
        }
      };
    }

    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (scrim) scrim.onclick = closeDrawer;
    document.onkeydown = e => { if (e.key === 'Escape') closeDrawer(); };

    // Auto-close drawer on link click for mobile
    sidebarEl.querySelectorAll('.sidebar-link').forEach((link) => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 820) {
          closeDrawer();
        }
      });
    });

    // Logout handler
    const logoutBtn = sidebarEl.querySelector('#btn-sidebar-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        Navigation.logout();
      });
    }
  }
};
