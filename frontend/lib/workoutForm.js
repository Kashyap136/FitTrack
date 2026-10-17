'use client';

/**
 * Field definitions per workout type. The log-workout form renders its inputs
 * from this list so every type gets only the fields that matter to it.
 */
export const WORKOUT_FIELDS = {
  run: [
    {
      name: 'duration',
      label: 'Duration',
      unit: 'min',
      type: 'number',
      min: 1,
      max: 1440,
      step: 1,
      required: true,
      placeholder: '32',
      help: 'Total moving time',
    },
    {
      name: 'distance',
      label: 'Distance',
      unit: 'km',
      type: 'number',
      min: 0.1,
      max: 500,
      step: 0.1,
      required: true,
      placeholder: '5.2',
      help: 'Longest distance becomes a PR',
    },
    {
      name: 'avgHeartRate',
      label: 'Avg heart rate',
      unit: 'bpm',
      type: 'number',
      min: 40,
      max: 230,
      step: 1,
      required: false,
      placeholder: '148',
    },
  ],
  gym: [
    {
      name: 'exercise',
      label: 'Exercise',
      type: 'text',
      required: true,
      placeholder: 'Bench press',
      help: 'Primary lift for this session',
    },
    {
      name: 'sets',
      label: 'Sets',
      type: 'number',
      min: 1,
      max: 100,
      step: 1,
      required: true,
      placeholder: '4',
    },
    {
      name: 'reps',
      label: 'Reps per set',
      type: 'number',
      min: 1,
      max: 200,
      step: 1,
      required: true,
      placeholder: '10',
    },
    {
      name: 'weight',
      label: 'Weight lifted',
      unit: 'kg',
      type: 'number',
      min: 0,
      max: 1000,
      step: 0.5,
      required: false,
      placeholder: '70',
      help: 'Sets × reps × load drives the volume PR',
    },
    {
      name: 'duration',
      label: 'Session time',
      unit: 'min',
      type: 'number',
      min: 1,
      max: 600,
      step: 1,
      required: false,
      placeholder: '55',
    },
  ],
  yoga: [
    {
      name: 'duration',
      label: 'Duration',
      unit: 'min',
      type: 'number',
      min: 1,
      max: 600,
      step: 1,
      required: true,
      placeholder: '45',
      help: 'Longest flow becomes a PR',
    },
    {
      name: 'holdSeconds',
      label: 'Hold time',
      unit: 'sec',
      type: 'number',
      min: 0,
      max: 7200,
      step: 5,
      required: false,
      placeholder: '120',
      help: 'Counts towards plank challenges',
    },
    {
      name: 'avgHeartRate',
      label: 'Avg heart rate',
      unit: 'bpm',
      type: 'number',
      min: 40,
      max: 230,
      step: 1,
      required: false,
      placeholder: '96',
    },
  ],
};

/** Rough MET-based calorie estimate so the form can pre-fill calories. */
const RUN_KM_PER_MINUTE = 0.16;
const RUN_KCAL_PER_KM = 62;
const GYM_KCAL_PER_MINUTE = 7.5;
const YOGA_KCAL_PER_MINUTE = 4.2;
const DEFAULT_WEIGHT = 70;

export function estimateCalories(type, data, weight = DEFAULT_WEIGHT) {
  const bodyWeight = Number(weight) > 0 ? Number(weight) : DEFAULT_WEIGHT;
  const minutes = Number(data.duration) || 0;

  if (type === 'run') {
    const distance = Number(data.distance) || 0;
    const paceMinutes = distance > 0 ? distance / RUN_KM_PER_MINUTE : minutes;
    return Math.round(paceMinutes * RUN_KCAL_PER_KM * (bodyWeight / 70) * 0.9);
  }

  if (type === 'gym') {
    const sets = Number(data.sets) || 0;
    const reps = Number(data.reps) || 0;
    const minutesEstimate = minutes || Math.round(sets * Math.max(reps * 0.45, 3));
    return Math.round(minutesEstimate * GYM_KCAL_PER_MINUTE * (bodyWeight / 70));
  }

  if (type === 'yoga') {
    return Math.round(minutes * YOGA_KCAL_PER_MINUTE * (bodyWeight / 70));
  }

  return 0;
}

export function emptyDataFor(type) {
  return (WORKOUT_FIELDS[type] || []).reduce((acc, field) => {
    acc[field.name] = field.type === 'number' ? '' : '';
    return acc;
  }, {});
}

/** Client-side mirror of the backend validation rules. */
export function validateWorkoutForm({ type, data, calories, dateTime }) {
  const errors = {};

  if (!WORKOUT_FIELDS[type]) errors.type = 'Choose a workout type';

  WORKOUT_FIELDS[type]?.forEach((field) => {
    const raw = data[field.name];
    const isEmpty = raw === '' || raw === null || raw === undefined;
    if (field.required && isEmpty) {
      errors[`data.${field.name}`] = `${field.label} is required`;
      return;
    }
    if (isEmpty) return;

    if (field.type === 'number') {
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0) {
        errors[`data.${field.name}`] = `${field.label} must be zero or more`;
      } else if (field.min !== undefined && value < field.min) {
        errors[`data.${field.name}`] = `${field.label} must be at least ${field.min}`;
      } else if (field.max !== undefined && value > field.max) {
        errors[`data.${field.name}`] = `${field.label} must be ${field.max} or less`;
      }
    } else if (String(raw).trim().length < 2) {
      errors[`data.${field.name}`] = `${field.label} is too short`;
    }
  });

  if (calories === '' || Number(calories) <= 0) {
    errors.calories = 'Calories must be greater than 0';
  } else if (Number(calories) > 20000) {
    errors.calories = 'Calories must be 20000 or less';
  }

  if (!dateTime) {
    errors.dateTime = 'Pick when the workout happened';
  } else if (new Date(dateTime).getTime() > Date.now() + 86400000) {
    errors.dateTime = 'Date cannot be in the future';
  }

  return errors;
}