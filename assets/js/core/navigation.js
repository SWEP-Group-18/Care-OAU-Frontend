/**
 * Care-OAU - Navigation Service
 * Handles route tracking, navigation guards, and role redirects.
 */

import { Storage } from './storage.js';
import { APP_CONFIG } from './config.js';
import { AuthService } from '../services/auth-service.js';

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
   * Guard route based on user login status and server-verified role
   */
  requireAuth(requiredRole = null) {
    const user = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
    const isInAdminDir = typeof window !== 'undefined' && window.location.pathname.includes('/admin/');
    const isInStudentDir = typeof window !== 'undefined' && window.location.pathname.includes('/student/');

    if (!user) {
      if (requiredRole === 'admin') {
        window.location.href = isInAdminDir ? 'login.html' : '../admin/login.html';
      } else {
        window.location.href = isInStudentDir ? 'auth.html' : '../student/auth.html';
      }
      return null;
    }

    if (requiredRole && user.role !== requiredRole) {
      // Cross-role access protection
      if (requiredRole === 'admin') {
        // Non-admin attempting to access admin route -> deny and redirect to admin login
        window.location.href = isInAdminDir ? 'login.html?denied=1' : '../admin/login.html?denied=1';
      } else {
        // Non-student attempting to access student route -> redirect to admin dashboard
        window.location.href = '../admin/dashboard.html';
      }
      return null;
    }

    // Verify session with live backend in background
    if (!APP_CONFIG.USE_MOCK_DATA) {
      this.syncSession(requiredRole);
    }

    return user;
  },

  /**
   * Asynchronously validates session against GET /api/v1/users/me in background
   */
  async syncSession(requiredRole = null) {
    try {
      const activeUser = await AuthService.checkSession();
      if (typeof window === 'undefined') return;

      const isProtectedAdminPage = window.location.pathname.includes('/admin/') && 
        !/login/.test(window.location.pathname);
      const isProtectedStudentPage = window.location.pathname.includes('/student/') && 
        !/auth|login|verify|password|reset/.test(window.location.pathname);

      if (!activeUser) {
        if (isProtectedAdminPage) {
          window.location.href = 'login.html?expired=1';
          return;
        }
        if (isProtectedStudentPage) {
          window.location.href = 'auth.html?expired=1';
          return;
        }
      }

      // If active user session exists, verify role against requiredRole
      if (activeUser && requiredRole && activeUser.role !== requiredRole) {
        if (requiredRole === 'admin') {
          // A student session cannot view admin pages
          Storage.remove(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
          window.location.href = 'login.html?denied=1';
        } else if (requiredRole === 'student') {
          window.location.href = '../admin/dashboard.html';
        }
      }
    } catch (err) {
      console.warn('[Care-OAU] Session validation notice:', err.message);
    }
  },

  /**
   * Log out user, invoke backend POST /api/v1/auth/logout, and redirect to appropriate login page
   */
  async logout() {
    const user = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
    const isAdmin = user && user.role === 'admin';
    const isInAdminDir = typeof window !== 'undefined' && window.location.pathname.includes('/admin/');
    const isInStudentDir = typeof window !== 'undefined' && window.location.pathname.includes('/student/');

    try {
      await AuthService.logout();
    } catch (err) {
      console.warn('[Care-OAU] Logout notice:', err.message);
    }
    Storage.remove(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
    Storage.remove(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN);

    if (isAdmin) {
      window.location.href = isInAdminDir ? 'login.html?logout=1' : '../admin/login.html?logout=1';
    } else {
      window.location.href = isInStudentDir ? 'auth.html?logout=1' : './student/auth.html?logout=1';
    }
  }
};
