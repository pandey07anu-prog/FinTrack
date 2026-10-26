const mongoose = require('mongoose');

let dbState = {
  status: 'DISCONNECTED', // 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING'
  category: 'INITIALIZING',
  message: 'Connecting to MongoDB Atlas...',
  lastAttempt: null
};

let retryTimer = null;

/**
 * Categorizes connection errors safely without exposing credentials
 */
function categorizeError(err) {
  const msg = err && err.message ? err.message : '';
  if (msg.includes('SSL alert number 80') || msg.includes('tlsv1 alert internal error') || (err.name === 'MongooseServerSelectionError' && msg.includes('whitelist'))) {
    return {
      category: 'IP_NOT_WHITELISTED',
      message: 'MongoDB Atlas rejected connection: Your current public IP is not in Atlas Network Access whitelist. Add 0.0.0.0/0 (or your current IP) in Atlas.'
    };
  }
  if (msg.includes('bad auth') || msg.includes('Authentication failed') || msg.includes('auth failed')) {
    return {
      category: 'AUTH_FAILED',
      message: 'MongoDB Atlas authentication failed. Please check the database username and password in server/.env.'
    };
  }
  if (msg.includes('ENOTFOUND') || msg.includes('querySrv')) {
    return {
      category: 'DNS_ERROR',
      message: 'Could not resolve MongoDB Atlas cluster hostname. Check your internet connection and cluster name.'
    };
  }
  return {
    category: 'CONNECTION_FAILED',
    message: 'Unable to connect to MongoDB Atlas. Check your cluster status and network settings.'
  };
}

/**
 * Connects to MongoDB Atlas using Mongoose.
 * Reads MONGODB_URI (or MONGO_URI) from the environment variables.
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  dbState.lastAttempt = new Date().toISOString();

  if (!uri || uri.includes('<username>') || uri.includes('<password>')) {
    dbState.status = 'DISCONNECTED';
    dbState.category = 'NOT_CONFIGURED';
    dbState.message = 'MongoDB Atlas connection string is pending configuration in server/.env.';
    console.warn('\n⚠️  [Database Status]: ' + dbState.message);
    return false;
  }

  if (mongoose.connection.readyState === 1) {
    dbState.status = 'CONNECTED';
    dbState.category = 'OK';
    dbState.message = 'Connected to MongoDB Atlas.';
    return true;
  }

  dbState.status = 'CONNECTING';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });

    dbState.status = 'CONNECTED';
    dbState.category = 'OK';
    dbState.message = `Connected to cluster: ${conn.connection.host}`;
    console.log(`✅ [MongoDB Atlas Connected]: ${conn.connection.host} / ${conn.connection.name}`);

    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
    return true;
  } catch (error) {
    const safeInfo = categorizeError(error);
    dbState.status = 'DISCONNECTED';
    dbState.category = safeInfo.category;
    dbState.message = safeInfo.message;

    console.error(`❌ [MongoDB Atlas Status]: [${safeInfo.category}] ${safeInfo.message}`);

    // Schedule background auto-retry every 10 seconds if not already scheduled
    if (!retryTimer) {
      retryTimer = setInterval(() => {
        if (mongoose.connection.readyState !== 1) {
          connectDB();
        } else {
          clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 10000);
    }

    return false;
  }
};

const getDBStatus = () => {
  return {
    readyState: mongoose.connection.readyState,
    isConnected: mongoose.connection.readyState === 1,
    status: mongoose.connection.readyState === 1 ? 'Connected' : dbState.status,
    category: mongoose.connection.readyState === 1 ? 'OK' : dbState.category,
    message: mongoose.connection.readyState === 1 ? 'Database connected successfully' : dbState.message,
    lastAttempt: dbState.lastAttempt
  };
};

connectDB.connectDB = connectDB;
connectDB.getDBStatus = getDBStatus;
module.exports = connectDB;
