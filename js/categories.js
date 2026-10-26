/**
 * Categories Management Logic
 * Expense Tracker / Personal Finance Manager
 * 
 * Demonstrates Syllabus Concepts:
 * - Objects, nested objects, and arrays
 * - Higher-order functions: map(), filter(), reduce()
 * - Array methods: push(), find()
 * - Form validation
 * - Dynamic color styling and Lucide icon rendering
 */

const CategoryManager = {
  init() {
    this.bindEvents();
    this.render();
  },

  bindEvents() {
    const openAddBtn = document.getElementById('btn-open-cat-modal');
    const modal = document.getElementById('category-modal');
    if (!modal) return;

    const closeBtn = modal.querySelector('.modal-close-btn');
    const cancelBtn = modal.querySelector('.btn-modal-cancel');
    const closeModal = () => modal.classList.remove('active');

    if (openAddBtn) {
      openAddBtn.addEventListener('click', () => {
        FormValidator.clearFormErrors(document.getElementById('category-form'));
        document.getElementById('category-form').reset();
        modal.classList.add('active');
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    const form = document.getElementById('category-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFormSubmit();
      });
    }

    // Type filter tabs (All, Income, Expense)
    const typeButtons = document.querySelectorAll('.cat-type-filter');
    typeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        typeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.render(btn.getAttribute('data-type'));
      });
    });
  },

  render(filterType = 'ALL') {
    const categories = StorageService.getCategories();
    const transactions = StorageService.getTransactions();

    const filtered = filterType === 'ALL'
      ? categories
      : categories.filter(c => c.type === filterType);

    const container = document.getElementById('categories-grid');
    if (!container) return;

    let html = '';
    filtered.forEach(cat => {
      // Calculate transaction count and total volume for this category
      const catTxs = transactions.filter(t => (t.category || '').toLowerCase() === cat.name.toLowerCase());
      const txCount = catTxs.length;
      const totalAmount = catTxs.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
      const isIncome = cat.type === 'income';

      html += `
        <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:1rem; margin-bottom:1rem;">
            <div class="cat-icon-badge" style="width:48px; height:48px; background-color:${cat.color}15; color:${cat.color};">
              <i data-lucide="${cat.icon || 'tag'}" style="width:24px; height:24px;"></i>
            </div>
            <div>
              <h4 style="font-size:1.1rem; font-weight:700; color:var(--text-main); margin-bottom:2px;">${escapeHTML(cat.name)}</h4>
              <span class="badge ${isIncome ? 'badge-success' : 'badge-secondary'}">
                ${isIncome ? 'Income Source' : 'Expense Category'}
              </span>
            </div>
          </div>

          <div style="background-color:var(--bg-surface-alt); padding:0.85rem 1rem; border-radius:var(--radius-md); border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Recorded Transactions</span>
              <strong style="font-size:0.95rem; color:var(--text-main);">${txCount} entries</strong>
            </div>
            <div style="text-align:right;">
              <span style="font-size:0.75rem; color:var(--text-muted); display:block;">Total Volume</span>
              <strong class="${isIncome ? 'amount-income' : 'amount-expense'}" style="font-size:0.95rem;">
                ${isIncome ? '+' : '-'}${formatCurrency(totalAmount)}
              </strong>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
    App.initLucideIcons();
  },

  handleFormSubmit() {
    const nameInput = document.getElementById('cat-modal-name');
    const typeSelect = document.getElementById('cat-modal-type');
    const colorInput = document.getElementById('cat-modal-color');
    const iconSelect = document.getElementById('cat-modal-icon');

    let isValid = true;
    if (!FormValidator.validateRequired(nameInput, 'Category Name')) isValid = false;

    if (!isValid) return;

    const name = nameInput.value.trim();
    const type = typeSelect.value;
    const color = colorInput.value || '#6366F1';
    const icon = iconSelect.value || 'tag';

    // Duplicate check
    const existing = StorageService.getCategories().find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      FormValidator.showFieldError(nameInput, `Category "${name}" already exists.`);
      return;
    }

    StorageService.addCategory({
      name,
      type,
      color,
      icon
    });

    showToast(`Category "${name}" added successfully!`, 'success');
    document.getElementById('category-modal').classList.remove('active');
    this.render();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  CategoryManager.init();
});
