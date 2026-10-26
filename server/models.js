const mongoose = require('mongoose');

// ============================================================================
// 1. User Model (College Viva: Mongoose Schema with unique index & validation)
// ============================================================================
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
  },
  passwordHash: {
    type: String,
    required: [true, 'Password hash is required']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Alias `password` to `passwordHash` for convenience
userSchema.virtual('password').get(function() {
  return this.passwordHash;
}).set(function(val) {
  this.passwordHash = val;
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

// ============================================================================
// 2. Transaction Model (Linked to authenticated User)
// ============================================================================
const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  type: {
    type: String,
    enum: {
      values: ['income', 'expense'],
      message: 'Transaction type must be either "income" or "expense"'
    },
    required: [true, 'Transaction type is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than zero']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  date: {
    type: String, // Stored as 'YYYY-MM-DD' to prevent timezone displacement
    required: [true, 'Date is required']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Virtual alias: `user` -> `userId`
transactionSchema.virtual('user').get(function() {
  return this.userId;
}).set(function(val) {
  this.userId = val;
});
transactionSchema.set('toJSON', { virtuals: true });

// ============================================================================
// 3. Budget Model (Monthly spending limits per category)
// ============================================================================
const budgetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  limit: {
    type: Number,
    required: [true, 'Monthly spending limit is required'],
    min: [1, 'Limit must be at least 1']
  },
  month: {
    type: Number,
    required: [true, 'Month is required (1-12)'],
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: [true, 'Year is required']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Virtual alias: `limitAmount` <-> `limit`
budgetSchema.virtual('limitAmount').get(function() {
  return this.limit;
}).set(function(val) {
  this.limit = val;
});
budgetSchema.set('toJSON', { virtuals: true });

// ============================================================================
// 4. RecurringRule Model (Scheduled recurring rules)
// ============================================================================
const recurringRuleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    default: 'monthly'
  },
  startDate: {
    type: String,
    required: true
  },
  nextDueDate: {
    type: String,
    required: true
  },
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});
recurringRuleSchema.set('toJSON', { virtuals: true });

// Export all models
const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Budget = mongoose.model('Budget', budgetSchema);
const RecurringRule = mongoose.model('RecurringRule', recurringRuleSchema);

module.exports = { User, Transaction, Budget, RecurringRule };
