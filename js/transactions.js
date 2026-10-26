/**
 * Transactions Management Page Logic
 * Expense Tracker / Personal Finance Manager
 * 
 * Demonstrates Syllabus Concepts:
 * - Array methods: filter(), sort(), slice(), splice(), push()
 * - Switch statements (sorting criteria)
 * - Higher-order functions & Arrow functions
 * - DOM manipulation & Element creation
 * - Form validation integration (FormValidator)
 * - Debouncing / real-time search input handling
 * - Modal workflows for Add, Edit, and Delete with custom confirm dialog
 * - Pagination logic (page slice calculations)
 */

const TransactionManager = {
  currentPage: 1,
  pageSize: 8,
  searchQuery: '',
  filterType: 'ALL',       // ALL | income | expense
  filterCategory: 'ALL',
  filterStartDate: '',
  filterEndDate: '',
  sortBy: 'date-desc',     // date-desc | date-asc | amount-desc | amount-asc
  editingTransactionId: null,

  async init() {
    this.populateCategoryFilter();
    this.bindEvents();
    if (typeof ApiService !== 'undefined' && ApiService.isAuthenticated()) {
      try {
        const serverTxs = await ApiService.getTransactions();
        if (Array.isArray(serverTxs)) {
          StorageService.saveTransactions(serverTxs);
        }
      } catch (err) {
        console.warn('Sync transactions failed:', err.message);
      }
    }
    this.render();
  },

  populateCategoryFilter() {
    const select = document.getElementById('filter-category');
    if (!select) return;

    const categories = StorageService.getCategories();
    select.innerHTML = '<option value="ALL">All Categories</option>';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.name;
      opt.textContent = cat.name;
      select.appendChild(opt);
    });

    // Also populate the form category dropdown
    const modalCatSelect = document.getElementById('tx-modal-category');
    if (modalCatSelect) {
      App.populateCategorySelect(modalCatSelect);
    }
  },

  bindEvents() {
    // Search input with instant filtering
    const searchInput = document.getElementById('tx-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim().toLowerCase();
        this.currentPage = 1;
        this.render();
      });
    }

    // Type filter tabs (All, Income, Expense)
    const typeButtons = document.querySelectorAll('.type-filter-btn');
    typeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        typeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filterType = btn.getAttribute('data-type');
        this.currentPage = 1;
        this.render();
      });
    });

    // Category filter
    const catSelect = document.getElementById('filter-category');
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        this.filterCategory = e.target.value;
        this.currentPage = 1;
        this.render();
      });
    }

    // Date range filters
    const startDateInput = document.getElementById('filter-start-date');
    const endDateInput = document.getElementById('filter-end-date');
    const resetDateBtn = document.getElementById('btn-reset-dates');

    if (startDateInput) {
      startDateInput.addEventListener('change', (e) => {
        this.filterStartDate = e.target.value;
        this.currentPage = 1;
        this.render();
      });
    }

    if (endDateInput) {
      endDateInput.addEventListener('change', (e) => {
        this.filterEndDate = e.target.value;
        this.currentPage = 1;
        this.render();
      });
    }

    if (resetDateBtn) {
      resetDateBtn.addEventListener('click', () => {
        if (startDateInput) startDateInput.value = '';
        if (endDateInput) endDateInput.value = '';
        this.filterStartDate = '';
        this.filterEndDate = '';
        this.currentPage = 1;
        this.render();
      });
    }

    // Sort select
    const sortSelect = document.getElementById('tx-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.sortBy = e.target.value;
        this.render();
      });
    }

    // Page size select
    const pageSizeSelect = document.getElementById('tx-page-size');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        this.pageSize = parseInt(e.target.value, 10);
        this.currentPage = 1;
        this.render();
      });
    }

    // Add Transaction Modal Trigger
    const openAddBtn = document.getElementById('btn-open-add-modal');
    if (openAddBtn) {
      openAddBtn.addEventListener('click', () => {
        this.openTransactionModal(null);
      });
    }

    // Transaction Modal Close & Cancel
    const modal = document.getElementById('tx-crud-modal');
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

    // Modal Form Submission (Add or Edit)
    const form = document.getElementById('tx-crud-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFormSubmit();
      });
    }

    // Listen for data changes from Quick Add
    window.addEventListener('transactionDataChanged', () => {
      this.render();
    });
  },

  /**
   * Filter and Sort Transactions
   */
  getFilteredTransactions() {
    let transactions = StorageService.getTransactions();

    // 1. Filter by Search Query (Description)
    if (this.searchQuery) {
      transactions = transactions.filter(t =>
        (t.description || '').toLowerCase().includes(this.searchQuery)
      );
    }

    // 2. Filter by Type (Income / Expense)
    if (this.filterType !== 'ALL') {
      transactions = transactions.filter(t => t.type === this.filterType);
    }

    // 3. Filter by Category
    if (this.filterCategory !== 'ALL') {
      transactions = transactions.filter(t =>
        (t.category || '').toLowerCase() === this.filterCategory.toLowerCase()
      );
    }

    // 4. Filter by Date Range
    if (this.filterStartDate) {
      transactions = transactions.filter(t => t.date >= this.filterStartDate);
    }
    if (this.filterEndDate) {
      transactions = transactions.filter(t => t.date <= this.filterEndDate);
    }

    // 5. Sort Transactions using switch statement (Syllabus concept)
    transactions.sort((a, b) => {
      switch (this.sortBy) {
        case 'date-asc':
          return new Date(a.date) - new Date(b.date);
        case 'amount-desc':
          return parseFloat(b.amount) - parseFloat(a.amount);
        case 'amount-asc':
          return parseFloat(a.amount) - parseFloat(b.amount);
        case 'date-desc':
        default:
          return new Date(b.date) - new Date(a.date);
      }
    });

    return transactions;
  },

  /**
   * Render Transaction Table & Pagination
   */
  render() {
    const filtered = this.getFilteredTransactions();
    const totalCount = filtered.length;

    // Calculate pagination slices
    const totalPages = Math.ceil(totalCount / this.pageSize) || 1;
    if (this.currentPage > totalPages) this.currentPage = totalPages;

    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    // Demonstrating Array.prototype.slice
    const pageItems = filtered.slice(startIndex, endIndex);

    // Update summary counters
    const countDisplay = document.getElementById('tx-results-count');
    if (countDisplay) {
      countDisplay.textContent = `Showing ${filtered.length > 0 ? startIndex + 1 : 0}-${Math.min(endIndex, totalCount)} of ${totalCount} transactions`;
    }

    // Render Table Rows
    const tbody = document.getElementById('transactions-table-tbody');
    if (!tbody) return;

    if (pageItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              <div class="empty-state-icon">
                <i data-lucide="receipt"></i>
              </div>
              <h4>No transactions found</h4>
              <p>Try adjusting your search criteria, filters, or add a new transaction.</p>
              <button class="btn btn-primary" onclick="TransactionManager.openTransactionModal(null)">
                <i data-lucide="plus"></i> Add Transaction
              </button>
            </div>
          </td>
        </tr>
      `;
      App.initLucideIcons();
      this.renderPagination(totalPages);
      return;
    }

    const categories = StorageService.getCategories();
    let html = '';

    pageItems.forEach(tx => {
      const isIncome = tx.type === 'income';
      const catObj = categories.find(c => c.name.toLowerCase() === (tx.category || '').toLowerCase());
      const catColor = catObj ? catObj.color : '#94A3B8';
      const catIcon = catObj ? catObj.icon : (isIncome ? 'arrow-down-left' : 'arrow-up-right');

      html += `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <div class="cat-icon-badge" style="background-color:${catColor}15; color:${catColor};">
                <i data-lucide="${catIcon}" style="width:18px; height:18px;"></i>
              </div>
              <div>
                <strong style="color:var(--text-main); display:block;">${escapeHTML(tx.description)}</strong>
                <small style="color:var(--text-muted);">${formatDisplayDate(tx.date)}</small>
              </div>
            </div>
          </td>
          <td>
            <span class="badge ${isIncome ? 'badge-success' : 'badge-secondary'}">
              ${escapeHTML(tx.category)}
            </span>
          </td>
          <td>
            <span class="badge ${isIncome ? 'badge-success' : 'badge-danger'}">
              ${isIncome ? 'Income' : 'Expense'}
            </span>
          </td>
          <td style="color:var(--text-muted); font-size:0.85rem;">
            ${formatDisplayDate(tx.date)}
          </td>
          <td style="text-align: right; font-weight: 700;" class="${isIncome ? 'amount-income' : 'amount-expense'}">
            ${isIncome ? '+' : '-'}${formatCurrency(tx.amount)}
          </td>
          <td style="text-align: right;">
            <div style="display:inline-flex; gap:0.35rem;">
              <button class="btn-icon-only btn-sm" title="Edit" onclick="TransactionManager.openTransactionModal('${tx.id}')">
                <i data-lucide="edit-2" style="width:14px; height:14px;"></i>
              </button>
              <button class="btn-icon-only btn-sm" title="Delete" style="color:var(--danger);" onclick="TransactionManager.confirmDelete('${tx.id}')">
                <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    App.initLucideIcons();

    // Render Pagination Controls
    this.renderPagination(totalPages);
  },

  /**
   * Render Pagination Page Numbers and Prev/Next controls
   */
  renderPagination(totalPages) {
    const container = document.getElementById('tx-pagination-controls');
    if (!container) return;

    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = '';

    // Previous Button
    html += `
      <button class="btn btn-secondary btn-sm" ${this.currentPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="TransactionManager.goToPage(${this.currentPage - 1})">
        <i data-lucide="chevron-left" style="width:14px; height:14px;"></i>
      </button>
    `;

    // Loop through page numbers
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= this.currentPage - 1 && p <= this.currentPage + 1)) {
        html += `
          <button class="btn btn-sm ${p === this.currentPage ? 'btn-primary' : 'btn-secondary'}" onclick="TransactionManager.goToPage(${p})">
            ${p}
          </button>
        `;
      } else if (p === this.currentPage - 2 || p === this.currentPage + 2) {
        html += `<span style="padding:0 0.35rem; color:var(--text-muted);">...</span>`;
      }
    }

    // Next Button
    html += `
      <button class="btn btn-secondary btn-sm" ${this.currentPage === totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="TransactionManager.goToPage(${this.currentPage + 1})">
        <i data-lucide="chevron-right" style="width:14px; height:14px;"></i>
      </button>
    `;

    container.innerHTML = html;
    App.initLucideIcons();
  },

  goToPage(page) {
    this.currentPage = page;
    this.render();
  },

  /**
   * Open Modal in Add or Edit Mode
   */
  openTransactionModal(transactionId = null) {
    const modal = document.getElementById('tx-crud-modal');
    const form = document.getElementById('tx-crud-form');
    const titleEl = document.getElementById('tx-modal-title');
    if (!modal || !form) return;

    FormValidator.clearFormErrors(form);
    this.editingTransactionId = transactionId;

    if (transactionId) {
      // Edit Mode
      titleEl.textContent = 'Edit Transaction';
      const transactions = StorageService.getTransactions();
      const tx = transactions.find(t => t.id === transactionId);
      if (!tx) return;

      // Populate form fields
      const typeRadio = form.querySelector(`input[name="tx-type"][value="${tx.type}"]`);
      if (typeRadio) typeRadio.checked = true;

      document.getElementById('tx-modal-amount').value = tx.amount;
      document.getElementById('tx-modal-category').value = tx.category;
      document.getElementById('tx-modal-date').value = tx.date;
      document.getElementById('tx-modal-description').value = tx.description;
    } else {
      // Add Mode
      titleEl.textContent = 'Add New Transaction';
      form.reset();
      const expenseRadio = form.querySelector('input[name="tx-type"][value="expense"]');
      if (expenseRadio) expenseRadio.checked = true;
      document.getElementById('tx-modal-date').value = new Date().toISOString().split('T')[0];
    }

    modal.classList.add('active');
  },

  /**
   * Validate and Submit Add/Edit Form
   */
  handleFormSubmit() {
    const form = document.getElementById('tx-crud-form');
    const typeRadio = form.querySelector('input[name="tx-type"]:checked');
    const type = typeRadio ? typeRadio.value : 'expense';
    const amountInput = document.getElementById('tx-modal-amount');
    const catSelect = document.getElementById('tx-modal-category');
    const dateInput = document.getElementById('tx-modal-date');
    const descInput = document.getElementById('tx-modal-description');

    // Perform validation using FormValidator
    let isValid = true;
    if (!FormValidator.validatePositiveNumber(amountInput, 'Amount')) isValid = false;
    if (!FormValidator.validateRequired(catSelect, 'Category')) isValid = false;
    if (!FormValidator.validateRequired(dateInput, 'Date')) isValid = false;
    if (!FormValidator.validateRequired(descInput, 'Description')) isValid = false;

    if (!isValid) return;

    const txData = {
      type,
      amount: parseFloat(amountInput.value),
      category: catSelect.value,
      date: dateInput.value,
      description: descInput.value.trim()
    };

    if (this.editingTransactionId) {
      // Update existing
      ApiService.updateTransaction(this.editingTransactionId, txData).then(() => {
        showToast('Transaction updated successfully!', 'success');
        document.getElementById('tx-crud-modal').classList.remove('active');
        this.render();
      }).catch(err => {
        showToast('Error updating: ' + err.message, 'danger');
      });
    } else {
      // Create new
      ApiService.createTransaction(txData).then(() => {
        showToast('Transaction added successfully!', 'success');
        document.getElementById('tx-crud-modal').classList.remove('active');
        this.render();
      }).catch(err => {
        showToast('Error creating: ' + err.message, 'danger');
      });
    }
  },

  /**
   * Delete transaction with confirmation modal
   */
  confirmDelete(transactionId) {
    showConfirmModal({
      title: 'Delete Transaction',
      message: 'Are you sure you want to permanently delete this transaction? This action will adjust your balance and budget calculations.',
      confirmText: 'Delete',
      confirmClass: 'btn-danger',
      onConfirm: () => {
        ApiService.deleteTransaction(transactionId).then(() => {
          showToast('Transaction deleted successfully', 'info');
          this.render();
        }).catch(err => {
          showToast('Error deleting: ' + err.message, 'danger');
        });
      }
    });
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  TransactionManager.init();
});
