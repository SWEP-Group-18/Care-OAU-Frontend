/**
 * Care-OAU - Student Authentication Page Logic
 * Handles Login and Register forms, input validation, and prototype session routing.
 */

import { AuthService } from '../services/auth-service.js';
import { FormValidator } from '../components/form-validation.js';
import { Toast } from '../components/toast.js';
import { Loading } from '../components/loading.js';
import { APP_CONFIG } from '../core/config.js';
import { Utils } from '../core/utils.js';

document.addEventListener('DOMContentLoaded', () => {
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const authTitle = document.getElementById('auth-title');
  const authSubtitle = document.getElementById('auth-subtitle');

  // Detect whether script is executed from root (index.html) or student subdirectory
  const isRoot = !window.location.pathname.includes('/student/');
  const targetDashboard = isRoot ? './student/dashboard.html' : 'dashboard.html';
  const targetVerify = isRoot ? './student/verify-email.html' : 'verify-email.html';

  // Check URL parameters (e.g. ?mode=register)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mode') === 'register') {
    switchToRegister();
  }

  // Password visibility toggle helpers with dynamic eye/eye-off icon swapping
  Utils.setupPasswordToggle();

  // Tab switching
  function switchToLogin() {
    if (tabLogin) {
      tabLogin.classList.add('active');
      tabLogin.setAttribute('aria-selected', 'true');
    }
    if (tabRegister) {
      tabRegister.classList.remove('active');
      tabRegister.setAttribute('aria-selected', 'false');
    }
    if (formLogin) formLogin.classList.remove('hidden');
    if (formRegister) formRegister.classList.add('hidden');
    if (authTitle) authTitle.textContent = 'Welcome back';
    if (authSubtitle) authSubtitle.textContent = 'Sign in to manage your next visit.';
    if (formRegister) FormValidator.resetForm(formRegister);
  }

  function switchToRegister() {
    if (tabRegister) {
      tabRegister.classList.add('active');
      tabRegister.setAttribute('aria-selected', 'true');
    }
    if (tabLogin) {
      tabLogin.classList.remove('active');
      tabLogin.setAttribute('aria-selected', 'false');
    }
    if (formRegister) formRegister.classList.remove('hidden');
    if (formLogin) formLogin.classList.add('hidden');
    if (authTitle) authTitle.textContent = 'Create your account';
    if (authSubtitle) authSubtitle.textContent = 'Register to book and manage appointments.';
    if (formLogin) FormValidator.resetForm(formLogin);
  }

  if (tabLogin) tabLogin.addEventListener('click', switchToLogin);
  if (tabRegister) tabRegister.addEventListener('click', switchToRegister);

  // -------------------------------------------------------------------------
  // Handle Login
  // -------------------------------------------------------------------------
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();

      const identifierInput = document.getElementById('login-identifier');
      const passwordInput = document.getElementById('login-password');
      const rememberInput = document.getElementById('login-remember');
      const submitBtn = document.getElementById('btn-login-submit');

      let isValid = true;
      const identifierVal = identifierInput.value.trim();

      if (!identifierVal) {
        FormValidator.setError(identifierInput, 'Please enter your registered student email.');
        isValid = false;
      } else if (!identifierVal.includes('@') && !APP_CONFIG.USE_MOCK_DATA) {
        FormValidator.setError(identifierInput, 'Student login requires your registered email address (e.g. name@student.oauife.edu.ng).');
        isValid = false;
      } else {
        FormValidator.clearError(identifierInput);
      }

      if (!passwordInput.value) {
        FormValidator.setError(passwordInput, 'Password is required.');
        isValid = false;
      } else {
        FormValidator.clearError(passwordInput);
      }

      if (!isValid) return;

      Loading.setButtonLoading(submitBtn, true, 'Signing In...');

      try {
        const res = await AuthService.loginStudent({
          identifier: identifierVal,
          password: passwordInput.value,
          remember: rememberInput ? rememberInput.checked : true
        });

        if (res.success) {
          Toast.success(`Welcome back, ${res.user.name}!`);
          const dest = res.user.role === 'admin' 
            ? (isRoot ? './admin/dashboard.html' : '../admin/dashboard.html') 
            : targetDashboard;
          setTimeout(() => {
            window.location.href = dest;
          }, 500);
        } else {
          if (res.details && Array.isArray(res.details)) {
            for (const item of res.details) {
              if (item.field === 'email' || item.field === 'identifier') {
                FormValidator.setError(identifierInput, item.message);
              }
              if (item.field === 'password') {
                FormValidator.setError(passwordInput, item.message);
              }
            }
          } else if (res.code === 'INVALID_CREDENTIALS') {
            FormValidator.setError(passwordInput, 'Invalid email or password. Please verify and try again.');
          }
          Toast.error(res.message || 'Login failed. Please verify your credentials.');
          Loading.setButtonLoading(submitBtn, false);
        }
      } catch (err) {
        console.error(err);
        Toast.error(err.message || 'An unexpected error occurred. Please try again.');
        Loading.setButtonLoading(submitBtn, false);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Handle Register
  // -------------------------------------------------------------------------
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fullNameInput = document.getElementById('reg-fullname');
      const matricInput = document.getElementById('reg-matric');
      const emailInput = document.getElementById('reg-email');
      const phoneInput = document.getElementById('reg-phone');
      const passwordInput = document.getElementById('reg-password');
      const confirmPasswordInput = document.getElementById('reg-confirm-password');
      const submitBtn = document.getElementById('btn-register-submit');

      let isValid = true;

      if (!FormValidator.validateRequired(fullNameInput, 'Full Name')) isValid = false;
      if (!FormValidator.validateMatricNumber(matricInput)) isValid = false;
      if (!FormValidator.validateEmail(emailInput)) isValid = false;
      if (!FormValidator.validatePhone(phoneInput)) isValid = false;
      
      if (!passwordInput.value || passwordInput.value.length < 6) {
        FormValidator.setError(passwordInput, 'Password must be at least 6 characters.');
        isValid = false;
      } else {
        FormValidator.clearError(passwordInput);
      }

      if (!FormValidator.validatePasswordMatch(passwordInput, confirmPasswordInput)) {
        isValid = false;
      }

      if (!isValid) return;

      Loading.setButtonLoading(submitBtn, true, 'Creating Account...');

      try {
        const res = await AuthService.registerStudent({
          fullName: fullNameInput.value.trim(),
          matricNo: matricInput.value.trim(),
          email: emailInput.value.trim(),
          phone: phoneInput.value.trim(),
          password: passwordInput.value
        });

        if (res.success) {
          Toast.success('Account created! Forwarding to email verification.');
          setTimeout(() => {
            window.location.href = `${targetVerify}?email=${encodeURIComponent(emailInput.value.trim())}`;
          }, 600);
        } else {
          if (res.details && Array.isArray(res.details)) {
            for (const item of res.details) {
              if (item.field === 'name') FormValidator.setError(fullNameInput, item.message);
              if (item.field === 'matricNumber' || item.field === 'matricNo') FormValidator.setError(matricInput, item.message);
              if (item.field === 'email') FormValidator.setError(emailInput, item.message);
              if (item.field === 'phone') FormValidator.setError(phoneInput, item.message);
              if (item.field === 'password') FormValidator.setError(passwordInput, item.message);
            }
          }
          Toast.error(res.message || 'Registration failed.');
          Loading.setButtonLoading(submitBtn, false);
        }
      } catch (err) {
        console.error(err);
        Toast.error('An error occurred during registration.');
        Loading.setButtonLoading(submitBtn, false);
      }
    });
  }
});
