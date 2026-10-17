const mongoose = require('mongoose');
const { Challenge, CHALLENGE_UNIT } = require('../models/Challenge');
const { Workout } = require('../models/Workout');
const { ApiError } = require('./validators');

/**
 * Convert a workout into challenge progress. Returns 0 when the workout does
 * not contribute to the given challenge type.
 */
function workoutContribution(workout, challengeType) {
  const data = workout.data || {};
  const unit = CHALLENGE_UNIT[challengeType];
  if (!unit) return 0;

  if (challengeType === 'run' && workout.type !== 'run') return 0;
  if (challengeType === 'yoga' && workout.type !== 'yoga') return 0;
  if (challengeType === 'gym' && workout.type !== 'gym') return 0;
  // Plank challenges only count logged hold time, so a session that never
  // recorded a hold contributes nothing and the metric stays unambiguous.
  if (challengeType === 'plank') {
    const hold = Number(data.holdSeconds) || 0;
    return hold > 0 ? Math.round(hold * 100) / 100 : 0;
  }

  const value = unit.per.reduce((total, key) => total + (Number(data[key]) || 0), 0);
  return Math.round(value * 100) / 100;
}

/**
 * Add a workout's contribution to every challenge the member is part of.
 * Called right after a workout is created (and after recalculation helpers).
 */
async function applyWorkoutToChallenges({ user, workout }) {
  if (!user?._id) return [];

  const challenges = await Challenge.find({
    'members.user._id': user._id,
  });

  const updated = [];
  const membershipUpdates = [];

  challenges.forEach((challenge) => {
    const amount = workoutContribution(workout, challenge.type);
    const index = challenge.members.findIndex((m) => String(m.user?._id) === String(user._id));
    if (index === -1) return;

    const withinWindow =
      workout.date >= challenge.startDate && workout.date <= challenge.endDate;
    if (!withinWindow) return;

    const member = challenge.members[index];
    const goal = challenge.goal;
    const nextProgress = Math.round(Math.min(goal, member.progress + amount) * 100) / 100;

    membershipUpdates.push({
      challengeId: challenge._id,
      index,
      progress: nextProgress,
      completedAt: nextProgress >= goal ? member.completedAt || workout.date : null,
      type: challenge.type,
    });

    updated.push(challenge);
  });

  await Promise.all(
    membershipUpdates.map((entry) =>
      Challenge.updateOne(
        { _id: entry.challengeId },
        {
          $set: {
            [`members.${entry.index}.progress`]: entry.progress,
            [`members.${entry.index}.completedAt`]: entry.completedAt,
          },
        }
      )
    )
  );

  if (updated.length) await syncLeaderboards(updated.map((c) => c._id));
  return updated;
}

/**
 * Recalculate a member's progress from scratch for one challenge.
 * Used when a member joins mid-challenge so historical workouts count.
 */
async function recalcMemberProgress(challengeId, userId) {
  const challenge = await Challenge.findById(challengeId);
  if (!challenge) throw ApiError.notFound('Challenge not found');

  const { Workout: WorkoutModel } = require('../models/Workout');
  const workouts = await WorkoutModel.find({
    'userId._id': userId,
    date: { $gte: challenge.startDate, $lte: challenge.endDate },
  }).select('type data date');

  const amount = workouts.reduce((total, workout) => total + workoutContribution(workout, challenge.type), 0);
  const progress = Math.round(Math.min(challenge.goal, amount) * 100) / 100;
  const index = challenge.members.findIndex((m) => String(m.user?._id) === String(userId));

  if (index === -1) return challenge;

  // `updateOne` on the indexed member position keeps concurrent recalculations
  // for different members of the same challenge free of version conflicts.
  await Challenge.updateOne(
    { _id: challenge._id },
    {
      $set: {
        [`members.${index}.progress`]: progress,
        [`members.${index}.completedAt`]:
          progress >= challenge.goal ? challenge.members[index].completedAt || new Date() : null,
      },
    }
  );

  challenge.members[index].progress = progress;
  challenge.members[index].completedAt =
    progress >= challenge.goal ? challenge.members[index].completedAt || new Date() : null;

  await syncLeaderboards([challenge._id]);
  return challenge;
}

/**
 * Persist a denormalised leaderboard copy (sorted by progress descending)
 * so `/api/leaderboard/:challengeId` stays a single document read.
 */
async function syncLeaderboards(challengeIds) {
  const ids = (challengeIds || []).filter(Boolean).map((id) => (id?._id ? id._id : id));
  if (!ids.length) return;

  const challenges = await Challenge.find({ _id: { $in: ids } }).lean();
  await Promise.all(
    challenges.map((challenge) =>
      Challenge.updateOne(
        { _id: challenge._id },
        {
          $set: {
            leaderboard: [...(challenge.members || [])].sort(
              (a, b) => b.progress - a.progress || new Date(a.joinedAt) - new Date(b.joinedAt)
            ),
          },
        }
      )
    )
  );
}

const isValidChallengeId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));

module.exports = {
  applyWorkoutToChallenges,
  isValidChallengeId,
  recalcMemberProgress,
  syncLeaderboards,
  workoutContribution,
};