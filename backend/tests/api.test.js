'use strict';

/**
 * FitTrack Community — API + logic test suite.
 *
 * Runs against a real MongoDB. By default it uses a dedicated `fittrack_test`
 * database on the local instance (the same MongoDB the app needs) which is
 * dropped before and after the run — it never touches the `fittrack` database.
 *
 * Override the target with MONGO_TEST_URI, e.g.
 *   MONGO_TEST_URI=mongodb://localhost:27017/fittrack_ci npm test
 *
 *   npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';

const TEST_URI = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/fittrack_test';

let app;
let server;
let baseUrl;

/* ------------------------------------------------------------- test helpers */

async function request(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { status: response.status, data };
}

const password = 'FitTrack@123';
let userSeq = 0;

async function registerUser(prefix = 'user') {
  userSeq += 1;
  const handle = `${prefix}${userSeq}`;
  const email = `${handle}@example.com`;
  const response = await request('/api/auth/register', {
    method: 'POST',
    body: { name: `${prefix} ${userSeq}`, handle, email, password, weight: 70 },
  });
  assert.equal(response.status, 201, `register failed: ${JSON.stringify(response.data)}`);
  return { handle, email, token: response.data.token, id: response.data.user.id };
}

const workoutBody = (type, data, extra = {}) => ({
  type,
  data,
  calories: extra.calories ?? 300,
  ...extra,
});

/* ------------------------------------------------------------------ lifecycle */

test.before(async () => {
  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 8000 });
  await mongoose.connection.dropDatabase();

  app = require('../app'); // eslint-disable-line global-require
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

/* ------------------------------------------------------------------ unit: PR */

test('PR metrics: longest session is a yoga-only metric', () => {
  const { metricsFor } = require('../utils/pr'); // eslint-disable-line global-require

  const run = metricsFor({ type: 'run', data: { duration: 200, distance: 10 }, calories: 500 });
  assert.equal(run.longestSession, undefined, 'run duration must not win the yoga metric');
  assert.equal(run.longestRun, 10);
  assert.equal(run.runCalories, 500);

  const yoga = metricsFor({ type: 'yoga', data: { duration: 45 } });
  assert.equal(yoga.longestSession, 45);

  const gym = metricsFor({ type: 'gym', data: { sets: 4, reps: 10, weight: 60, duration: 50 } });
  assert.equal(gym.longestSession, undefined, 'gym duration must not win the yoga metric');
  assert.equal(gym.gymVolume, 2400);
});

/* --------------------------------------------------------- unit: streak */

test('Streaks ignore future-dated workouts when computing the current run', () => {
  const { calculateStreaks, addDays, startOfDay } = require('../utils/streak'); // eslint-disable-line global-require

  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);

  assert.equal(calculateStreaks([]).current, 0);
  assert.equal(calculateStreaks([today]).current, 1);
  assert.equal(calculateStreaks([yesterday, today]).current, 2);
  // A workout dated in the future must not wipe out a live streak.
  assert.equal(calculateStreaks([today, tomorrow]).current, 1);

  const broken = calculateStreaks([addDays(today, -4), today]);
  assert.equal(broken.current, 1);
  assert.equal(broken.longest >= 1, true);
});

/* ---------------------------------------------------------------- health */

test('GET /api/health reports the API and database state', async () => {
  const { status, data } = await request('/api/health');
  assert.equal(status, 200);
  assert.equal(data.success, true);
  assert.equal(data.status, 'ok');
  assert.equal(data.database, 'connected');
});

/* -------------------------------------------------------------------- auth */

test('Auth: registration, validation, duplicates and login', async () => {
  const handle = `authcheck${Date.now()}`;
  const email = `${handle}@example.com`;

  const created = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Auth Check', handle, email, password, weight: 65 },
  });
  assert.equal(created.status, 201);
  assert.ok(created.data.token, 'registration returns a JWT');
  assert.equal(created.data.user.handle, handle);
  assert.equal(created.data.user.passwordHash, undefined, 'password hash is never returned');

  // Duplicate email.
  const dupEmail = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Other', handle: `${handle}x`, email, password },
  });
  assert.equal(dupEmail.status, 409);

  // Duplicate handle.
  const dupHandle = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Other', handle, email: `other-${email}`, password },
  });
  assert.equal(dupHandle.status, 409);

  // Weak password.
  const weak = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Weak', handle: `${handle}y`, email: `weak-${email}`, password: 'short' },
  });
  assert.equal(weak.status, 400);
  assert.ok(weak.data.errors?.password);

  // Reserved handle.
  const reserved = await request('/api/auth/register', {
    method: 'POST',
    body: { name: 'Reserved', handle: 'admin', email: `res-${email}`, password },
  });
  assert.equal(reserved.status, 400);
  assert.ok(reserved.data.errors?.handle);

  // Login success + failures.
  const good = await request('/api/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(good.status, 200);
  assert.ok(good.data.token);

  const bad = await request('/api/auth/login', { method: 'POST', body: { email, password: 'WrongPass1' } });
  assert.equal(bad.status, 401);

  const missing = await request('/api/auth/login', {
    method: 'POST',
    body: { email: `nobody-${email}`, password },
  });
  assert.equal(missing.status, 401);
});

test('Auth: protected routes reject anonymous and accept valid tokens', async () => {
  const anon = await request('/api/auth/me');
  assert.equal(anon.status, 401);

  const { token } = await registerUser('prot');
  const me = await request('/api/auth/me', { token });
  assert.equal(me.status, 200);
  assert.ok(me.data.user.handle);
});

/* ---------------------------------------------------------------- workouts */

test('Workouts: PR detection across run, gym and yoga', async () => {
  const { token } = await registerUser('pr');

  // First ever run is never a PR.
  const first = await request('/api/workouts/create', {
    method: 'POST',
    token,
    body: workoutBody('run', { duration: 30, distance: 5 }),
  });
  assert.equal(first.status, 201);
  assert.equal(first.data.pr.achieved, false);

  // A longer run sets a distance PR.
  const second = await request('/api/workouts/create', {
    method: 'POST',
    token,
    body: workoutBody('run', { duration: 40, distance: 10 }),
  });
  assert.equal(second.status, 201);
  assert.equal(second.data.pr.achieved, true);
  assert.ok(
    second.data.pr.highlights.some((line) => /Longest run/i.test(line)),
    `expected a longest-run highlight, got ${JSON.stringify(second.data.pr.highlights)}`
  );

  // A shorter, slower run is not a PR.
  const worse = await request('/api/workouts/create', {
    method: 'POST',
    token,
    body: workoutBody('run', { duration: 60, distance: 3 }),
  });
  assert.equal(worse.status, 201);
  assert.equal(worse.data.pr.achieved, false);

  // Gym first session -> not a PR; heavier volume -> PR.
  const gym1 = await request('/api/workouts/create', {
    method: 'POST',
    token,
    body: workoutBody('gym', { exercise: 'Bench press', sets: 4, reps: 10, weight: 60 }),
  });
  assert.equal(gym1.status, 201);
  assert.equal(gym1.data.pr.achieved, false);

  const gym2 = await request('/api/workouts/create', {
    method: 'POST',
    token,
    body: workoutBody('gym', { exercise: 'Bench press', sets: 4, reps: 12, weight: 70 }),
  });
  assert.equal(gym2.status, 201);
  assert.equal(gym2.data.pr.achieved, true);

  // A long run must NOT claim the yoga "longest session" record.
  await request('/api/workouts/create', {
    method: 'POST',
    token,
    body: workoutBody('run', { duration: 200, distance: 20 }),
  });

  const yoga1 = await request('/api/workouts/create', {
    method: 'POST',
    token,
    body: workoutBody('yoga', { duration: 30 }),
  });
  assert.equal(yoga1.status, 201);
  assert.equal(yoga1.data.pr.achieved, false);

  const yoga2 = await request('/api/workouts/create', {
    method: 'POST',
    token,
    body: workoutBody('yoga', { duration: 45 }),
  });
  assert.equal(yoga2.status, 201);
  assert.equal(yoga2.data.pr.achieved, true, 'yoga duration PR should not be blocked by run duration');
  assert.ok(yoga2.data.pr.highlights.some((line) => /Longest session/i.test(line)));

  // PR list is consistent and only contains PR workouts.
  const prs = await request('/api/workouts/prs/mine', { token });
  assert.equal(prs.status, 200);
  assert.ok(prs.data.workouts.length > 0);
  assert.ok(prs.data.workouts.every((w) => w.pr === true));
});

test('Workouts: validation rejects bad payloads', async () => {
  const { token } = await registerUser('invalid');

  const noDistance = await request('/api/workouts/create', {
    method: 'POST',
    token,
    body: workoutBody('run', { duration: 30 }),
  });
  assert.equal(noDistance.status, 400);
  assert.ok(noDistance.data.errors?.['data.distance']);

  const zeroCalories = await request('/api/workouts/create', {
    method: 'POST',
    token,
    body: workoutBody('run', { duration: 30, distance: 5 }, { calories: 0 }),
  });
  assert.equal(zeroCalories.status, 400);
  assert.ok(zeroCalories.data.errors?.calories);

  const badType = await request('/api/workouts/create', {
    method: 'POST',
    token,
    body: workoutBody('swim', { duration: 30 }),
  });
  assert.equal(badType.status, 400);
});

test('Workouts: edit and delete recompute PR flags for the whole history', async () => {
  const { token } = await registerUser('recalc');

  const w1 = await request('/api/workouts/create', {
    method: 'POST',
    token,
    body: workoutBody('run', { duration: 20, distance: 3 }),
  });
  const w2 = await request('/api/workouts/create', {
    method: 'POST',
    token,
    body: workoutBody('run', { duration: 30, distance: 5 }),
  });
  const w3 = await request('/api/workouts/create', {
    method: 'POST',
    token,
    body: workoutBody('run', { duration: 40, distance: 7 }),
  });
  assert.equal(w2.data.pr.achieved, true);
  assert.equal(w3.data.pr.achieved, true);

  // Shrink the longest run: it should lose its PR, the 5 km run keeps its own.
  const edited = await request(`/api/workouts/${w3.data.workout.id}`, {
    method: 'PUT',
    token,
    body: { data: { distance: 1, duration: 15 } },
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.workout.pr, false);

  let prs = await request('/api/workouts/prs/mine', { token });
  assert.deepEqual(
    prs.data.workouts.map((w) => w.id).sort(),
    [w2.data.workout.id].sort(),
    'only the 5 km run remains a PR'
  );

  // Deleting the remaining PR leaves no records behind.
  const removed = await request(`/api/workouts/${w2.data.workout.id}`, { method: 'DELETE', token });
  assert.equal(removed.status, 200);

  prs = await request('/api/workouts/prs/mine', { token });
  assert.equal(prs.data.workouts.length, 0);
});

test('Workouts: ownership is enforced', async () => {
  const owner = await registerUser('owner');
  const intruder = await registerUser('intruder');

  const created = await request('/api/workouts/create', {
    method: 'POST',
    token: owner.token,
    body: workoutBody('run', { duration: 30, distance: 5 }),
  });
  const id = created.data.workout.id;

  const edit = await request(`/api/workouts/${id}`, {
    method: 'PUT',
    token: intruder.token,
    body: { notes: 'hijacked' },
  });
  assert.equal(edit.status, 403);

  const del = await request(`/api/workouts/${id}`, { method: 'DELETE', token: intruder.token });
  assert.equal(del.status, 403);

  const createForOther = await request('/api/workouts/create', {
    method: 'POST',
    token: intruder.token,
    body: workoutBody('run', { duration: 30, distance: 5 }, { userId: owner.id }),
  });
  assert.equal(createForOther.status, 403);
});

/* -------------------------------------------------------------------- feed */

test('Feed: pagination, likes and comments (with real comment ids)', async () => {
  const { token } = await registerUser('feed');
  const created = await request('/api/workouts/create', {
    method: 'POST',
    token,
    body: workoutBody('run', { duration: 30, distance: 5 }),
  });
  const workoutId = created.data.workout.id;

  const list = await request('/api/feed/list?page=1&limit=5');
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.data.workouts));
  assert.equal(typeof list.data.hasMore, 'boolean');

  const like = await request(`/api/workouts/${workoutId}/like`, { method: 'POST', token });
  assert.equal(like.status, 200);
  assert.equal(like.data.liked, true);
  assert.equal(like.data.likeCount, 1);

  const unlike = await request(`/api/workouts/${workoutId}/like`, { method: 'POST', token });
  assert.equal(unlike.data.liked, false);
  assert.equal(unlike.data.likeCount, 0);

  const comment = await request(`/api/workouts/${workoutId}/comment`, {
    method: 'POST',
    token,
    body: { text: 'Nice session!' },
  });
  assert.equal(comment.status, 201);
  assert.equal(comment.data.comment.text, 'Nice session!');
  assert.equal(typeof comment.data.comment.id, 'string');
  assert.notEqual(comment.data.comment.id, 'undefined');
  assert.ok(comment.data.comment.id.length > 0);

  const comments = await request(`/api/feed/comments/${workoutId}`);
  assert.equal(comments.status, 200);
  assert.equal(comments.data.comments.length, 1);
  assert.equal(comments.data.comments[0].id, comment.data.comment.id);

  const missing = await request(`/api/workouts/${new mongoose.Types.ObjectId()}/like`, {
    method: 'POST',
    token,
  });
  assert.equal(missing.status, 404);

  const emptyComment = await request(`/api/workouts/${workoutId}/comment`, {
    method: 'POST',
    token,
    body: { text: '   ' },
  });
  assert.equal(emptyComment.status, 400);
});

/* -------------------------------------------------------------- challenges */

test('Challenges: create, join, progress and leaderboard', async () => {
  const runner = await registerUser('runner');
  const joiner = await registerUser('joiner');

  const start = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const end = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

  const created = await request('/api/challenges/create', {
    method: 'POST',
    token: runner.token,
    body: { name: `Test Run ${Date.now()}`, type: 'run', goal: 20, startDate: start, endDate: end },
  });
  assert.equal(created.status, 201);
  const challengeId = created.data.challenge.id;

  const join = await request('/api/challenges/join', {
    method: 'POST',
    token: joiner.token,
    body: { challengeId },
  });
  assert.equal(join.status, 200);

  const duplicate = await request('/api/challenges/join', {
    method: 'POST',
    token: joiner.token,
    body: { challengeId },
  });
  assert.equal(duplicate.status, 409);

  // Runner logs a run inside the window: progress should count it.
  await request('/api/workouts/create', {
    method: 'POST',
    token: runner.token,
    body: workoutBody('run', { duration: 30, distance: 6 }),
  });

  const board = await request(`/api/leaderboard/${challengeId}`);
  assert.equal(board.status, 200);
  assert.equal(board.data.challenge.id, challengeId);
  const runnerRow = board.data.leaderboard.find((row) => row.user.handle === runner.handle);
  assert.ok(runnerRow);
  assert.equal(runnerRow.progress, 6);
  assert.equal(runnerRow.rank, 1);

  // A gym workout must not contribute to a run challenge.
  await request('/api/workouts/create', {
    method: 'POST',
    token: joiner.token,
    body: workoutBody('gym', { exercise: 'Squat', sets: 4, reps: 8, weight: 80 }),
  });
  const board2 = await request(`/api/leaderboard/${challengeId}`);
  const joinerRow = board2.data.leaderboard.find((row) => row.user.handle === joiner.handle);
  assert.equal(joinerRow.progress, 0);
});

test('Leaderboards: ended challenges remain available', async () => {
  const { token } = await registerUser('ended');

  const start = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000);
  const end = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  const created = await request('/api/challenges/create', {
    method: 'POST',
    token,
    body: { name: `Ended ${Date.now()}`, type: 'run', goal: 10, startDate: start, endDate: end },
  });
  assert.equal(created.status, 201);
  const challengeId = created.data.challenge.id;

  const list = await request('/api/leaderboard', { token });
  assert.equal(list.status, 200);
  assert.ok(
    list.data.challenges.some((c) => c.id === challengeId),
    'an ended challenge the user belongs to is still listed'
  );

  const board = await request(`/api/leaderboard/${challengeId}`);
  assert.equal(board.status, 200);
  assert.equal(board.data.challenge.status, 'ended');
});

/* ------------------------------------------------------------------- stats */

test('Stats: public profile by handle, owner flag and 404 for unknown handles', async () => {
  const { handle, token } = await registerUser('stats');

  const anon = await request(`/api/stats/${handle}`);
  assert.equal(anon.status, 200);
  assert.equal(anon.data.handle, handle);
  assert.equal(anon.data.isOwner, false);

  const owner = await request(`/api/stats/${handle}`, { token });
  assert.equal(owner.data.isOwner, true);
  assert.ok(owner.data.stats);
  assert.ok(Array.isArray(owner.data.weightHistory));
  assert.ok(Array.isArray(owner.data.personalRecords));

  const unknown = await request('/api/stats/definitely-not-a-real-handle');
  assert.equal(unknown.status, 404);
});

/* ---------------------------------------------------------------- settings */

test('Settings: read, validation and persistence', async () => {
  const { token } = await registerUser('settings');

  const initial = await request('/api/settings', { token });
  assert.equal(initial.status, 200);
  assert.ok(initial.data.settings);

  const invalid = await request('/api/settings', {
    method: 'PUT',
    token,
    body: { units: 'stone' },
  });
  assert.equal(invalid.status, 400);
  assert.ok(invalid.data.errors?.units);

  const valid = await request('/api/settings', {
    method: 'PUT',
    token,
    body: { units: 'imperial', language: 'en', upiId: 'friend@bank' },
  });
  assert.equal(valid.status, 200);

  const after = await request('/api/settings', { token });
  assert.equal(after.data.settings.units, 'imperial');
  assert.equal(after.data.settings.upiId, 'friend@bank');
});

/* ---------------------------------------------------------------- password */

test('Auth: password change requires the current password and takes effect', async () => {
  const { email, token } = await registerUser('pwchange');

  const wrong = await request('/api/auth/password', {
    method: 'PUT',
    token,
    body: { currentPassword: 'NotMyPass1', newPassword: 'BrandNewPass9' },
  });
  assert.equal(wrong.status, 401);

  const weak = await request('/api/auth/password', {
    method: 'PUT',
    token,
    body: { currentPassword: password, newPassword: 'weak' },
  });
  assert.equal(weak.status, 400);

  const ok = await request('/api/auth/password', {
    method: 'PUT',
    token,
    body: { currentPassword: password, newPassword: 'BrandNewPass9' },
  });
  assert.equal(ok.status, 200);

  const oldLogin = await request('/api/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(oldLogin.status, 401);

  const newLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'BrandNewPass9' },
  });
  assert.equal(newLogin.status, 200);
});
