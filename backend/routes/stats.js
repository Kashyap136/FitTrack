const express = require('express');
const { Workout } = require('../models/Workout');
const { WeightEntry } = require('../models/WeightEntry');
const { User } = require('../models/User');
const { Challenge } = require('../models/Challenge');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { ApiError, normaliseHandle } = require('../utils/validators');
const { buildActivityMap, calculateStreaks } = require('../utils/streak');
const { recomputePersonalBests } = require('../utils/pr');
const { publicUser, workoutDto } = require('../utils/serializers');

const router = express.Router();

const ACTIVITY_WINDOW_DAYS = 84;

/**
 * GET /api/stats/:handle
 * Public profile statistics: weight chart data, streaks, PRs and aggregates.
 */
router.get('/:handle', optionalAuth, async (req, res, next) => {
  try {
    const handle = normaliseHandle(req.params.handle);
    if (!handle) throw ApiError.badRequest('A handle is required');

    const user = await User.findOne({ handle });
    if (!user) throw ApiError.notFound(`No athlete found for @${handle}`);

    const [workouts, weights] = await Promise.all([
      Workout.find({ 'userId._id': user._id }).sort({ date: -1 }).lean(),
      WeightEntry.find({ 'userId._id': user._id }).sort({ date: 1 }).lean(),
    ]);

    // Streaks are always recalculated from stored dates.
    const streaks = calculateStreaks(workouts.map((w) => w.date));
    const activity = buildActivityMap(
      workouts.map((w) => w.date),
      ACTIVITY_WINDOW_DAYS
    );

    const bests = recomputePersonalBests(workouts);
    const prWorkouts = workouts.filter((w) => w.pr);
    const totalDistance = workouts.reduce((sum, w) => sum + (Number(w.data?.distance) || 0), 0);
    const totalMinutes = workouts.reduce((sum, w) => sum + (Number(w.data?.duration) || 0), 0);
    const totalCalories = workouts.reduce((sum, w) => sum + (w.calories || 0), 0);
    const typeCounts = workouts.reduce((acc, w) => {
      acc[w.type] = (acc[w.type] || 0) + 1;
      return acc;
    }, {});

    const challenges = await Challenge.find({ 'members.user._id': user._id })
      .sort({ endDate: -1 })
      .limit(10)
      .lean();

    const first = weights[0]?.weight ?? null;
    const latest = weights[weights.length - 1]?.weight ?? null;

    res.json({
      success: true,
      handle: user.handle,
      isOwner: Boolean(req.user && String(req.user._id) === String(user._id)),
      user: {
        ...publicUser(user),
        streak: streaks.current,
        longestStreak: streaks.longest,
        createdAt: user.createdAt,
      },
      stats: {
        streak: streaks.current,
        longestStreak: streaks.longest,
        totalWorkouts: workouts.length,
        prCount: prWorkouts.length,
        totalDistance: Math.round(totalDistance * 100) / 100,
        totalMinutes: Math.round(totalMinutes),
        totalCalories: Math.round(totalCalories),
        typeCounts,
        activeDays: streaks.activeDays.length,
        firstWeight: first,
        latestWeight: latest,
        weightChange:
          first !== null && latest !== null ? Math.round((latest - first) * 10) / 10 : null,
      },
      weightHistory: weights.map((entry) => ({
        id: String(entry._id),
        date: entry.date,
        weight: entry.weight,
        note: entry.note || '',
      })),
      personalRecords: Object.entries(bests)
        .map(([key, best]) => ({
          key,
          workoutId: best.workoutId,
          date: best.date,
          value: best.value,
          previousBest: null,
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
      prs: prWorkouts.slice(0, 20).map((w) => workoutDto(w, { includeComments: false })),
      activity,
      challenges: challenges.map((challenge) => {
        const member = (challenge.members || []).find(
          (m) => String(m.user?._id) === String(user._id)
        );
        return {
          id: String(challenge._id),
          name: challenge.name,
          type: challenge.type,
          goal: challenge.goal,
          goalUnit: challenge.goalUnit,
          endDate: challenge.endDate,
          progress: Math.round((member?.progress || 0) * 100) / 100,
          memberCount: (challenge.members || []).length,
        };
      }),
      recentWorkouts: workouts.slice(0, 10).map((w) => workoutDto(w, { includeComments: false })),
    });
  } catch (error) {
    next(error);
  }
});

/** GET /api/stats/me/summary — dashboard numbers for the signed-in user. */
router.get('/me/summary', requireAuth, async (req, res, next) => {
  try {
    const workouts = await Workout.find({ 'userId._id': req.user._id }).lean();
    const streaks = calculateStreaks(workouts.map((w) => w.date));
    const prCount = workouts.filter((w) => w.pr).length;

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);
    const thisWeek = workouts.filter((w) => new Date(w.date) >= startOfWeek);

    res.json({
      success: true,
      streak: streaks.current,
      longestStreak: streaks.longest,
      totalWorkouts: workouts.length,
      prCount,
      thisWeekWorkouts: thisWeek.length,
      thisWeekCalories: thisWeek.reduce((sum, w) => sum + (w.calories || 0), 0),
      thisWeekMinutes: thisWeek.reduce((sum, w) => sum + (Number(w.data?.duration) || 0), 0),
      thisWeekDistance: Math.round(
        thisWeek.reduce((sum, w) => sum + (Number(w.data?.distance) || 0), 0) * 100
      ) / 100,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = { statsRouter: router };