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
  if (
    msg.includes('SSL alert number 80') || 
    msg.includes('tlsv1 alert internal error') || 
    msg.includes('whitelist') || 
    msg.includes('IP that isn\'t whitelisted') ||
    (err.name === 'MongooseServerSelectionError' && (msg.includes('whitelist') || msg.includes('Could not connect to any servers')))
  ) {
    return {
      category: 'IP_NOT_WHITELISTED',
      message: 'MongoDB Atlas connection rejected: Your current IP is not whitelisted. Please add 0.0.0.0/0 (or your current IP) in MongoDB Atlas Network Access.'
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

// Bind Mongoose connection event listeners for real-time state tracking
mongoose.connection.on('connected', () => {
  dbState.status = 'CONNECTED';
  dbState.category = 'OK';
  dbState.message = 'Database connected successfully';
  console.log(`✅ [MongoDB Atlas Connected]: ${mongoose.connection.host} / ${mongoose.connection.name}`);
});

mongoose.connection.on('disconnected', () => {
  dbState.status = 'DISCONNECTED';
  dbState.category = 'DISCONNECTED';
  dbState.message = 'MongoDB Atlas is disconnected. Please check your network connection and Atlas IP whitelist.';
  console.warn('⚠️ [MongoDB Atlas Disconnected]');
});

mongoose.connection.on('error', (err) => {
  const safeInfo = categorizeError(err);
  dbState.status = 'DISCONNECTED';
  dbState.category = safeInfo.category;
  dbState.message = safeInfo.message;
  console.error(`❌ [MongoDB Atlas Error]: [${safeInfo.category}] ${safeInfo.message}`);
});

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
    dbState.message = 'Database connected successfully';
    return true;
  }

  if (mongoose.connection.readyState === 2) {
    return false; // Connection is currently in progress
  }

  dbState.status = 'CONNECTING';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });

    dbState.status = 'CONNECTED';
    dbState.category = 'OK';
    dbState.message = 'Database connected successfully';
    console.log(`✅ [MongoDB Atlas Ready]: ${conn.connection.host} / ${conn.connection.name}`);

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

    // Schedule background auto-retry every 8 seconds if not already scheduled
    if (!retryTimer) {
      retryTimer = setInterval(() => {
        if (mongoose.connection.readyState !== 1) {
          connectDB();
        } else {
          clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 8000);
    }

    return false;
  }
};

const getDBStatus = () => {
  const readyState = mongoose.connection.readyState;
  const isConnected = readyState === 1;

  let message = '';
  if (isConnected) {
    message = 'Database connected successfully';
  } else if (readyState === 2 && (!dbState.category || dbState.category === 'INITIALIZING')) {
    message = 'Connecting to MongoDB Atlas...';
  } else {
    // If disconnected or retrying after an error, prioritize the specific error message
    if (dbState.message && !dbState.message.toLowerCase().includes('connected to cluster')) {
      message = dbState.message;
    } else {
      message = 'MongoDB Atlas is disconnected. Please ensure your IP is whitelisted in Atlas Network Access.';
    }
  }

  return {
    readyState,
    isConnected,
    status: isConnected ? 'Connected' : (readyState === 2 ? 'Connecting' : 'Disconnected'),
    category: isConnected ? 'OK' : dbState.category,
    message,
    lastAttempt: dbState.lastAttempt
  };
};

connectDB.connectDB = connectDB;
connectDB.getDBStatus = getDBStatus;
module.exports = connectDB;
