/**
 * Personal record (PR) detection.
 *
 * Rules are deterministic and based only on stored workout data:
 *  - Run  : longest distance in a single session, best (fastest) average pace.
 *  - Gym  : highest total volume (sets x reps x load), highest reps in a session,
 *          heaviest set lifted.
 *  - Yoga : longest session duration.
 *
 * A workout is a PR when at least one metric beats the previous best.
 * The first ever workout of a type is never a PR (nothing to beat).
 */

const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

/** Average pace in minutes per kilometre (min/km). */
const pace = (duration, distance) => (distance > 0 ? num(duration) / num(distance) : null);

/**
 * Build the metrics dictionary for a workout.
 * Returns null for non-comparable values so they never win a comparison.
 */
function metricsFor(workout) {
  const data = workout.data || {};
  const duration = num(data.duration);
  const metrics = {};

  if (workout.type === 'run') {
    const distance = num(data.distance);
    const avgPace = pace(duration, distance);
    if (distance > 0) metrics.longestRun = round(distance, 2);
    if (avgPace !== null) metrics.bestPace = round(avgPace, 2);
    if (num(workout.calories) > 0) metrics.runCalories = round(num(workout.calories), 0);
  }

  if (workout.type === 'gym') {
    const sets = num(data.sets);
    const reps = num(data.reps);
    const load = num(data.weight);
    if (sets > 0 && reps > 0) metrics.gymVolume = round(sets * reps * (load > 0 ? load : 1), 1);
    if (reps > 0) metrics.maxReps = round(reps, 0);
    if (load > 0) metrics.heavySet = round(load, 1);
  }

  if (workout.type === 'yoga') {
    if (duration > 0) metrics.longestSession = round(duration, 0);
  }

  return metrics;
}

/** `betterThan` maps a metric name to the comparison direction. */
const betterThan = {
  longestRun: 'max',
  runCalories: 'max',
  bestPace: 'min',
  gymVolume: 'max',
  maxReps: 'max',
  heavySet: 'max',
  longestSession: 'max',
};

const METRIC_LABELS = {
  longestRun: { label: 'Longest run', unit: 'km', format: (v) => `${v} km` },
  runCalories: { label: 'Run calorie burn', unit: 'kcal', format: (v) => `${v} kcal` },
  bestPace: { label: 'Fastest average pace', unit: 'min/km', format: (v) => `${v} min/km` },
  gymVolume: { label: 'Highest training volume', unit: 'kg-reps', format: (v) => `${v} volume` },
  maxReps: { label: 'Most reps in a session', unit: 'reps', format: (v) => `${v} reps` },
  heavySet: { label: 'Heaviest set lifted', unit: 'kg', format: (v) => `${v} kg` },
  longestSession: { label: 'Longest session', unit: 'min', format: (v) => `${v} min` },
};

/**
 * Compare a new workout against previous personal bests.
 *
 * @param {object} workout   the newly created workout document (lean or doc)
 * @param {object} bests     { metricKey: { value, workoutId, date } } — bests strictly older
 * @returns {{ pr: boolean, highlights: string[], records: object[] }}
 */
function detectPR(workout, bests = {}) {
  const metrics = metricsFor(workout);
  const highlights = [];
  const records = [];

  Object.entries(metrics).forEach(([key, value]) => {
    const current = bests[key];
    if (!current || current.value === undefined || current.value === null) return;
    const direction = betterThan[key];
    const improved = direction === 'min' ? value < current.value : value > current.value;
    if (!improved) return;

    const meta = METRIC_LABELS[key] || { label: key, unit: '', format: (v) => `${v}` };
    highlights.push(`${meta.label}: ${meta.format(value)} (previous best ${meta.format(current.value)})`);
    records.push({
      key,
      label: meta.label,
      value,
      unit: meta.unit,
      previous: current.value,
      formatted: meta.format(value),
      previousFormatted: meta.format(current.value),
      date: workout.date,
      workoutId: workout._id?.toString?.() ?? null,
    });
  });

  return { pr: highlights.length > 0, highlights, records };
}

/**
 * Recompute every stored personal best for a user from their full history.
 * Called after each new workout so history edits / seed imports stay correct.
 */
function recomputePersonalBests(workouts) {
  const bests = {};
  const ordered = [...workouts].sort((a, b) => new Date(a.date) - new Date(b.date));

  ordered.forEach((workout) => {
    const metrics = metricsFor(workout);
    Object.entries(metrics).forEach(([key, value]) => {
      const current = bests[key];
      if (!current) {
        bests[key] = { value, workoutId: workout._id?.toString?.() ?? null, date: workout.date };
        return;
      }
      const direction = betterThan[key] === 'min' ? value < current.value : value > current.value;
      if (direction) {
        bests[key] = { value, workoutId: workout._id?.toString?.() ?? null, date: workout.date };
      }
    });
  });

  return bests;
}

/**
 * Build the personal bests from all but the newest workout, so the newest
 * workout can be judged against strictly older performances.
 */
function previousBests(workouts, excludeId) {
  const history = workouts.filter((w) => String(w._id?.toString?.() ?? w._id) !== String(excludeId));
  return recomputePersonalBests(history);
}

module.exports = {
  detectPR,
  metricsFor,
  recomputePersonalBests,
  previousBests,
  betterThan,
  METRIC_LABELS,
};