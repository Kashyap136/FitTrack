require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const config = require('./config/env');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { securityHeaders } = require('./middleware/securityHeaders');
const { authRouter } = require('./routes/auth');
const { workoutRouter } = require('./routes/workouts');
const { feedRouter } = require('./routes/feed');
const { challengeRouter } = require('./routes/challenges');
const { leaderboardRouter } = require('./routes/leaderboard');
const { statsRouter } = require('./routes/stats');
const { usersRouter } = require('./routes/users');
const { settingsRouter } = require('./routes/settings');
const { groupsRouter } = require('./routes/groups');

const app = express();

/* ------------------------------------------------------------ middleware */

app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);
app.use(securityHeaders);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const corsOptions = {
  origin(origin, callback) {
    // Allow same-origin/tooling requests and any explicitly configured origin.
    if (!origin || config.corsOrigins.length === 0 || config.corsOrigins.includes('*')) {
      return callback(null, true);
    }
    if (config.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
};

app.use(cors(corsOptions));

app.use('/uploads', express.static(path.join(process.cwd(), config.uploadsDir), { maxAge: '1h' }));

if (config.logRequests) {
  app.use((req, _res, next) => {
    if (req.path !== '/api/health' && req.path !== '/api/ready') {
      console.log(`${req.method} ${req.originalUrl}`);
    }
    next();
  });
}

/* ---------------------------------------------------------------- routes */

app.get('/api/health', (_req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    success: true,
    status: 'ok',
    database: states[mongoose.connection.readyState] || 'unknown',
    uptime: Math.round(process.uptime()),
    environment: config.env,
  });
});

app.get('/api/ready', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    success: connected,
    status: connected ? 'ready' : 'not-ready',
    database: connected ? 'connected' : 'disconnected',
  });
});

app.use('/api/auth', authRouter);
app.use('/api/workouts', workoutRouter);
app.use('/api/feed', feedRouter);
app.use('/api/challenges', challengeRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/stats', statsRouter);
app.use('/api/users', usersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/groups', groupsRouter);

// Social interactions are also mounted in feedRouter where needed.


app.use(notFound);
app.use(errorHandler);

/* ------------------------------------------------------------- lifecycle */

async function start() {
  try {
    await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 8000 });
    console.log(`✔ MongoDB connected → ${config.mongodbUri.replace(/\/\/.*@/, '//***@')}`);

    const server = app.listen(config.port, () => {
      console.log(`✔ FitTrack API listening on http://localhost:${config.port}`);
      console.log(`  Health check:  http://localhost:${config.port}/api/health`);
    });

    const shutdown = async (signal) => {
      console.log(`\n${signal} received, shutting down…`);
      // Never hang forever waiting on lingering connections.
      const forceExit = setTimeout(() => {
        console.warn('Shutdown timed out after 10s — forcing exit.');
        process.exit(1);
      }, 10_000);
      forceExit.unref();

      server.close(async () => {
        clearTimeout(forceExit);
        await mongoose.connection.close();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('✖ Could not connect to MongoDB:', error.message);
    console.error(`  Check MONGODB_URI in backend/.env (currently: ${config.mongodbUri})`);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = app;