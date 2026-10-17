require('dotenv').config();

const toList = (value) =>
  (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

/**
 * `app.set('trust proxy', …)` accepts a boolean, a hop count, or a string such
 * as `loopback` / a subnet. Parse whichever form was supplied.
 */
const toTrustProxy = (value) => {
  if (value === undefined || value === '') return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
};

const env = process.env.NODE_ENV || 'development';

const config = {
  env,
  isProduction: env === 'production',
  port: Number(process.env.PORT) || 5000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/fittrack',
  jwtSecret: process.env.JWT_SECRET || 'secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins: toList(process.env.CORS_ORIGIN),
  uploadsDir: process.env.UPLOADS_DIR || 'uploads',
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES) || 5 * 1024 * 1024,
  demoPassword: process.env.DEMO_PASSWORD || 'FitTrack@123',
  trustProxy: toTrustProxy(process.env.TRUST_PROXY),
  logRequests: toBoolean(process.env.LOG_REQUESTS, env !== 'test'),
};

/* -------------------------------------------------------- production guards */

if (config.isProduction) {
  if (!config.jwtSecret || config.jwtSecret === 'secret' || config.jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET must be a strong, unique value (at least 32 characters) when NODE_ENV=production.'
    );
  }

  if (config.corsOrigins.length === 0 || config.corsOrigins.includes('*')) {
    throw new Error(
      'CORS_ORIGIN must list explicit frontend origin(s) (no wildcard) when NODE_ENV=production.'
    );
  }
}

module.exports = config;
