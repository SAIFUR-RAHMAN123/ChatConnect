const crypto = require('crypto');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { sendResetEmail } = require('../utils/mailer');
const { HttpError, asyncHandler } = require('../utils/httpError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const register = asyncHandler(async (req, res) => {
  const { name, email, password, confirmPassword } = req.body || {};
  if (![name, email, password, confirmPassword].every((v) => typeof v === 'string' && v.trim())) {
    throw new HttpError(400, 'Name, email, password and confirm password are required');
  }
  if (!EMAIL_RE.test(email.trim())) throw new HttpError(400, 'Please provide a valid email');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  if (password !== confirmPassword) throw new HttpError(400, 'Passwords do not match');

  const normalized = email.trim().toLowerCase();
  if (await User.exists({ email: normalized })) throw new HttpError(409, 'Email is already registered');

  const user = await User.create({ name: name.trim(), email: normalized, password });
  res.status(201).json({ success: true, user, token: generateToken(user._id) });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw new HttpError(400, 'Email and password are required');
  }
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    throw new HttpError(401, 'Invalid email or password');
  }
  res.json({ success: true, user, token: generateToken(user._id) });
});

const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});

// POST /api/auth/forgot-password  { email }
// Always answers the same way so nobody can find out which emails are registered.
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    throw new HttpError(400, 'Please provide a valid email');
  }
  const body = { success: true, message: 'If an account exists for that email, a reset link has been sent.' };

  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = sha256(token); // only the hash is stored
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const base = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '');
    const link = `${base}/reset-password/${token}`;
    try {
      await sendResetEmail(user, link);
    } catch (err) {
      console.error('Failed to send reset email:', err.message);
    }
    // local development helper only: set SHOW_RESET_LINK=true in server/.env
    if (process.env.SHOW_RESET_LINK === 'true') body.resetLink = link;
  }
  res.json(body);
});

// POST /api/auth/reset-password/:token  { password, confirmPassword }
const resetPassword = asyncHandler(async (req, res) => {
  const { password, confirmPassword } = req.body || {};
  if (typeof password !== 'string' || typeof confirmPassword !== 'string' || !password) {
    throw new HttpError(400, 'Password and confirm password are required');
  }
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  if (password !== confirmPassword) throw new HttpError(400, 'Passwords do not match');

  const user = await User.findOne({
    resetPasswordToken: sha256(String(req.params.token)),
    resetPasswordExpires: { $gt: new Date() },
  });
  if (!user) throw new HttpError(400, 'This reset link is invalid or has expired');

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save(); // also stamps passwordChangedAt, which logs out older sessions

  res.json({ success: true, message: 'Password updated', user, token: generateToken(user._id) });
});

module.exports = { register, login, me, forgotPassword, resetPassword };