const express = require('express');
const { Challenge, CHALLENGE_TYPES } = require('../models/Challenge');
const { User } = require('../models/User');
const { Workout } = require('../models/Workout');
const { optionalAuth, requireAuth, resolveTargetUser } = require('../middleware/auth');
const { ApiError, isValidId, validateChallenge } = require('../utils/validators');
const { recalcMemberProgress, syncLeaderboards, workoutContribution } = require('../utils/challengeProgress');
const { challengeDto, liveMemberUsers } = require('../utils/serializers');

const router = express.Router();

/** GET /api/challenges/list?status=active|upcoming|ended|all */
router.get('/list', optionalAuth, async (req, res, next) => {
  try {
    const { status = 'all' } = req.query;
    const now = new Date();
    const filters = {
      all: {},
      active: { startDate: { $lte: now }, endDate: { $gte: now } },
      upcoming: { startDate: { $gt: now } },
      ended: { endDate: { $lt: now } },
    };

    if (!filters[status]) throw ApiError.badRequest('status must be active, upcoming, ended or all');

    const challenges = await Challenge.find(filters[status]).sort({ startDate: -1 });
    const viewerId = req.user?._id || null;
    const liveUsers = await liveMemberUsers(challenges);

    res.json({
      success: true,
      count: challenges.length,
      challenges: challenges.map((challenge) =>
        challengeDto(challenge, { currentUserId: viewerId, liveUsers })
      ),
    });
  } catch (error) {
    next(error);
  }
});

/** GET /api/challenges/types — supported challenge types for the UI. */
router.get('/types', (_req, res) => {
  res.json({
    success: true,
    types: CHALLENGE_TYPES.map((type) => ({
      type,
      unit: { run: 'km', plank: 'seconds', yoga: 'minutes', gym: 'sets' }[type],
    })),
  });
});

/** POST /api/challenges/create — create a challenge and auto-join the creator. */
router.post('/create', requireAuth, async (req, res, next) => {
  try {
    const payload = validateChallenge(req.body);
    const ownerId = resolveTargetUser(req, { bodyKey: 'createdBy' });

    const creator = await User.findById(ownerId);
    if (!creator) throw ApiError.notFound('User not found');

    const challenge = await Challenge.create({
      name: payload.name,
      description: payload.description,
      type: payload.type,
      goal: payload.goal,
      startDate: payload.startDate,
      endDate: payload.endDate,
      createdBy: creator.toObject(),
      members: [
        {
          user: creator.toObject(),
          progress: 0,
          goal: payload.goal,
          joinedAt: new Date(),
        },
      ],
    });

    await recalcMemberProgress(challenge._id, creator._id);

    const fresh = await Challenge.findById(challenge._id);
    res.status(201).json({
      success: true,
      message: `Challenge "${challenge.name}" created`,
      challenge: challengeDto(fresh, { currentUserId: creator._id }),
    });
  } catch (error) {
    next(error);
  }
});

/** POST /api/challenges/join — add a user to a challenge. */
router.post('/join', requireAuth, async (req, res, next) => {
  try {
    const challengeId = req.body?.challengeId;
    const userId = resolveTargetUser(req);

    if (!challengeId || !isValidId(challengeId)) {
      throw ApiError.badRequest('A valid challengeId is required');
    }

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) throw ApiError.notFound('Challenge not found');

    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    const alreadyMember = challenge.members.some((member) => String(member.user?._id) === String(userId));
    if (alreadyMember) {
      throw ApiError.conflict('You have already joined this challenge', {
        challengeId: String(challenge._id),
        joined: true,
      });
    }

    if (challenge.endDate.getTime() < Date.now()) {
      throw ApiError.badRequest('This challenge has already ended');
    }

    challenge.members.push({
      user: user.toObject(),
      progress: 0,
      goal: challenge.goal,
      joinedAt: new Date(),
    });
    await challenge.save();

    // Historical workouts inside the window count towards progress immediately.
    await recalcMemberProgress(challenge._id, user._id);

    const updated = await Challenge.findById(challenge._id);
    const member = updated.members.find((m) => String(m.user?._id) === String(userId));

    res.status(200).json({
      success: true,
      message: `Joined ${updated.name}`,
      challenge: challengeDto(updated, { currentUserId: user._id }),
      progress: member?.progress || 0,
    });
  } catch (error) {
    next(error);
  }
});

/** POST /api/challenges/leave — remove the signed-in user from a challenge. */
router.post('/leave', requireAuth, async (req, res, next) => {
  try {
    const challengeId = req.body?.challengeId;
    if (!challengeId || !isValidId(challengeId)) throw ApiError.badRequest('A valid challengeId is required');

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) throw ApiError.notFound('Challenge not found');

    const index = challenge.members.findIndex((m) => String(m.user?._id) === String(req.user._id));
    if (index === -1) throw ApiError.conflict('You are not a member of this challenge');

    challenge.members.splice(index, 1);
    await challenge.save();
    await syncLeaderboards([challenge._id]);

    res.json({ success: true, message: `Left ${challenge.name}` });
  } catch (error) {
    next(error);
  }
});

/** GET /api/challenges/:id — single challenge with members + progress. */
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) throw ApiError.badRequest('Invalid challenge id');
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) throw ApiError.notFound('Challenge not found');

    const viewerId = req.user?._id || req.body?.userId || null;
    res.json({
      success: true,
      challenge: challengeDto(challenge, {
        currentUserId: viewerId,
        liveUsers: await liveMemberUsers(challenge),
      }),
    });
  } catch (error) {
    next(error);
  }
});

/** GET /api/challenges/mine/list — challenges the signed-in user has joined. */
router.get('/mine/list', requireAuth, async (req, res, next) => {
  try {
    const challenges = await Challenge.find({ 'members.user._id': req.user._id }).sort({ endDate: -1 });
    const liveUsers = await liveMemberUsers(challenges);
    res.json({
      success: true,
      count: challenges.length,
      challenges: challenges.map((challenge) =>
        challengeDto(challenge, { currentUserId: req.user._id, liveUsers })
      ),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/challenges/:id/log — recent workouts of the signed-in member that
 * contribute to the challenge, so the UI can show what moved their progress.
 */
router.get('/:id/log', requireAuth, async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) throw ApiError.badRequest('Invalid challenge id');
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) throw ApiError.notFound('Challenge not found');

    const workouts = await Workout.find({
      'userId._id': req.user._id,
      date: { $gte: challenge.startDate, $lte: challenge.endDate },
    })
      .sort({ date: -1 })
      .limit(25)
      .lean();

    const contributions = workouts
      .map((workout) => ({ workout, amount: workoutContribution(workout, challenge.type) }))
      .filter((entry) => entry.amount > 0);

    res.json({
      success: true,
      challenge: challengeDto(challenge, { currentUserId: req.user._id }),
      contributions: contributions.map(({ workout, amount }) => ({
        workoutId: String(workout._id),
        type: workout.type,
        date: workout.date,
        calories: workout.calories,
        contribution: Math.round(amount * 100) / 100,
        pr: workout.pr,
      })),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = { challengeRouter: router };