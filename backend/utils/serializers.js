/**
 * Response shaping. Serialisers keep Mongoose internals (`_id`, timestamps,
 * embedded snapshots) out of the API and produce a stable frontend contract.
 */

const toId = (value) => (value?._id?.toString?.() ?? value?.toString?.() ?? value ?? null);

/** Compact public user payload embedded in feed cards and leaderboards. */
function publicUser(user) {
  if (!user) return null;
  if (user._id === undefined && user.id !== undefined) return user;

  const source = typeof user.toObject === 'function' ? user.toObject() : user;
  return {
    id: toId(source._id ?? source.id),
    name: source.name,
    handle: source.handle,
    avatarUrl: source.avatarUrl || '',
    weight: source.weight ?? null,
    streak: source.streak ?? 0,
    longestStreak: source.longestStreak ?? source.streak ?? 0,
    bio: source.bio || '',
    location: source.location || '',
  };
}

/**
 * Session payload for the signed-in user. Adds the account email on top of the
 * public shape — it is only ever returned to the owner of the token.
 */
function sessionUser(user) {
  if (!user) return null;
  if (user._id === undefined && user.id !== undefined) return user;
  const source = typeof user.toObject === 'function' ? user.toObject() : user;
  return { ...publicUser(source), email: source.email || '' };
}

function workoutSummary(type, data = {}) {
  switch (type) {
    case 'run':
      return data.distance > 0
        ? `${Number(data.distance).toFixed(1)} km`
        : `${data.duration || 0} min`;
    case 'gym':
      return data.sets > 0 && data.reps > 0
        ? `${data.sets} × ${data.reps}`
        : `${data.duration || 0} min`;
    case 'yoga':
      return `${data.duration || 0} min flow`;
    default:
      return 'Workout';
  }
}

function pacePerKm(data = {}) {
  const distance = Number(data.distance) || 0;
  const duration = Number(data.duration) || 0;
  if (distance <= 0 || duration <= 0) return null;
  const minutesPerKm = duration / distance;
  const minutes = Math.floor(minutesPerKm);
  const seconds = Math.round((minutesPerKm - minutes) * 60);
  return `${minutes}:${`${seconds}`.padStart(2, '0')}`;
}

function commentDto(comment) {
  return {
    id: toId(comment._id) || `${comment.user?.handle}-${comment.createdAt}`,
    text: comment.text,
    createdAt: comment.createdAt,
    user: publicUser(comment.user),
  };
}

function workoutDto(workout, { includeComments = true } = {}) {
  if (!workout) return null;
  const source = typeof workout.toObject === 'function' ? workout.toObject() : workout;
  const likes = source.likes || [];

  return {
    id: toId(source._id ?? source.id),
    user: publicUser(source.userId),
    type: source.type,
    title: source.title || '',
    notes: source.notes || '',
    data: source.data || {},
    summary: workoutSummary(source.type, source.data || {}),
    pace: pacePerKm(source.data || {}),
    calories: source.calories ?? 0,
    date: source.date,
    pr: Boolean(source.pr),
    prHighlights: source.prHighlights || [],
    likeCount: source.likeCount ?? likes.length,
    commentCount: source.commentCount ?? (source.comments || []).length,
    likedBy: likes.map((like) => toId(like.user?._id ?? like.user)).filter(Boolean),
    likes: likes.map((like) => ({
      user: publicUser(like.user),
      createdAt: like.createdAt,
    })),
    comments: includeComments
      ? (source.comments || []).slice(-20).map(commentDto)
      : undefined,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

/**
 * Challenge members embed a snapshot of the user document. Streaks and profile
 * edits happen outside the challenge, so responses may pass a freshly loaded
 * user to keep the shown values accurate.
 */
function memberDto(member, liveUser) {
  return {
    progress: Math.round((member.progress || 0) * 100) / 100,
    goal: member.goal || 0,
    completedAt: member.completedAt || null,
    joinedAt: member.joinedAt,
    completed: Boolean(member.completedAt),
    user: publicUser(liveUser || member.user),
  };
}

/** Batch-load the users referenced by challenge members, keyed by id string. */
async function liveMemberUsers(challenges) {
  const list = Array.isArray(challenges) ? challenges : [challenges];
  const ids = new Set();
  for (const challenge of list) {
    for (const member of challenge?.members || []) {
      const id = member?.user?._id;
      if (id) ids.add(String(id));
    }
  }
  if (!ids.size) return new Map();

  const { User } = require('../models/User');
  const users = await User.find({ _id: { $in: [...ids] } })
    .select('name handle avatarUrl weight streak longestStreak bio location')
    .lean();

  return new Map(users.map((user) => [String(user._id), user]));
}

function challengeDto(challenge, { currentUserId = null, liveUsers = null } = {}) {
  if (!challenge) return null;
  const source = typeof challenge.toObject === 'function' ? challenge.toObject() : challenge;
  const now = Date.now();
  const status =
    new Date(source.startDate).getTime() > now
      ? 'upcoming'
      : new Date(source.endDate).getTime() < now
        ? 'ended'
        : 'active';

  const members = [...(source.members || [])]
    .sort((a, b) => b.progress - a.progress || new Date(a.joinedAt) - new Date(b.joinedAt))
    .map((member) =>
      memberDto(member, liveUsers ? liveUsers.get(String(member.user?._id)) : null)
    );

  const me = (source.members || []).find(
    (member) => currentUserId && String(member.user?._id) === String(currentUserId)
  );

  const goal = source.goal || 0;
  const topProgress = members.length ? Math.max(...members.map((m) => m.progress || 0)) : 0;

  return {
    id: toId(source._id ?? source.id),
    name: source.name,
    description: source.description || '',
    type: source.type,
    goal,
    goalUnit: source.goalUnit || '',
    startDate: source.startDate,
    endDate: source.endDate,
    status,
    memberCount: members.length,
    createdBy: publicUser(source.createdBy),
    members,
    leaderboard: members,
    joined: Boolean(me),
    myProgress: me ? Math.round((me.progress || 0) * 100) / 100 : 0,
    myRank: me ? members.findIndex((m) => m.user?.id === toId(me.user?._id)) + 1 || null : null,
    progressPercent: goal > 0 ? Math.min(100, Math.round((topProgress / goal) * 100)) : 0,
    daysLeft: Math.max(0, Math.ceil((new Date(source.endDate).getTime() - now) / 86400000)),
    createdAt: source.createdAt,
  };
}

function groupDto(group) {
  if (!group) return null;
  const source = typeof group.toObject === 'function' ? group.toObject() : group;
  return {
    id: toId(source._id ?? source.id),
    name: source.name,
    description: source.description || '',
    type: source.type,
    memberCount: source.members?.length || 0,
    isPrivate: Boolean(source.isPrivate),
    members: (source.members || []).map(publicUser),
  };
}

module.exports = {
  challengeDto,
  groupDto,
  liveMemberUsers,
  memberDto,
  pacePerKm,
  publicUser,
  userDto: publicUser,
  workoutDto,
  workoutSummary,
};