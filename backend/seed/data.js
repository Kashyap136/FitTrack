/**
 * Seed definitions for the FitTrack demo dataset.
 *
 * Everything here is static reference data: the eight demo athletes, the two
 * crews and the three challenges. Workout history is generated from these
 * training plans in `seed.js` and run through the real PR detector, so seeded
 * data and data created through the API follow exactly the same rules.
 *
 * Dates are expressed as day offsets from "today" so the demo always looks
 * current whenever the seed is run.
 */

/** Demo athletes. `plan` keys are weekday numbers (0 = Sunday). */
const USERS = [
  {
    name: 'Aarav Sharma',
    handle: 'aaravfit',
    email: 'aarav@example.com',
    bio: 'Chasing a sub-40 10K. Mornings in Cubbon Park, coffee after.',
    location: 'Bengaluru, India',
    weight: 68.4,
    upiId: 'aaravfit@okhdfc',
    language: 'en',
    plan: {
      // weekday -> workout type
      1: 'run', 3: 'run', 5: 'run', 6: 'run', 0: 'yoga', 2: 'gym', 4: 'gym',
    },
    runBase: { distance: 6.5, pace: 6.4 },
    gymBase: { exercise: 'Barbell deadlift', sets: 4, reps: 5, weight: 92.5 },
    yogaBase: { duration: 45, holdSeconds: 210 },
    skipRate: 0.14,
    progression: { distance: 0.05, pace: -0.012, load: 0.55 },
    weights: [76.8, 75.9, 74.6, 73.4, 72.1, 70.8, 69.9, 69.1, 68.4],
  },
  {
    name: 'Priya Verma',
    handle: 'priyafit',
    email: 'priya@example.com',
    bio: 'Physio by day, barre and yoga by evening. Consistency over intensity.',
    location: 'Kochi, India',
    weight: 58.2,
    upiId: 'priyafit@okaxis',
    language: 'en',
    plan: { 1: 'yoga', 2: 'yoga', 4: 'yoga', 5: 'yoga', 3: 'gym', 6: 'gym', 0: 'run' },
    runBase: { distance: 4, pace: 7.2 },
    gymBase: { exercise: 'Goblet squat', sets: 3, reps: 12, weight: 24 },
    yogaBase: { duration: 50, holdSeconds: 180 },
    skipRate: 0.18,
    progression: { distance: 0.03, pace: -0.008, load: 0.4 },
    weights: [61.5, 61.1, 60.4, 60.0, 59.5, 59.0, 58.7, 58.4, 58.2],
  },
  {
    name: 'Rohan Mehta',
    handle: 'rohanruns',
    email: 'rohan@example.com',
    bio: 'Marathon 2026. 78 km last month, all of it before 6am.',
    location: 'Pune, India',
    weight: 71.9,
    upiId: 'rohanruns@ybl',
    language: 'en',
    plan: { 0: 'run', 1: 'run', 2: 'yoga', 3: 'run', 4: 'run', 5: 'run', 6: 'run' },
    runBase: { distance: 9.5, pace: 5.7 },
    gymBase: { exercise: 'Weighted pull-up', sets: 4, reps: 6, weight: 15 },
    yogaBase: { duration: 35, holdSeconds: 150 },
    skipRate: 0.07,
    progression: { distance: 0.09, pace: -0.018, load: 0.5 },
    // Every 7th run is a long-run day, which is where his distance PRs land.
    longRunEvery: 7,
    longRunDistance: 26,
    weights: [74.2, 73.6, 73.1, 72.8, 72.5, 72.2, 72.0, 71.9, 71.9],
  },
  {
    name: 'Ananya Singh',
    handle: 'ananyayoga',
    email: 'ananya@example.com',
    bio: 'Yoga teacher, 200-hour RYT. Teaching sunrise flow on the beach.',
    location: 'Chennai, India',
    weight: 57.4,
    upiId: 'ananyayoga@okicici',
    language: 'en',
    plan: { 0: 'yoga', 1: 'yoga', 2: 'yoga', 3: 'yoga', 4: 'yoga', 5: 'yoga', 6: 'run' },
    runBase: { distance: 5, pace: 7.6 },
    gymBase: { exercise: 'Bodyweight squat', sets: 3, reps: 20, weight: 0 },
    yogaBase: { duration: 60, holdSeconds: 300 },
    skipRate: 0.1,
    progression: { distance: 0.02, pace: -0.006, load: 0.3 },
    weights: [59.8, 59.4, 59.0, 58.7, 58.4, 58.1, 57.8, 57.6, 57.4],
  },
  {
    name: 'Kabir Gupta',
    handle: 'kabirgym',
    email: 'kabir@example.com',
    bio: 'Powerlifter. Squat 1.2x bodyweight and still learning to eat enough.',
    location: 'New Delhi, India',
    weight: 86.7,
    upiId: 'kabirgym@okhdfc',
    language: 'en',
    plan: { 0: 'gym', 1: 'gym', 2: 'gym', 3: 'gym', 4: 'gym', 5: 'gym', 6: 'run' },
    runBase: { distance: 5.5, pace: 7.8 },
    gymBase: { exercise: 'Back squat', sets: 5, reps: 5, weight: 120 },
    yogaBase: { duration: 30, holdSeconds: 240 },
    skipRate: 0.12,
    progression: { distance: 0.02, pace: -0.005, load: 1.4 },
    // Plank accessory work is logged as hold time on gym days.
    plankOnGym: true,
    weights: [88.4, 88.0, 87.6, 87.2, 87.0, 86.9, 86.8, 86.7, 86.7],
  },
  {
    name: 'Neha Kapoor',
    handle: 'nehafit',
    email: 'neha@example.com',
    bio: 'Desk job, lifting heavy things after. Six sessions a week since March.',
    location: 'Mumbai, India',
    weight: 63.9,
    upiId: 'nehafit@okaxis',
    language: 'en',
    plan: { 1: 'gym', 3: 'gym', 5: 'gym', 0: 'yoga', 2: 'yoga', 4: 'run', 6: 'run' },
    runBase: { distance: 5, pace: 7 },
    gymBase: { exercise: 'Romanian deadlift', sets: 3, reps: 10, weight: 60 },
    yogaBase: { duration: 40, holdSeconds: 170 },
    skipRate: 0.16,
    progression: { distance: 0.04, pace: -0.01, load: 0.8 },
    plankOnGym: true,
    weights: [66.1, 65.7, 65.2, 64.8, 64.4, 64.2, 64.0, 63.9, 63.9],
  },
  {
    name: 'Vikram Joshi',
    handle: 'vikramactive',
    email: 'vikram@example.com',
    bio: 'Cricket in the evening, engine builds in the morning.',
    location: 'Hyderabad, India',
    weight: 79.3,
    upiId: 'vikramactive@okhdfc',
    language: 'en',
    plan: { 1: 'run', 3: 'run', 5: 'run', 2: 'gym', 4: 'gym', 6: 'gym', 0: 'yoga' },
    runBase: { distance: 7, pace: 6.1 },
    gymBase: { exercise: 'Bench press', sets: 4, reps: 8, weight: 70 },
    yogaBase: { duration: 35, holdSeconds: 160 },
    skipRate: 0.15,
    progression: { distance: 0.06, pace: -0.014, load: 0.7 },
    weights: [82.0, 81.5, 81.0, 80.5, 80.1, 79.8, 79.5, 79.4, 79.3],
  },
  {
    name: 'Ishita Rao',
    handle: 'ishitafit',
    email: 'ishita@example.com',
    bio: 'Learning to love lifting. Two years in and hooked on the big lifts.',
    location: 'Kolkata, India',
    weight: 61.5,
    upiId: 'ishitafit@ybl',
    language: 'en',
    plan: { 2: 'gym', 4: 'gym', 1: 'yoga', 5: 'yoga', 0: 'run', 3: 'run', 6: 'run' },
    runBase: { distance: 4.5, pace: 7.4 },
    gymBase: { exercise: 'Hip thrust', sets: 3, reps: 12, weight: 55 },
    yogaBase: { duration: 45, holdSeconds: 190 },
    skipRate: 0.2,
    progression: { distance: 0.03, pace: -0.009, load: 0.6 },
    plankOnGym: true,
    weights: [64.0, 63.6, 63.2, 62.8, 62.4, 62.0, 61.8, 61.6, 61.5],
  },
];

/** Crews shown on the community rail. */
const GROUPS = [
  {
    name: 'Morning Runners',
    description: 'Sunrise miles, four times a week. Pace is whatever the clock allows.',
    type: 'running',
    isPrivate: false,
    createdBy: 'rohanruns',
    members: ['rohanruns', 'aaravfit', 'vikramactive', 'nehafit'],
  },
  {
    name: 'Weekend Warriors',
    description: 'Gym on Saturday, yoga on Sunday, guilt-free rest in between.',
    type: 'fitness',
    isPrivate: false,
    createdBy: 'ananyayoga',
    members: ['ananyayoga', 'priyafit', 'ishitafit', 'kabirgym'],
  },
];

/**
 * Challenges. Two are active with comfortable headroom; the yoga challenge is
 * close to its goal and the 30-day run block has already finished, so the UI
 * always has "nearly done" and "completed" states to show.
 * `startOffset` / `endOffset` are day offsets from today (negative = past).
 */
const CHALLENGES = [
  {
    name: 'Monsoon 300K Run Club',
    description:
      'Log 300 km between the first and last day of the monsoon block. Easy runs, long runs, whatever the sky allows.',
    type: 'run',
    goal: 300,
    startOffset: -21,
    endOffset: 39,
    createdBy: 'rohanruns',
    members: ['rohanruns', 'aaravfit', 'vikramactive', 'nehafit'],
  },
  {
    name: 'Plank Power 3600',
    description: 'Accumulate a full hour of logged plank holds across three weeks. Slower is better.',
    type: 'plank',
    goal: 3600,
    startOffset: -12,
    endOffset: 18,
    createdBy: 'kabirgym',
    members: ['kabirgym', 'nehafit', 'ishitafit'],
  },
  {
    name: 'Yoga Sunrise 1500',
    description: 'Fifteen hundred minutes of yoga before the month runs out. Every flow counts.',
    type: 'yoga',
    goal: 1500,
    startOffset: -26,
    endOffset: 4,
    createdBy: 'ananyayoga',
    members: ['ananyayoga', 'priyafit'],
  },
  {
    name: '30-Day Running Challenge',
    description: 'A classic 100 km block over thirty days. This one is wrapped — check the final standings.',
    type: 'run',
    goal: 100,
    startOffset: -44,
    endOffset: -14,
    createdBy: 'aaravfit',
    members: ['aaravfit', 'rohanruns', 'priyafit', 'ishitafit'],
  },
];

/** Free-text comments attached to the most recent workouts. */
const COMMENT_POOL = {
  aaravfit: ['That pace is getting ridiculous 🔥', 'Cubbon Park mornings are the best.', 'Nice negative split on this one!'],
  priyafit: ['Form looks solid from the notes here.', 'Adding this to my rotation.', 'Recovery day still counts 💚'],
  rohanruns: ['Long run done. Legs gone but worth it.', 'Fuel strategy on this was spot on.', 'Respect the consistency.'],
  ananyayoga: ['Beautiful flow description.', 'Breath work over everything.', 'This is the practice, not the pose.'],
  kabirgym: ['Volume is climbing week over week 💪', 'Deload week already?', 'Heaviest set yet, respect.'],
  nehafit: ['This is my third session this week!', 'Setting a new habit one rep at a time.', 'Love the consistency here.'],
  vikramactive: ['Morning miles before cricket hits 🔥', 'Strong finish on that run.', 'Volume going up, good.'],
  ishitafit: ['Two years in and still learning. Love it.', 'Adding 5kg next month.', 'Best mid-week motivation.'],
};

const DEFAULT_LIKERS = [
  'aaravfit', 'priyafit', 'rohanruns', 'ananyayoga',
  'kabirgym', 'nehafit', 'vikramactive', 'ishitafit',
];

module.exports = {
  USERS,
  GROUPS,
  CHALLENGES,
  COMMENT_POOL,
  DEFAULT_LIKERS,
};
