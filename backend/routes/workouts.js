const express = require('express');
const { Workout } = require('../models/Workout');
const { User } = require('../models/User');
const { Challenge } = require('../models/Challenge');
const { requireAuth, resolveTargetUser } = require('../middleware/auth');
const { ApiError, isValidId, validateWorkout } = require('../utils/validators');
const { detectPR, recomputePersonalBests } = require('../utils/pr');
const { calculateStreaks } = require('../utils/streak');
const { applyWorkoutToChallenges, recalcMemberProgress } = require('../utils/challengeProgress');
const { workoutDto, publicUser } = require('../utils/serializers');

const router = express.Router();

/**
 * Recompute and persist the user's streak from their stored workout history.
 */
async function refreshStreak(userId) {
  const dates = await Workout.find({ 'userId._id': userId }).select('date').lean();
  const { current, longest } = calculateStreaks(dates.map((d) => d.date));
  const lastWorkoutDate = dates.length
    ? new Date(Math.max(...dates.map((d) => new Date(d.date).getTime())))
    : null;

  await User.updateOne(
    { _id: userId },
    { $set: { streak: current, longestStreak: Math.max(longest, current), lastWorkoutDate } }
  );

  return current;
}

/** Recalculate challenge progress for every challenge the user belongs to. */
async function refreshChallenges(userId) {
  const challenges = await Challenge.find({ 'members.user._id': userId }).select('_id');
  await Promise.all(challenges.map((challenge) => recalcMemberProgress(challenge._id, userId)));
}

/**
 * Replay a user's entire workout history through the PR detector so stored
 * `pr` flags and highlights always match the current history. This keeps
 * back-dated logs and edits/deletes consistent across every session.
 *
 * @returns {Promise<{ prCount: number, byId: Map<string, { pr: boolean, highlights: string[] }> }>}
 */
async function recomputeUserPRs(userId) {
  const workouts = await Workout.find({ 'userId._id': userId })
    .sort({ date: 1, createdAt: 1 })
    .lean();

  const history = [];
  const byId = new Map();
  const ops = [];
  let prCount = 0;

  workouts.forEach((workout) => {
    const { pr, highlights } = detectPR(workout, recomputePersonalBests(history));
    byId.set(String(workout._id), { pr, highlights });
    if (pr) prCount += 1;

    const previousHighlights = workout.prHighlights || [];
    const changed =
      Boolean(workout.pr) !== pr ||
      previousHighlights.length !== highlights.length ||
      previousHighlights.some((value, index) => value !== highlights[index]);

    if (changed) {
      ops.push({
        updateOne: {
          filter: { _id: workout._id },
          update: { $set: { pr, prHighlights: highlights } },
        },
      });
    }

    history.push(workout);
  });

  if (ops.length) await Workout.bulkWrite(ops, { ordered: false });

  return { prCount, byId };
}

/** GET /api/workouts/prs/mine — every personal record for the signed-in user. */
router.get('/prs/mine', requireAuth, async (req, res, next) => {
  try {
    const workouts = await Workout.find({ 'userId._id': req.user._id, pr: true })
      .sort({ date: -1 })
      .lean();
    res.json({ success: true, count: workouts.length, workouts: workouts.map((w) => workoutDto(w)) });
  } catch (error) {
    next(error);
  }
});

/** GET /api/workouts/my?type=&limit= — the signed-in user's own history. */
router.get('/my', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const filter = { 'userId._id': req.user._id };
    if (req.query.type) filter.type = String(req.query.type).toLowerCase();

    const workouts = await Workout.find(filter)
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, count: workouts.length, workouts: workouts.map((w) => workoutDto(w)) });
  } catch (error) {
    next(error);
  }
});

/** POST /api/workouts/create — log a workout, detect a PR, update streak. */
router.post('/create', requireAuth, async (req, res, next) => {
  try {
    const userId = resolveTargetUser(req);
    const payload = validateWorkout(req.body);

    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    const workout = await Workout.create({
      userId: user.toObject(),
      type: payload.type,
      title: payload.title,
      notes: payload.notes,
      data: payload.data,
      calories: payload.calories,
      date: payload.date,
      pr: false,
      prHighlights: [],
    });

    // Replay the full history so back-dated logs are judged correctly too.
    const { byId } = await recomputeUserPRs(userId);
    const { pr, highlights } = byId.get(String(workout._id)) || { pr: false, highlights: [] };
    workout.pr = pr;
    workout.prHighlights = highlights;

    const streak = await refreshStreak(userId);
    const touchedChallenges = await applyWorkoutToChallenges({ user, workout });

    res.status(201).json({
      success: true,
      message: pr ? 'Personal record! Workout logged.' : 'Workout logged successfully',
      workout: workoutDto(workout),
      pr: { achieved: pr, highlights, count: highlights.length },
      streak,
      challengeProgress: touchedChallenges.map((challenge) => ({
        id: challenge._id,
        name: challenge.name,
        type: challenge.type,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/** GET /api/workouts/:id — a single workout (own, or any public one). */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) throw ApiError.badRequest('Invalid workout id');
    const workout = await Workout.findById(req.params.id).lean();
    if (!workout) throw ApiError.notFound('Workout not found');

    res.json({ success: true, workout: workoutDto(workout) });
  } catch (error) {
    next(error);
  }
});

/** PUT /api/workouts/:id — edit a workout and re-evaluate its PR status. */
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) throw ApiError.badRequest('Invalid workout id');

    const workout = await Workout.findById(req.params.id);
    if (!workout) throw ApiError.notFound('Workout not found');
    if (String(workout.userId?._id) !== String(req.user._id)) {
      throw ApiError.forbidden('You can only edit your own workouts');
    }

    // Optional numeric fields default to 0 in the database. Treat those stored
    // defaults as "not provided" so re-validating a partial edit does not fail
    // min-value checks (e.g. an untouched avgHeartRate of 0).
    const storedData = Object.entries(workout.data?.toObject?.() ?? workout.data ?? {}).reduce(
      (acc, [key, value]) => {
        if (value !== 0 && value !== '' && value !== null && value !== undefined) acc[key] = value;
        return acc;
      },
      {}
    );

    const payload = validateWorkout({
      type: req.body.type ?? workout.type,
      data: { ...storedData, ...(req.body.data || {}) },
      calories: req.body.calories ?? workout.calories,
      date: req.body.date ?? workout.date,
      notes: req.body.notes ?? workout.notes,
      title: req.body.title ?? workout.title,
    });

    workout.type = payload.type;
    workout.data = payload.data;
    workout.calories = payload.calories;
    workout.date = payload.date;
    workout.notes = payload.notes;
    workout.title = payload.title;

    await workout.save();

    // Editing an older session can change later records, so replay history.
    const { byId } = await recomputeUserPRs(req.user._id);
    const { pr, highlights } = byId.get(String(workout._id)) || { pr: false, highlights: [] };
    workout.pr = pr;
    workout.prHighlights = highlights;

    // Historical edits can shift bests, streaks and challenge progress.
    const streak = await refreshStreak(req.user._id);
    await refreshChallenges(req.user._id);

    res.json({
      success: true,
      message: 'Workout updated',
      workout: workoutDto(workout),
      pr: { achieved: pr, highlights },
      streak,
    });
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/workouts/:id — remove a workout and recalculate derived stats. */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) throw ApiError.badRequest('Invalid workout id');

    const workout = await Workout.findById(req.params.id);
    if (!workout) throw ApiError.notFound('Workout not found');
    if (String(workout.userId?._id) !== String(req.user._id)) {
      throw ApiError.forbidden('You can only delete your own workouts');
    }

    await workout.deleteOne();
    await recomputeUserPRs(req.user._id);
    const streak = await refreshStreak(req.user._id);
    await refreshChallenges(req.user._id);

    res.json({ success: true, message: 'Workout deleted', streak });
  } catch (error) {
    next(error);
  }
});

/** POST /api/workouts/:id/like — toggle the signed-in user's like. */
router.post('/:id/like', requireAuth, async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) throw ApiError.badRequest('Invalid workout id');

    const workout = await Workout.findById(req.params.id);
    if (!workout) throw ApiError.notFound('Workout not found');

    const userId = String(req.user._id);
    const existingIndex = workout.likes.findIndex((like) => String(like.user?._id) === userId);

    if (existingIndex >= 0) workout.likes.splice(existingIndex, 1);
    else workout.likes.push({ user: req.user.toObject(), createdAt: new Date() });

    workout.likeCount = workout.likes.length;
    await workout.save();

    res.json({
      success: true,
      liked: existingIndex === -1,
      likeCount: workout.likeCount,
      workoutId: String(workout._id),
      message: existingIndex === -1 ? 'Liked workout' : 'Like removed',
    });
  } catch (error) {
    next(error);
  }
});

/** POST /api/workouts/:id/comment — add a comment to a workout. */
router.post('/:id/comment', requireAuth, async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) throw ApiError.badRequest('Invalid workout id');
    const text = String(req.body?.text || req.body?.comment || '').trim();
    if (!text) throw ApiError.badRequest('Comment cannot be empty');
    if (text.length > 500) throw ApiError.badRequest('Comment must be 500 characters or fewer');

    const workout = await Workout.findById(req.params.id);
    if (!workout) throw ApiError.notFound('Workout not found');

    workout.comments.push({ user: req.user.toObject(), text, createdAt: new Date() });
    workout.commentCount = workout.comments.length;
    await workout.save();

    const created = workout.comments[workout.comments.length - 1];

    res.status(201).json({
      success: true,
      message: 'Comment added',
      commentCount: workout.commentCount,
      comment: {
        id: String(created._id),
        text: created.text,
        createdAt: created.createdAt,
        user: publicUser(created.user),
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = { workoutRouter: router, refreshChallenges, refreshStreak };