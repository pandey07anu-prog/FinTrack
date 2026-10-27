/**
 * Authentication Module - Expense Tracker / Personal Finance Manager
 * 
 * Features:
 * - Real API integration with Node.js/Express backend (/api/auth/login, /api/auth/register)
 * - Accessible input validation (RFC 5322 email regex, length >= 6, password matching)
 * - Password show/hide toggle support
 * - Button loading spinners & duplicate submission prevention
 * - Single clean error alerts (eliminates duplicate red messages on fields)
 * - Database health monitoring: disables submission while database is unavailable
 * - Session restoration via ApiService.getMe()
 */

const AuthManager = {
  REMEMBERED_EMAIL_KEY: 'fintrack_remembered_email',
  healthPollTimer: null,
  isDbConnected: true,

  async init() {
    this.bindEvents();
    this.initPasswordToggles();
    this.restoreRememberedEmail();
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
    await this.checkDatabaseHealth();
    await this.checkSession();
  },

  /**
   * Monitor backend & MongoDB Atlas connectivity
   */
  async checkDatabaseHealth() {
    const submitBtn = document.getElementById('btn-submit-auth');
    try {
      const health = await ApiService.checkHealth();
      if (!health) {
        // Backend offline completely
        this.setDbOfflineState(true, 'Backend server is unreachable. Please ensure it is running on port 5000.');
        this.scheduleHealthPoll();
        return false;
      }

      // Check genuine Mongoose connection state (both backend database and readyState)
      const isConnected = health.database === 'Connected' || (health.dbDetails && health.dbDetails.isConnected === true && health.dbDetails.readyState === 1);

      if (isConnected) {
        // Database is fully connected and ready
        this.setDbOfflineState(false);
        this.clearAlert();
        if (this.healthPollTimer) {
          clearInterval(this.healthPollTimer);
          this.healthPollTimer = null;
        }
        return true;
      } else {
        // Database is disconnected / IP rejected / connecting
        let msg = (health.dbDetails && health.dbDetails.message) ? health.dbDetails.message : '';
        // CRITICAL: Filter out any misleading "Connected to cluster" message when database is offline!
        if (!msg || msg.toLowerCase().includes('connected to cluster')) {
          msg = 'MongoDB Atlas is disconnected. Please ensure your IP is whitelisted in Atlas Network Access.';
        }
        this.setDbOfflineState(true, msg);
        this.scheduleHealthPoll();
        return false;
      }
    } catch (e) {
      this.setDbOfflineState(true, 'Backend connection error. Retrying...');
      this.scheduleHealthPoll();
      return false;
    }
  },

  scheduleHealthPoll() {
    if (this.healthPollTimer) return;
    this.healthPollTimer = setInterval(async () => {
      await this.checkDatabaseHealth();
    }, 5000);
  },

  /**
   * Disable/enable form submit button while database is unavailable
   */
  setDbOfflineState(isOffline, message = '') {
    this.isDbConnected = !isOffline;
    const submitBtn = document.getElementById('btn-submit-auth');
    if (!submitBtn) return;

    const textSpan = submitBtn.querySelector('.btn-text');
    const isRegister = !!document.getElementById('register-form');

    if (isOffline) {
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.65';
      submitBtn.style.cursor = 'not-allowed';
      if (textSpan) {
        textSpan.innerHTML = `<span>Database Offline</span>`;
      }
      if (message) {
        // Filter out misleading cluster message when offline
        if (!message.toLowerCase().includes('connected to cluster')) {
          this.showAlert(message, 'danger');
        }
      }
    } else {
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
      if (textSpan) {
        const actionText = isRegister ? 'Create Account' : 'Sign In';
        textSpan.innerHTML = `<span>${actionText}</span> <i data-lucide="arrow-right" style="width: 16px; height: 16px;"></i>`;
        if (window.lucide) lucide.createIcons({ root: textSpan });
      }
      this.clearAlert();
    }
  },

  /**
   * Check if user already has an active session
   */
  async checkSession() {
    if (typeof ApiService !== 'undefined' && ApiService.isAuthenticated()) {
      try {
        const serverUser = await ApiService.getMe();
        if (serverUser && typeof StorageService !== 'undefined') {
          StorageService.setSessionUser(serverUser);
        }
      } catch (err) {
        // Token might be expired, leave for explicit login
      }
    }

    if (typeof StorageService !== 'undefined') {
      const user = StorageService.getSessionUser();
      const banner = document.getElementById('session-active-banner');
      if (user && banner) {
        banner.style.display = 'flex';
        const userSpan = document.getElementById('active-session-username');
        if (userSpan) userSpan.textContent = user.name || user.email;
      }
    }
  },

  /**
   * Restore remembered email from localStorage if available
   */
  restoreRememberedEmail() {
    const emailInput = document.getElementById('login-email');
    const rememberCheckbox = document.getElementById('login-remember');
    if (emailInput && rememberCheckbox) {
      const savedEmail = localStorage.getItem(this.REMEMBERED_EMAIL_KEY);
      if (savedEmail) {
        emailInput.value = savedEmail;
        rememberCheckbox.checked = true;
      }
    }
  },

  /**
   * Initialize eye icon show/hide toggle on password inputs
   */
  initPasswordToggles() {
    const toggleButtons = document.querySelectorAll('.btn-password-toggle');
    toggleButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const inputWrap = btn.closest('.password-input-wrap, .auth-input-container');
        if (!inputWrap) return;
        const input = inputWrap.querySelector('input');
        if (!input) return;

        const iconEye = btn.querySelector('.icon-eye');
        const iconEyeOff = btn.querySelector('.icon-eye-off');

        if (input.type === 'password') {
          input.type = 'text';
          if (iconEye) iconEye.style.display = 'none';
          if (iconEyeOff) iconEyeOff.style.display = 'inline-block';
          btn.setAttribute('aria-label', 'Hide password');
        } else {
          input.type = 'password';
          if (iconEye) iconEye.style.display = 'inline-block';
          if (iconEyeOff) iconEyeOff.style.display = 'none';
          btn.setAttribute('aria-label', 'Show password');
        }
      });
    });
  },

  /**
   * Display a single inline alert message in the form
   */
  showAlert(message, type = 'danger', isHtml = false) {
    const alertBox = document.getElementById('auth-alert');
    if (!alertBox) return;

    let icon = 'alert-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'info') icon = 'info';

    alertBox.className = `auth-alert auth-alert-${type}`;
    const safeContent = isHtml ? message : escapeHTML(message);
    alertBox.innerHTML = `
      <i data-lucide="${icon}" style="width: 16px; height: 16px; flex-shrink: 0;"></i>
      <span>${safeContent}</span>
    `;
    alertBox.style.display = 'flex';

    if (window.lucide) {
      lucide.createIcons({ root: alertBox });
    }
  },

  /**
   * Hide the inline alert message
   */
  clearAlert() {
    const alertBox = document.getElementById('auth-alert');
    if (alertBox) {
      alertBox.style.display = 'none';
      alertBox.innerHTML = '';
    }
  },

  /**
   * Set button loading state (spinner + disabled)
   */
  setButtonLoading(button, isLoading, loadingText = 'Processing...') {
    if (!button) return;
    const textSpan = button.querySelector('.btn-text');
    const spinnerSpan = button.querySelector('.btn-spinner');

    if (isLoading) {
      button.disabled = true;
      if (textSpan) textSpan.style.display = 'none';
      if (spinnerSpan) {
        spinnerSpan.style.display = 'inline-flex';
        spinnerSpan.querySelector('.spinner-sm').nextSibling.nodeValue = ` ${loadingText}`;
      }
    } else {
      button.disabled = false;
      if (textSpan) textSpan.style.display = 'inline';
      if (spinnerSpan) spinnerSpan.style.display = 'none';
    }
  },

  bindEvents() {
    // Clear alerts and field errors on user typing
    const formInputs = document.querySelectorAll('.form-control, .auth-form-input');
    formInputs.forEach(input => {
      input.addEventListener('input', () => {
        // Clear field error
        input.classList.remove('has-error');
        FormValidator.clearFieldError(input);
        // Only clear global alert if it was not a system offline warning
        if (this.isDbConnected) {
          this.clearAlert();
        }
      });
    });

    // Google Sign-In helper notice
    const googleBtns = document.querySelectorAll('#btn-google-login, #btn-google-signup');
    googleBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.showAlert('Google Sign-In is configured for cloud OAuth deployment. Please use email and password below.', 'info');
      });
    });

    // Login Form Handler
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleLogin();
      });

      // Quick Demo Auto-Fill Pill on Login Page
      const demoFillBtn = document.getElementById('btn-fill-demo-login');
      if (demoFillBtn) {
        demoFillBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const emailInput = document.getElementById('login-email');
          const passInput = document.getElementById('login-password');
          if (emailInput) emailInput.value = 'munjalradha91@gmail.com';
          if (passInput) passInput.value = 'password123';
          if (this.isDbConnected) this.clearAlert();
          if (emailInput) emailInput.classList.remove('has-error');
          if (passInput) passInput.classList.remove('has-error');
          FormValidator.clearFieldError(emailInput);
          FormValidator.clearFieldError(passInput);
        });
      }
    }

    // Register Form Handler
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleRegister();
      });

      // Quick Demo Auto-Fill Pill on Register Page
      const demoFillRegBtn = document.getElementById('btn-fill-demo-register');
      if (demoFillRegBtn) {
        demoFillRegBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const nameInput = document.getElementById('reg-name');
          const emailInput = document.getElementById('reg-email');
          const passInput = document.getElementById('reg-password');
          const confirmInput = document.getElementById('reg-confirm-password');

          if (nameInput) nameInput.value = 'Radha Munjal';
          if (emailInput) emailInput.value = 'munjalradha91@gmail.com';
          if (passInput) passInput.value = 'password123';
          if (confirmInput) confirmInput.value = 'password123';

          if (this.isDbConnected) this.clearAlert();
          [nameInput, emailInput, passInput, confirmInput].forEach(inp => {
            if (inp) {
              inp.classList.remove('has-error');
              FormValidator.clearFieldError(inp);
            }
          });
        });
      }
    }

    // Logout button (if present anywhere on dashboard pages)
    const logoutBtn = document.getElementById('btn-auth-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof ApiService !== 'undefined') {
          ApiService.logout();
        }
        window.location.href = 'login.html';
      });
    }
  },

  /**
   * Handle user login submission
   */
  async handleLogin() {
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    const submitBtn = document.getElementById('btn-submit-auth');
    const rememberCheckbox = document.getElementById('login-remember');

    // Clear previous errors
    this.clearAlert();
    emailInput.classList.remove('has-error');
    passInput.classList.remove('has-error');
    FormValidator.clearFieldError(emailInput);
    FormValidator.clearFieldError(passInput);

    // If database is offline, do not submit
    if (!this.isDbConnected) {
      await this.checkDatabaseHealth();
      if (!this.isDbConnected) return;
    }

    // Client-side Validation using FormValidator
    let isValid = true;
    if (!FormValidator.validateEmail(emailInput)) isValid = false;
    if (!FormValidator.validatePassword(passInput, 6)) isValid = false;

    if (!isValid) return;

    const email = emailInput.value.trim();
    const password = passInput.value;

    this.setButtonLoading(submitBtn, true, 'Signing in...');

    try {
      const res = await ApiService.login({ email, password });

      // Save or remove remembered email
      if (rememberCheckbox && rememberCheckbox.checked) {
        localStorage.setItem(this.REMEMBERED_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(this.REMEMBERED_EMAIL_KEY);
      }

      this.showAlert(`Welcome back, ${res.user ? res.user.name : email}! Redirecting...`, 'success');

      setTimeout(() => {
        window.location.href = 'index.html';
      }, 700);

    } catch (err) {
      this.setButtonLoading(submitBtn, false);
      const errorMessage = err.message || 'Login failed. Please check your credentials.';

      // Check if this is a database connectivity/backend issue
      const isDbErr = err.isDbError || /database|mongo|atlas|unreachable|offline|503/i.test(errorMessage);

      if (isDbErr) {
        // Show ONLY in the single top alert banner; DO NOT mark password field; DO NOT show toast
        this.showAlert(errorMessage, 'danger');
        this.setDbOfflineState(true, errorMessage);
        this.scheduleHealthPoll();
      } else if (err.accountExists === false || err.code === 'USER_NOT_FOUND' || /no account/i.test(errorMessage)) {
        // Case: User entered an email that is not registered yet
        // Show ONE clear helpful message directing them to sign up, highlighting email without duplicate text
        this.showAlert(
          `No account found with this email. Please <a href="register.html" style="color: inherit; text-decoration: underline; font-weight: 700;">Sign Up</a> first to create your account.`,
          'danger',
          true
        );
        emailInput.classList.add('has-error');
      } else if (err.code === 'INVALID_PASSWORD' || /incorrect password/i.test(errorMessage)) {
        // Case: User entered an incorrect password
        this.showAlert('Incorrect password. Please verify your password and try again.', 'danger');
        passInput.classList.add('has-error');
      } else {
        // Generic credential error: single top banner alert, NO duplicate text under password field
        this.showAlert(errorMessage, 'danger');
        emailInput.classList.add('has-error');
        passInput.classList.add('has-error');
      }
    }
  },

  /**
   * Handle user registration submission
   */
  async handleRegister() {
    const nameInput = document.getElementById('reg-name');
    const emailInput = document.getElementById('reg-email');
    const passInput = document.getElementById('reg-password');
    const confirmInput = document.getElementById('reg-confirm-password');
    const submitBtn = document.getElementById('btn-submit-auth');

    // Clear previous errors
    this.clearAlert();
    [nameInput, emailInput, passInput, confirmInput].forEach(inp => {
      if (inp) {
        inp.classList.remove('has-error');
        FormValidator.clearFieldError(inp);
      }
    });

    // If database is offline, do not submit
    if (!this.isDbConnected) {
      await this.checkDatabaseHealth();
      if (!this.isDbConnected) return;
    }

    // Client-side Validation
    let isValid = true;
    if (!FormValidator.validateRequired(nameInput, 'Full Name')) isValid = false;
    if (nameInput.value.trim().length < 2) {
      FormValidator.showFieldError(nameInput, 'Full Name must be at least 2 characters.');
      isValid = false;
    }
    if (!FormValidator.validateEmail(emailInput)) isValid = false;
    if (!FormValidator.validatePassword(passInput, 6)) isValid = false;
    if (!FormValidator.validatePasswordMatch(passInput, confirmInput)) isValid = false;

    if (!isValid) return;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passInput.value;

    this.setButtonLoading(submitBtn, true, 'Creating Account...');

    try {
      const res = await ApiService.register({ name, email, password });

      this.showAlert(`Account created successfully! Welcome, ${res.user ? res.user.name : name}! Redirecting...`, 'success');

      // Update user profile in settings store
      if (typeof StorageService !== 'undefined') {
        const settings = StorageService.getSettings();
        settings.userName = name;
        settings.userEmail = email;
        StorageService.saveSettings(settings);
      }

      setTimeout(() => {
        window.location.href = 'index.html';
      }, 800);

    } catch (err) {
      this.setButtonLoading(submitBtn, false);
      const errorMessage = err.message || 'Registration failed. Please try again.';

      const isDbErr = err.isDbError || /database|mongo|atlas|unreachable|offline|503/i.test(errorMessage);

      if (isDbErr) {
        // Show ONLY in the single top alert banner; NEVER on password fields; NO toast
        this.showAlert(errorMessage, 'danger');
        this.setDbOfflineState(true, errorMessage);
        this.scheduleHealthPoll();
      } else if (err.code === 'EMAIL_EXISTS' || /already exists/i.test(errorMessage)) {
        this.showAlert(
          `An account with this email already exists. Please <a href="login.html" style="color: inherit; text-decoration: underline; font-weight: 700;">Sign In</a> instead.`,
          'danger',
          true
        );
        emailInput.classList.add('has-error');
      } else {
        this.showAlert(errorMessage, 'danger');
        if (/email/i.test(errorMessage)) {
          emailInput.classList.add('has-error');
        } else if (/password/i.test(errorMessage)) {
          passInput.classList.add('has-error');
        }
      }
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AuthManager.init();
});
