/**
 * Care-OAU - Password Recovery & Reset Logic
 * Handles forgot-password simulated instruction email and reset-password confirmation.
 */

import { FormValidator } from '../components/form-validation.js';
import { Toast } from '../components/toast.js';
import { Loading } from '../components/loading.js';

document.addEventListener('DOMContentLoaded', () => {
  const forgotForm = document.getElementById('form-forgot-password');
  const resetForm = document.getElementById('form-reset-password');

  // Handle Forgot Password Form
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const identifierInput = document.getElementById('recovery-identifier');
      const submitBtn = document.getElementById('btn-forgot-submit');

      if (!identifierInput.value.trim()) {
        FormValidator.setError(identifierInput, 'Please provide your student email or matriculation number.');
        return;
      }
      FormValidator.clearError(identifierInput);

      Loading.setButtonLoading(submitBtn, true, 'Generating link...');

      await new Promise(r => setTimeout(r, 600));

      Toast.success('Simulated reset instructions generated!');
      setTimeout(() => {
        window.location.href = `reset-password.html?identifier=${encodeURIComponent(identifierInput.value.trim())}`;
      }, 900);
    });
  }

  // Handle Reset Password Form
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const newPassInput = document.getElementById('reset-password');
      const confirmPassInput = document.getElementById('reset-confirm-password');
      const submitBtn = document.getElementById('btn-reset-submit');

      let isValid = true;

      if (!newPassInput.value || newPassInput.value.length < 6) {
        FormValidator.setError(newPassInput, 'Password must be at least 6 characters.');
        isValid = false;
      } else {
        FormValidator.clearError(newPassInput);
      }

      if (!FormValidator.validatePasswordMatch(newPassInput, confirmPassInput)) {
        isValid = false;
      }

      if (!isValid) return;

      Loading.setButtonLoading(submitBtn, true, 'Updating password...');

      await new Promise(r => setTimeout(r, 600));

      Toast.success('Password updated successfully! Please sign in with your new password.');
      setTimeout(() => {
        window.location.href = 'auth.html';
      }, 1000);
    });
  }
});
