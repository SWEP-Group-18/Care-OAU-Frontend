/**
 * Care-OAU - Form Validation Utility
 * Validates inputs, handles visual error states, and validates common hospital/OAU rules.
 */

import { Utils } from '../core/utils.js';

export const FormValidator = {
  /**
   * Set field to error state
   */
  setError(input, message) {
    if (!input) return;
    input.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');
    input.classList.remove('is-valid');

    const formGroup = input.closest('.form-group, .field');
    if (formGroup) {
      let errorEl = formGroup.querySelector('.form-error, .field-message');
      if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'form-error';
        formGroup.appendChild(errorEl);
      }
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  },

  /**
   * Clear error state for a field
   */
  clearError(input) {
    if (!input) return;
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
    input.classList.add('is-valid');

    const formGroup = input.closest('.form-group, .field');
    if (formGroup) {
      const errorEl = formGroup.querySelector('.form-error, .field-message');
      if (errorEl) {
        errorEl.style.display = 'none';
        errorEl.textContent = '';
      }
    }
  },

  /**
   * Reset entire form validation states
   */
  resetForm(form) {
    if (!form) return;
    form.querySelectorAll('.is-invalid, .is-valid').forEach(el => {
      el.classList.remove('is-invalid', 'is-valid');
    });
    form.querySelectorAll('.form-error, .field-message').forEach(el => {
      el.style.display = 'none';
      el.textContent = '';
    });
  },

  /**
   * Validate required field
   */
  validateRequired(input, fieldName = 'This field') {
    if (!input.value || !input.value.trim()) {
      this.setError(input, `${fieldName} is required.`);
      return false;
    }
    this.clearError(input);
    return true;
  },

  /**
   * Validate Matriculation / Hospital Number
   */
  validateMatricNumber(input) {
    const val = (input.value || '').trim();
    if (!val) {
      this.setError(input, 'Matriculation / Hospital Reg. Number is required.');
      return false;
    }
    if (!Utils.isValidMatricOrRegNo(val)) {
      this.setError(input, 'Enter a valid OAU Matric No (e.g. CSC/2020/045) or Reg No.');
      return false;
    }
    this.clearError(input);
    return true;
  },

  /**
   * Validate Email Address
   */
  validateEmail(input) {
    const val = (input.value || '').trim();
    if (!val) {
      this.setError(input, 'Email address is required.');
      return false;
    }
    if (!Utils.isValidEmail(val)) {
      this.setError(input, 'Please enter a valid email address.');
      return false;
    }
    this.clearError(input);
    return true;
  },

  /**
   * Validate Phone Number
   */
  validatePhone(input) {
    const val = (input.value || '').trim();
    if (!val) {
      this.setError(input, 'Phone number is required.');
      return false;
    }
    if (!Utils.isValidPhone(val)) {
      this.setError(input, 'Enter a valid Nigerian phone number (e.g. 08012345678).');
      return false;
    }
    this.clearError(input);
    return true;
  },

  /**
   * Validate Password match
   */
  validatePasswordMatch(passwordInput, confirmInput) {
    if (!confirmInput.value) {
      this.setError(confirmInput, 'Please confirm your password.');
      return false;
    }
    if (passwordInput.value !== confirmInput.value) {
      this.setError(confirmInput, 'Passwords do not match.');
      return false;
    }
    this.clearError(confirmInput);
    return true;
  }
};
