/**
 * Recurring Transactions Management Logic
 * Expense Tracker / Personal Finance Manager
 * 
 * Demonstrates Syllabus Concepts:
 * - Switch statement (handling frequency calculations)
 * - Date arithmetic and parsing
 * - Array methods: filter(), forEach(), map()
 * - Objects, spread syntax, and deep copying
 * - Dynamic generation of transactions with duplicate prevention
 * - Modal management and validation
 */

const RecurringManager = {
  editingRuleId: null,

  init() {
    this.populateCategorySelect();
    this.bindEvents();
    this.render();
  },

  populateCategorySelect() {
    const select = document.getElementById('rec-modal-category');
    if (select) {
      App.populateCategorySelect(select);
    }
  },

  bindEvents() {
    // Open modal
    const openAddBtn = document.getElementById('btn-open-recurring-modal');
    const modal = document.getElementById('recurring-modal');
    if (!modal) return;

    const closeBtn = modal.querySelector('.modal-close-btn');
    const cancelBtn = modal.querySelector('.btn-modal-cancel');
    const closeModal = () => modal.classList.remove('active');

    if (openAddBtn) {
      openAddBtn.addEventListener('click', () => {
        this.openRecurringModal(null);
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Form submit
    const form = document.getElementById('recurring-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFormSubmit();
      });
    }

    // Manual 'Generate Due Transactions' button
    const genBtn = document.getElementById('btn-generate-due');
    if (genBtn) {
      genBtn.addEventListener('click', () => {
        this.generateDueTransactions();
      });
    }
  },

  /**
   * Helper: Calculate next due date based on frequency using switch statement
   */
  computeNextDate(currentDateStr, frequency) {
    const [y, m, d] = currentDateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);

    // Demonstrating switch statement for syllabus requirements
    switch (frequency) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        date.setMonth(date.getMonth() + 1);
    }

    const nextY = date.getFullYear();
    const nextM = String(date.getMonth() + 1).padStart(2, '0');
    const nextD = String(date.getDate()).padStart(2, '0');
    return `${nextY}-${nextM}-${nextD}`;
  },

  /**
   * Manual 'Generate Due Transactions' action
   * Finds active rules where nextDueDate <= today, generates a transaction,
   * advances nextDueDate to prevent duplicate generation.
   */
  generateDueTransactions() {
    const rules = StorageService.getRecurringRules();
    const todayStr = new Date().toISOString().split('T')[0];

    let generatedCount = 0;
    const updatedRules = [];

    // Filter rules that are active and due
    rules.forEach(rule => {
      if (rule.active && rule.nextDueDate && rule.nextDueDate <= todayStr) {
        // 1. Create and save new transaction
        StorageService.addTransaction({
          type: rule.type,
          amount: parseFloat(rule.amount),
          category: rule.category,
          date: rule.nextDueDate,
          description: `${rule.description} (Recurring ${rule.frequency})`
        });

        generatedCount++;

        // 2. Advance nextDueDate to prevent duplicate generation
        const newNextDueDate = this.computeNextDate(rule.nextDueDate, rule.frequency);
        updatedRules.push({
          ...rule,
          nextDueDate: newNextDueDate
        });
      } else {
        updatedRules.push(rule);
      }
    });

    // Call ApiService to trigger generation on backend if authenticated
    if (ApiService.isAuthenticated()) {
      ApiService.generateDueTransactions().then(res => {
        if (res && res.generatedCount > 0) {
          showToast(`Backend generated ${res.generatedCount} due transaction(s)!`, 'success');
          window.dispatchEvent(new CustomEvent('transactionDataChanged'));
          this.render();
          return;
        }
      }).catch(() => {});
    }

    if (generatedCount > 0) {
      StorageService.saveRecurringRules(updatedRules);
      showToast(`Successfully generated ${generatedCount} due transaction(s)!`, 'success');
      // Notify other views
      window.dispatchEvent(new CustomEvent('transactionDataChanged'));
      this.render();
    } else {
      showToast('No recurring transactions are due today.', 'info');
    }
  },

  /**
   * Render Recurring Rules List
   */
  render() {
    const rules = StorageService.getRecurringRules();
    const container = document.getElementById('recurring-rules-container');
    const todayStr = new Date().toISOString().split('T')[0];
    if (!container) return;

    if (rules.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1;">
          <div class="empty-state">
            <div class="empty-state-icon">
              <i data-lucide="refresh-cw"></i>
            </div>
            <h4>No Recurring Rules Found</h4>
            <p>Automate regular income (Salary) or expenses (Rent, Subscriptions) by creating recurring rules.</p>
            <button class="btn btn-primary" onclick="RecurringManager.openRecurringModal(null)">
              <i data-lucide="plus"></i> Add Recurring Rule
            </button>
          </div>
        </div>
      `;
      App.initLucideIcons();
      return;
    }

    const categories = StorageService.getCategories();
    let html = '';

    rules.forEach(rule => {
      const isIncome = rule.type === 'income';
      const catObj = categories.find(c => c.name.toLowerCase() === (rule.category || '').toLowerCase());
      const catColor = catObj ? catObj.color : '#6366F1';
      const catIcon = catObj ? catObj.icon : 'refresh-cw';

      const isDue = rule.active && rule.nextDueDate && rule.nextDueDate <= todayStr;

      let statusBadge = '';
      if (!rule.active) {
        statusBadge = '<span class="badge badge-secondary">Paused</span>';
      } else if (isDue) {
        statusBadge = '<span class="badge badge-danger"><i data-lucide="alert-circle" style="width:12px;height:12px;"></i> Due Now!</span>';
      } else {
        statusBadge = '<span class="badge badge-success">Active</span>';
      }

      html += `
        <div class="card" style="display:flex; flex-direction:column; justify-content:space-between; ${!rule.active ? 'opacity:0.75;' : ''}">
          <div>
            <div class="card-header" style="margin-bottom:0.75rem;">
              <div style="display:flex; align-items:center; gap:0.75rem;">
                <div class="cat-icon-badge" style="background-color:${catColor}15; color:${catColor};">
                  <i data-lucide="${catIcon}" style="width:18px;height:18px;"></i>
                </div>
                <div>
                  <h4 style="font-size:1.05rem; font-weight:700; color:var(--text-main);">${escapeHTML(rule.description)}</h4>
                  <span style="font-size:0.78rem; color:var(--text-muted);">${escapeHTML(rule.category)}</span>
                </div>
              </div>
              <div>${statusBadge}</div>
            </div>

            <div style="background-color:var(--bg-surface-alt); padding:0.85rem; border-radius:var(--radius-md); border:1px solid var(--border-color); margin:0.85rem 0;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                <span style="font-size:0.82rem; color:var(--text-muted);">Amount:</span>
                <strong class="${isIncome ? 'amount-income' : 'amount-expense'}" style="font-size:1.1rem;">
                  ${isIncome ? '+' : '-'}${formatCurrency(rule.amount)}
                </strong>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem;">
                <span style="color:var(--text-muted);">Frequency:</span>
                <span class="badge badge-primary" style="text-transform:capitalize;">${rule.frequency}</span>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted);">
              <span>Next Due: <strong style="color:var(--text-main);">${formatDisplayDate(rule.nextDueDate)}</strong></span>
              <span>Started: ${formatDisplayDate(rule.startDate)}</span>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1.25rem; padding-top:0.75rem; border-top:1px solid var(--border-color);">
            <button class="btn btn-sm ${rule.active ? 'btn-secondary' : 'btn-success'}" onclick="RecurringManager.toggleRuleActive('${rule.id}')">
              <i data-lucide="${rule.active ? 'pause' : 'play'}" style="width:13px;height:13px;"></i>
              ${rule.active ? 'Pause' : 'Resume'}
            </button>

            <div style="display:flex; gap:0.4rem;">
              <button class="btn btn-secondary btn-sm" onclick="RecurringManager.openRecurringModal('${rule.id}')">
                <i data-lucide="edit-2" style="width:13px;height:13px;"></i> Edit
              </button>
              <button class="btn btn-outline-danger btn-sm" onclick="RecurringManager.confirmDelete('${rule.id}')">
                <i data-lucide="trash-2" style="width:13px;height:13px;"></i> Delete
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    App.initLucideIcons();
  },

  openRecurringModal(ruleId = null) {
    const modal = document.getElementById('recurring-modal');
    const form = document.getElementById('recurring-form');
    const titleEl = document.getElementById('rec-modal-title');
    if (!modal || !form) return;

    FormValidator.clearFormErrors(form);
    this.editingRuleId = ruleId;

    if (ruleId) {
      titleEl.textContent = 'Edit Recurring Rule';
      const rules = StorageService.getRecurringRules();
      const r = rules.find(item => item.id === ruleId);
      if (!r) return;

      const typeRadio = form.querySelector(`input[name="rec-type"][value="${r.type}"]`);
      if (typeRadio) typeRadio.checked = true;

      document.getElementById('rec-modal-amount').value = r.amount;
      document.getElementById('rec-modal-category').value = r.category;
      document.getElementById('rec-modal-description').value = r.description;
      document.getElementById('rec-modal-frequency').value = r.frequency;
      document.getElementById('rec-modal-start-date').value = r.startDate;
      document.getElementById('rec-modal-next-due').value = r.nextDueDate;
    } else {
      titleEl.textContent = 'Create Recurring Rule';
      form.reset();
      const expenseRadio = form.querySelector('input[name="rec-type"][value="expense"]');
      if (expenseRadio) expenseRadio.checked = true;
      const todayStr = new Date().toISOString().split('T')[0];
      document.getElementById('rec-modal-start-date').value = todayStr;
      document.getElementById('rec-modal-next-due').value = todayStr;
    }

    modal.classList.add('active');
  },

  handleFormSubmit() {
    const form = document.getElementById('recurring-form');
    const typeRadio = form.querySelector('input[name="rec-type"]:checked');
    const type = typeRadio ? typeRadio.value : 'expense';
    const amountInput = document.getElementById('rec-modal-amount');
    const catSelect = document.getElementById('rec-modal-category');
    const descInput = document.getElementById('rec-modal-description');
    const freqSelect = document.getElementById('rec-modal-frequency');
    const startInput = document.getElementById('rec-modal-start-date');
    const nextInput = document.getElementById('rec-modal-next-due');

    let isValid = true;
    if (!FormValidator.validatePositiveNumber(amountInput, 'Amount')) isValid = false;
    if (!FormValidator.validateRequired(catSelect, 'Category')) isValid = false;
    if (!FormValidator.validateRequired(descInput, 'Description')) isValid = false;
    if (!FormValidator.validateRequired(startInput, 'Start Date')) isValid = false;
    if (!FormValidator.validateRequired(nextInput, 'Next Due Date')) isValid = false;

    if (!isValid) return;

    const ruleData = {
      type,
      amount: parseFloat(amountInput.value),
      category: catSelect.value,
      description: descInput.value.trim(),
      frequency: freqSelect.value,
      startDate: startInput.value,
      nextDueDate: nextInput.value
    };

    if (this.editingRuleId) {
      StorageService.updateRecurringRule({
        id: this.editingRuleId,
        ...ruleData
      });
      showToast('Recurring rule updated successfully!', 'success');
    } else {
      ApiService.createRecurringRule(ruleData).then(() => {
        showToast('Recurring rule created successfully!', 'success');
        this.render();
      }).catch(() => {
        StorageService.addRecurringRule(ruleData);
        showToast('Recurring rule created successfully!', 'success');
        this.render();
      });
    }

    document.getElementById('recurring-modal').classList.remove('active');
    this.render();
  },

  toggleRuleActive(ruleId) {
    const rules = StorageService.getRecurringRules();
    const r = rules.find(item => item.id === ruleId);
    if (r) {
      r.active = !r.active;
      StorageService.updateRecurringRule(r);
      showToast(`Rule ${r.active ? 'resumed' : 'paused'}`, 'info');
      this.render();
    }
  },

  confirmDelete(ruleId) {
    showConfirmModal({
      title: 'Delete Recurring Rule',
      message: 'Are you sure you want to delete this recurring rule? Existing transactions generated by this rule will remain safe.',
      confirmText: 'Delete Rule',
      confirmClass: 'btn-danger',
      onConfirm: () => {
        ApiService.deleteRecurringRule(ruleId).then(() => {
          showToast('Recurring rule deleted', 'info');
          this.render();
        }).catch(() => {
          StorageService.deleteRecurringRule(ruleId);
          showToast('Recurring rule deleted', 'info');
          this.render();
        });
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  RecurringManager.init();
});
