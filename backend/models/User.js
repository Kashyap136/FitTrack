const mongoose = require('mongoose');

/** Projection string that guarantees password hashes never reach the API. */
const USER_PROJECTION = '-passwordHash -__v';

const userShape = {
  name: { type: String, required: true, trim: true, maxlength: 60 },
  handle: { type: String, required: true, trim: true, lowercase: true, minlength: 3, maxlength: 24 },
  email: { type: String, required: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true, select: false },
  avatarUrl: { type: String, default: '' },
  bio: { type: String, default: '', maxlength: 240 },
  location: { type: String, default: '', maxlength: 60 },
  weight: { type: Number, default: null, min: 20, max: 400 },
  streak: { type: Number, default: 0, min: 0 },
  longestStreak: { type: Number, default: 0, min: 0 },
  lastWorkoutDate: { type: Date, default: null },
  settings: {
    notifications: {
      workoutReminders: { type: Boolean, default: true },
      prAlerts: { type: Boolean, default: true },
      challengeUpdates: { type: Boolean, default: true },
      socialActivity: { type: Boolean, default: false },
    },
    language: { type: String, default: 'en', enum: ['en', 'hi', 'es', 'fr', 'de'] },
    units: { type: String, default: 'metric', enum: ['metric', 'imperial'] },
    upiId: { type: String, default: '', trim: true, maxlength: 64 },
  },
  isPublic: { type: Boolean, default: true },
  role: { type: String, default: 'member', enum: ['member', 'moderator'] },
};

/**
 * Embeddable subset of the User schema so references such as
 * Challenge.members / Group.members always share the same field rules
 * while still avoiding duplicated user data in the database.
 *
 * The embedded copy keeps its own `_id`, which is what every lookup
 * (`{ 'userId._id': ... }`) resolves against.
 */
function userReferenceSchema({ required = false } = {}) {
  const shape = { ...userShape };
  // `unique` must be dropped: an index on an embedded path would reject
  // legitimate rows, because every workout embeds the same user.
  delete shape.passwordHash;
  delete shape.unique;
  return new mongoose.Schema(shape, { id: false, required });
}

const userSchema = new mongoose.Schema(userShape, { timestamps: true });

userSchema.index({ handle: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });

userSchema.virtual('publicProfileUrl').get(function publicProfileUrl() {
  return `/profile/${this.handle}`;
});

userSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

/** Strip sensitive fields from a plain object (e.g. produced by `.lean()`). */
userSchema.methods.toPublic = function toPublic() {
  const obj = this.toObject({ virtuals: true });
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

module.exports = {
  User: mongoose.models.User || mongoose.model('User', userSchema),
  USER_PROJECTION,
  userReferenceSchema,
};