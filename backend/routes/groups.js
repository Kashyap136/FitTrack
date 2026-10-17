const express = require('express');
const { Group } = require('../models/Group');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { ApiError, isValidId } = require('../utils/validators');
const { groupDto } = require('../utils/serializers');

const router = express.Router();

/**
 * Groups are seeded and exposed read-only. The model and this read surface
 * exist so crew features can be added without restructuring the API.
 */
router.get('/list', optionalAuth, async (_req, res, next) => {
  try {
    const groups = await Group.find({ isPrivate: false }).sort({ memberCount: -1, name: 1 });
    res.json({ success: true, count: groups.length, groups: groups.map(groupDto) });
  } catch (error) {
    next(error);
  }
});

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const groups = await Group.find({ 'members._id': req.user._id });
    res.json({ success: true, count: groups.length, groups: groups.map(groupDto) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) throw ApiError.badRequest('Invalid group id');
    const group = await Group.findById(req.params.id);
    if (!group) throw ApiError.notFound('Group not found');
    res.json({ success: true, group: groupDto(group) });
  } catch (error) {
    next(error);
  }
});

module.exports = { groupsRouter: router };