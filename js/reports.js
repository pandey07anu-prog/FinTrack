/**
 * Reports & Financial Analytics Logic
 * Expense Tracker / Personal Finance Manager
 * 
 * Demonstrates Syllabus Concepts:
 * - Dynamic calculations from stored transactions (income, expenses, net savings, savings rate)
 * - Higher-order functions: reduce(), filter(), map(), sort()
 * - while / do-while loop implementations for timeline generation
 * - CSV data export generation using Blob and URL.createObjectURL()
 * - Print handling (window.print())
 * - Multi-dataset Chart.js charts
 */

const ReportManager = {
  startDate: '',
  endDate: '',
  trendChartInstance: null,
  categoryChartInstance: null,

  init() {
    this.setDefaultDateRange();
    this.bindEvents();
    this.render();
  },

  // Default to past 6 months to current date
  setDefaultDateRange() {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 5);
    start.setDate(1);

    this.startDate = start.toISOString().split('T')[0];
    this.endDate = end.toISOString().split('T')[0];

    const startInput = document.getElementById('report-start-date');
    const endInput = document.getElementById('report-end-date');
    if (startInput) startInput.value = this.startDate;
    if (endInput) endInput.value = this.endDate;
  },

  bindEvents() {
    const startInput = document.getElementById('report-start-date');
    const endInput = document.getElementById('report-end-date');
    const applyBtn = document.getElementById('btn-apply-report-filter');
    const exportCsvBtn = document.getElementById('btn-export-csv');
    const printBtn = document.getElementById('btn-print-report');

    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        if (startInput) this.startDate = startInput.value;
        if (endInput) this.endDate = endInput.value;
        this.render();
      });
    }

    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => {
        this.exportTransactionsToCSV();
      });
    }

    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }

    // Refresh on transaction changes
    window.addEventListener('transactionDataChanged', () => {
      this.render();
    });
  },

  /**
   * Filter transactions falling in the selected date range
   */
  getFilteredTransactions() {
    const transactions = StorageService.getTransactions();
    return transactions.filter(t => {
      if (!t.date) return false;
      if (this.startDate && t.date < this.startDate) return false;
      if (this.endDate && t.date > this.endDate) return false;
      return true;
    });
  },

  /**
   * Render Master Reports
   */
  render() {
    const txs = this.getFilteredTransactions();

    // 1. Calculate Summary Metrics
    const totalIncome = txs
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    const totalExpense = txs
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    const netSavings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? ((netSavings / totalIncome) * 100).toFixed(1) : 0;

    // Update DOM summary cards
    const incomeEl = document.getElementById('rep-total-income');
    const expenseEl = document.getElementById('rep-total-expense');
    const balanceEl = document.getElementById('rep-net-savings');
    const rateEl = document.getElementById('rep-savings-rate');

    if (incomeEl) incomeEl.textContent = formatCurrency(totalIncome);
    if (expenseEl) expenseEl.textContent = formatCurrency(totalExpense);
    if (balanceEl) {
      balanceEl.textContent = formatCurrency(netSavings);
      balanceEl.className = netSavings >= 0 ? 'metric-value amount-income' : 'metric-value amount-expense';
    }
    if (rateEl) {
      rateEl.textContent = `${savingsRate}% savings rate`;
    }

    // 2. Render Charts
    this.renderTrendChart(txs);
    this.renderCategoryBreakdown(txs);

    // 3. Render Category Breakdown Table
    this.renderCategoryTable(txs, totalExpense);

    App.initLucideIcons();
  },

  /**
   * Render Monthly Comparison Bar Chart
   * Demonstrates while loop to build monthly timeline
   */
  renderTrendChart(filteredTxs) {
    const canvas = document.getElementById('report-trend-chart');
    if (!canvas || !window.Chart) return;

    // Group transactions by month
    const monthlyMap = {};

    filteredTxs.forEach(t => {
      if (!t.date) return;
      const key = t.date.substring(0, 7); // 'YYYY-MM'
      if (!monthlyMap[key]) {
        monthlyMap[key] = { income: 0, expense: 0 };
      }
      if (t.type === 'income') {
        monthlyMap[key].income += parseFloat(t.amount || 0);
      } else {
        monthlyMap[key].expense += parseFloat(t.amount || 0);
      }
    });

    const sortedMonths = Object.keys(monthlyMap).sort();
    const labels = [];
    const incomeData = [];
    const expenseData = [];

    // Demonstrating while loop for iterating through sorted months
    let idx = 0;
    while (idx < sortedMonths.length) {
      const mKey = sortedMonths[idx];
      const parts = mKey.split('-');
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
      labels.push(d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }));
      incomeData.push(monthlyMap[mKey].income);
      expenseData.push(monthlyMap[mKey].expense);
      idx++;
    }

    if (this.trendChartInstance) {
      this.trendChartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    this.trendChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Total Income',
            data: incomeData,
            backgroundColor: '#10B981',
            borderRadius: 6
          },
          {
            label: 'Total Expenses',
            data: expenseData,
            backgroundColor: '#EF4444',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                return `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(val) {
                return '₹' + (val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val);
              }
            }
          }
        }
      }
    });
  },

  /**
   * Render Category Doughnut Chart
   */
  renderCategoryBreakdown(filteredTxs) {
    const canvas = document.getElementById('report-category-chart');
    if (!canvas || !window.Chart) return;

    const expenses = filteredTxs.filter(t => t.type === 'expense');
    const catMap = {};

    // Group using forEach
    expenses.forEach(t => {
      catMap[t.category] = (catMap[t.category] || 0) + parseFloat(t.amount || 0);
    });

    const categories = StorageService.getCategories();
    const labels = Object.keys(catMap);
    const data = Object.values(catMap);
    const bgColors = labels.map(name => {
      const found = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
      return found ? found.color : '#94A3B8';
    });

    if (this.categoryChartInstance) {
      this.categoryChartInstance.destroy();
    }

    if (labels.length === 0) {
      canvas.style.display = 'none';
      return;
    } else {
      canvas.style.display = 'block';
    }

    const ctx = canvas.getContext('2d');
    this.categoryChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#111827' : '#FFFFFF'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10 } },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((ctx.raw / total) * 100).toFixed(1);
                return `${ctx.label}: ${formatCurrency(ctx.raw)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  },

  /**
   * Render Detailed Category Table
   */
  renderCategoryTable(filteredTxs, totalExpense) {
    const tbody = document.getElementById('report-category-tbody');
    if (!tbody) return;

    const expenses = filteredTxs.filter(t => t.type === 'expense');
    const catStats = {};

    expenses.forEach(t => {
      if (!catStats[t.category]) {
        catStats[t.category] = { count: 0, amount: 0 };
      }
      catStats[t.category].count++;
      catStats[t.category].amount += parseFloat(t.amount || 0);
    });

    const sortedCats = Object.keys(catStats).sort((a, b) => catStats[b].amount - catStats[a].amount);
    const categories = StorageService.getCategories();

    if (sortedCats.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center; padding:2rem; color:var(--text-muted);">
            No expense records in the selected period.
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    sortedCats.forEach(catName => {
      const stats = catStats[catName];
      const pct = totalExpense > 0 ? ((stats.amount / totalExpense) * 100).toFixed(1) : 0;
      const catObj = categories.find(c => c.name.toLowerCase() === catName.toLowerCase());
      const catColor = catObj ? catObj.color : '#6366F1';

      html += `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:0.6rem;">
              <span style="width:12px; height:12px; border-radius:50%; background-color:${catColor}; display:inline-block;"></span>
              <strong>${escapeHTML(catName)}</strong>
            </div>
          </td>
          <td>${stats.count} transactions</td>
          <td style="font-weight:600;">
            ${formatCurrency(stats.amount)}
          </td>
          <td style="text-align:right;">
            <span class="badge badge-secondary">${pct}%</span>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  /**
   * Export Filtered Transactions to CSV format
   * Demonstrates Blob, URL.createObjectURL, and programmatic link click
   */
  exportTransactionsToCSV() {
    const txs = this.getFilteredTransactions();
    if (txs.length === 0) {
      showToast('No transactions found to export.', 'warning');
      return;
    }

    // CSV Headers
    const headers = ['ID', 'Type', 'Amount (INR)', 'Category', 'Date', 'Description'];
    const rows = txs.map(t => [
      `"${t.id}"`,
      `"${t.type}"`,
      t.amount,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      `"${t.date}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `financial_report_${this.startDate}_to_${this.endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Financial report exported to CSV successfully!', 'success');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  ReportManager.init();
});
