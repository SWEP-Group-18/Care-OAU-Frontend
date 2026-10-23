/**
 * Care-OAU - Navigation Service
 * Handles route tracking, navigation guards, and role redirects.
 */

import { Storage } from './storage.js';
import { APP_CONFIG } from './config.js';

export const Navigation = {
  /**
   * Get current page filename without extension (e.g. 'dashboard')
   */
  getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.split('/').pop() || 'index.html';
    return filename.replace('.html', '');
  },

  /**
   * Highlight active sidebar navigation links
   */
  highlightActiveLink() {
    const currentPage = this.getCurrentPage();
    const links = document.querySelectorAll('.nav-item, .sidebar-link');
    links.forEach(link => {
      const href = link.getAttribute('href') || '';
      const linkPage = href.split('/').pop().replace('.html', '');
      if (linkPage === currentPage) {
        link.classList.add('active');
        if (!link.querySelector('.active-indicator')) {
          const indicator = document.createElement('i');
          indicator.className = 'active-indicator';
          link.appendChild(indicator);
        }
      } else {
        link.classList.remove('active');
        const ind = link.querySelector('.active-indicator');
        if (ind) ind.remove();
      }
    });
  },

  /**
   * Guard route based on user login status
   */
  requireAuth(requiredRole = null) {
    const user = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
    if (!user) {
      if (requiredRole === 'admin') {
        window.location.href = '../admin/login.html';
      } else {
        window.location.href = '../student/auth.html';
      }
      return null;
    }

    if (requiredRole && user.role !== requiredRole) {
      // Cross-role redirect
      if (user.role === 'admin') {
        window.location.href = '../admin/dashboard.html';
      } else {
        window.location.href = '../student/dashboard.html';
      }
      return null;
    }

    return user;
  },

  /**
   * Log out user and redirect to appropriate login page
   */
  logout() {
    const user = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
    const isAdmin = user && user.role === 'admin';
    Storage.remove(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
    Storage.remove(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN);

    if (isAdmin) {
      window.location.href = './login.html';
    } else {
      window.location.href = './auth.html';
    }
  }
};
