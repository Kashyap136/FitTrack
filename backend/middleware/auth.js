const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { User, USER_PROJECTION } = require('../models/User');
const { ApiError, isValidId } = require('../utils/validators');

/** Sign a JWT for a user document. */
function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), handle: user.handle, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return req.headers['x-auth-token'] || null;
}

/**
 * Require a valid JWT. Attaches the user document to `req.user`.
 */
async function requireAuth(req, _res, next) {
  try {
    const token = readToken(req);
    if (!token) throw ApiError.unauthorized('Sign in to continue');

    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch (error) {
      throw ApiError.unauthorized(
        error.name === 'TokenExpiredError' ? 'Your session expired, please sign in again' : 'Invalid session token'
      );
    }

    const user = await User.findById(payload.sub).select(USER_PROJECTION);
    if (!user) throw ApiError.unauthorized('Account no longer exists');

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Attach the user when a valid token is present but never block the request.
 * Used for public endpoints (feed, profile) that personalise their response.
 */
async function optionalAuth(req, _res, next) {
  try {
    const token = readToken(req);
    if (token) {
      const payload = jwt.verify(token, config.jwtSecret);
      if (payload?.sub) {
        req.user = await User.findById(payload.sub).select(USER_PROJECTION);
        req.token = token;
      }
    }
  } catch {
    req.user = undefined;
  }
  next();
}

/**
 * Some endpoints in the build sheet accept `userId` in the request body or
 * query string. Honour it when it matches the signed-in user; otherwise 403,
 * so one user can never act on behalf of another.
 */
function resolveTargetUser(req, { bodyKey = 'userId', queryKey = 'userId' } = {}) {
  const fromBody = req.body?.[bodyKey];
  const fromQuery = req.query?.[queryKey];
  const requested = fromBody || fromQuery || null;

  if (requested) {
    if (!isValidId(requested)) throw ApiError.badRequest('Invalid user id');
    if (req.user && String(req.user._id) !== String(requested)) {
      throw ApiError.forbidden('You can only manage your own data');
    }
    if (!req.user) throw ApiError.unauthorized('Sign in to continue');
    return requested;
  }

  if (!req.user) throw ApiError.unauthorized('Sign in to continue');
  return req.user._id.toString();
}

module.exports = { optionalAuth, requireAuth, resolveTargetUser, signToken };