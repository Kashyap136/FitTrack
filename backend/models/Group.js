const mongoose = require('mongoose');
const { userReferenceSchema } = require('./User');

/**
 * Community / crew grouping. The model and indexes exist so group features
 * (crew feeds, group challenges) can be added later without restructuring.
 */
const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
    description: { type: String, default: '', trim: true, maxlength: 240 },
    type: { type: String, required: true, trim: true, lowercase: true, default: 'fitness' },
    members: { type: [userReferenceSchema()], default: [] },
    memberCount: { type: Number, default: 0, min: 0 },
    createdBy: { type: userReferenceSchema(), default: null },
    isPrivate: { type: Boolean, default: false },
  },
  { timestamps: true }
);

groupSchema.index({ type: 1 });

groupSchema.pre('save', function syncMemberCount(next) {
  this.memberCount = this.members.length;
  next();
});

module.exports = {
  Group: mongoose.models.Group || mongoose.model('Group', groupSchema),
};