const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { HttpError, asyncHandler } = require('../utils/httpError');

// A token issued before the user's last password change is no longer valid.
const tokenPredatesPasswordChange = (decoded, user) =>
  Boolean(user.passwordChangedAt) && decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000);

const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    throw new HttpError(401, 'Not authorized, token missing');
  }
  const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET); // errors handled centrally
  const user = await User.findById(decoded.id).select('+passwordChangedAt');
  if (!user) throw new HttpError(401, 'User no longer exists');
  if (tokenPredatesPasswordChange(decoded, user)) {
    throw new HttpError(401, 'Password was changed, please log in again');
  }
  req.user = user;
  next();
});

module.exports = { protect, tokenPredatesPasswordChange };