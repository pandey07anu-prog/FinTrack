const express = require('express');
const mongoose = require('mongoose');
const { authMiddleware, checkDB } = require('./auth');
const { Transaction, Budget, RecurringRule } = require('./models');

const router = express.Router();

// Helper: Helper function to advance a date string 'YYYY-MM-DD' by frequency
function advanceDateByFrequency(dateStr, frequency) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);

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
}

// ============================================================================
// 1. Transaction CRUD Endpoints (Protected by authMiddleware & checkDB)
// ============================================================================

// GET /api/transactions - Fetch all transactions for the authenticated user
router.get('/transactions', authMiddleware, checkDB, async (req, res, next) => {
  try {
    const query = { userId: req.user.id };

    if (req.query.type && ['income', 'expense'].includes(req.query.type)) {
      query.type = req.query.type;
    }
    if (req.query.category && req.query.category !== 'ALL') {
      query.category = req.query.category;
    }
    if (req.query.startDate) {
      query.date = { ...(query.date || {}), $gte: req.query.startDate };
    }
    if (req.query.endDate) {
      query.date = { ...(query.date || {}), $lte: req.query.endDate };
    }
    if (req.query.search) {
      query.description = { $regex: req.query.search, $options: 'i' };
    }

    const transactions = await Transaction.find(query).sort({ date: -1, createdAt: -1 });

    const formatted = transactions.map(t => ({
      id: t._id,
      userId: t.userId,
      type: t.type,
      amount: t.amount,
      category: t.category,
      date: t.date,
      description: t.description,
      createdAt: t.createdAt
    }));

    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

// POST /api/transactions - Create a new transaction
router.post('/transactions', authMiddleware, checkDB, async (req, res, next) => {
  try {
    const { type, amount, category, date, description } = req.body;

    if (!type || !['income', 'expense'].includes(type)) {
      return res.status(400).json({ error: 'Transaction type must be "income" or "expense".' });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number greater than 0.' });
    }

    if (!category || !category.trim()) {
      return res.status(400).json({ error: 'Category is required.' });
    }

    if (!date) {
      return res.status(400).json({ error: 'Date is required.' });
    }

    const transaction = new Transaction({
      userId: req.user.id,
      type,
      amount: numericAmount,
      category: category.trim(),
      date,
      description: (description || '').trim() || 'No description'
    });

    const saved = await transaction.save();

    res.status(201).json({
      id: saved._id,
      userId: saved.userId,
      type: saved.type,
      amount: saved.amount,
      category: saved.category,
      date: saved.date,
      description: saved.description,
      createdAt: saved.createdAt
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/transactions/:id - Update an existing transaction
router.put('/transactions/:id', authMiddleware, checkDB, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid transaction ID format.' });
    }

    const { type, amount, category, date, description } = req.body;
    const updateData = {};

    if (type) {
      if (!['income', 'expense'].includes(type)) {
        return res.status(400).json({ error: 'Type must be "income" or "expense".' });
      }
      updateData.type = type;
    }

    if (amount !== undefined) {
      const num = parseFloat(amount);
      if (isNaN(num) || num <= 0) {
        return res.status(400).json({ error: 'Amount must be greater than 0.' });
      }
      updateData.amount = num;
    }

    if (category) updateData.category = category.trim();
    if (date) updateData.date = date;
    if (description !== undefined) updateData.description = description.trim();

    const updated = await Transaction.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Transaction not found or access unauthorized.' });
    }

    res.json({
      id: updated._id,
      userId: updated.userId,
      type: updated.type,
      amount: updated.amount,
      category: updated.category,
      date: updated.date,
      description: updated.description
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/transactions/:id - Delete a transaction
router.delete('/transactions/:id', authMiddleware, checkDB, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid transaction ID format.' });
    }

    const deleted = await Transaction.findOneAndDelete({ _id: id, userId: req.user.id });

    if (!deleted) {
      return res.status(404).json({ error: 'Transaction not found or access unauthorized.' });
    }

    res.json({ message: 'Transaction deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 2. Budget CRUD Endpoints (With dynamic spent calculations)
// ============================================================================

// GET /api/budgets - Retrieve user budgets with live spending calculations
router.get('/budgets', authMiddleware, checkDB, async (req, res, next) => {
  try {
    const query = { userId: req.user.id };
    const month = req.query.month ? parseInt(req.query.month, 10) : new Date().getMonth() + 1;
    const year = req.query.year ? parseInt(req.query.year, 10) : new Date().getFullYear();

    if (req.query.month) query.month = month;
    if (req.query.year) query.year = year;

    const budgets = await Budget.find(query);

    // Fetch this month's expense transactions to calculate actual spending
    const targetPrefix = `${year}-${String(month).padStart(2, '0')}`;
    const monthlyExpenses = await Transaction.find({
      userId: req.user.id,
      type: 'expense',
      date: { $regex: `^${targetPrefix}` }
    });

    const enrichedBudgets = budgets.map(b => {
      const spent = monthlyExpenses
        .filter(t => t.category.toLowerCase() === b.category.toLowerCase())
        .reduce((sum, t) => sum + t.amount, 0);

      const limit = b.limit;
      const remaining = limit - spent;
      const percent = limit > 0 ? (spent / limit) * 100 : 0;
      const isExceeded = spent > limit;

      return {
        id: b._id,
        userId: b.userId,
        category: b.category,
        limit,
        limitAmount: limit,
        month: b.month,
        year: b.year,
        spent,
        remaining,
        percent: Number(percent.toFixed(1)),
        isExceeded
      };
    });

    res.json(enrichedBudgets);
  } catch (err) {
    next(err);
  }
});

// POST /api/budgets - Create or update a budget limit
router.post('/budgets', authMiddleware, checkDB, async (req, res, next) => {
  try {
    const { category, limit, limitAmount, month, year } = req.body;
    const finalLimit = parseFloat(limit || limitAmount);

    if (!category || isNaN(finalLimit) || !month || !year) {
      return res.status(400).json({ error: 'Category, monthly limit, month, and year are required.' });
    }

    if (finalLimit <= 0) {
      return res.status(400).json({ error: 'Budget limit must be greater than 0.' });
    }

    const budget = await Budget.findOneAndUpdate(
      {
        userId: req.user.id,
        category: category.trim(),
        month: parseInt(month, 10),
        year: parseInt(year, 10)
      },
      { limit: finalLimit },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(201).json({
      id: budget._id,
      userId: budget.userId,
      category: budget.category,
      limit: budget.limit,
      limitAmount: budget.limit,
      month: budget.month,
      year: budget.year
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/budgets/:id - Update budget limit by ID
router.put('/budgets/:id', authMiddleware, checkDB, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid budget ID format.' });
    }

    const { limit, limitAmount } = req.body;
    const finalLimit = parseFloat(limit || limitAmount);

    if (isNaN(finalLimit) || finalLimit <= 0) {
      return res.status(400).json({ error: 'Valid positive limit amount is required.' });
    }

    const updated = await Budget.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      { limit: finalLimit },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Budget not found or access unauthorized.' });
    }

    res.json({
      id: updated._id,
      userId: updated.userId,
      category: updated.category,
      limit: updated.limit,
      limitAmount: updated.limit,
      month: updated.month,
      year: updated.year
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/budgets/:id - Delete a budget limit
router.delete('/budgets/:id', authMiddleware, checkDB, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid budget ID format.' });
    }

    const deleted = await Budget.findOneAndDelete({ _id: id, userId: req.user.id });

    if (!deleted) {
      return res.status(404).json({ error: 'Budget not found or access unauthorized.' });
    }

    res.json({ message: 'Budget deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 3. Financial Reports Endpoint (Aggregated from real transactions)
// ============================================================================

// GET /api/reports/monthly?month=10&year=2026
router.get('/reports/monthly', authMiddleware, checkDB, async (req, res, next) => {
  try {
    const month = req.query.month ? parseInt(req.query.month, 10) : new Date().getMonth() + 1;
    const year = req.query.year ? parseInt(req.query.year, 10) : new Date().getFullYear();

    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Invalid month parameter (must be 1-12).' });
    }
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ error: 'Invalid year parameter.' });
    }

    const datePrefix = `${year}-${String(month).padStart(2, '0')}`;
    const transactions = await Transaction.find({
      userId: req.user.id,
      date: { $regex: `^${datePrefix}` }
    });

    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryBreakdown = {};

    transactions.forEach(t => {
      if (t.type === 'income') {
        totalIncome += t.amount;
      } else {
        totalExpenses += t.amount;
        categoryBreakdown[t.category] = (categoryBreakdown[t.category] || 0) + t.amount;
      }
    });

    const remainingBalance = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? ((remainingBalance / totalIncome) * 100).toFixed(1) : 0;

    res.json({
      month,
      year,
      totalIncome,
      totalExpenses,
      remainingBalance,
      savingsSummary: {
        netSavings: remainingBalance,
        savingsRate: Number(savingsRate)
      },
      categoryBreakdown,
      transactionCount: transactions.length
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 4. Recurring Transactions Endpoints
// ============================================================================

// GET /api/recurring - List user's recurring rules
router.get('/recurring', authMiddleware, checkDB, async (req, res, next) => {
  try {
    const rules = await RecurringRule.find({ userId: req.user.id });
    res.json(rules.map(r => ({
      id: r._id,
      userId: r.userId,
      type: r.type,
      amount: r.amount,
      category: r.category,
      description: r.description,
      frequency: r.frequency,
      startDate: r.startDate,
      nextDueDate: r.nextDueDate,
      active: r.active
    })));
  } catch (err) {
    next(err);
  }
});

// POST /api/recurring - Create a new recurring rule
router.post('/recurring', authMiddleware, checkDB, async (req, res, next) => {
  try {
    const { type, amount, category, description, frequency, startDate, nextDueDate } = req.body;

    if (!type || !amount || !category || !startDate || !nextDueDate) {
      return res.status(400).json({ error: 'Type, amount, category, startDate, and nextDueDate are required.' });
    }

    const rule = new RecurringRule({
      userId: req.user.id,
      type,
      amount: parseFloat(amount),
      category: category.trim(),
      description: (description || '').trim() || 'Recurring payment',
      frequency: frequency || 'monthly',
      startDate,
      nextDueDate
    });

    const saved = await rule.save();
    res.status(201).json({
      id: saved._id,
      userId: saved.userId,
      type: saved.type,
      amount: saved.amount,
      category: saved.category,
      description: saved.description,
      frequency: saved.frequency,
      startDate: saved.startDate,
      nextDueDate: saved.nextDueDate,
      active: saved.active
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/recurring/:id - Update or toggle active on recurring rule
router.put('/recurring/:id', authMiddleware, checkDB, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid recurring rule ID.' });
    }

    const updated = await RecurringRule.findOneAndUpdate(
      { _id: id, userId: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Recurring rule not found.' });
    }

    res.json({
      id: updated._id,
      userId: updated.userId,
      type: updated.type,
      amount: updated.amount,
      category: updated.category,
      description: updated.description,
      frequency: updated.frequency,
      startDate: updated.startDate,
      nextDueDate: updated.nextDueDate,
      active: updated.active
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/recurring/:id - Delete recurring rule
router.delete('/recurring/:id', authMiddleware, checkDB, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid recurring rule ID.' });
    }

    const deleted = await RecurringRule.findOneAndDelete({ _id: id, userId: req.user.id });
    if (!deleted) {
      return res.status(404).json({ error: 'Recurring rule not found.' });
    }

    res.json({ message: 'Recurring rule deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/recurring/generate - Evaluate due rules, create transactions, and advance nextDueDate
router.post('/recurring/generate', authMiddleware, checkDB, async (req, res, next) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // Find active rules due on or before today
    const dueRules = await RecurringRule.find({
      userId: req.user.id,
      active: true,
      nextDueDate: { $lte: todayStr }
    });

    let generatedCount = 0;

    for (const rule of dueRules) {
      // 1. Create matching transaction in MongoDB
      const tx = new Transaction({
        userId: req.user.id,
        type: rule.type,
        amount: rule.amount,
        category: rule.category,
        date: rule.nextDueDate,
        description: `${rule.description} (Recurring: ${rule.frequency})`
      });
      await tx.save();

      // 2. Advance nextDueDate to prevent duplicate generation for the same occurrence
      rule.nextDueDate = advanceDateByFrequency(rule.nextDueDate, rule.frequency);
      await rule.save();

      generatedCount++;
    }

    res.json({
      message: generatedCount > 0 ? `Generated ${generatedCount} due transactions.` : 'No recurring transactions are due today.',
      generatedCount
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
