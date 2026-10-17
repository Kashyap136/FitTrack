/* eslint-disable no-console */
/**
 * FitTrack demo seed.
 *
 * Run with `npm run seed` from `backend/`. The script is fully deterministic:
 *   1. wipes the FitTrack collections
 *   2. creates the eight demo athletes (password: DEMO_PASSWORD, default FitTrack@123)
 *   3. generates ~12 weeks of workout history from the plans in `data.js`
 *   4. replays that history through the real PR detector so every personal
 *      record, streak and challenge number matches what the API would produce
 *   5. adds likes, comments, weight history, challenges and crews
 *
 * Nothing here bypasses application logic: streaks come from `calculateStreaks`
 * and challenge progress from `recalcMemberProgress`, exactly as at runtime.
 */

require('dotenv').config();

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const config = require('../config/env');
const { User } = require('../models/User');
const { Workout } = require('../models/Workout');
const { Challenge } = require('../models/Challenge');
const { Group } = require('../models/Group');
const { WeightEntry } = require('../models/WeightEntry');
const { calculateStreaks } = require('../utils/streak');
const { detectPR, recomputePersonalBests } = require('../utils/pr');
const { recalcMemberProgress, syncLeaderboards } = require('../utils/challengeProgress');
const { refreshStreak } = require('../routes/workouts');

const { USERS, GROUPS, CHALLENGES, COMMENT_POOL, DEFAULT_LIKERS } = require('./data');

const HISTORY_DAYS = 84;
const SALT_ROUNDS = 10;
const LIKE_WINDOW_DAYS = 21;
const COMMENT_WORKOUT_COUNT = 14;

/* ----------------------------------------------------------------- helpers */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Deterministic PRNG so every seed run produces the same dataset. */
function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const round = (value, decimals = 1) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const startOfDay = (date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const daysAgo = (offset) => new Date(startOfDay(new Date()).getTime() - offset * DAY_MS);
const daysAhead = (offset) => new Date(startOfDay(new Date()).getTime() + offset * DAY_MS);
/** Negative offsets are in the past, positive offsets are in the future. */
const relativeDay = (offset) => (offset < 0 ? daysAgo(-offset) : daysAhead(offset));

/** Pick a value from a list using the supplied PRNG. */
const pick = (rand, list) => list[Math.floor(rand() * list.length) % list.length];
const between = (rand, min, max) => min + rand() * (max - min);

/* ------------------------------------------------------- workout generation */

const RUN_TITLES = ['Easy Run', 'Tempo Run', 'Interval Run', 'Park Loop', 'Sunset Run', 'Recovery Jog'];
const RUN_NOTES = [
  'Legs felt heavy for the first two kilometres, then it opened up.',
  'Negative split without trying too hard.',
  'Kept the heart rate in zone 3 the whole way.',
  'Humidity was brutal, cut it short.',
  'Best run of the block so far.',
  'Easy conversational pace with Rohan.',
];
const YOGA_TITLES = ['Sunrise Flow', 'Evening Reset', 'Vinyasa', 'Slow Flow', 'Yin Session'];
const YOGA_NOTES = [
  'Long holds in the last third, hips finally loosened.',
  'Focused on breath over posture.',
  'Hot room, worth it.',
  'Short but steadier than last week.',
  'Recovery session after a heavy lifting day.',
];
const GYM_NOTES = [
  'Last two sets were grindy but clean.',
  'Added a pause on the eccentric.',
  'Bar path felt much better today.',
  'Deload felt right.',
  'New grip, no blisters.',
];

/** Build the plain workout document for one calendar day. */
function buildWorkout({ user, rand, offset, date, type, runIndex }) {
  // Progression advances roughly one unit per week of history.
  const weeks = (HISTORY_DAYS - offset) / 7;
  const hour = Math.floor(between(rand, 5.5, 20.5));
  const minute = Math.floor(between(rand, 0, 59));
  const when = new Date(date);
  when.setHours(hour, minute, 0, 0);

  if (type === 'run') {
    const isLongRun = user.longRunEvery && runIndex > 0 && runIndex % user.longRunEvery === 0;
    const base = isLongRun
      ? user.longRunDistance
      : user.runBase.distance + user.progression.distance * weeks + between(rand, -0.9, 0.9);
    const distance = round(Math.max(2.5, base), 2);
    const pace = Math.max(4.1, user.runBase.pace + user.progression.pace * weeks + between(rand, -0.28, 0.28));
    const duration = Math.max(10, Math.round(distance * pace));

    return {
      type: 'run',
      title: isLongRun ? 'Long Run' : pick(rand, RUN_TITLES),
      notes: isLongRun ? 'Full distance effort, fuel on the move.' : pick(rand, RUN_NOTES),
      data: {
        type: 'run',
        duration,
        distance,
        intensity: Math.round(between(rand, 4, 9)),
        avgHeartRate: Math.round(between(rand, 138, 172)),
      },
      calories: Math.round(distance * 58 + duration * 0.9),
      date: when,
    };
  }

  if (type === 'gym') {
    const load = round(Math.max(user.gymBase.weight, user.gymBase.weight + user.progression.load * weeks + between(rand, -3.5, 3.5)), 1);
    const sets = user.gymBase.sets + (rand() < 0.3 ? 1 : 0);
    const reps = user.gymBase.reps + (rand() < 0.22 ? 1 : 0) + (rand() < 0.08 ? 2 : 0);
    const duration = Math.max(20, Math.round((sets * reps * 3 + between(rand, 8, 22)) / 5) * 5);
    const data = {
      type: 'gym',
      exercise: user.gymBase.exercise,
      sets,
      reps,
      weight: load,
      duration,
      intensity: Math.round(between(rand, 5, 10)),
      avgHeartRate: Math.round(between(rand, 112, 152)),
    };
    // Plank accessories are logged as hold time so plank challenges have data.
    if (user.plankOnGym) data.holdSeconds = Math.round(between(rand, 150, 260));

    return {
      type: 'gym',
      title: user.gymBase.exercise,
      notes: pick(rand, GYM_NOTES),
      data,
      calories: Math.round(sets * reps * 3.4 + duration * 4.6),
      date: when,
    };
  }

  const duration = Math.max(15, Math.round(user.yogaBase.duration + between(rand, -12, 18)));
  return {
    type: 'yoga',
    title: pick(rand, YOGA_TITLES),
    notes: pick(rand, YOGA_NOTES),
    data: {
      type: 'yoga',
      duration,
      holdSeconds: Math.round(between(rand, user.yogaBase.holdSeconds - 45, user.yogaBase.holdSeconds + 55)),
      intensity: Math.round(between(rand, 2, 7)),
      avgHeartRate: Math.round(between(rand, 78, 116)),
    },
    calories: Math.round(duration * 3.4 + 25),
    date: when,
  };
}

function generateWorkouts(user) {
  const rand = mulberry32(hashString(user.handle));
  const docs = [];
  let runIndex = 0;

  // Walk backwards from today so the plan is applied per weekday.
  for (let offset = HISTORY_DAYS - 1; offset >= 0; offset -= 1) {
    const date = daysAgo(offset);
    const type = user.plan[date.getDay()];
    if (!type) continue;
    if (rand() < user.skipRate) continue;

    const workout = buildWorkout({ user, rand, offset, date, type, runIndex });
    if (type === 'run') runIndex += 1;
    docs.push(workout);
  }

  return docs;
}

/* --------------------------------------------------------------- seed steps */

async function clearDatabase() {
  await Promise.all([
    User.deleteMany({}),
    Workout.deleteMany({}),
    Challenge.deleteMany({}),
    Group.deleteMany({}),
    WeightEntry.deleteMany({}),
  ]);
}

async function createUsers() {
  const passwordHash = await bcrypt.hash(config.demoPassword, SALT_ROUNDS);
  const users = [];

  for (const definition of USERS) {
    const user = await User.create({
      name: definition.name,
      handle: definition.handle,
      email: definition.email,
      passwordHash,
      avatarUrl: '',
      bio: definition.bio,
      location: definition.location,
      weight: definition.weight,
      settings: {
        notifications: {
          workoutReminders: true,
          prAlerts: true,
          challengeUpdates: true,
          socialActivity: definition.handle !== 'ishitafit',
        },
        language: definition.language,
        units: 'metric',
        upiId: definition.upiId,
      },
      isPublic: true,
    });
    users.push({ doc: user, definition });
  }

  return users;
}

async function insertWorkouts(users) {
  const docs = [];
  for (const { doc, definition } of users) {
    for (const workout of generateWorkouts(definition)) {
      docs.push({ ...workout, userId: doc.toObject() });
    }
  }

  const inserted = await Workout.insertMany(docs, { ordered: true });
  return inserted;
}

/**
 * Replay every user's history in date order through the live PR detector.
 * The first workout of a kind is never a PR, and only genuine improvements
 * are flagged, exactly as `POST /api/workouts/create` behaves.
 */
async function applyPersonalRecords() {
  const users = await User.find().select('_id handle').lean();
  const operations = [];
  let prCount = 0;

  for (const user of users) {
    const workouts = await Workout.find({ 'userId._id': user._id }).sort({ date: 1, createdAt: 1 }).lean();
    const history = [];

    for (const workout of workouts) {
      const bests = recomputePersonalBests(history);
      const { pr, highlights } = detectPR(workout, bests);
      if (pr) {
        operations.push({
          updateOne: {
            filter: { _id: workout._id },
            update: { $set: { pr: true, prHighlights: highlights } },
          },
        });
        prCount += 1;
      }
      history.push(workout);
    }
  }

  if (operations.length) await Workout.bulkWrite(operations);
  return prCount;
}

/** Spread the demo weight history evenly across the last ~6 months. */
async function insertWeightHistory(users) {
  const spanDays = 180;
  const entries = [];

  for (const { doc, definition } of users) {
    const weights = definition.weights;
    const step = spanDays / (weights.length - 1);

    weights.forEach((weight, index) => {
      const date = new Date(startOfDay(new Date()).getTime() - Math.round(spanDays - index * step) * DAY_MS);
      date.setHours(7, 30, 0, 0);
      entries.push({
        userId: doc.toObject(),
        weight,
        date,
        note: index === weights.length - 1 ? 'Current weight' : '',
      });
    });
  }

  await WeightEntry.insertMany(entries, { ordered: true });
  return entries.length;
}

/** Add likes to recent workouts and comments to the newest ones. */
async function addSocialActivity(users) {
  const byHandle = new Map(users.map((u) => [u.definition.handle, u.doc]));

  const recent = await Workout.find({ date: { $gte: daysAgo(LIKE_WINDOW_DAYS) } })
    .sort({ date: -1 })
    .lean();

  const likeOps = [];
  recent.forEach((workout, index) => {
    const rand = mulberry32(hashString(`${workout.userId.handle}-${workout._id}`));
    const ownerHandle = workout.userId.handle;
    const candidates = DEFAULT_LIKERS.filter((handle) => handle !== ownerHandle);
    const likeCount = Math.floor(rand() * 4);

    const likes = [];
    for (let i = 0; i < likeCount; i += 1) {
      const handle = candidates[(index + i * 3) % candidates.length];
      const liked = byHandle.get(handle);
      if (liked && !likes.some((entry) => String(entry.user._id) === String(liked._id))) {
        likes.push({ user: liked.toObject(), createdAt: new Date(new Date(workout.date).getTime() + 3600000 * (i + 1)) });
      }
    }

    likeOps.push({
      updateOne: {
        filter: { _id: workout._id },
        update: { $set: { likes, likeCount: likes.length } },
      },
    });
  });

  if (likeOps.length) await Workout.bulkWrite(likeOps);

  // Comments only on the newest posts, so the feed reads like a real thread.
  const newest = recent.slice(0, COMMENT_WORKOUT_COUNT);
  const commentOps = [];

  newest.forEach((workout, index) => {
    const rand = mulberry32(hashString(`comment-${workout._id}`));
    const ownerHandle = workout.userId.handle;
    const candidates = DEFAULT_LIKERS.filter((handle) => handle !== ownerHandle);
    const count = 1 + Math.floor(rand() * 2);
    const comments = [];

    for (let i = 0; i < count; i += 1) {
      const handle = candidates[(index * 2 + i) % candidates.length];
      const commenter = byHandle.get(handle);
      if (!commenter) continue;
      const pool = COMMENT_POOL[handle] || [];
      if (!pool.length) continue;
      comments.push({
        user: commenter.toObject(),
        text: pool[(index + i) % pool.length],
        createdAt: new Date(new Date(workout.date).getTime() + 5400000 * (i + 1)),
      });
    }

    if (comments.length) {
      commentOps.push({
        updateOne: {
          filter: { _id: workout._id },
          update: { $set: { comments, commentCount: comments.length } },
        },
      });
    }
  });

  if (commentOps.length) await Workout.bulkWrite(commentOps);
  return { liked: likeOps.length, commented: commentOps.length };
}

async function createChallenges() {
  const users = await User.find();
  const byHandle = new Map(users.map((u) => [u.handle, u]));
  const created = [];

  for (const definition of CHALLENGES) {
    const owner = byHandle.get(definition.createdBy);
    const startDate = relativeDay(definition.startOffset);
    const endDate = relativeDay(definition.endOffset);

    const challenge = await Challenge.create({
      name: definition.name,
      description: definition.description,
      type: definition.type,
      goal: definition.goal,
      startDate,
      endDate,
      visibility: 'public',
      createdBy: owner.toObject(),
      members: definition.members.map((handle) => ({
        user: byHandle.get(handle).toObject(),
        progress: 0,
        goal: definition.goal,
        joinedAt: startDate,
      })),
    });

    // Progress is derived from the seeded workout history, never hardcoded.
    await Promise.all(
      definition.members.map((handle) => recalcMemberProgress(challenge._id, byHandle.get(handle)._id))
    );
    await syncLeaderboards([challenge._id]);

    created.push(await Challenge.findById(challenge._id).lean());
  }

  return created;
}

async function createGroups() {
  const users = await User.find();
  const byHandle = new Map(users.map((u) => [u.handle, u]));

  for (const definition of GROUPS) {
    const owner = byHandle.get(definition.createdBy);
    await Group.create({
      name: definition.name,
      description: definition.description,
      type: definition.type,
      isPrivate: definition.isPrivate,
      createdBy: owner.toObject(),
      members: definition.members.map((handle) => byHandle.get(handle).toObject()),
    });
  }

  return Group.countDocuments({});
}

/** Recompute every derived streak value from the stored workout dates. */
async function refreshAllStreaks() {
  const users = await User.find().select('_id handle').lean();
  const streaks = [];

  for (const user of users) {
    const current = await refreshStreak(user._id);
    streaks.push({ handle: user.handle, streak: current });
  }

  return streaks;
}

/* -------------------------------------------------------------------- main */

async function main() {
  console.log('\nFitTrack seed');
  console.log('------------');
  console.log(`Target: ${config.mongodbUri.replace(/\/\/.*@/, '//***@')}`);

  await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 10000 });
  console.log('Connected to MongoDB');

  await clearDatabase();
  console.log('Cleared existing demo data');

  const users = await createUsers();
  console.log(`Created ${users.length} demo athletes`);

  const workouts = await insertWorkouts(users);
  console.log(`Inserted ${workouts.length} workouts`);

  const prCount = await applyPersonalRecords();
  console.log(`Detected ${prCount} personal records`);

  const weightCount = await insertWeightHistory(users);
  console.log(`Inserted ${weightCount} weight measurements`);

  const social = await addSocialActivity(users);
  console.log(`Added likes to ${social.liked} workouts and comments to ${social.commented}`);

  // Streaks are derived before groups/challenges embed their member snapshots
  // so the stored copies already carry the right numbers.
  const streaks = await refreshAllStreaks();

  const challenges = await createChallenges();
  console.log(`Created ${challenges.length} challenges`);

  const groupCount = await createGroups();
  console.log(`Created ${groupCount} groups`);

  console.log('\nSummary');
  console.log('-------');
  for (const { handle, streak } of streaks) {
    console.log(`  @${handle.padEnd(14)} streak ${streak} day${streak === 1 ? '' : 's'}`);
  }
  for (const challenge of challenges) {
    const status = challenge.endDate < new Date() ? 'ended' : 'active';
    const leader = [...challenge.members].sort((a, b) => b.progress - a.progress)[0];
    console.log(
      `  ${challenge.name} (${status}) - leader @${leader.user.handle} ` +
        `${Math.round(leader.progress * 10) / 10}/${challenge.goal} ${challenge.goalUnit}`
    );
  }

  console.log('\nDemo credentials (all accounts share one password)');
  console.log('---------------------------------------------------');
  for (const user of USERS) console.log(`  ${user.email.padEnd(24)} ${config.demoPassword}`);
  console.log('\nSeed complete.\n');
}

main()
  .catch((error) => {
    console.error('\nSeed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
