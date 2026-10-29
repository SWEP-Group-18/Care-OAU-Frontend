/**
 * Care-OAU - General Utilities
 * Common helper functions for formatting, sanitization, and UI badges.
 */

export const Utils = {
  /**
   * Format a date string or timestamp into a human-readable format.
   * e.g., "Monday, Oct 24, 2026"
   */
  formatDate(dateInput) {
    if (!dateInput) return 'N/A';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return dateInput;
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  },

  /**
   * Format a 24-hour time or ISO string to 12-hour AM/PM.
   * e.g., "09:30 AM"
   */
  formatTime(timeInput) {
    if (!timeInput) return '';
    if (timeInput.includes(':') && timeInput.length <= 8) {
      const [h, m] = timeInput.split(':');
      const hour = parseInt(h, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const formattedHour = hour % 12 || 12;
      return `${formattedHour}:${m} ${ampm}`;
    }
    const date = new Date(timeInput);
    if (!isNaN(date.getTime())) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    return timeInput;
  },

  /**
   * Convert 12-hour AM/PM string to 24-hour HH:mm format for backend API.
   * e.g., "1:30 PM" -> "13:30", "09:00 AM" -> "09:00"
   */
  to24HourTime(timeInput) {
    if (!timeInput) return '';
    const clean = String(timeInput).trim();
    const match = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
    if (!match) return clean.slice(0, 5);
    let hour = parseInt(match[1], 10);
    const minute = match[2];
    const modifier = match[3]?.toUpperCase();
    if (modifier === 'PM' && hour < 12) hour += 12;
    if (modifier === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${minute}`;
  },

  /**
   * Format today's date in YYYY-MM-DD for HTML date inputs
   */
  getTodayDateString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  },

  /**
   * Generate next sequential ticket number (e.g., Q-001)
   */
  generateQueueTicket(queueList = []) {
    const nextNum = Math.max(0, ...queueList.map(item => Number(/^Q-(\d+)$/.exec(item.queueNumber || '')?.[1] || 0))) + 1;
    return `Q-${String(nextNum).padStart(3, '0')}`;
  },

  /**
   * Validate OAU Matriculation Number format (e.g. CSC/2020/045 or GLG/2021/112)
   * or Health Centre Hospital Registration Number (e.g. OAU/HC/12345 or HC/2024/09)
   */
  isValidMatricOrRegNo(str) {
    if (!str) return false;
    const clean = str.trim().toUpperCase();
    const matricRegex = /^[A-Z]{3}\/\d{4}\/\d{3,4}$/;
    const regNoRegex = /^(OAU\/)?(HC|MED)\/\d{4,6}$/i;
    const generalRegex = /^[A-Z0-9\/\-]{6,16}$/;
    return matricRegex.test(clean) || regNoRegex.test(clean) || generalRegex.test(clean);
  },

  /**
   * Validate standard email address format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(String(email).toLowerCase());
  },

  /**
   * Validate Nigerian Phone Number (e.g., 08012345678 or +234...)
   */
  isValidPhone(phone) {
    const phoneRegex = /^(\+234|0)[789][01]\d{8}$/;
    return phoneRegex.test(String(phone).replace(/\s+/g, ''));
  },

  /**
   * Escape HTML to prevent basic XSS
   */
  escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * Generate appropriate CSS badge HTML for status strings
   */
  getStatusBadge(status) {
    const normalized = (status || '').toLowerCase();
    let badgeClass = 'badge-navy';

    if (normalized.includes('pending')) {
      badgeClass = 'badge-pending';
    } else if (normalized.includes('approved')) {
      badgeClass = 'badge-approved';
    } else if (normalized.includes('checked in') || normalized.includes('called')) {
      badgeClass = 'badge-teal';
    } else if (normalized.includes('completed')) {
      badgeClass = 'badge-success';
    } else if (normalized.includes('rejected') || normalized.includes('cancelled') || normalized.includes('no show')) {
      badgeClass = 'badge-rejected';
    } else if (normalized.includes('consultation')) {
      badgeClass = 'badge-info';
    }

    return `<span class="badge ${badgeClass}">${status}</span>`;
  },

  /**
   * Simple Debounce implementation
   */
  debounce(func, wait = 250) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Initializes password view/hide toggle buttons.
   * Finds all elements with [data-toggle-password="<input-id>"].
   */
  setupPasswordToggle(container = document) {
    if (!container) return;
    const eyeSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    const eyeOffSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

    container.querySelectorAll('[data-toggle-password]').forEach((btn) => {
      if (btn.dataset.toggleInitialized) return;
      btn.dataset.toggleInitialized = 'true';

      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-toggle-password');
        const input = document.getElementById(targetId);
        if (!input) return;
        const willShow = input.getAttribute('type') === 'password';
        input.setAttribute('type', willShow ? 'text' : 'password');
        btn.setAttribute('aria-label', willShow ? 'Hide password' : 'Show password');
        btn.setAttribute('title', willShow ? 'Hide password' : 'Show password');
        btn.innerHTML = willShow ? eyeOffSvg : eyeSvg;
      });
    });
  }
};
