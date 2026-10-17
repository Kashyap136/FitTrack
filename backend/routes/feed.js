const express = require('express');
const { Workout } = require('../models/Workout');
const { User } = require('../models/User');
const { optionalAuth, requireAuth, resolveTargetUser } = require('../middleware/auth');
const { ApiError, isValidId } = require('../utils/validators');
const { publicUser, workoutDto } = require('../utils/serializers');
const router = express.Router();

const DEFAULT_LIMIT = 20;

/**
 * GET /api/feed/list?userId=&type=&page=&limit=
 *
 * Community workout feed sorted by date descending. When `userId` is provided
 * the feed is scoped to that user (must be the signed-in user).
 */
router.get('/list', optionalAuth, async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || DEFAULT_LIMIT, 1), 50);

    const filter = {};

    if (req.query.userId) {
      if (!isValidId(req.query.userId)) throw ApiError.badRequest('Invalid user id');
      if (req.user && String(req.user._id) !== String(req.query.userId)) {
        throw ApiError.forbidden('You can only view your own private feed');
      }
      filter['userId._id'] = req.query.userId;
    }

    if (req.query.type) {
      const type = String(req.query.type).toLowerCase();
      if (!['run', 'gym', 'yoga'].includes(type)) throw ApiError.badRequest('Invalid workout type filter');
      filter.type = type;
    }

    const [workouts, total] = await Promise.all([
      Workout.find(filter)
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Workout.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: workouts.length,
      total,
      page,
      limit,
      hasMore: page * limit < total,
      viewerId: req.user ? String(req.user._id) : null,
      workouts: workouts.map((workout) => workoutDto(workout)),
    });
  } catch (error) {
    next(error);
  }
});

/** GET /api/feed/people — community members shown in the feed sidebar. */
router.get('/people', optionalAuth, async (req, res, next) => {
  try {
    const users = await User.find({ isPublic: true })
      .sort({ streak: -1, createdAt: -1 })
      .limit(8)
      .lean();

    res.json({ success: true, users: users.map(publicUser) });
  } catch (error) {
    next(error);
  }
});

/** GET /api/feed/comments/:workoutId — comments for one workout. */
router.get('/comments/:workoutId', async (req, res, next) => {
  try {
    if (!isValidId(req.params.workoutId)) throw ApiError.badRequest('Invalid workout id');
    const workout = await Workout.findById(req.params.workoutId).select('comments').lean();
    if (!workout) throw ApiError.notFound('Workout not found');

    res.json({
      success: true,
      comments: (workout.comments || []).map((comment) => ({
        id: String(comment._id),
        text: comment.text,
        createdAt: comment.createdAt,
        user: publicUser(comment.user),
      })),
    });
  } catch (error) {
    next(error);
  }
});

/** GET /api/feed/summary — headline numbers for the signed-in user. */
router.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const userId = resolveTargetUser(req, { queryKey: 'userId' });
    const [workouts, prs] = await Promise.all([
      Workout.find({ 'userId._id': userId }).select('date calories type').lean(),
      Workout.countDocuments({ 'userId._id': userId, pr: true }),
    ]);

    const thisWeekStart = new Date();
    thisWeekStart.setDate(thisWeekStart.getDate() - 6);
    thisWeekStart.setHours(0, 0, 0, 0);

    res.json({
      success: true,
      totalWorkouts: workouts.length,
      totalCalories: workouts.reduce((sum, w) => sum + (w.calories || 0), 0),
      totalMinutes: workouts.reduce((sum, w) => sum + (Number(w.data?.duration) || 0), 0),
      totalDistance: workouts.reduce((sum, w) => sum + (Number(w.data?.distance) || 0), 0),
      prCount: prs,
      thisWeek: workouts.filter((w) => new Date(w.date) >= thisWeekStart).length,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = { feedRouter: router };