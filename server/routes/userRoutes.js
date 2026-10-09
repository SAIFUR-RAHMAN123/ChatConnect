const router = require('express').Router();
const { listUsers, searchUsers, getUser } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);
router.get('/', listUsers);
router.get('/search', searchUsers); // must stay above '/:id'
router.get('/:id', getUser);

module.exports = router;
