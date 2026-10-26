/**
 * Core Application Utilities & Shared UI Components
 * Expense Tracker / Personal Finance Manager
 * 
 * Demonstrates Syllabus Concepts:
 * - Template literals
 * - Intl.NumberFormat localization (en-IN currency formatting)
 * - Rest parameters & Default parameters
 * - Object destructuring
 * - DOM selection & element creation/traversal
 * - Event handling & keyboard events (Escape to close modals)
 * - XSS text escaping
 */

// Global App State & Config
const App = {
  currency: 'INR',
  currencySymbol: '₹',
  theme: 'light',

  // Initialize application common components
  init() {
    this.loadPreferences();
    this.initTheme();
    this.initMobileSidebar();
    this.initQuickAddModal();
    this.initLucideIcons();
    this.highlightActiveNavLink();
  },

  // Load user preferences from storage
  loadPreferences() {
    const settings = StorageService.getSettings();
    if (settings) {
      this.currency = settings.currency || 'INR';
      this.currencySymbol = settings.currencySymbol || '₹';
      this.theme = settings.theme || 'light';
    }
  },

  // Initialize and apply theme (Light / Dark)
  initTheme() {
    document.documentElement.setAttribute('data-theme', this.theme);
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
      this.updateThemeButtonIcon(themeToggleBtn, this.theme);
      themeToggleBtn.addEventListener('click', () => {
        this.toggleTheme();
      });
    }
  },

  // Toggle theme between light and dark
  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', this.theme);
    const settings = StorageService.getSettings();
    settings.theme = this.theme;
    StorageService.saveSettings(settings);

    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
      this.updateThemeButtonIcon(themeToggleBtn, this.theme);
    }
    this.initLucideIcons();
  },

  updateThemeButtonIcon(button, currentTheme) {
    if (currentTheme === 'dark') {
      button.innerHTML = '<i data-lucide="sun"></i>';
      button.setAttribute('title', 'Switch to Light Mode');
    } else {
      button.innerHTML = '<i data-lucide="moon"></i>';
      button.setAttribute('title', 'Switch to Dark Mode');
    }
  },

  // Safe Lucide icon initializer
  initLucideIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  },

  // Mobile sidebar drawer logic
  initMobileSidebar() {
    const toggleBtn = document.getElementById('menu-toggle-btn');
    const sidebar = document.getElementById('app-sidebar');
    let backdrop = document.querySelector('.sidebar-backdrop');

    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'sidebar-backdrop';
      document.body.appendChild(backdrop);
    }

    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('sidebar-open');
        backdrop.classList.toggle('active');
      });

      backdrop.addEventListener('click', () => {
        sidebar.classList.remove('sidebar-open');
        backdrop.classList.remove('active');
      });
    }
  },

  // Active navigation link highlighting based on current page path
  highlightActiveNavLink() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-item');
    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href && (href === currentPath || (currentPath === '' && href === 'index.html'))) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  },

  // Initialize Global Quick-Add Modal
  initQuickAddModal() {
    const quickAddBtns = document.querySelectorAll('.btn-quick-add');
    const modalOverlay = document.getElementById('quick-add-modal');
    if (!modalOverlay) return;

    const closeBtn = modalOverlay.querySelector('.modal-close-btn');
    const cancelBtn = modalOverlay.querySelector('.btn-modal-cancel');
    const form = document.getElementById('quick-add-form');

    // Populate category dropdown
    const catSelect = document.getElementById('qa-category');
    if (catSelect) {
      this.populateCategorySelect(catSelect);
    }

    // Set today's date as default
    const dateInput = document.getElementById('qa-date');
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    quickAddBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        modalOverlay.classList.add('active');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
      });
    });

    const closeModal = () => {
      modalOverlay.classList.remove('active');
      if (form) form.reset();
      // Remove any lingering error styles
      if (modalOverlay) {
        modalOverlay.querySelectorAll('.form-control').forEach(el => el.classList.remove('has-error'));
        modalOverlay.querySelectorAll('.form-error').forEach(el => el.classList.remove('visible'));
      }
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
        closeModal();
      }
    });

    // Form submission
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const typeEl = form.querySelector('input[name="qa-type"]:checked') || document.getElementById('qa-type');
        const type = typeEl ? typeEl.value : 'expense';
        const amountEl = document.getElementById('qa-amount');
        const categoryEl = document.getElementById('qa-category');
        const dateEl = document.getElementById('qa-date');
        const descEl = document.getElementById('qa-description');

        const amount = parseFloat(amountEl.value);
        const category = categoryEl.value.trim();
        const date = dateEl.value;
        const description = descEl.value.trim();

        if (isNaN(amount) || amount <= 0) {
          FormValidator.showFieldError(amountEl, 'Please enter a valid positive amount.');
          return;
        }

        if (!category) {
          FormValidator.showFieldError(categoryEl, 'Please select a category.');
          return;
        }

        if (!date) {
          FormValidator.showFieldError(dateEl, 'Please select a valid date.');
          return;
        }

        if (!description) {
          FormValidator.showFieldError(descEl, 'Please provide a short description.');
          return;
        }

        // Save transaction via ApiService
        ApiService.createTransaction({
          type,
          amount,
          category,
          date,
          description
        }).then(() => {
          showToast('Transaction added successfully!', 'success');
          closeModal();
          window.dispatchEvent(new CustomEvent('transactionDataChanged'));
        }).catch(err => {
          showToast('Error saving transaction: ' + err.message, 'danger');
        });
      });
    }
  },

  populateCategorySelect(selectElement, selectedValue = '') {
    const categories = StorageService.getCategories();
    selectElement.innerHTML = '<option value="">-- Select Category --</option>';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.name;
      opt.textContent = `${cat.name} (${cat.type === 'income' ? 'Income' : 'Expense'})`;
      if (cat.name === selectedValue) {
        opt.selected = true;
      }
      selectElement.appendChild(opt);
    });
  }
};

/**
 * Currency Formatting with Intl.NumberFormat (INR ₹ default)
 * Demonstrates higher-order localization functions
 */
function formatCurrency(amount, currencyCode = null) {
  const settings = StorageService.getSettings();
  const code = currencyCode || settings.currency || 'INR';

  try {
    const formatter = new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0
    });
    return formatter.format(amount || 0);
  } catch (e) {
    return `${settings.currencySymbol || '₹'}${Number(amount || 0).toLocaleString('en-IN')}`;
  }
}

/**
 * Date formatting helpers
 */
function formatDisplayDate(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return dateStr;
}

/**
 * XSS Security: Safe HTML escaping helper
 */
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Toast Notification System
 * Demonstrates dynamic element creation, style changes, timeouts, and rest parameters
 */
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  // Icon mapping
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'danger') iconName = 'alert-triangle';
  if (type === 'warning') iconName = 'alert-circle';

  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <div style="flex:1;">${escapeHTML(message)}</div>
    <button class="toast-close-btn" style="color:var(--text-muted);font-size:1.1rem;">&times;</button>
  `;

  container.appendChild(toast);
  App.initLucideIcons();

  // Trigger smooth entrance
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  const removeToast = () => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 300);
  };

  const timer = setTimeout(removeToast, duration);

  toast.querySelector('.toast-close-btn').addEventListener('click', () => {
    clearTimeout(timer);
    removeToast();
  });
}

/**
 * Reusable Confirmation Modal Dialog
 * Replaces window.confirm with a modern custom UI modal
 */
function showConfirmModal({ title = 'Confirm Action', message = 'Are you sure?', confirmText = 'Confirm', confirmClass = 'btn-danger', onConfirm }) {
  let modalOverlay = document.getElementById('confirm-action-modal');
  if (!modalOverlay) {
    modalOverlay = document.createElement('div');
    modalOverlay.id = 'confirm-action-modal';
    modalOverlay.className = 'modal-overlay';
    modalOverlay.innerHTML = `
      <div class="modal-box" style="max-width: 440px;">
        <div class="modal-header">
          <h3 id="confirm-modal-title">Confirm Action</h3>
          <button class="modal-close-btn" id="confirm-modal-x">&times;</button>
        </div>
        <div class="modal-body">
          <p id="confirm-modal-message" style="color:var(--text-muted); font-size:0.95rem; line-height:1.6;"></p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="confirm-modal-cancel">Cancel</button>
          <button class="btn" id="confirm-modal-ok">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalOverlay);
  }

  const titleEl = document.getElementById('confirm-modal-title');
  const msgEl = document.getElementById('confirm-modal-message');
  const okBtn = document.getElementById('confirm-modal-ok');
  const cancelBtn = document.getElementById('confirm-modal-cancel');
  const closeX = document.getElementById('confirm-modal-x');

  titleEl.textContent = title;
  msgEl.textContent = message;
  okBtn.textContent = confirmText;
  okBtn.className = `btn ${confirmClass}`;

  const closeModal = () => {
    modalOverlay.classList.remove('active');
  };

  // Fresh event listeners
  const newOkBtn = okBtn.cloneNode(true);
  okBtn.parentNode.replaceChild(newOkBtn, okBtn);

  const newCancelBtn = cancelBtn.cloneNode(true);
  cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

  const newCloseX = closeX.cloneNode(true);
  closeX.parentNode.replaceChild(newCloseX, closeX);

  newOkBtn.addEventListener('click', () => {
    closeModal();
    if (typeof onConfirm === 'function') onConfirm();
  });

  newCancelBtn.addEventListener('click', closeModal);
  newCloseX.addEventListener('click', closeModal);

  modalOverlay.classList.add('active');
}

// Global initialization on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
