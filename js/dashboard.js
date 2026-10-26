/**
 * Dashboard Logic - Expense Tracker / Personal Finance Manager
 * 
 * Demonstrates Syllabus Concepts:
 * - Dynamic calculations (no hardcoding)
 * - Higher-order functions: filter(), reduce(), map(), sort(), slice(), forEach()
 * - Objects, object destructuring, and computed properties
 * - Date manipulation and type conversions
 * - DOM manipulation and conditional styling
 * - Chart.js data visualization integration
 * - Event handling (change, custom event 'transactionDataChanged')
 */

// Module state
const Dashboard = {
  selectedMonth: new Date().getMonth() + 1, // 1 to 12
  selectedYear: new Date().getFullYear(),
  incomeExpenseChartInstance: null,
  categoryChartInstance: null,

  async init() {
    this.populateDateFilters();
    this.bindEvents();
    if (typeof ApiService !== 'undefined' && ApiService.isAuthenticated()) {
      try {
        const serverTxs = await ApiService.getTransactions();
        if (Array.isArray(serverTxs)) {
          StorageService.saveTransactions(serverTxs);
          this.populateDateFilters();
        }
      } catch (err) {
        console.warn('Sync transactions failed:', err.message);
      }
    }
    this.render();
  },

  // Populate Month and Year dropdowns
  populateDateFilters() {
    const monthSelect = document.getElementById('dash-month-select');
    const yearSelect = document.getElementById('dash-year-select');

    if (!monthSelect || !yearSelect) return;

    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    monthSelect.innerHTML = '';
    // Demonstrating 'for' loop and array indexing
    for (let i = 0; i < months.length; i++) {
      const opt = document.createElement('option');
      opt.value = i + 1;
      opt.textContent = months[i];
      if (i + 1 === this.selectedMonth) opt.selected = true;
      monthSelect.appendChild(opt);
    }

    // Populate years based on transactions + current year
    const transactions = StorageService.getTransactions();
    const yearsSet = new Set([this.selectedYear]);
    
    // Demonstrating for...of loop
    for (const tx of transactions) {
      if (tx.date) {
        const yr = parseInt(tx.date.split('-')[0], 10);
        if (!isNaN(yr)) yearsSet.add(yr);
      }
    }

    yearSelect.innerHTML = '';
    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
    sortedYears.forEach(year => {
      const opt = document.createElement('option');
      opt.value = year;
      opt.textContent = year;
      if (year === this.selectedYear) opt.selected = true;
      yearSelect.appendChild(opt);
    });
  },

  bindEvents() {
    const monthSelect = document.getElementById('dash-month-select');
    const yearSelect = document.getElementById('dash-year-select');

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

    // Auto-update dashboard when transactions change (from quick add or other tabs)
    window.addEventListener('transactionDataChanged', () => {
      this.populateDateFilters();
      this.render();
    });
  },

  // Master render method
  render() {
    const transactions = StorageService.getTransactions();

    // 1. Calculate and update summary metrics
    this.updateMetrics(transactions);

    // 2. Render Charts
    this.renderIncomeExpenseChart(transactions);
    this.renderCategoryChart(transactions);

    // 3. Render Budget Progress List
    this.renderBudgetProgress(transactions);

    // 4. Render Recent Transactions Table
    this.renderRecentTransactions(transactions);

    // Refresh icons
    App.initLucideIcons();
  },

  /**
   * Calculate financial figures dynamically:
   * - Total Balance (All-time Income minus All-time Expense)
   * - Monthly Income (Selected Month)
   * - Monthly Expense (Selected Month)
   * - Monthly Savings & Savings Rate
   */
  updateMetrics(transactions) {
    // All-time totals using reduce
    const allTimeIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    const allTimeExpense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    const totalBalance = allTimeIncome - allTimeExpense;

    // Filter current selected month's transactions
    const monthlyTransactions = transactions.filter(t => {
      if (!t.date) return false;
      const parts = t.date.split('-');
      const tYear = parseInt(parts[0], 10);
      const tMonth = parseInt(parts[1], 10);
      return tYear === this.selectedYear && tMonth === this.selectedMonth;
    });

    const monthlyIncome = monthlyTransactions
      .filter(t => t.type === 'income')
      .reduce((acc, t) => acc + parseFloat(t.amount || 0), 0);

    const monthlyExpense = monthlyTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => acc + parseFloat(t.amount || 0), 0);

    const monthlySavings = monthlyIncome - monthlyExpense;
    const savingsRate = monthlyIncome > 0 ? ((monthlySavings / monthlyIncome) * 100).toFixed(1) : 0;

    // Update DOM elements
    const totalBalanceEl = document.getElementById('metric-total-balance');
    const monthlyIncomeEl = document.getElementById('metric-monthly-income');
    const monthlyExpenseEl = document.getElementById('metric-monthly-expense');
    const monthlySavingsEl = document.getElementById('metric-monthly-savings');
    const savingsRateEl = document.getElementById('metric-savings-rate');

    if (totalBalanceEl) totalBalanceEl.textContent = formatCurrency(totalBalance);
    if (monthlyIncomeEl) monthlyIncomeEl.textContent = formatCurrency(monthlyIncome);
    if (monthlyExpenseEl) monthlyExpenseEl.textContent = formatCurrency(monthlyExpense);
    if (monthlySavingsEl) {
      monthlySavingsEl.textContent = formatCurrency(monthlySavings);
      // Toggle color based on positive or negative savings
      if (monthlySavings >= 0) {
        monthlySavingsEl.className = 'metric-value amount-income';
      } else {
        monthlySavingsEl.className = 'metric-value amount-expense';
      }
    }
    if (savingsRateEl) {
      savingsRateEl.textContent = `${savingsRate}% of income saved`;
    }
  },

  /**
   * Monthly Income vs Expense Comparison Chart (Past 6 Months)
   */
  renderIncomeExpenseChart(transactions) {
    const canvas = document.getElementById('chart-income-expense');
    if (!canvas || !window.Chart) return;

    // Generate past 6 months labels & data
    const labels = [];
    const incomeData = [];
    const expenseData = [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Loop backwards 5 months to current month (6 months total)
    for (let i = 5; i >= 0; i--) {
      const d = new Date(this.selectedYear, this.selectedMonth - 1 - i, 1);
      const mIdx = d.getMonth();
      const yr = d.getFullYear();
      labels.push(`${monthNames[mIdx]} ${yr.toString().slice(-2)}`);

      // Sum income and expenses for that specific month
      const monthTxs = transactions.filter(t => {
        if (!t.date) return false;
        const parts = t.date.split('-');
        return parseInt(parts[0], 10) === yr && parseInt(parts[1], 10) === (mIdx + 1);
      });

      const inc = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0);
      const exp = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0);

      incomeData.push(inc);
      expenseData.push(exp);
    }

    if (this.incomeExpenseChartInstance) {
      this.incomeExpenseChartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    this.incomeExpenseChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Income',
            data: incomeData,
            backgroundColor: '#10B981',
            borderRadius: 6,
            barPercentage: 0.6,
            categoryPercentage: 0.7
          },
          {
            label: 'Expenses',
            data: expenseData,
            backgroundColor: '#EF4444',
            borderRadius: 6,
            barPercentage: 0.6,
            categoryPercentage: 0.7
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              boxWidth: 12,
              font: { family: 'Plus Jakarta Sans', weight: 600 }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '₹' + (value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value);
              }
            }
          }
        }
      }
    });
  },

  /**
   * Category-wise Spending Doughnut Chart
   */
  renderCategoryChart(transactions) {
    const canvas = document.getElementById('chart-category-spending');
    if (!canvas || !window.Chart) return;

    // Filter current month's expenses
    const monthlyExpenses = transactions.filter(t => {
      if (t.type !== 'expense' || !t.date) return false;
      const parts = t.date.split('-');
      return parseInt(parts[0], 10) === this.selectedYear && parseInt(parts[1], 10) === this.selectedMonth;
    });

    // Group by category using reduce
    const categoryTotals = monthlyExpenses.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount);
      return acc;
    }, {});

    const categories = StorageService.getCategories();
    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);

    // Map category colors
    const backgroundColors = labels.map(catName => {
      const found = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
      return found ? found.color : '#94A3B8';
    });

    if (this.categoryChartInstance) {
      this.categoryChartInstance.destroy();
    }

    // Empty state container if no expense data
    const emptyNotice = document.getElementById('category-empty-notice');
    if (labels.length === 0) {
      canvas.style.display = 'none';
      if (emptyNotice) emptyNotice.style.display = 'flex';
      return;
    } else {
      canvas.style.display = 'block';
      if (emptyNotice) emptyNotice.style.display = 'none';
    }

    const ctx = canvas.getContext('2d');
    this.categoryChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: backgroundColors,
          borderWidth: 2,
          borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#111827' : '#FFFFFF'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              padding: 12,
              font: { family: 'Plus Jakarta Sans', size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percent = ((context.raw / total) * 100).toFixed(1);
                return `${context.label}: ${formatCurrency(context.raw)} (${percent}%)`;
              }
            }
          }
        }
      }
    });
  },

  /**
   * Budget Progress Cards with Warning (>=80%) and Exceeded (>=100%) states
   */
  renderBudgetProgress(transactions) {
    const container = document.getElementById('dashboard-budget-list');
    if (!container) return;

    const allBudgets = StorageService.getBudgets();
    // Filter active budgets for the selected month/year (or default fallback)
    const activeBudgets = allBudgets.filter(b => {
      if (!b.month || !b.year) return true;
      return b.month === this.selectedMonth && b.year === this.selectedYear;
    });

    if (activeBudgets.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 2rem 1rem; color:var(--text-muted); font-size:0.875rem;">
          <i data-lucide="piggy-bank" style="width:36px; height:36px; margin: 0 auto 0.5rem; display:block; opacity:0.5;"></i>
          No budgets configured for this month.
          <br><a href="budgets.html" class="btn btn-sm btn-primary" style="margin-top:0.75rem;">Create a Budget</a>
        </div>
      `;
      return;
    }

    // Filter current month expenses
    const monthlyExpenses = transactions.filter(t => {
      if (t.type !== 'expense' || !t.date) return false;
      const parts = t.date.split('-');
      return parseInt(parts[0], 10) === this.selectedYear && parseInt(parts[1], 10) === this.selectedMonth;
    });

    const categories = StorageService.getCategories();
    let html = '';

    // Show top 4 budgets on the dashboard
    activeBudgets.slice(0, 4).forEach(budget => {
      // Calculate spent for this category
      const spent = monthlyExpenses
        .filter(t => t.category.toLowerCase() === budget.category.toLowerCase())
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

      const limit = parseFloat(budget.limitAmount);
      const percent = limit > 0 ? (spent / limit) * 100 : 0;
      const roundedPercent = Math.min(Math.round(percent), 100);

      // Warning states
      let statusBadge = '<span class="badge badge-success">Healthy</span>';
      let fillClass = '';

      if (percent >= 100) {
        statusBadge = '<span class="badge badge-danger">Exceeded!</span>';
        fillClass = 'danger';
      } else if (percent >= 80) {
        statusBadge = '<span class="badge badge-warning">Near Limit (80%+)</span>';
        fillClass = 'warning';
      }

      const catObj = categories.find(c => c.name.toLowerCase() === budget.category.toLowerCase());
      const catColor = catObj ? catObj.color : '#6366F1';

      html += `
        <div class="budget-progress-item">
          <div class="budget-item-header">
            <div class="budget-category-label">
              <span style="width:10px; height:10px; border-radius:50%; background-color:${catColor}; display:inline-block;"></span>
              <span>${escapeHTML(budget.category)}</span>
            </div>
            <div>${statusBadge}</div>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${fillClass}" style="width: ${roundedPercent}%;"></div>
          </div>
          <div class="budget-item-footer">
            <span>Spent: <strong>${formatCurrency(spent)}</strong></span>
            <span>Limit: ${formatCurrency(limit)} (${percent.toFixed(0)}%)</span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  /**
   * Recent Transactions List on Dashboard
   */
  renderRecentTransactions(transactions) {
    const tbody = document.getElementById('recent-transactions-tbody');
    if (!tbody) return;

    if (transactions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; padding: 2rem; color:var(--text-muted);">
            No transactions found. Click "+ Quick Add" to record your first transaction!
          </td>
        </tr>
      `;
      return;
    }

    // Sort descending by date, then take top 5
    const recent = [...transactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    const categories = StorageService.getCategories();

    let html = '';
    recent.forEach(tx => {
      const isIncome = tx.type === 'income';
      const catObj = categories.find(c => c.name.toLowerCase() === tx.category.toLowerCase());
      const catColor = catObj ? catObj.color : '#94A3B8';
      const catIcon = catObj ? catObj.icon : (isIncome ? 'arrow-down-left' : 'arrow-up-right');

      html += `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <div class="cat-icon-badge" style="background-color: ${catColor}15; color: ${catColor};">
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
          <td style="text-align: right;" class="${isIncome ? 'amount-income' : 'amount-expense'}">
            ${isIncome ? '+' : '-'}${formatCurrency(tx.amount)}
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }
};

// Initialize Dashboard when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  Dashboard.init();
});
