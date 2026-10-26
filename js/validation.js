/**
 * Validation Module - Expense Tracker / Personal Finance Manager
 * 
 * Demonstrates Syllabus Concepts:
 * - Regular expressions (RegExp test for email)
 * - Conditional logic (if, else if, else)
 * - Type checks and conversions (isNaN, typeof)
 * - DOM manipulation (adding/removing error classes)
 * - Event listeners (input, change events to auto-clear errors)
 * - Object literals & validation methods
 */

const FormValidator = {
  // Email validation regex (standard RFC 5322 compliant regex)
  emailPattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,

  /**
   * Display error message beneath an input element
   */
  showFieldError(inputElement, errorMessage) {
    if (!inputElement) return;

    inputElement.classList.add('has-error');

    // Find targeted or adjacent error container
    let errorContainer = null;
    const describedBy = inputElement.getAttribute('aria-describedby');
    if (describedBy) {
      errorContainer = document.getElementById(describedBy);
    }
    if (!errorContainer) {
      const group = inputElement.closest('.auth-form-group, .form-group');
      errorContainer = group ? group.querySelector('.form-error') : null;
    }
    if (!errorContainer) {
      errorContainer = document.createElement('div');
      errorContainer.className = 'form-error';
      const container = inputElement.closest('.auth-input-container, .password-input-wrap');
      if (container && container.parentNode) {
        container.parentNode.insertBefore(errorContainer, container.nextSibling);
      } else {
        inputElement.parentElement.appendChild(errorContainer);
      }
    }

    errorContainer.textContent = errorMessage;
    errorContainer.classList.add('visible');

    // Listen to user input to clear the error state immediately
    const clearHandler = () => {
      this.clearFieldError(inputElement);
      inputElement.removeEventListener('input', clearHandler);
      inputElement.removeEventListener('change', clearHandler);
    };

    inputElement.addEventListener('input', clearHandler);
    inputElement.addEventListener('change', clearHandler);
  },

  /**
   * Clear error state for an input
   */
  clearFieldError(inputElement) {
    if (!inputElement) return;
    inputElement.classList.remove('has-error');
    
    let errorContainer = null;
    const describedBy = inputElement.getAttribute('aria-describedby');
    if (describedBy) {
      errorContainer = document.getElementById(describedBy);
    }
    if (!errorContainer) {
      const group = inputElement.closest('.auth-form-group, .form-group');
      errorContainer = group ? group.querySelector('.form-error') : null;
    }
    if (errorContainer) {
      errorContainer.textContent = '';
      errorContainer.classList.remove('visible');
    }
  },

  /**
   * Clear all errors inside a form
   */
  clearFormErrors(formElement) {
    if (!formElement) return;
    const inputs = formElement.querySelectorAll('.form-control, .auth-form-input');
    inputs.forEach(input => input.classList.remove('has-error'));
    const errors = formElement.querySelectorAll('.form-error');
    errors.forEach(err => {
      err.textContent = '';
      err.classList.remove('visible');
    });
  },

  /**
   * Validate required string
   */
  validateRequired(inputElement, fieldName = 'This field') {
    const value = inputElement.value.trim();
    if (value === '') {
      this.showFieldError(inputElement, `${fieldName} is required.`);
      return false;
    }
    this.clearFieldError(inputElement);
    return true;
  },

  /**
   * Validate positive number (Amount)
   */
  validatePositiveNumber(inputElement, fieldName = 'Amount') {
    const val = parseFloat(inputElement.value);
    if (isNaN(val) || val <= 0) {
      this.showFieldError(inputElement, `${fieldName} must be a valid number greater than 0.`);
      return false;
    }
    this.clearFieldError(inputElement);
    return true;
  },

  /**
   * Validate email format
   */
  validateEmail(inputElement) {
    const email = inputElement.value.trim();
    if (!email) {
      this.showFieldError(inputElement, 'Email address is required.');
      return false;
    }
    if (!this.emailPattern.test(email)) {
      this.showFieldError(inputElement, 'Please enter a valid email address (e.g., student@college.edu).');
      return false;
    }
    this.clearFieldError(inputElement);
    return true;
  },

  /**
   * Validate password length
   */
  validatePassword(inputElement, minLength = 6) {
    const password = inputElement.value;
    if (!password) {
      this.showFieldError(inputElement, 'Password is required.');
      return false;
    }
    if (password.length < minLength) {
      this.showFieldError(inputElement, `Password must be at least ${minLength} characters long.`);
      return false;
    }
    this.clearFieldError(inputElement);
    return true;
  },

  /**
   * Validate password confirmation matching
   */
  validatePasswordMatch(passwordInput, confirmInput) {
    if (passwordInput.value !== confirmInput.value) {
      this.showFieldError(confirmInput, 'Passwords do not match.');
      return false;
    }
    this.clearFieldError(confirmInput);
    return true;
  }
};
