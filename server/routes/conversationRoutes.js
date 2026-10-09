const router = require('express').Router();
const {
  listConversations,
  createConversation,
  getConversation,
  createGroup,
  renameGroup,
  addMembers,
  removeMember,
} = require('../controllers/conversationController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);
router.get('/', listConversations);
router.post('/', createConversation);
router.post('/group', createGroup);
router.get('/:id', getConversation);
router.patch('/:id', renameGroup);
router.post('/:id/members', addMembers);
router.delete('/:id/members/:userId', removeMember);

module.exports = router;