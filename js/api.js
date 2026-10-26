/**
 * API Service Layer - Expense Tracker / Personal Finance Manager
 * 
 * Connects the frontend to the Node.js + Express + MongoDB Atlas backend
 * using asynchronous fetch(), Promises, async/await, and JSON.
 * 
 * Endpoints:
 * - POST   /api/auth/register            -> Register new user account
 * - POST   /api/auth/login               -> Authenticate and return JWT token
 * - GET    /api/auth/me                  -> Get authenticated user profile
 * - GET    /api/transactions             -> Fetch user transactions
 * - POST   /api/transactions             -> Create a new transaction
 * - PUT    /api/transactions/:id         -> Update an existing transaction
 * - DELETE /api/transactions/:id         -> Delete a transaction
 * - GET    /api/budgets                  -> Fetch budgets with live spending calculations
 * - POST   /api/budgets                  -> Create or update a budget limit
 * - PUT    /api/budgets/:id              -> Update budget limit
 * - DELETE /api/budgets/:id              -> Delete a budget
 * - GET    /api/reports/monthly          -> Compute monthly financial summary
 * - GET    /api/recurring                -> List recurring rules
 * - POST   /api/recurring                -> Add a recurring rule
 * - PUT    /api/recurring/:id            -> Update recurring rule
 * - DELETE /api/recurring/:id            -> Delete recurring rule
 * - POST   /api/recurring/generate       -> Trigger due transactions engine
 */

const API_CONFIG = {
  BASE_URL: 'http://localhost:5000/api',
  AUTH_TOKEN_KEY: 'expense_tracker_jwt_token',
  // When false, always routes to backend. Fallback activates only if network/server is completely unreachable.
  USE_LOCAL_STORAGE_MOCK: false
};

const ApiService = {
  /**
   * Helper to retrieve JWT Token for Authorization header
   */
  getToken() {
    return localStorage.getItem(API_CONFIG.AUTH_TOKEN_KEY);
  },

  setToken(token) {
    if (token) {
      localStorage.setItem(API_CONFIG.AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(API_CONFIG.AUTH_TOKEN_KEY);
    }
  },

  getAuthHeader() {
    const token = this.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  /**
   * Check backend health status
   */
  async checkHealth() {
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL.replace('/api', '')}/api/health`);
      if (res.ok) return await res.json();
      return null;
    } catch (e) {
      return null;
    }
  },

  // ==========================================================================
  // Authentication API
  // ==========================================================================

  async register({ name, email, password }) {
    if (API_CONFIG.USE_LOCAL_STORAGE_MOCK) {
      const demoUser = { name, email, token: 'mock-jwt-' + Date.now() };
      StorageService.setSessionUser(demoUser);
      return { user: demoUser, token: demoUser.token };
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const err = new Error(data.error || 'Registration failed');
        err.status = response.status;
        err.category = data.category;
        err.isDbError = response.status === 503;
        throw err;
      }

      if (data.token) this.setToken(data.token);
      if (data.user) StorageService.setSessionUser(data.user);
      return data;
    } catch (err) {
      if (!err.status && err.name === 'TypeError') {
        const netErr = new Error('Cannot connect to backend server at http://localhost:5000. Please ensure the backend is running.');
        netErr.isDbError = true;
        throw netErr;
      }
      throw err;
    }
  },

  async login({ email, password }) {
    if (API_CONFIG.USE_LOCAL_STORAGE_MOCK) {
      const demoUser = { name: email.split('@')[0], email, token: 'mock-jwt-' + Date.now() };
      StorageService.setSessionUser(demoUser);
      return { user: demoUser, token: demoUser.token };
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const err = new Error(data.error || 'Login failed');
        err.status = response.status;
        err.category = data.category;
        err.code = data.code;
        err.accountExists = data.accountExists;
        err.isDbError = response.status === 503;
        throw err;
      }

      if (data.token) this.setToken(data.token);
      if (data.user) StorageService.setSessionUser(data.user);
      return data;
    } catch (err) {
      if (!err.status && err.name === 'TypeError') {
        const netErr = new Error('Cannot connect to backend server at http://localhost:5000. Please ensure the backend is running.');
        netErr.isDbError = true;
        throw netErr;
      }
      throw err;
    }
  },

  async getMe() {
    if (!this.isAuthenticated()) return null;

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/me`, {
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        }
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.user;
    } catch (err) {
      return null;
    }
  },

  logout() {
    this.setToken(null);
    StorageService.clearSessionUser();
  },

  // ==========================================================================
  // Transactions API
  // ==========================================================================

  async getTransactions(filters = {}) {
    if (API_CONFIG.USE_LOCAL_STORAGE_MOCK || !this.isAuthenticated()) {
      return Promise.resolve(StorageService.getTransactions());
    }

    try {
      const params = new URLSearchParams();
      if (filters.type && filters.type !== 'ALL') params.append('type', filters.type);
      if (filters.category && filters.category !== 'ALL') params.append('category', filters.category);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.search) params.append('search', filters.search);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`${API_CONFIG.BASE_URL}/transactions${qs}`, {
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        }
      });

      if (response.status === 503) {
        // Fallback to local data gracefully if DB not connected
        return StorageService.getTransactions();
      }

      if (!response.ok) throw new Error('Failed to fetch transactions from server');
      return await response.json();
    } catch (err) {
      console.warn('Backend unavailable, using local transactions:', err.message);
      return StorageService.getTransactions();
    }
  },

  async createTransaction(transactionData) {
    if (API_CONFIG.USE_LOCAL_STORAGE_MOCK || !this.isAuthenticated()) {
      return Promise.resolve(StorageService.addTransaction(transactionData));
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        },
        body: JSON.stringify(transactionData)
      });

      if (response.status === 503) {
        return StorageService.addTransaction(transactionData);
      }

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create transaction');
      }

      const created = await response.json();
      // Sync local store
      StorageService.addTransaction(created);
      return created;
    } catch (err) {
      return StorageService.addTransaction(transactionData);
    }
  },

  async updateTransaction(id, updatedData) {
    if (API_CONFIG.USE_LOCAL_STORAGE_MOCK || !this.isAuthenticated()) {
      return Promise.resolve(StorageService.updateTransaction({ id, ...updatedData }));
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/transactions/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        },
        body: JSON.stringify(updatedData)
      });

      if (!response.ok) {
        return StorageService.updateTransaction({ id, ...updatedData });
      }

      const updated = await response.json();
      StorageService.updateTransaction(updated);
      return updated;
    } catch (err) {
      return StorageService.updateTransaction({ id, ...updatedData });
    }
  },

  async deleteTransaction(id) {
    if (API_CONFIG.USE_LOCAL_STORAGE_MOCK || !this.isAuthenticated()) {
      return Promise.resolve(StorageService.deleteTransaction(id));
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/transactions/${id}`, {
        method: 'DELETE',
        headers: { ...this.getAuthHeader() }
      });
      StorageService.deleteTransaction(id);
      return response.ok;
    } catch (err) {
      return StorageService.deleteTransaction(id);
    }
  },

  // ==========================================================================
  // Budgets API
  // ==========================================================================

  async getBudgets(month = null, year = null) {
    if (API_CONFIG.USE_LOCAL_STORAGE_MOCK || !this.isAuthenticated()) {
      return Promise.resolve(StorageService.getBudgets());
    }

    try {
      const params = new URLSearchParams();
      if (month) params.append('month', month);
      if (year) params.append('year', year);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`${API_CONFIG.BASE_URL}/budgets${qs}`, {
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        }
      });

      if (!response.ok) return StorageService.getBudgets();
      return await response.json();
    } catch (err) {
      return StorageService.getBudgets();
    }
  },

  async saveBudget(budgetData) {
    if (API_CONFIG.USE_LOCAL_STORAGE_MOCK || !this.isAuthenticated()) {
      if (budgetData.id) return StorageService.updateBudget(budgetData);
      return StorageService.addBudget(budgetData);
    }

    try {
      const method = budgetData.id ? 'PUT' : 'POST';
      const url = budgetData.id ? `${API_CONFIG.BASE_URL}/budgets/${budgetData.id}` : `${API_CONFIG.BASE_URL}/budgets`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        },
        body: JSON.stringify(budgetData)
      });

      if (!response.ok) {
        if (budgetData.id) return StorageService.updateBudget(budgetData);
        return StorageService.addBudget(budgetData);
      }

      const saved = await response.json();
      if (budgetData.id) StorageService.updateBudget(saved);
      else StorageService.addBudget(saved);
      return saved;
    } catch (err) {
      if (budgetData.id) return StorageService.updateBudget(budgetData);
      return StorageService.addBudget(budgetData);
    }
  },

  async deleteBudget(id) {
    if (API_CONFIG.USE_LOCAL_STORAGE_MOCK || !this.isAuthenticated()) {
      return Promise.resolve(StorageService.deleteBudget(id));
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/budgets/${id}`, {
        method: 'DELETE',
        headers: { ...this.getAuthHeader() }
      });
      StorageService.deleteBudget(id);
      return response.ok;
    } catch (err) {
      return StorageService.deleteBudget(id);
    }
  },

  // ==========================================================================
  // Financial Reports API
  // ==========================================================================

  async getMonthlyReport(month, year) {
    if (API_CONFIG.USE_LOCAL_STORAGE_MOCK || !this.isAuthenticated()) {
      return null;
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/reports/monthly?month=${month}&year=${year}`, {
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        }
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (err) {
      return null;
    }
  },

  // ==========================================================================
  // Recurring Transactions API
  // ==========================================================================

  async getRecurringRules() {
    if (API_CONFIG.USE_LOCAL_STORAGE_MOCK || !this.isAuthenticated()) {
      return Promise.resolve(StorageService.getRecurringRules());
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/recurring`, {
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        }
      });
      if (!response.ok) return StorageService.getRecurringRules();
      return await response.json();
    } catch (err) {
      return StorageService.getRecurringRules();
    }
  },

  async createRecurringRule(ruleData) {
    if (API_CONFIG.USE_LOCAL_STORAGE_MOCK || !this.isAuthenticated()) {
      return Promise.resolve(StorageService.addRecurringRule(ruleData));
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/recurring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        },
        body: JSON.stringify(ruleData)
      });
      if (!response.ok) return StorageService.addRecurringRule(ruleData);
      const saved = await response.json();
      StorageService.addRecurringRule(saved);
      return saved;
    } catch (err) {
      return StorageService.addRecurringRule(ruleData);
    }
  },

  async deleteRecurringRule(id) {
    if (API_CONFIG.USE_LOCAL_STORAGE_MOCK || !this.isAuthenticated()) {
      return Promise.resolve(StorageService.deleteRecurringRule(id));
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/recurring/${id}`, {
        method: 'DELETE',
        headers: { ...this.getAuthHeader() }
      });
      StorageService.deleteRecurringRule(id);
      return response.ok;
    } catch (err) {
      return StorageService.deleteRecurringRule(id);
    }
  },

  async generateDueTransactions() {
    if (API_CONFIG.USE_LOCAL_STORAGE_MOCK || !this.isAuthenticated()) {
      return null;
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/recurring/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader()
        }
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (err) {
      return null;
    }
  }
};
