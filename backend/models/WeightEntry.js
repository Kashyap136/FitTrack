const mongoose = require('mongoose');
const { userReferenceSchema } = require('./User');

/**
 * Dated weight measurements. The profile weight chart reads from this
 * collection so historical values are real database records rather than
 * hardcoded front-end data.
 */
const weightEntrySchema = new mongoose.Schema(
  {
    userId: { type: userReferenceSchema(), required: true },
    weight: { type: Number, required: true, min: 20, max: 400 },
    date: { type: Date, required: true, default: Date.now },
    note: { type: String, default: '', trim: true, maxlength: 120 },
  },
  { timestamps: true }
);

weightEntrySchema.index({ 'userId._id': 1, date: 1 });

module.exports = {
  WeightEntry: mongoose.models.WeightEntry || mongoose.model('WeightEntry', weightEntrySchema),
};