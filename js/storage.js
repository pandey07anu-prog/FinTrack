/**
 * Storage Service Module - Expense Tracker / Personal Finance Manager
 * Manages LocalStorage & SessionStorage persistence with realistic demo datasets.
 * 
 * Demonstrates Syllabus Concepts:
 * - var, let, const declarations
 * - LocalStorage & SessionStorage APIs
 * - JSON serialization (JSON.stringify, JSON.parse)
 * - Array methods (push, splice, filter, findIndex, map)
 * - Object destructuring & Spread syntax
 * - Error handling with try...catch
 * - Data type conversions
 */

// Legacy 'var' demonstration for syllabus requirements (scoped configuration)
var APP_DB_VERSION = '1.0.0';

// Constants for storage keys
const STORAGE_KEYS = {
  TRANSACTIONS: 'expense_tracker_transactions',
  BUDGETS: 'expense_tracker_budgets',
  CATEGORIES: 'expense_tracker_categories',
  RECURRING: 'expense_tracker_recurring',
  SETTINGS: 'expense_tracker_settings',
  SESSION_USER: 'expense_tracker_session_user'
};

// Default Categories with fintech color themes and Lucide icon names
const DEFAULT_CATEGORIES = [
  { id: 'cat_salary', name: 'Salary', type: 'income', icon: 'wallet', color: '#10B981' },
  { id: 'cat_freelance', name: 'Freelance', type: 'income', icon: 'laptop', color: '#0EA5E9' },
  { id: 'cat_investments', name: 'Investments', type: 'income', icon: 'trending-up', color: '#8B5CF6' },
  { id: 'cat_food', name: 'Food', type: 'expense', icon: 'utensils', color: '#F97316' },
  { id: 'cat_shopping', name: 'Shopping', type: 'expense', icon: 'shopping-bag', color: '#EC4899' },
  { id: 'cat_transport', name: 'Transport', type: 'expense', icon: 'car', color: '#3B82F6' },
  { id: 'cat_education', name: 'Education', type: 'expense', icon: 'graduation-cap', color: '#6366F1' },
  { id: 'cat_healthcare', name: 'Healthcare', type: 'expense', icon: 'heart-pulse', color: '#EF4444' },
  { id: 'cat_entertainment', name: 'Entertainment', type: 'expense', icon: 'film', color: '#A855F7' },
  { id: 'cat_rent', name: 'Rent', type: 'expense', icon: 'home', color: '#64748B' },
  { id: 'cat_bills', name: 'Bills', type: 'expense', icon: 'zap', color: '#EAB308' },
  { id: 'cat_other', name: 'Other', type: 'expense', icon: 'more-horizontal', color: '#94A3B8' }
];

// Helper to get formatted dates relative to today
function getDateString(dayOffset = 0, targetMonthOffset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + targetMonthOffset);
  d.setDate(d.getDate() + dayOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Generate Realistic Initial Demo Dataset
function getDemoDataset() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  const transactions = [
    // Current Month Income
    { id: 'tx_101', type: 'income', amount: 65000, category: 'Salary', date: getDateString(-20), description: 'Monthly Tech Salary - Infosys Ltd', createdAt: new Date().toISOString() },
    { id: 'tx_102', type: 'income', amount: 14500, category: 'Freelance', date: getDateString(-10), description: 'UI Design project for Web Client', createdAt: new Date().toISOString() },
    { id: 'tx_103', type: 'income', amount: 3200, category: 'Investments', date: getDateString(-5), description: 'Mutual Fund Dividend Payout', createdAt: new Date().toISOString() },

    // Current Month Expenses
    { id: 'tx_201', type: 'expense', amount: 16000, category: 'Rent', date: getDateString(-22), description: 'Apartment Monthly Rent', createdAt: new Date().toISOString() },
    { id: 'tx_202', type: 'expense', amount: 3850, category: 'Bills', date: getDateString(-18), description: 'Electricity & Broadband Bill', createdAt: new Date().toISOString() },
    { id: 'tx_203', type: 'expense', amount: 6420, category: 'Food', date: getDateString(-15), description: 'Supermarket Grocery & Dairy Supplies', createdAt: new Date().toISOString() },
    { id: 'tx_204', type: 'expense', amount: 1450, category: 'Food', date: getDateString(-12), description: 'Weekend Dinner with College Friends', createdAt: new Date().toISOString() },
    { id: 'tx_205', type: 'expense', amount: 2100, category: 'Transport', date: getDateString(-8), description: 'Fuel & Metro Smart Card Recharge', createdAt: new Date().toISOString() },
    { id: 'tx_206', type: 'expense', amount: 4890, category: 'Shopping', date: getDateString(-6), description: 'Sneakers & Casual Wear from Myntra', createdAt: new Date().toISOString() },
    { id: 'tx_207', type: 'expense', amount: 1200, category: 'Entertainment', date: getDateString(-3), description: 'IMAX Movie Tickets & Popcorn', createdAt: new Date().toISOString() },
    { id: 'tx_208', type: 'expense', amount: 850, category: 'Healthcare', date: getDateString(-1), description: 'Pharmacy Vitamins & Health Checkup', createdAt: new Date().toISOString() },
    { id: 'tx_209', type: 'expense', amount: 950, category: 'Food', date: getDateString(0), description: 'Zomato Lunch Delivery', createdAt: new Date().toISOString() },

    // Previous Month Transactions for Reports & Trend comparison
    { id: 'tx_301', type: 'income', amount: 65000, category: 'Salary', date: getDateString(-50), description: 'Monthly Tech Salary - Infosys Ltd', createdAt: new Date().toISOString() },
    { id: 'tx_302', type: 'income', amount: 11000, category: 'Freelance', date: getDateString(-45), description: 'Logo & Graphic Design Work', createdAt: new Date().toISOString() },
    { id: 'tx_303', type: 'expense', amount: 16000, category: 'Rent', date: getDateString(-52), description: 'Apartment Monthly Rent', createdAt: new Date().toISOString() },
    { id: 'tx_304', type: 'expense', amount: 7200, category: 'Food', date: getDateString(-48), description: 'Monthly Groceries & Dining', createdAt: new Date().toISOString() },
    { id: 'tx_305', type: 'expense', amount: 3500, category: 'Bills', date: getDateString(-46), description: 'Utility Bills', createdAt: new Date().toISOString() },
    { id: 'tx_306', type: 'expense', amount: 2800, category: 'Transport', date: getDateString(-42), description: 'Cab rides & Fuel', createdAt: new Date().toISOString() },
    { id: 'tx_307', type: 'expense', amount: 5600, category: 'Shopping', date: getDateString(-38), description: 'Electronics accessory and books', createdAt: new Date().toISOString() }
  ];

  // Budget limits configured to showcase Normal (<80%), Warning (>=80%), and Exceeded (>=100%)
  const budgets = [
    { id: 'bg_1', category: 'Rent', limitAmount: 16000, month: currentMonth, year: currentYear },
    { id: 'bg_2', category: 'Food', limitAmount: 9000, month: currentMonth, year: currentYear }, // Spent: 6420+1450+950 = 8820 (98% -> Warning)
    { id: 'bg_3', category: 'Bills', limitAmount: 3500, month: currentMonth, year: currentYear }, // Spent: 3850 (110% -> Exceeded!)
    { id: 'bg_4', category: 'Shopping', limitAmount: 6000, month: currentMonth, year: currentYear }, // Spent: 4890 (81.5% -> Warning)
    { id: 'bg_5', category: 'Transport', limitAmount: 3500, month: currentMonth, year: currentYear }, // Spent: 2100 (60% -> Healthy)
    { id: 'bg_6', category: 'Entertainment', limitAmount: 2500, month: currentMonth, year: currentYear }, // Spent: 1200 (48% -> Healthy)
    { id: 'bg_7', category: 'Healthcare', limitAmount: 2000, month: currentMonth, year: currentYear }
  ];

  const recurringRules = [
    {
      id: 'rec_1',
      type: 'income',
      amount: 65000,
      category: 'Salary',
      description: 'Monthly Tech Salary',
      frequency: 'monthly',
      startDate: `${currentYear}-01-01`,
      nextDueDate: getDateString(5),
      active: true
    },
    {
      id: 'rec_2',
      type: 'expense',
      amount: 16000,
      category: 'Rent',
      description: 'Apartment Monthly Rent',
      frequency: 'monthly',
      startDate: `${currentYear}-01-05`,
      nextDueDate: getDateString(8),
      active: true
    },
    {
      id: 'rec_3',
      type: 'expense',
      amount: 699,
      category: 'Entertainment',
      description: 'Netflix 4K Subscription',
      frequency: 'monthly',
      startDate: `${currentYear}-02-15`,
      nextDueDate: getDateString(1),
      active: true
    },
    {
      id: 'rec_4',
      type: 'expense',
      amount: 50,
      category: 'Bills',
      description: 'Daily Cloud Backup Service',
      frequency: 'daily',
      startDate: getDateString(-2),
      nextDueDate: getDateString(0), // Due today!
      active: true
    }
  ];

  const settings = {
    currency: 'INR',
    currencySymbol: '₹',
    theme: 'light',
    userName: 'Aarav Patel',
    userEmail: 'aarav.patel@student.college.edu',
    monthlySavingsGoal: 25000,
    notificationEnabled: true
  };

  return { transactions, budgets, recurringRules, categories: DEFAULT_CATEGORIES, settings };
}

/**
 * Storage API Interface
 */
const StorageService = {
  // Initialization: seeds initial demo data if storage is empty
  init() {
    try {
      if (!localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) {
        this.resetToDemoData();
      } else {
        // Ensure categories exist
        if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
          this.saveCategories(DEFAULT_CATEGORIES);
        }
      }
    } catch (e) {
      console.error('LocalStorage initialization error:', e);
    }
  },

  // Reset all stores to the pre-populated demo data
  resetToDemoData() {
    const demo = getDemoDataset();
    this.saveTransactions(demo.transactions);
    this.saveBudgets(demo.budgets);
    this.saveRecurringRules(demo.recurringRules);
    this.saveCategories(demo.categories);
    this.saveSettings(demo.settings);
    return demo;
  },

  // Clear all data
  clearAllData() {
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
    localStorage.removeItem(STORAGE_KEYS.BUDGETS);
    localStorage.removeItem(STORAGE_KEYS.RECURRING);
    // Keep default categories & settings intact or reseed
    this.saveTransactions([]);
    this.saveBudgets([]);
    this.saveRecurringRules([]);
  },

  // --- Transactions ---
  getTransactions() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.error('Error reading transactions from localStorage:', err);
      return [];
    }
  },

  saveTransactions(transactions) {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  },

  addTransaction(transaction) {
    const transactions = this.getTransactions();
    // Generate unique ID
    const newTx = {
      ...transaction,
      id: 'tx_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      amount: parseFloat(transaction.amount),
      createdAt: new Date().toISOString()
    };
    transactions.unshift(newTx); // Place latest at beginning
    this.saveTransactions(transactions);
    return newTx;
  },

  updateTransaction(updatedTransaction) {
    const transactions = this.getTransactions();
    const index = transactions.findIndex(t => t.id === updatedTransaction.id);
    if (index !== -1) {
      transactions[index] = {
        ...transactions[index],
        ...updatedTransaction,
        amount: parseFloat(updatedTransaction.amount)
      };
      this.saveTransactions(transactions);
      return transactions[index];
    }
    return null;
  },

  deleteTransaction(id) {
    let transactions = this.getTransactions();
    const initialLen = transactions.length;
    transactions = transactions.filter(t => t.id !== id);
    if (transactions.length !== initialLen) {
      this.saveTransactions(transactions);
      return true;
    }
    return false;
  },

  // --- Budgets ---
  getBudgets() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BUDGETS);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.error('Error reading budgets:', err);
      return [];
    }
  },

  saveBudgets(budgets) {
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
  },

  addBudget(budget) {
    const budgets = this.getBudgets();
    const newBudget = {
      ...budget,
      id: 'bg_' + Date.now(),
      limitAmount: parseFloat(budget.limitAmount),
      month: parseInt(budget.month, 10),
      year: parseInt(budget.year, 10)
    };
    budgets.push(newBudget);
    this.saveBudgets(budgets);
    return newBudget;
  },

  updateBudget(updatedBudget) {
    const budgets = this.getBudgets();
    const index = budgets.findIndex(b => b.id === updatedBudget.id);
    if (index !== -1) {
      budgets[index] = {
        ...budgets[index],
        ...updatedBudget,
        limitAmount: parseFloat(updatedBudget.limitAmount),
        month: parseInt(updatedBudget.month, 10),
        year: parseInt(updatedBudget.year, 10)
      };
      this.saveBudgets(budgets);
      return budgets[index];
    }
    return null;
  },

  deleteBudget(id) {
    let budgets = this.getBudgets();
    budgets = budgets.filter(b => b.id !== id);
    this.saveBudgets(budgets);
    return true;
  },

  // --- Categories ---
  getCategories() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      return data ? JSON.parse(data) : DEFAULT_CATEGORIES;
    } catch (err) {
      return DEFAULT_CATEGORIES;
    }
  },

  saveCategories(categories) {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  },

  addCategory(category) {
    const categories = this.getCategories();
    const newCategory = {
      ...category,
      id: 'cat_' + Date.now()
    };
    categories.push(newCategory);
    this.saveCategories(categories);
    return newCategory;
  },

  // --- Recurring Rules ---
  getRecurringRules() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RECURRING);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      return [];
    }
  },

  saveRecurringRules(rules) {
    localStorage.setItem(STORAGE_KEYS.RECURRING, JSON.stringify(rules));
  },

  addRecurringRule(rule) {
    const rules = this.getRecurringRules();
    const newRule = {
      ...rule,
      id: 'rec_' + Date.now(),
      amount: parseFloat(rule.amount),
      active: true
    };
    rules.push(newRule);
    this.saveRecurringRules(rules);
    return newRule;
  },

  updateRecurringRule(updatedRule) {
    const rules = this.getRecurringRules();
    const index = rules.findIndex(r => r.id === updatedRule.id);
    if (index !== -1) {
      rules[index] = {
        ...rules[index],
        ...updatedRule,
        amount: parseFloat(updatedRule.amount)
      };
      this.saveRecurringRules(rules);
      return rules[index];
    }
    return null;
  },

  deleteRecurringRule(id) {
    let rules = this.getRecurringRules();
    rules = rules.filter(r => r.id !== id);
    this.saveRecurringRules(rules);
    return true;
  },

  // --- Settings ---
  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (data) return JSON.parse(data);
    } catch (e) {}
    return {
      currency: 'INR',
      currencySymbol: '₹',
      theme: 'light',
      userName: 'Aarav Patel',
      userEmail: 'aarav.patel@student.college.edu',
      monthlySavingsGoal: 25000,
      notificationEnabled: true
    };
  },

  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  // --- Session Storage Demo Auth ---
  getSessionUser() {
    try {
      const data = sessionStorage.getItem(STORAGE_KEYS.SESSION_USER);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  setSessionUser(userObj) {
    sessionStorage.setItem(STORAGE_KEYS.SESSION_USER, JSON.stringify(userObj));
  },

  clearSessionUser() {
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_USER);
  },

  // --- JSON Data Export & Import ---
  exportAllData() {
    const payload = {
      version: APP_DB_VERSION,
      exportedAt: new Date().toISOString(),
      transactions: this.getTransactions(),
      budgets: this.getBudgets(),
      categories: this.getCategories(),
      recurring: this.getRecurringRules(),
      settings: this.getSettings()
    };
    return JSON.stringify(payload, null, 2);
  },

  importData(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.transactions && Array.isArray(parsed.transactions)) {
        this.saveTransactions(parsed.transactions);
      }
      if (parsed.budgets && Array.isArray(parsed.budgets)) {
        this.saveBudgets(parsed.budgets);
      }
      if (parsed.categories && Array.isArray(parsed.categories)) {
        this.saveCategories(parsed.categories);
      }
      if (parsed.recurring && Array.isArray(parsed.recurring)) {
        this.saveRecurringRules(parsed.recurring);
      }
      if (parsed.settings) {
        this.saveSettings(parsed.settings);
      }
      return { success: true, count: parsed.transactions?.length || 0 };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

// Initialize on script load
StorageService.init();
