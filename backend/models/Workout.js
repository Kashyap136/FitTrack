const mongoose = require('mongoose');
const { userReferenceSchema } = require('./User');

const WORKOUT_TYPES = ['run', 'gym', 'yoga'];

const likesSchema = new mongoose.Schema(
  {
    user: { type: userReferenceSchema(), required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Comments carry a stable `_id` so individual comments can be addressed by the
// API. Likes are keyed by user, so they stay compact (`_id: false`).
const commentSchema = new mongoose.Schema({
  user: { type: userReferenceSchema(), required: true },
  text: { type: String, required: true, trim: true, maxlength: 500 },
  createdAt: { type: Date, default: Date.now },
});

const workoutSchema = new mongoose.Schema(
  {
    userId: { type: userReferenceSchema(), required: true },
    type: { type: String, required: true, enum: WORKOUT_TYPES, lowercase: true, trim: true },
    title: { type: String, default: '', trim: true, maxlength: 80 },
    notes: { type: String, default: '', trim: true, maxlength: 500 },
    data: {
      type: { type: String, trim: true, lowercase: true }, // run | gym | yoga
      exercise: { type: String, default: '', trim: true, maxlength: 80 },
      duration: { type: Number, min: 0, default: 0 },
      distance: { type: Number, min: 0, default: 0 }, // km
      sets: { type: Number, min: 0, default: 0 },
      reps: { type: Number, min: 0, default: 0 },
      weight: { type: Number, min: 0, default: 0 }, // kg lifted per set (gym)
      holdSeconds: { type: Number, min: 0, default: 0 }, // plank / yoga holds
      intensity: { type: Number, min: 1, max: 10, default: 5 },
      avgHeartRate: { type: Number, min: 0, default: 0 },
    },
    calories: { type: Number, required: true, min: 0, max: 20000 },
    date: { type: Date, required: true, default: Date.now },
    pr: { type: Boolean, default: false },
    prHighlights: { type: [String], default: [] },
    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
    likes: { type: [likesSchema], default: [] },
    comments: { type: [commentSchema], default: [] },
  },
  { timestamps: true }
);

workoutSchema.index({ 'userId._id': 1, date: -1 });
workoutSchema.index({ date: -1 });
workoutSchema.index({ pr: 1 });

/** Human readable summary used across the feed, profile and leaderboard. */
workoutSchema.methods.summary = function summary() {
  const d = this.data || {};
  switch (this.type) {
    case 'run': {
      if (d.distance > 0) return `${d.distance.toFixed(1)} km`;
      return `${d.duration || 0} min`;
    }
    case 'gym':
      if (d.sets > 0 && d.reps > 0) return `${d.sets} x ${d.reps}`;
      if (d.duration > 0) return `${d.duration} min`;
      return 'Strength session';
    case 'yoga':
      return `${d.duration || 0} min flow`;
    default:
      return 'Workout';
  }
};

module.exports = {
  Workout: mongoose.models.Workout || mongoose.model('Workout', workoutSchema),
  WORKOUT_TYPES,
};