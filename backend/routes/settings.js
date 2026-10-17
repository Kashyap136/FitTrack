const express = require('express');
const { User } = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { ApiError, validateSettings } = require('../utils/validators');

const router = express.Router();

/** GET /api/settings — current settings for the signed-in user. */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('settings').lean();
    if (!user) throw ApiError.notFound('User not found');
    res.json({ success: true, settings: user.settings });
  } catch (error) {
    next(error);
  }
});

/** PUT /api/settings — persist notification, language, units and UPI settings. */
router.put('/', requireAuth, async (req, res, next) => {
  try {
    const updates = validateSettings(req.body);
    if (!Object.keys(updates).length) {
      throw ApiError.badRequest('Nothing to update — send at least one setting');
    }

    const setOps = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'notifications') {
        Object.entries(value).forEach(([notificationKey, notificationValue]) => {
          setOps[`settings.notifications.${notificationKey}`] = notificationValue;
        });
      } else {
        setOps[`settings.${key}`] = value;
      }
    });

    const user = await User.findByIdAndUpdate(req.user._id, { $set: setOps }, {
      new: true,
      runValidators: true,
    }).select('settings');

    if (!user) throw ApiError.notFound('User not found');

    res.json({ success: true, message: 'Settings saved', settings: user.settings });
  } catch (error) {
    next(error);
  }
});

module.exports = { settingsRouter: router };