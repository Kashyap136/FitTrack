const express = require('express');
const bcrypt = require('bcryptjs');
const { User } = require('../models/User');
const { WeightEntry } = require('../models/WeightEntry');
const { signToken, requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { createRateLimiter } = require('../middleware/rateLimit');
const { ApiError, validateLogin, validateRegistration, validateWeight } = require('../utils/validators');
const { publicUser } = require('../utils/serializers');

const router = express.Router();
const SALT_ROUNDS = 10;

// Throttle credential endpoints to slow down brute-force attempts.
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many authentication attempts. Please wait a few minutes and try again.',
});

const hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);

/** POST /api/auth/register — create an account and return a JWT. */
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { name, handle, email, password, weight } = validateRegistration(req.body);

    const existing = await User.findOne({ $or: [{ email }, { handle }] }).select('email handle');
    if (existing) {
      const field = existing.email === email ? 'email' : 'handle';
      throw ApiError.conflict(
        field === 'email' ? 'An account with that email already exists' : `The handle @${handle} is already taken`,
        { [field]: field === 'email' ? 'Email already registered' : 'Handle already taken' }
      );
    }

    const user = await User.create({
      name,
      handle,
      email,
      passwordHash: await hashPassword(password),
      weight: weight ?? null,
    });

    // Seed the weight chart with the registration weight when provided.
    if (weight) {
      await WeightEntry.create({ userId: user.toObject(), weight, date: new Date() });
    }

    res.status(201).json({
      success: true,
      message: `Welcome to FitTrack, ${user.name.split(' ')[0]}!`,
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

/** POST /api/auth/login — exchange credentials for a JWT. */
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = validateLogin(req.body);

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) throw ApiError.unauthorized('Email or password is incorrect');

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) throw ApiError.unauthorized('Email or password is incorrect');

    res.json({
      success: true,
      message: `Welcome back, ${user.name.split(' ')[0]}`,
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

/** GET /api/auth/me — validate the stored token and return the profile. */
router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, user: publicUser(req.user) });
});

/** PUT /api/auth/password — change password for the signed-in user. */
router.put('/password', requireAuth, authLimiter, async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');

    if (!currentPassword || !newPassword) {
      throw ApiError.badRequest('Current and new password are required');
    }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      throw ApiError.badRequest('New password must be 8+ characters and include letters and numbers');
    }

    const user = await User.findById(req.user._id).select('+passwordHash');
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) throw ApiError.unauthorized('Current password is incorrect');

    user.passwordHash = await hashPassword(newPassword);
    await user.save();

    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    next(error);
  }
});

/** POST /api/auth/weight — record a dated weight measurement for the chart. */
router.post('/weight', requireAuth, async (req, res, next) => {
  try {
    const { weight, date, note } = validateWeight(req.body);
    const entry = await WeightEntry.create({ userId: req.user.toObject(), weight, date, note });
    await User.updateOne({ _id: req.user._id }, { $set: { weight } });

    res.status(201).json({
      success: true,
      message: 'Weight logged',
      entry: { id: entry._id, weight: entry.weight, date: entry.date, note: entry.note },
      user: publicUser({ ...req.user.toObject(), weight }),
    });
  } catch (error) {
    next(error);
  }
});

/** GET /api/auth/weight — the signed-in user's own weight history. */
router.get('/weight', requireAuth, async (req, res, next) => {
  try {
    const entries = await WeightEntry.find({ 'userId._id': req.user._id })
      .sort({ date: 1 })
      .select('weight date note')
      .lean();

    res.json({
      success: true,
      history: entries.map((entry) => ({ id: entry._id, weight: entry.weight, date: entry.date, note: entry.note })),
    });
  } catch (error) {
    next(error);
  }
});

/** POST /api/auth/avatar — optional image upload used by profile settings. */
router.post('/avatar', requireAuth, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) throw ApiError.badRequest('Choose an image to upload');
    const avatarUrl = `/uploads/${req.file.filename}`;
    await User.updateOne({ _id: req.user._id }, { $set: { avatarUrl } });
    res.status(201).json({ success: true, message: 'Photo updated', avatarUrl });
  } catch (error) {
    next(error);
  }
});

module.exports = { authRouter: router };