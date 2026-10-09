const router = require('express').Router();
const { register, login, me, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const rateLimit = require('../middleware/rateLimit');

const FIFTEEN_MIN = 15 * 60 * 1000;
const authLimiter = rateLimit({ windowMs: FIFTEEN_MIN, max: 60, message: 'Too many attempts, please try again later' });
const resetLimiter = rateLimit({ windowMs: FIFTEEN_MIN, max: 15, message: 'Too many reset attempts, please try again later' });

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/forgot-password', resetLimiter, forgotPassword);
router.post('/reset-password/:token', resetLimiter, resetPassword);
router.get('/me', protect, me);

module.exports = router;