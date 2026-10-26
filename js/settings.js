/**
 * Settings Page Logic - Expense Tracker / Personal Finance Manager
 * 
 * Demonstrates Syllabus Concepts:
 * - Object destructuring and spread syntax
 * - JSON serialization (stringify / parse)
 * - LocalStorage state persistence
 * - File API & FileReader for JSON data backups
 * - Custom modal confirmation dialogs
 * - Form submission and event listeners
 */

const SettingsManager = {
  init() {
    this.loadCurrentSettings();
    this.bindEvents();
  },

  loadCurrentSettings() {
    const settings = StorageService.getSettings();

    // 1. Profile inputs
    const nameInput = document.getElementById('set-user-name');
    const emailInput = document.getElementById('set-user-email');
    const goalInput = document.getElementById('set-savings-goal');

    if (nameInput) nameInput.value = settings.userName || '';
    if (emailInput) emailInput.value = settings.userEmail || '';
    if (goalInput) goalInput.value = settings.monthlySavingsGoal || 25000;

    // 2. Currency Selector
    const currSelect = document.getElementById('set-currency-select');
    if (currSelect) currSelect.value = settings.currency || 'INR';

    // 3. Theme Selector
    const themeSelect = document.getElementById('set-theme-select');
    if (themeSelect) themeSelect.value = settings.theme || 'light';
  },

  bindEvents() {
    // Save Profile Form
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveProfile();
      });
    }

    // Save Preferences Form (Currency & Theme)
    const prefForm = document.getElementById('preferences-form');
    if (prefForm) {
      prefForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.savePreferences();
      });
    }

    // JSON Data Export
    const exportBtn = document.getElementById('btn-export-json');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportDataJSON();
      });
    }

    // JSON Data Import (FileReader)
    const importInput = document.getElementById('import-json-file');
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        this.handleFileImport(e);
      });
    }

    // Reset Demo Data Button
    const resetDemoBtn = document.getElementById('btn-reset-demo-data');
    if (resetDemoBtn) {
      resetDemoBtn.addEventListener('click', () => {
        showConfirmModal({
          title: 'Reset to Demo Data',
          message: 'This will reset your transactions, budgets, and recurring rules to the initial pre-populated demo dataset. Continue?',
          confirmText: 'Reset Demo Data',
          confirmClass: 'btn-primary',
          onConfirm: () => {
            StorageService.resetToDemoData();
            showToast('Reset to demo dataset successfully!', 'success');
            setTimeout(() => window.location.reload(), 1000);
          }
        });
      });
    }

    // Clear All Data Button
    const clearDataBtn = document.getElementById('btn-clear-all-data');
    if (clearDataBtn) {
      clearDataBtn.addEventListener('click', () => {
        showConfirmModal({
          title: 'Clear All Data',
          message: 'Are you sure you want to completely erase all transactions, budgets, and recurring rules? This cannot be undone.',
          confirmText: 'Erase Everything',
          confirmClass: 'btn-danger',
          onConfirm: () => {
            StorageService.clearAllData();
            showToast('All data erased successfully.', 'info');
            setTimeout(() => window.location.reload(), 1000);
          }
        });
      });
    }
  },

  saveProfile() {
    const nameInput = document.getElementById('set-user-name');
    const emailInput = document.getElementById('set-user-email');
    const goalInput = document.getElementById('set-savings-goal');

    let isValid = true;
    if (!FormValidator.validateRequired(nameInput, 'Full Name')) isValid = false;
    if (!FormValidator.validateEmail(emailInput)) isValid = false;
    if (!FormValidator.validatePositiveNumber(goalInput, 'Monthly Savings Goal')) isValid = false;

    if (!isValid) return;

    const settings = StorageService.getSettings();
    settings.userName = nameInput.value.trim();
    settings.userEmail = emailInput.value.trim();
    settings.monthlySavingsGoal = parseFloat(goalInput.value);

    StorageService.saveSettings(settings);
    showToast('Profile information saved!', 'success');

    // Update avatar and username display
    const initials = settings.userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const avatar = document.getElementById('sidebar-user-avatar');
    const nameLabel = document.getElementById('sidebar-user-name');
    if (avatar) avatar.textContent = initials;
    if (nameLabel) nameLabel.textContent = settings.userName;
  },

  savePreferences() {
    const currSelect = document.getElementById('set-currency-select');
    const themeSelect = document.getElementById('set-theme-select');

    const settings = StorageService.getSettings();
    settings.currency = currSelect.value;
    settings.theme = themeSelect.value;

    // Currency symbol mapping
    const symbols = { 'INR': '₹', 'USD': '$', 'EUR': '€', 'GBP': '£' };
    settings.currencySymbol = symbols[settings.currency] || '₹';

    StorageService.saveSettings(settings);
    App.currency = settings.currency;
    App.currencySymbol = settings.currencySymbol;
    App.theme = settings.theme;

    document.documentElement.setAttribute('data-theme', settings.theme);
    showToast('Preferences updated successfully!', 'success');
  },

  exportDataJSON() {
    const jsonStr = StorageService.exportAllData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `expense_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Backup JSON downloaded successfully!', 'success');
  },

  handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Demonstrating FileReader API
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const res = StorageService.importData(content);
        if (res.success) {
          showToast(`Backup restored successfully with ${res.count} transactions!`, 'success');
          setTimeout(() => window.location.reload(), 1200);
        } else {
          showToast(`Import failed: ${res.error}`, 'danger');
        }
      } catch (err) {
        showToast('Invalid JSON file format.', 'danger');
      }
    };
    reader.readAsText(file);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  SettingsManager.init();
});
