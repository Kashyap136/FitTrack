const express = require('express');
const { Challenge } = require('../models/Challenge');
const { optionalAuth } = require('../middleware/auth');
const { ApiError, isValidId } = require('../utils/validators');
const { syncLeaderboards } = require('../utils/challengeProgress');
const { liveMemberUsers } = require('../utils/serializers');

const router = express.Router();

/**
 * GET /api/leaderboard/:challengeId
 * Ranked by progress descending. Ranks are 1-based; users are returned with
 * their handle so the frontend can link to /profile/[handle].
 */
router.get('/:challengeId', optionalAuth, async (req, res, next) => {
  try {
    const { challengeId } = req.params;
    if (!isValidId(challengeId)) throw ApiError.badRequest('Invalid challenge id');

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) throw ApiError.notFound('Challenge not found');

    // Keep the denormalised copy fresh if progress changed out of band.
    await syncLeaderboards([challenge._id]);
    const fresh = await Challenge.findById(challengeId);

    const viewerId = req.user?._id || null;
    const liveUsers = await liveMemberUsers(fresh);
    const sorted = [...(fresh.members || [])].sort(
      (a, b) => b.progress - a.progress || new Date(a.joinedAt) - new Date(b.joinedAt)
    );

    const rows = sorted.map((member, index) => {
      const live = liveUsers.get(String(member.user?._id)) || member.user;
      const streak = live?.streak || 0;

      return {
      rank: index + 1,
      user: {
        id: String(live?._id),
        name: live?.name,
        handle: live?.handle,
        avatarUrl: live?.avatarUrl || '',
        streak,
      },
      progress: Math.round((member.progress || 0) * 100) / 100,
      goal: member.goal || fresh.goal,
      streak,
      percent: fresh.goal > 0 ? Math.min(100, Math.round(((member.progress || 0) / fresh.goal) * 100)) : 0,
      completed: Boolean(member.completedAt),
      completedAt: member.completedAt || null,
      isViewer: viewerId ? String(member.user?._id) === String(viewerId) : false,
      };
    });

    const top = rows[0]?.progress || 0;

    res.json({
      success: true,
      challenge: {
        id: String(fresh._id),
        name: fresh.name,
        type: fresh.type,
        goal: fresh.goal,
        goalUnit: fresh.goalUnit,
        startDate: fresh.startDate,
        endDate: fresh.endDate,
        status: fresh.status(),
        memberCount: rows.length,
      },
      leaderboard: rows.map((row) => ({
        ...row,
        leader: row.rank === 1 && row.progress > 0,
        gapToLeader: top - row.progress,
      })),
      viewerRank: rows.find((row) => row.isViewer)?.rank ?? null,
    });
  } catch (error) {
    next(error);
  }
});

/** GET /api/leaderboard — challenges the viewer belongs to, best first. */
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    if (!req.user) throw ApiError.unauthorized('Sign in to view your leaderboards');

    // Include ended challenges so deep links to a finished board still resolve;
    // active and upcoming boards are listed first.
    const now = new Date();
    const challenges = await Challenge.find({ 'members.user._id': req.user._id });
    challenges.sort((a, b) => {
      const aEnded = a.endDate < now;
      const bEnded = b.endDate < now;
      if (aEnded !== bEnded) return aEnded ? 1 : -1;
      return a.endDate - b.endDate;
    });

    res.json({
      success: true,
      count: challenges.length,
      challenges: challenges.map((challenge) => {
        const sorted = [...challenge.members].sort((a, b) => b.progress - a.progress);
        const rank = sorted.findIndex((m) => String(m.user?._id) === String(req.user._id)) + 1;
        return {
          id: String(challenge._id),
          name: challenge.name,
          type: challenge.type,
          goal: challenge.goal,
          goalUnit: challenge.goalUnit,
          memberCount: challenge.members.length,
          endDate: challenge.endDate,
          myRank: rank || null,
          myProgress:
            Math.round(
              (sorted.find((m) => String(m.user?._id) === String(req.user._id))?.progress || 0) * 100
            ) / 100,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = { leaderboardRouter: router };