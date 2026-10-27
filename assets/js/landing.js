/**
 * Care-OAU - Landing Page Interactive Logic
 * Handles mobile drawer toggle, accessible keyboard navigation, scroll spy,
 * dynamic doctor availability check, and dynamic copyright year.
 */

import { DoctorService } from './services/doctor-service.js';

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initHeaderScroll();
  initSmoothScroll();
  initDoctorAvailabilitySection();
  initDynamicYear();
});

/**
 * Mobile Navigation Drawer & Keyboard Accessibility
 */
function initMobileNav() {
  const toggleBtn = document.getElementById('mobile-nav-toggle');
  const drawer = document.getElementById('mobile-drawer');

  if (!toggleBtn || !drawer) return;

  const toggle = (forceState) => {
    const isOpen = typeof forceState === 'boolean' ? forceState : !drawer.classList.contains('open');
    drawer.classList.toggle('open', isOpen);
    toggleBtn.setAttribute('aria-expanded', String(isOpen));
    toggleBtn.setAttribute('aria-label', isOpen ? 'Close mobile menu' : 'Open mobile menu');

    const iconMenu = toggleBtn.querySelector('.icon-menu');
    const iconClose = toggleBtn.querySelector('.icon-close');
    if (iconMenu && iconClose) {
      iconMenu.style.display = isOpen ? 'none' : 'block';
      iconClose.style.display = isOpen ? 'block' : 'none';
    }
  };

  toggleBtn.addEventListener('click', () => toggle());

  // Close when clicking outside or on a link
  drawer.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => toggle(false));
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) {
      toggle(false);
      toggleBtn.focus();
    }
  });
}

/**
 * Header Elevation on Scroll
 */
function initHeaderScroll() {
  const header = document.querySelector('.landing-header');
  if (!header) return;

  const onScroll = () => {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/**
 * Smooth Scroll for In-Page Anchor Links & Active Section Highlighting
 */
function initSmoothScroll() {
  const navLinks = document.querySelectorAll('.desktop-nav .nav-link, .mobile-nav-links a');
  const sections = document.querySelectorAll('section[id]');

  // Scrollspy via IntersectionObserver
  if ('IntersectionObserver' in window && sections.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          navLinks.forEach(link => {
            const href = link.getAttribute('href') || '';
            if (href === `#${id}`) {
              link.classList.add('active');
            } else if (href.startsWith('#')) {
              link.classList.remove('active');
            }
          });
        }
      });
    }, {
      rootMargin: '-20% 0px -70% 0px'
    });

    sections.forEach(sec => observer.observe(sec));
  }
}

/**
 * Doctor Availability Section Integration
 * Reads live availability status and renders truthful state
 */
async function initDoctorAvailabilitySection() {
  const previewContainer = document.getElementById('landing-doctor-preview');
  if (!previewContainer) return;

  try {
    const res = await DoctorService.getDoctorAvailability();

    if (res.status === 'available' && res.doctors.length > 0) {
      previewContainer.innerHTML = `
        <div class="empty-state-notice">
          <div class="notice-icon" aria-hidden="true" style="background: #D1FAE5; color: #065F46;">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <h4>${res.doctors.length} Published ${res.doctors.length === 1 ? 'Doctor' : 'Doctors'}</h4>
          <p>Official duty schedules and availability for the health centre have been published.</p>
          <a href="student/doctors.html" class="clay-btn clay-btn--secondary" style="margin-top: 14px; font-size: 13.5px; padding: 10px 20px;">
            View Duty Schedules →
          </a>
        </div>
      `;
    } else if (res.status === 'empty' || (res.status === 'available' && res.doctors.length === 0)) {
      previewContainer.innerHTML = `
        <div class="empty-state-notice">
          <div class="notice-icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <h4>No doctors available yet</h4>
          <p>Doctor profiles and availability will appear here once the health centre team adds and publishes them. Please check back later.</p>
          <a href="student/doctors.html" class="clay-btn clay-btn--secondary" style="margin-top: 14px; font-size: 13.5px; padding: 10px 20px;">
            Check Availability Directory →
          </a>
        </div>
      `;
    } else {
      // Unavailable state (404 / network failure)
      previewContainer.innerHTML = `
        <div class="empty-state-notice">
          <div class="notice-icon" aria-hidden="true" style="background: var(--oau-gold-subtle); color: #92400E;">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h4>Doctor Availability Notice</h4>
          <p>Doctor availability is not available right now. Please check back later.</p>
          <a href="student/doctors.html" class="clay-btn clay-btn--secondary" style="margin-top: 14px; font-size: 13.5px; padding: 10px 20px;">
            Visit Doctors Page →
          </a>
        </div>
      `;
    }
  } catch (err) {
    previewContainer.innerHTML = `
      <div class="empty-state-notice">
        <div class="notice-icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h4>Doctor Availability Notice</h4>
        <p>Doctor availability is not available right now. Please check back later.</p>
      </div>
    `;
  }
}

/**
 * Dynamic Copyright Year
 */
function initDynamicYear() {
  const yearEl = document.getElementById('current-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}
