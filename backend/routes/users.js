const express = require('express');
const { User, USER_PROJECTION } = require('../models/User');
const { Workout } = require('../models/Workout');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { ApiError, normaliseHandle } = require('../utils/validators');
const { publicUser, workoutDto } = require('../utils/serializers');

const router = express.Router();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** GET /api/users/directory — public member directory (powers the feed rail). */
router.get('/directory', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim().slice(0, 40);
    const filter = { isPublic: true };
    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: pattern }, { handle: pattern }];
    }

    const users = await User.find(filter)
      .select(USER_PROJECTION)
      .sort({ streak: -1, longestStreak: -1, createdAt: 1 })
      .limit(40)
      .lean();

    res.json({ success: true, count: users.length, users: users.map(publicUser) });
  } catch (error) {
    next(error);
  }
});

/** GET /api/users/me — full private profile for the signed-in user. */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(USER_PROJECTION).lean();
    if (!user) throw ApiError.notFound('User not found');

    const totalWorkouts = await Workout.countDocuments({ 'userId._id': user._id });

    res.json({
      success: true,
      user: {
        ...publicUser(user),
        email: user.email,
        role: user.role,
        isPublic: user.isPublic,
        settings: user.settings,
        createdAt: user.createdAt,
        totalWorkouts,
      },
    });
  } catch (error) {
    next(error);
  }
});

/** PUT /api/users/me — update editable profile fields. */
router.put('/me', requireAuth, async (req, res, next) => {
  try {
    const updates = {};
    const errors = {};

    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (name.length < 2 || name.length > 60) errors.name = 'Name must be 2-60 characters';
      else updates.name = name;
    }

    if (req.body?.bio !== undefined) {
      const bio = String(req.body.bio).trim();
      if (bio.length > 240) errors.bio = 'Bio must be 240 characters or fewer';
      else updates.bio = bio;
    }

    if (req.body?.location !== undefined) {
      const location = String(req.body.location).trim();
      if (location.length > 60) errors.location = 'Location must be 60 characters or fewer';
      else updates.location = location;
    }

    if (req.body?.avatarUrl !== undefined) {
      updates.avatarUrl = String(req.body.avatarUrl).trim().slice(0, 300);
    }

    if (Object.keys(errors).length) {
      throw ApiError.badRequest('Please correct the highlighted fields', errors);
    }

    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, {
      new: true,
      runValidators: true,
    }).select(USER_PROJECTION);

    res.json({ success: true, message: 'Profile updated', user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

/** GET /api/users/:handle — lightweight public profile header. */
router.get('/:handle', optionalAuth, async (req, res, next) => {
  try {
    const handle = normaliseHandle(req.params.handle);
    const user = await User.findOne({ handle }).select(USER_PROJECTION).lean();
    if (!user) throw ApiError.notFound(`No athlete found for @${handle}`);
    if (!user.isPublic && String(user._id) !== String(req.user?._id)) {
      throw ApiError.forbidden('This profile is private');
    }

    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

/** GET /api/users/:handle/workouts — public workout history for a handle. */
router.get('/:handle/workouts', optionalAuth, async (req, res, next) => {
  try {
    const handle = normaliseHandle(req.params.handle);
    const user = await User.findOne({ handle })
      .select('_id handle name avatarUrl isPublic')
      .lean();
    if (!user) throw ApiError.notFound(`No athlete found for @${handle}`);
    if (!user.isPublic && String(user._id) !== String(req.user?._id)) {
      throw ApiError.forbidden('This profile is private');
    }

    const limit = Math.min(Number(req.query.limit) || 12, 50);
    const workouts = await Workout.find({ 'userId._id': user._id })
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      user: publicUser(user),
      workouts: workouts.map((w) => workoutDto(w, { includeComments: false })),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = { usersRouter: router };