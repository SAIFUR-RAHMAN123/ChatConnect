const mongoose = require('mongoose');
const User = require('../models/User');
const { HttpError, asyncHandler } = require('../utils/httpError');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user._id } }).sort({ name: 1 }).limit(100);
  res.json({ success: true, users });
});

const searchUsers = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 50);
  if (!q) return res.json({ success: true, users: [] });
  const rx = new RegExp(escapeRegex(q), 'i');
  const users = await User.find({
    _id: { $ne: req.user._id },
    $or: [{ name: rx }, { email: rx }],
  })
    .sort({ name: 1 })
    .limit(20);
  res.json({ success: true, users });
});

const getUser = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid user ID');
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');
  res.json({ success: true, user });
});

module.exports = { listUsers, searchUsers, getUser };
