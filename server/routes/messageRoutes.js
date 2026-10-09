const router = require('express').Router();
const {
  getMessages,
  createMessage,
  uploadMessage,
  getFile,
  updateMessage,
  removeMessage,
  reactToMessage,
  readMessage,
} = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../utils/uploads');

router.use(protect);
router.post('/', createMessage);
router.post('/upload', upload.single('file'), uploadMessage);
router.get('/:id/file', getFile);
router.put('/:id/reactions', reactToMessage);
router.patch('/:id/read', readMessage);
router.patch('/:id', updateMessage);
router.delete('/:id', removeMessage);
router.get('/:conversationId', getMessages);

module.exports = router;