/**
 * Care-OAU - Email Verification Page Logic
 * Manages 6-digit OTP input auto-advance, backspace navigation, paste handling,
 * resend timer, and verification submission.
 */

import { AuthService } from '../services/auth-service.js';
import { Toast } from '../components/toast.js';
import { Loading } from '../components/loading.js';
import { APP_CONFIG } from '../core/config.js';

document.addEventListener('DOMContentLoaded', () => {
  const otpContainer = document.getElementById('otp-inputs');
  const otpInputs = otpContainer ? Array.from(otpContainer.querySelectorAll('.otp-input')) : [];
  const form = document.getElementById('form-verify-email');
  const errorEl = document.getElementById('otp-error');
  const submitBtn = document.getElementById('btn-verify-submit');
  const resendBtn = document.getElementById('btn-resend-otp');
  const countdownEl = document.getElementById('resend-countdown');
  const verifyTextEl = document.getElementById('verify-email-text');

  // Read email from URL or pending registration
  let targetEmail = '';
  try {
    targetEmail = new URLSearchParams(window.location.search).get('email') || '';
  } catch {}
  if (!targetEmail) {
    try {
      const pending = JSON.parse(localStorage.getItem('care_oau_pending_verification') || '{}');
      if (pending && pending.email) targetEmail = pending.email;
    } catch {}
  }
  if (targetEmail && verifyTextEl) {
    verifyTextEl.innerHTML = `Enter the 6-digit confirmation code sent to <strong>${targetEmail}</strong>.`;
  }

  // Input navigation & auto-advance
  otpInputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const val = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = val;

      if (val && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus();
      }

      clearError();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        otpInputs[index - 1].focus();
      }
    });

    // Handle full paste (e.g. copying 123456)
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text').trim();
      if (/^\d{6}$/.test(pasted)) {
        pasted.split('').forEach((char, i) => {
          if (otpInputs[i]) otpInputs[i].value = char;
        });
        otpInputs[otpInputs.length - 1].focus();
        clearError();
      }
    });
  });

  function showError(msg) {
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    }
  }

  function clearError() {
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }
  }

  // Handle Form Submit
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const code = otpInputs.map(input => input.value).join('');

      if (code.length < 6) {
        showError('Please enter the complete 6-digit verification code.');
        return;
      }

      Loading.setButtonLoading(submitBtn, true, 'Verifying...');

      try {
        const res = await AuthService.verifyEmail(code, targetEmail);

        if (res.success) {
          Toast.success('Email verified successfully! Welcome to Care-OAU.');
          setTimeout(() => {
            window.location.href = 'dashboard.html';
          }, 800);
        } else {
          showError(res.message);
          Toast.error(res.message);
          Loading.setButtonLoading(submitBtn, false);
        }
      } catch (err) {
        console.error(err);
        showError(err.message || 'Verification failed. Please try again.');
        Loading.setButtonLoading(submitBtn, false);
      }
    });
  }

  // Resend Countdown
  let seconds = 30;
  let timer = setInterval(() => {
    seconds -= 1;
    if (countdownEl) countdownEl.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(timer);
      if (resendBtn) {
        resendBtn.disabled = false;
        resendBtn.innerHTML = 'Resend Code Now';
      }
    }
  }, 1000);

  if (resendBtn) {
    resendBtn.addEventListener('click', () => {
      Toast.info('A verification code was dispatched to your email during registration. Please check your inbox or spam folder.');
      resendBtn.disabled = true;
      seconds = 30;
      resendBtn.innerHTML = `Resend Code (<span id="resend-countdown">30</span>s)`;
    });
  }
});
