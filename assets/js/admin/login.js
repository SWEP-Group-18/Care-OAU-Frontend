/**
 * Care-OAU - Admin / Staff Login Logic
 * Connects to the real backend authentication endpoint with server-verified role enforcement.
 */

import { AuthService } from '../services/auth-service.js';
import { FormValidator } from '../components/form-validation.js';
import { Toast } from '../components/toast.js';
import { Loading } from '../components/loading.js';
import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';

document.addEventListener('DOMContentLoaded', () => {
  // If user already holds an authenticated admin session, redirect straight to dashboard
  const currentUser = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
  if (currentUser && currentUser.role === 'admin') {
    window.location.href = 'dashboard.html';
    return;
  }

  // Handle URL query feedback (e.g. session expired, access denied, logged out)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('expired') === '1') {
    Toast.warning('Your session has expired. Please sign in again.');
  } else if (urlParams.get('denied') === '1') {
    Toast.error('Access denied. Administrator privileges required.');
  } else if (urlParams.get('logout') === '1') {
    Toast.info('You have been signed out successfully.');
  }

  const form = document.getElementById('form-admin-login');
  const staffIdInput = document.getElementById('admin-staff-id');
  const passwordInput = document.getElementById('admin-password');
  const submitBtn = document.getElementById('btn-admin-login-submit');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const emailVal = (staffIdInput?.value || '').trim();
      const passwordVal = passwordInput?.value || '';

      let isValid = true;
      if (!emailVal) {
        FormValidator.setError(staffIdInput, 'Staff email address is required.');
        isValid = false;
      } else if (!emailVal.includes('@') && !APP_CONFIG.USE_MOCK_DATA) {
        FormValidator.setError(staffIdInput, 'Please enter your registered staff email address (e.g. name@oauife.edu.ng).');
        isValid = false;
      } else {
        FormValidator.clearError(staffIdInput);
      }

      if (!passwordVal) {
        FormValidator.setError(passwordInput, 'Password is required.');
        isValid = false;
      } else {
        FormValidator.clearError(passwordInput);
      }

      if (!isValid) return;

      // Prevent duplicate submissions while request is processing
      submitBtn.disabled = true;
      Loading.setButtonLoading(submitBtn, true, 'Authenticating...');

      try {
        const res = await AuthService.loginAdmin({
          email: emailVal,
          staffId: emailVal,
          password: passwordVal
        });

        if (res.success && res.user && res.user.role === 'admin') {
          Toast.success(`Welcome back, ${res.user.name}!`);
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 450);
        } else {
          submitBtn.disabled = false;
          Loading.setButtonLoading(submitBtn, false);

          if (res.code === 'FORBIDDEN_ROLE') {
            FormValidator.setError(staffIdInput, 'Access denied: This portal is for hospital staff and administration only.');
            Toast.error(res.message);
          } else if (res.code === 'INVALID_CREDENTIALS') {
            FormValidator.setError(passwordInput, 'Invalid email or password. Please verify and try again.');
            Toast.error('Invalid credentials. Please verify your email and password.');
          } else if (res.code === 'EMAIL_NOT_VERIFIED') {
            FormValidator.setError(staffIdInput, 'Account not verified. Please verify your email address.');
            Toast.error(res.message);
          } else {
            Toast.error(res.message || 'Staff authentication failed. Please verify your credentials.');
          }
        }
      } catch (err) {
        console.error('[Care-OAU] Admin login error:', err);
        submitBtn.disabled = false;
        Loading.setButtonLoading(submitBtn, false);
        Toast.error(err.message || 'An unexpected error occurred during staff login. Please try again.');
      }
    });
  }
});
