import { AuthService } from '../services/auth-service.js';
import { FormValidator } from '../components/form-validation.js';
import { Toast } from '../components/toast.js';
import { Loading } from '../components/loading.js';
import { APP_CONFIG } from '../core/config.js';

document.addEventListener('DOMContentLoaded', () => {
  const forgotForm = document.getElementById('form-forgot-password');
  const resetForm = document.getElementById('form-reset-password');
  const urlParams = new URLSearchParams(window.location.search);

  // Pre-fill reset code if provided in URL parameter (?code=...)
  const codeParam = urlParams.get('code');
  const resetCodeInput = document.getElementById('reset-code');
  if (codeParam && resetCodeInput) {
    resetCodeInput.value = codeParam;
  }

  // Handle Forgot Password Form
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const identifierInput = document.getElementById('recovery-identifier');
      const submitBtn = document.getElementById('btn-forgot-submit');
      const val = identifierInput.value.trim();

      if (!val) {
        FormValidator.setError(identifierInput, 'Please provide your registered student email address.');
        return;
      }

      if (!val.includes('@') && !APP_CONFIG.USE_MOCK_DATA) {
        FormValidator.setError(identifierInput, 'Please enter a valid student email address.');
        return;
      }
      FormValidator.clearError(identifierInput);

      Loading.setButtonLoading(submitBtn, true, 'Sending instructions...');

      try {
        const res = await AuthService.forgotPassword(val);
        if (res.success) {
          Toast.success(res.message || 'Reset instructions dispatched!');
          setTimeout(() => {
            window.location.href = `reset-password.html?email=${encodeURIComponent(val)}&identifier=${encodeURIComponent(val)}`;
          }, 800);
        } else {
          Toast.error(res.message || 'Unable to send reset instructions.');
          Loading.setButtonLoading(submitBtn, false);
        }
      } catch (err) {
        console.error(err);
        Toast.error(err.message || 'An error occurred. Please try again.');
        Loading.setButtonLoading(submitBtn, false);
      }
    });
  }

  // Handle Reset Password Form
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const newPassInput = document.getElementById('reset-password');
      const confirmPassInput = document.getElementById('reset-confirm-password');
      const codeInput = document.getElementById('reset-code');
      const submitBtn = document.getElementById('btn-reset-submit');

      let isValid = true;

      // Extract target email from URL or storage
      const email = urlParams.get('email') || urlParams.get('identifier') || '';

      // Validate Code
      let code = codeInput ? codeInput.value.trim() : (urlParams.get('code') || '');
      if (!code && APP_CONFIG.USE_MOCK_DATA) {
        code = '123456'; // Fallback demo code for automated mock tests
      } else if (!code) {
        if (codeInput) FormValidator.setError(codeInput, 'Please enter the 6-digit code received via email.');
        isValid = false;
      } else if (codeInput) {
        FormValidator.clearError(codeInput);
      }

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

      try {
        const res = await AuthService.resetPassword({
          email,
          code,
          password: newPassInput.value
        });

        if (res.success) {
          Toast.success(res.message || 'Password updated successfully! Please sign in with your new password.');
          setTimeout(() => {
            window.location.href = 'auth.html';
          }, 900);
        } else {
          if (codeInput && (res.code === 'INVALID_RESET_CODE' || (res.message && res.message.toLowerCase().includes('code')))) {
            FormValidator.setError(codeInput, res.message);
          }
          Toast.error(res.message || 'Failed to update password.');
          Loading.setButtonLoading(submitBtn, false);
        }
      } catch (err) {
        console.error(err);
        Toast.error(err.message || 'Unable to update password. Please try again.');
        Loading.setButtonLoading(submitBtn, false);
      }
    });
  }
});
