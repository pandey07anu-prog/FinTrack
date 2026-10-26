require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const connectDB = require('./db');
const { authRouter } = require('./auth');
const apiRoutes = require('./routes');

// Initialize Express Application
const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

// Connect to MongoDB Atlas
connectDB();

// Global Middlewares
const allowedOrigins = [
  CLIENT_ORIGIN,
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5500'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(null, true); // Permissive for local testing
  },
  credentials: true
}));
app.use(express.json());

// Serve static frontend files (HTML, CSS, JS, images)
const path = require('path');
app.use(express.static(path.join(__dirname, '..')));


// Root Health & Metadata Endpoints
app.get('/', (req, res) => {
  res.json({
    status: 'Online',
    project: 'Expense Tracker / Personal Finance Manager REST API',
    version: '1.0.0',
    documentation: {
      auth: ['POST /api/auth/register', 'POST /api/auth/login', 'GET /api/auth/me'],
      transactions: ['GET /api/transactions', 'POST /api/transactions', 'PUT /api/transactions/:id', 'DELETE /api/transactions/:id'],
      budgets: ['GET /api/budgets', 'POST /api/budgets', 'PUT /api/budgets/:id', 'DELETE /api/budgets/:id'],
      reports: ['GET /api/reports/monthly?month=MM&year=YYYY'],
      recurring: ['GET /api/recurring', 'POST /api/recurring', 'PUT /api/recurring/:id', 'DELETE /api/recurring/:id', 'POST /api/recurring/generate']
    }
  });
});

app.get('/api/health', (req, res) => {
  const { getDBStatus } = require('./db');
  const dbInfo = typeof getDBStatus === 'function' ? getDBStatus() : { isConnected: false };
  res.json({
    status: 'Healthy',
    database: dbInfo.isConnected ? 'Connected' : 'Pending Configuration',
    dbDetails: dbInfo,
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/auth', authRouter); // Auth endpoints: /api/auth/register, /api/auth/login, /api/auth/me
app.use('/api', apiRoutes);       // Data endpoints: /api/transactions, /api/budgets, etc.

// Centralized Express Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(`💥 [Server Error]: ${err.message}`);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Internal Server Error'
  });
});

// Scheduled Background Task: Automatically process due recurring transactions daily
// Demonstrates Node.js Event Loop timers (setInterval) and duplicate prevention
const scheduleRecurringTask = () => {
  const checkDue = async () => {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) return;
    try {
      const { RecurringRule, Transaction } = require('./models');
      const todayStr = new Date().toISOString().split('T')[0];
      const dueRules = await RecurringRule.find({ active: true, nextDueDate: { $lte: todayStr } });
      
      for (const rule of dueRules) {
        // 1. Create transaction in MongoDB
        const tx = new Transaction({
          userId: rule.userId,
          type: rule.type,
          amount: rule.amount,
          category: rule.category,
          date: rule.nextDueDate,
          description: `${rule.description} (Auto Scheduled: ${rule.frequency})`
        });
        await tx.save();

        // 2. Advance nextDueDate to prevent duplicate generation for the same occurrence
        const [y, m, d] = rule.nextDueDate.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        if (rule.frequency === 'daily') dt.setDate(dt.getDate() + 1);
        else if (rule.frequency === 'weekly') dt.setDate(dt.getDate() + 7);
        else if (rule.frequency === 'yearly') dt.setFullYear(dt.getFullYear() + 1);
        else dt.setMonth(dt.getMonth() + 1);
        
        const ny = dt.getFullYear();
        const nm = String(dt.getMonth() + 1).padStart(2, '0');
        const nd = String(dt.getDate()).padStart(2, '0');
        rule.nextDueDate = `${ny}-${nm}-${nd}`;
        await rule.save();
      }

      if (dueRules.length > 0) {
        console.log(`⏰ [Recurring Scheduler]: Automatically processed ${dueRules.length} due transactions.`);
      }
    } catch (err) {
      console.warn('⚠️ [Recurring Scheduler Warning]:', err.message);
    }
  };

  // Run on startup after 5 seconds, then every 24 hours
  setTimeout(checkDue, 5000);
  setInterval(checkDue, 24 * 60 * 60 * 1000);
};

scheduleRecurringTask();

// Start Express Server
app.listen(PORT, () => {
  console.log(`🚀 [Server Running]: http://localhost:${PORT}`);
});

