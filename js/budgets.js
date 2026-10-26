/**
 * Budgets Management Page Logic
 * Expense Tracker / Personal Finance Manager
 * 
 * Demonstrates Syllabus Concepts:
 * - Dynamic calculations from transaction data (spent vs limit)
 * - Conditionals for budget warnings (<80% Normal, 80-99% Warning, >=100% Exceeded)
 * - for...of and for...in loops
 * - Higher-order functions: filter(), map(), reduce()
 * - Object property access and modifications
 * - DOM element creation and event listeners
 * - Custom confirm dialog for deletion
 */

const BudgetManager = {
  selectedMonth: new Date().getMonth() + 1,
  selectedYear: new Date().getFullYear(),
  editingBudgetId: null,

  async init() {
    this.populateDateFilters();
    this.populateModalCategories();
    this.bindEvents();
    if (typeof ApiService !== 'undefined' && ApiService.isAuthenticated()) {
      try {
        const serverBudgets = await ApiService.getBudgets(this.selectedMonth, this.selectedYear);
        if (Array.isArray(serverBudgets)) {
          StorageService.saveBudgets(serverBudgets);
        }
      } catch (err) {
        console.warn('Sync budgets failed:', err.message);
      }
    }
    this.render();
  },

  populateDateFilters() {
    const monthSelect = document.getElementById('budget-month-select');
    const yearSelect = document.getElementById('budget-year-select');
    if (!monthSelect || !yearSelect) return;

    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    monthSelect.innerHTML = '';
    months.forEach((m, idx) => {
      const opt = document.createElement('option');
      opt.value = idx + 1;
      opt.textContent = m;
      if (idx + 1 === this.selectedMonth) opt.selected = true;
      monthSelect.appendChild(opt);
    });

    // Populate years
    yearSelect.innerHTML = '';
    const currentYear = new Date().getFullYear();
    for (let yr = currentYear - 2; yr <= currentYear + 2; yr++) {
      const opt = document.createElement('option');
      opt.value = yr;
      opt.textContent = yr;
      if (yr === this.selectedYear) opt.selected = true;
      yearSelect.appendChild(opt);
    }
  },

  populateModalCategories() {
    const catSelect = document.getElementById('budget-modal-category');
    if (!catSelect) return;

    // Only expense categories can have budgets
    const categories = StorageService.getCategories().filter(c => c.type === 'expense');
    catSelect.innerHTML = '<option value="">-- Select Category --</option>';
    categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      catSelect.appendChild(opt);
    });
  },

  bindEvents() {
    const monthSelect = document.getElementById('budget-month-select');
    const yearSelect = document.getElementById('budget-year-select');

    if (monthSelect) {
      monthSelect.addEventListener('change', (e) => {
        this.selectedMonth = parseInt(e.target.value, 10);
        this.render();
      });
    }

    if (yearSelect) {
      yearSelect.addEventListener('change', (e) => {
        this.selectedYear = parseInt(e.target.value, 10);
        this.render();
      });
    }

    // Modal open
    const openAddBtn = document.getElementById('btn-open-budget-modal');
    if (openAddBtn) {
      openAddBtn.addEventListener('click', () => {
        this.openBudgetModal(null);
      });
    }

    // Modal close & cancel
    const modal = document.getElementById('budget-modal');
    if (modal) {
      const closeBtn = modal.querySelector('.modal-close-btn');
      const cancelBtn = modal.querySelector('.btn-modal-cancel');
      const closeModal = () => modal.classList.remove('active');

      if (closeBtn) closeBtn.addEventListener('click', closeModal);
      if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    // Form submit
    const form = document.getElementById('budget-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFormSubmit();
      });
    }

    // React to transactions added in background
    window.addEventListener('transactionDataChanged', () => {
      this.render();
    });
  },

  /**
   * Render Budgets Grid & Summary Metrics
   */
  render() {
    const allBudgets = StorageService.getBudgets();
    const transactions = StorageService.getTransactions();

    // 1. Filter budgets for selected month & year
    const monthlyBudgets = allBudgets.filter(b => {
      if (!b.month || !b.year) return true;
      return b.month === this.selectedMonth && b.year === this.selectedYear;
    });

    // 2. Filter actual expense transactions for selected month & year
    const monthlyExpenses = transactions.filter(t => {
      if (t.type !== 'expense' || !t.date) return false;
      const parts = t.date.split('-');
      return parseInt(parts[0], 10) === this.selectedYear && parseInt(parts[1], 10) === this.selectedMonth;
    });

    // 3. Calculate overview statistics
    let totalBudgeted = 0;
    let totalSpentInBudgeted = 0;
    let warningCount = 0;
    let exceededCount = 0;

    // Build budget analysis models using for...of loop
    const analyzedBudgets = [];
    for (const budget of monthlyBudgets) {
      const limit = parseFloat(budget.limitAmount || 0);
      totalBudgeted += limit;

      // Sum actual spent for this specific category
      const spent = monthlyExpenses
        .filter(t => (t.category || '').toLowerCase() === (budget.category || '').toLowerCase())
        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

      totalSpentInBudgeted += spent;

      const remaining = limit - spent;
      const percent = limit > 0 ? (spent / limit) * 100 : 0;

      let status = 'HEALTHY';
      if (percent >= 100) {
        status = 'EXCEEDED';
        exceededCount++;
      } else if (percent >= 80) {
        status = 'WARNING';
        warningCount++;
      }

      analyzedBudgets.push({
        ...budget,
        limit,
        spent,
        remaining,
        percent,
        status
      });
    }

    const totalRemaining = Math.max(0, totalBudgeted - totalSpentInBudgeted);

    // Update Overview Cards
    const totalBudgetedEl = document.getElementById('stat-total-budgeted');
    const totalSpentEl = document.getElementById('stat-budget-spent');
    const totalRemainingEl = document.getElementById('stat-budget-remaining');
    const alertsEl = document.getElementById('stat-budget-alerts');

    if (totalBudgetedEl) totalBudgetedEl.textContent = formatCurrency(totalBudgeted);
    if (totalSpentEl) totalSpentEl.textContent = formatCurrency(totalSpentInBudgeted);
    if (totalRemainingEl) totalRemainingEl.textContent = formatCurrency(totalRemaining);
    if (alertsEl) {
      alertsEl.textContent = `${exceededCount} exceeded, ${warningCount} near limit`;
      alertsEl.style.color = (exceededCount > 0 || warningCount > 0) ? 'var(--danger)' : 'var(--success)';
    }

    // Render Cards in Grid
    const container = document.getElementById('budgets-grid-container');
    if (!container) return;

    if (analyzedBudgets.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1;">
          <div class="empty-state">
            <div class="empty-state-icon">
              <i data-lucide="piggy-bank"></i>
            </div>
            <h4>No Budgets Configured</h4>
            <p>You haven't set any category budgets for this month. Set spending limits to avoid overspending!</p>
            <button class="btn btn-primary" onclick="BudgetManager.openBudgetModal(null)">
              <i data-lucide="plus"></i> Create First Budget
            </button>
          </div>
        </div>
      `;
      App.initLucideIcons();
      return;
    }

    const categories = StorageService.getCategories();
    let html = '';

    analyzedBudgets.forEach(b => {
      const catObj = categories.find(c => c.name.toLowerCase() === b.category.toLowerCase());
      const catColor = catObj ? catObj.color : '#6366F1';
      const catIcon = catObj ? catObj.icon : 'tag';

      // Badge and progress styling
      let statusBadge = '<span class="badge badge-success"><i data-lucide="check-circle" style="width:12px;height:12px;"></i> On Track</span>';
      let fillClass = '';
      let alertBanner = '';

      if (b.status === 'EXCEEDED') {
        statusBadge = '<span class="badge badge-danger"><i data-lucide="alert-triangle" style="width:12px;height:12px;"></i> Exceeded (100%+)</span>';
        fillClass = 'danger';
        alertBanner = `
          <div style="background-color:var(--danger-light); color:var(--danger-hover); padding:0.5rem 0.75rem; border-radius:var(--radius-sm); font-size:0.75rem; font-weight:600; margin-top:0.75rem; display:flex; align-items:center; gap:0.4rem;">
            <i data-lucide="alert-triangle" style="width:14px;height:14px;"></i>
            Budget exceeded by ${formatCurrency(Math.abs(b.remaining))}!
          </div>
        `;
      } else if (b.status === 'WARNING') {
        statusBadge = '<span class="badge badge-warning"><i data-lucide="alert-circle" style="width:12px;height:12px;"></i> Warning (80%+)</span>';
        fillClass = 'warning';
        alertBanner = `
          <div style="background-color:var(--warning-light); color:var(--warning-hover); padding:0.5rem 0.75rem; border-radius:var(--radius-sm); font-size:0.75rem; font-weight:600; margin-top:0.75rem; display:flex; align-items:center; gap:0.4rem;">
            <i data-lucide="alert-circle" style="width:14px;height:14px;"></i>
            Spending reached ${b.percent.toFixed(0)}% of limit!
          </div>
        `;
      }

      const barWidth = Math.min(Math.round(b.percent), 100);

      html += `
        <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div class="card-header" style="margin-bottom:0.75rem;">
              <div style="display:flex; align-items:center; gap:0.75rem;">
                <div class="cat-icon-badge" style="background-color:${catColor}15; color:${catColor};">
                  <i data-lucide="${catIcon}" style="width:18px;height:18px;"></i>
                </div>
                <div>
                  <h4 style="font-size:1.05rem; font-weight:700; color:var(--text-main);">${escapeHTML(b.category)}</h4>
                  <span style="font-size:0.78rem; color:var(--text-muted);">${formatCurrency(b.limit)} Limit</span>
                </div>
              </div>
              <div>${statusBadge}</div>
            </div>

            <div style="margin: 1.15rem 0 0.5rem;">
              <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:0.4rem;">
                <span style="color:var(--text-muted);">Spent: <strong>${formatCurrency(b.spent)}</strong></span>
                <span style="font-weight:700; color:var(--text-main);">${b.percent.toFixed(1)}%</span>
              </div>
              <div class="progress-track" style="height:10px;">
                <div class="progress-fill ${fillClass}" style="width: ${barWidth}%;"></div>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-muted); margin-top:0.6rem;">
              <span>Remaining: <strong style="color:${b.remaining < 0 ? 'var(--danger)' : 'var(--text-main)'};">${formatCurrency(b.remaining)}</strong></span>
              <span>Month: ${this.selectedMonth}/${this.selectedYear}</span>
            </div>

            ${alertBanner}
          </div>

          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem; padding-top:0.75rem; border-top:1px solid var(--border-color);">
            <button class="btn btn-secondary btn-sm" onclick="BudgetManager.openBudgetModal('${b.id}')">
              <i data-lucide="edit-2" style="width:13px;height:13px;"></i> Edit
            </button>
            <button class="btn btn-outline-danger btn-sm" onclick="BudgetManager.confirmDelete('${b.id}', '${escapeHTML(b.category)}')">
              <i data-lucide="trash-2" style="width:13px;height:13px;"></i> Delete
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    App.initLucideIcons();
  },

  openBudgetModal(budgetId = null) {
    const modal = document.getElementById('budget-modal');
    const form = document.getElementById('budget-form');
    const titleEl = document.getElementById('budget-modal-title');
    if (!modal || !form) return;

    FormValidator.clearFormErrors(form);
    this.editingBudgetId = budgetId;

    if (budgetId) {
      titleEl.textContent = 'Edit Budget Limit';
      const budgets = StorageService.getBudgets();
      const b = budgets.find(item => item.id === budgetId);
      if (!b) return;

      document.getElementById('budget-modal-category').value = b.category;
      document.getElementById('budget-modal-limit').value = b.limitAmount;
    } else {
      titleEl.textContent = 'Set Category Budget';
      form.reset();
    }

    modal.classList.add('active');
  },

  handleFormSubmit() {
    const catSelect = document.getElementById('budget-modal-category');
    const limitInput = document.getElementById('budget-modal-limit');

    let isValid = true;
    if (!FormValidator.validateRequired(catSelect, 'Category')) isValid = false;
    if (!FormValidator.validatePositiveNumber(limitInput, 'Budget Limit Amount')) isValid = false;

    if (!isValid) return;

    const category = catSelect.value;
    const limitAmount = parseFloat(limitInput.value);

    if (this.editingBudgetId) {
      ApiService.saveBudget({
        id: this.editingBudgetId,
        category,
        limitAmount,
        limit: limitAmount,
        month: this.selectedMonth,
        year: this.selectedYear
      }).then(() => {
        showToast('Budget updated successfully!', 'success');
        document.getElementById('budget-modal').classList.remove('active');
        this.render();
      }).catch(err => {
        showToast('Error saving budget: ' + err.message, 'danger');
      });
    } else {
      // Check if category already has a budget for this month
      const existing = StorageService.getBudgets().find(b =>
        b.category.toLowerCase() === category.toLowerCase() &&
        b.month === this.selectedMonth &&
        b.year === this.selectedYear
      );

      if (existing) {
        FormValidator.showFieldError(catSelect, `A budget already exists for ${category} in this month.`);
        return;
      }

      ApiService.saveBudget({
        category,
        limitAmount,
        limit: limitAmount,
        month: this.selectedMonth,
        year: this.selectedYear
      }).then(() => {
        showToast('Budget set successfully!', 'success');
        document.getElementById('budget-modal').classList.remove('active');
        this.render();
      }).catch(err => {
        showToast('Error creating budget: ' + err.message, 'danger');
      });
    }
  },

  confirmDelete(budgetId, categoryName) {
    showConfirmModal({
      title: 'Delete Budget',
      message: `Are you sure you want to delete the monthly budget for "${categoryName}"?`,
      confirmText: 'Delete Budget',
      confirmClass: 'btn-danger',
      onConfirm: () => {
        ApiService.deleteBudget(budgetId).then(() => {
          showToast(`Budget for ${categoryName} deleted`, 'info');
          this.render();
        }).catch(err => {
          showToast('Error deleting: ' + err.message, 'danger');
        });
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  BudgetManager.init();
});
