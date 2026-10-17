const mongoose = require('mongoose');
const { userReferenceSchema } = require('./User');

const CHALLENGE_TYPES = ['plank', 'run', 'yoga', 'gym'];

/** How a single workout converts into progress for each challenge type. */
const CHALLENGE_UNIT = {
  run: { unit: 'km', per: ['distance'], label: 'distance run' },
  plank: { unit: 'seconds', per: ['holdSeconds'], label: 'plank hold' },
  yoga: { unit: 'minutes', per: ['duration'], label: 'yoga session' },
  gym: { unit: 'sets', per: ['sets'], label: 'strength session' },
};

const memberSchema = new mongoose.Schema(
  {
    user: { type: userReferenceSchema(), required: true },
    progress: { type: Number, default: 0, min: 0 },
    goal: { type: Number, default: 0, min: 0 },
    completedAt: { type: Date, default: null },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const challengeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', trim: true, maxlength: 300 },
    type: { type: String, required: true, enum: CHALLENGE_TYPES, lowercase: true, trim: true },
    goal: { type: Number, required: true, min: 0.01 },
    goalUnit: { type: String, default: '' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    members: { type: [memberSchema], default: [] },
    leaderboard: { type: [memberSchema], default: [] },
    createdBy: { type: userReferenceSchema(), default: null },
    visibility: { type: String, default: 'public', enum: ['public', 'private'] },
  },
  { timestamps: true }
);

challengeSchema.index({ startDate: -1, endDate: -1 });

// The unit label always matches the challenge type, so the UI never has to
// guess what a goal of "3600" is measured in.
challengeSchema.pre('validate', function setGoalUnit(next) {
  if (!this.goalUnit && CHALLENGE_UNIT[this.type]) {
    this.goalUnit = CHALLENGE_UNIT[this.type].unit;
  }
  next();
});

/** True when the current date sits inside the challenge window. */
challengeSchema.methods.isActive = function isActive(now = new Date()) {
  return this.startDate <= now && this.endDate >= now;
};

challengeSchema.methods.status = function status(now = new Date()) {
  if (now < this.startDate) return 'upcoming';
  if (now > this.endDate) return 'ended';
  return 'active';
};

module.exports = {
  Challenge: mongoose.models.Challenge || mongoose.model('Challenge', challengeSchema),
  CHALLENGE_TYPES,
  CHALLENGE_UNIT,
};