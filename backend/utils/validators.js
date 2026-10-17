const mongoose = require('mongoose');

/** Error carrying an HTTP status code so route handlers stay declarative. */
class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    if (details) this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'You do not have access to this resource') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message, details) {
    return new ApiError(409, message, details);
  }
}

const HANDLE_RE = /^[a-z0-9_.]{3,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const UPI_RE = /^[\w.\-]{2,64}@[\w.\-]{2,64}$/;

const isEmpty = (value) => value === undefined || value === null || String(value).trim() === '';

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return NaN;
};

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isValidId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));

const assert = (condition, status, message, details) => {
  if (!condition) throw new ApiError(status, message, details);
};

/** Trim + case-normalise a handle. */
const normaliseHandle = (value) => String(value || '').trim().toLowerCase();

/**
 * Reject reserved handles so public profile URLs never collide with app routes.
 */
const RESERVED_HANDLES = new Set([
  'api', 'admin', 'login', 'logout', 'register', 'feed', 'challenges', 'leaderboard',
  'settings', 'workout', 'profile', 'about', 'help', 'support', 'u', 'user', 'users',
]);

const validateRegistration = (payload = {}) => {
  const errors = {};
  const name = String(payload.name || '').trim();
  const handle = normaliseHandle(payload.handle);
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');
  const weight = isEmpty(payload.weight) ? null : toNumber(payload.weight);

  if (!name || name.length < 2) errors.name = 'Name must be at least 2 characters';
  else if (name.length > 60) errors.name = 'Name must be 60 characters or fewer';

  if (!handle || !HANDLE_RE.test(handle)) {
    errors.handle = 'Handle must be 3-24 characters using letters, numbers, dots or underscores';
  } else if (RESERVED_HANDLES.has(handle)) {
    errors.handle = 'That handle is reserved, please choose another';
  }

  if (!email || !EMAIL_RE.test(email)) errors.email = 'A valid email address is required';

  if (!password || password.length < 8) errors.password = 'Password must be at least 8 characters';
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = 'Password must contain both letters and numbers';
  }

  if (weight !== null && (!Number.isFinite(weight) || weight < 20 || weight > 400)) {
    errors.weight = 'Weight must be a number between 20 and 400 kg';
  }

  assert(Object.keys(errors).length === 0, 400, 'Please correct the highlighted fields', errors);
  return { name, handle, email, password, weight };
};

const validateLogin = (payload = {}) => {
  const errors = {};
  const email = String(payload.email || '').trim().toLowerCase();
  const password = String(payload.password || '');

  if (!email) errors.email = 'Email is required';
  if (!password) errors.password = 'Password is required';

  assert(Object.keys(errors).length === 0, 400, 'Email and password are required', errors);
  return { email, password };
};

/**
 * Validate a workout payload. `data` stays a flexible JSON object so each
 * workout type can require different fields (run = distance, gym = sets...).
 */
const WORKOUT_RULES = {
  run: {
    label: 'Run',
    fields: [
      ['duration', { required: true, min: 1, max: 1440, label: 'Duration (minutes)' }],
      ['distance', { required: true, min: 0.05, max: 500, label: 'Distance (km)' }],
    ],
    optional: [
      ['avgHeartRate', { min: 40, max: 230, label: 'Average heart rate' }],
      ['intensity', { min: 1, max: 10, label: 'Intensity' }],
    ],
  },
  gym: {
    label: 'Gym',
    fields: [
      ['exercise', { required: true, min: 2, max: 80, label: 'Exercise' }],
      ['sets', { required: true, min: 1, max: 100, label: 'Sets' }],
      ['reps', { required: true, min: 1, max: 200, label: 'Reps per set' }],
    ],
    optional: [
      ['weight', { min: 0, max: 1000, label: 'Weight lifted (kg)' }],
      ['duration', { min: 1, max: 600, label: 'Duration (minutes)' }],
      ['avgHeartRate', { min: 40, max: 230, label: 'Average heart rate' }],
    ],
  },
  yoga: {
    label: 'Yoga',
    fields: [
      ['duration', { required: true, min: 1, max: 600, label: 'Duration (minutes)' }],
    ],
    optional: [
      ['holdSeconds', { min: 0, max: 7200, label: 'Hold time (seconds)' }],
      ['avgHeartRate', { min: 40, max: 230, label: 'Average heart rate' }],
    ],
  },
};

const validateWorkout = (payload = {}) => {
  const errors = {};
  const type = String(payload.type || '').trim().toLowerCase();
  const rules = WORKOUT_RULES[type];

  if (!rules) {
    errors.type = 'Workout type must be one of run, gym, yoga';
    throw new ApiError(400, 'Please correct the highlighted fields', errors);
  }

  const rawData = typeof payload.data === 'string' ? safeParse(payload.data) : payload.data;
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
    errors.data = 'Workout data must be a JSON object';
  }

  const data = {};
  const check = (key, rule) => {
    const value = rawData ? rawData[key] : undefined;
    if (isEmpty(value)) {
      if (rule.required) errors[`data.${key}`] = `${rule.label} is required`;
      return;
    }
    if (key === 'exercise') {
      const text = String(value).trim();
      if (text.length < rule.min || text.length > rule.max) {
        errors[`data.${key}`] = `${rule.label} must be ${rule.min}-${rule.max} characters`;
        return;
      }
      data[key] = text;
      return;
    }
    const num = toNumber(value);
    if (!Number.isFinite(num) || num < 0) {
      errors[`data.${key}`] = `${rule.label} must be zero or a positive number`;
      return;
    }
    if (rule.min !== undefined && num < rule.min) {
      errors[`data.${key}`] = `${rule.label} must be at least ${rule.min}`;
      return;
    }
    if (rule.max !== undefined && num > rule.max) {
      errors[`data.${key}`] = `${rule.label} must be ${rule.max} or less`;
      return;
    }
    data[key] = num;
  };

  rules.fields.forEach(([key, rule]) => check(key, rule));
  rules.optional.forEach(([key, rule]) => check(key, rule));

  const calories = toNumber(payload.calories);
  if (!Number.isFinite(calories) || calories <= 0) {
    errors.calories = 'Calories must be a number greater than 0';
  } else if (calories > 20000) {
    errors.calories = 'Calories must be 20000 or less';
  }

  const date = payload.date ? toDate(payload.date) : new Date();
  if (!date) errors.date = 'Date must be a valid date';
  else if (date.getTime() > Date.now() + 1000 * 60 * 60 * 24) {
    errors.date = 'Workout date cannot be in the future';
  }

  const notes = payload.notes ? String(payload.notes).trim() : '';
  if (notes.length > 500) errors.notes = 'Notes must be 500 characters or fewer';

  const title = payload.title ? String(payload.title).trim() : '';
  if (title.length > 80) errors.title = 'Title must be 80 characters or fewer';

  assert(Object.keys(errors).length === 0, 400, 'Please correct the highlighted fields', errors);

  return {
    type,
    data,
    calories,
    date,
    notes,
    title,
    label: rules.label,
  };
};

const validateChallenge = (payload = {}) => {
  const errors = {};
  const name = String(payload.name || '').trim();
  const type = String(payload.type || '').trim().toLowerCase();
  const goal = toNumber(payload.goal);
  const startDate = toDate(payload.startDate);
  const endDate = toDate(payload.endDate);

  if (!name || name.length < 3) errors.name = 'Challenge name must be at least 3 characters';
  else if (name.length > 80) errors.name = 'Challenge name must be 80 characters or fewer';

  if (!['plank', 'run', 'yoga', 'gym'].includes(type)) {
    errors.type = 'Challenge type must be one of plank, run, yoga, gym';
  }

  if (!Number.isFinite(goal) || goal <= 0) errors.goal = 'Goal must be a number greater than 0';
  else if (goal > 100000) errors.goal = 'Goal must be 100000 or less';

  if (!startDate) errors.startDate = 'Start date must be a valid date';
  if (!endDate) errors.endDate = 'End date must be a valid date';
  if (startDate && endDate && endDate.getTime() <= startDate.getTime()) {
    errors.endDate = 'End date must be after the start date';
  }
  if (endDate && endDate.getTime() < Date.now() - 1000 * 60 * 60 * 24 * 365 * 2) {
    errors.endDate = 'End date looks too far in the past';
  }

  const description = payload.description ? String(payload.description).trim() : '';
  if (description.length > 300) errors.description = 'Description must be 300 characters or fewer';

  assert(Object.keys(errors).length === 0, 400, 'Please correct the highlighted fields', errors);
  return { name, description, type, goal, startDate, endDate };
};

const validateSettings = (payload = {}) => {
  const errors = {};
  const result = {};

  if (payload.notifications && typeof payload.notifications === 'object') {
    const allowed = ['workoutReminders', 'prAlerts', 'challengeUpdates', 'socialActivity'];
    const notifications = {};
    allowed.forEach((key) => {
      if (typeof payload.notifications[key] === 'boolean') notifications[key] = payload.notifications[key];
    });
    result.notifications = notifications;
    Object.keys(notifications).forEach((key) => {
      if (typeof payload.notifications[key] !== 'boolean') {
        errors[`notifications.${key}`] = 'Notification settings must be true or false';
      }
    });
  }

  if (!isEmpty(payload.language)) {
    const language = String(payload.language).trim().toLowerCase();
    if (!['en', 'hi', 'es', 'fr', 'de'].includes(language)) errors.language = 'Unsupported language';
    else result.language = language;
  }

  if (!isEmpty(payload.units)) {
    const units = String(payload.units).trim().toLowerCase();
    if (!['metric', 'imperial'].includes(units)) errors.units = 'Units must be metric or imperial';
    else result.units = units;
  }

  if (payload.upiId !== undefined) {
    const upiId = String(payload.upiId || '').trim();
    if (upiId && !UPI_RE.test(upiId)) {
      errors.upiId = 'UPI ID must look like name@bank';
    } else {
      result.upiId = upiId;
    }
  }

  if (payload.bio !== undefined) {
    const bio = String(payload.bio || '').trim();
    if (bio.length > 240) errors.bio = 'Bio must be 240 characters or fewer';
    else result.bio = bio;
  }

  if (payload.location !== undefined) {
    const location = String(payload.location || '').trim();
    if (location.length > 60) errors.location = 'Location must be 60 characters or fewer';
    else result.location = location;
  }

  if (payload.isPublic !== undefined) {
    if (typeof payload.isPublic !== 'boolean') errors.isPublic = 'Profile visibility must be true or false';
    else result.isPublic = payload.isPublic;
  }

  assert(Object.keys(errors).length === 0, 400, 'Please correct the highlighted fields', errors);
  return result;
};

const validateWeight = (payload = {}) => {
  const errors = {};
  const weight = toNumber(payload.weight);
  if (!Number.isFinite(weight) || weight <= 0) errors.weight = 'Weight must be a number greater than 0';
  else if (weight < 20 || weight > 400) errors.weight = 'Weight must be between 20 and 400 kg';

  const date = payload.date ? toDate(payload.date) : new Date();
  if (!date) errors.date = 'Date must be a valid date';
  else if (date.getTime() > Date.now() + 1000 * 60 * 60 * 24) errors.date = 'Date cannot be in the future';

  assert(Object.keys(errors).length === 0, 400, 'Please correct the highlighted fields', errors);
  return { weight, date, note: payload.note ? String(payload.note).trim().slice(0, 120) : '' };
};

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

module.exports = {
  ApiError,
  RESERVED_HANDLES,
  HANDLE_RE,
  assert,
  isEmpty,
  isValidId,
  normaliseHandle,
  safeParse,
  toDate,
  toNumber,
  validateChallenge,
  validateLogin,
  validateRegistration,
  validateSettings,
  validateWeight,
  validateWorkout,
  WORKOUT_RULES,
};