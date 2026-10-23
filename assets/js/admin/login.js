/**
 * Care-OAU - Admin / Staff Login Logic
 * Validates staff ID, verifies clinic personnel sessions, and routes to staff dashboard.
 */

import { AuthService } from '../services/auth-service.js';
import { FormValidator } from '../components/form-validation.js';
import { Toast } from '../components/toast.js';
import { Loading } from '../components/loading.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-admin-login');
  const staffIdInput = document.getElementById('admin-staff-id');
  const passwordInput = document.getElementById('admin-password');
  const submitBtn = document.getElementById('btn-admin-login-submit');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      let isValid = true;
      if (!staffIdInput.value.trim()) {
        FormValidator.setError(staffIdInput, 'Staff ID is required.');
        isValid = false;
      } else {
        FormValidator.clearError(staffIdInput);
      }

      if (!passwordInput.value) {
        FormValidator.setError(passwordInput, 'Password is required.');
        isValid = false;
      } else {
        FormValidator.clearError(passwordInput);
      }

      if (!isValid) return;

      Loading.setButtonLoading(submitBtn, true, 'Authenticating...');

      try {
        const res = await AuthService.loginAdmin({
          staffId: staffIdInput.value.trim(),
          password: passwordInput.value
        });

        if (res.success) {
          Toast.success(`Welcome back, ${res.user.name}!`);
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 600);
        } else {
          Toast.error(res.message || 'Staff authentication failed.');
          Loading.setButtonLoading(submitBtn, false);
        }
      } catch (err) {
        console.error(err);
        Toast.error('An error occurred during staff login.');
        Loading.setButtonLoading(submitBtn, false);
      }
    });
  }
});
