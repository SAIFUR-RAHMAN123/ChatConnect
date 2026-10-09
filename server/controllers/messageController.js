const mongoose = require('mongoose');
const path = require('path');
const Message = require('../models/Message');
const { HttpError, asyncHandler } = require('../utils/httpError');
const {
  getAuthorizedConversation,
  sendMessage,
  sendAttachment,
  editMessage,
  deleteMessage,
  toggleReaction,
  markRead,
} = require('../utils/chatService');
const { UPLOAD_DIR, TYPES, verifyFile, cleanName, removeFile } = require('../utils/uploads');

// GET /api/messages/:conversationId?before=<messageId>&limit=30  -> chronological order
// `before` is the id of the oldest message the client already has (cursor pagination).
const getMessages = asyncHandler(async (req, res) => {
  const conv = await getAuthorizedConversation(req.params.conversationId, req.user._id);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);

  const filter = { conversationId: conv._id };
  if (req.query.before) {
    if (!mongoose.isValidObjectId(req.query.before)) throw new HttpError(400, 'Invalid "before" message ID');
    const cursor = await Message.findOne({ _id: req.query.before, conversationId: conv._id });
    if (!cursor) throw new HttpError(404, 'Cursor message not found');
    filter.$or = [
      { createdAt: { $lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
    ];
  }

  const found = await Message.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1);
  const hasMore = found.length > limit;
  const messages = found.slice(0, limit).reverse();
  res.json({ success: true, messages, hasMore });
});

// POST /api/messages  { conversationId, content }
const createMessage = asyncHandler(async (req, res) => {
  const { conversationId, content } = req.body || {};
  if (!conversationId) throw new HttpError(400, 'conversationId is required');
  const message = await sendMessage(req.app.get('io'), req.user._id, conversationId, content);
  res.status(201).json({ success: true, message });
});

// POST /api/messages/upload  (multipart: file, conversationId, caption?)
const uploadMessage = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) throw new HttpError(400, 'File is required');
  try {
    const { conversationId, caption } = req.body || {};
    if (!conversationId) throw new HttpError(400, 'conversationId is required');
    const ext = path.extname(file.filename).toLowerCase();
    if (!(await verifyFile(file.path, ext))) {
      throw new HttpError(400, 'File content does not match its type');
    }
    const message = await sendAttachment(
      req.app.get('io'),
      req.user._id,
      conversationId,
      {
        filename: file.filename,
        originalName: cleanName(file.originalname),
        mimeType: TYPES[ext].mime,
        size: file.size,
      },
      Boolean(TYPES[ext].image),
      caption
    );
    res.status(201).json({ success: true, message });
  } catch (err) {
    await removeFile(file.filename); // never keep files from rejected uploads
    throw err;
  }
});

// GET /api/messages/:id/file  (participants only, so uploads are never publicly readable)
const getFile = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid message ID');
  const message = await Message.findById(req.params.id);
  if (!message || message.deleted || !message.attachment) throw new HttpError(404, 'File not found');
  await getAuthorizedConversation(message.conversationId, req.user._id);

  const { filename, originalName, mimeType } = message.attachment;
  const isImage = mimeType.startsWith('image/');
  res.setHeader('Content-Type', mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader(
    'Content-Disposition',
    `${isImage ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(originalName)}`
  );
  res.sendFile(path.basename(filename), { root: UPLOAD_DIR }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ success: false, message: 'File not found' });
  });
});

// PATCH /api/messages/:id  { content }
const updateMessage = asyncHandler(async (req, res) => {
  const message = await editMessage(req.app.get('io'), req.user._id, req.params.id, (req.body || {}).content);
  res.json({ success: true, message });
});

// DELETE /api/messages/:id  (delete for everyone)
const removeMessage = asyncHandler(async (req, res) => {
  const message = await deleteMessage(req.app.get('io'), req.user._id, req.params.id);
  res.json({ success: true, message });
});

// PUT /api/messages/:id/reactions  { emoji }
const reactToMessage = asyncHandler(async (req, res) => {
  const message = await toggleReaction(req.app.get('io'), req.user._id, req.params.id, (req.body || {}).emoji);
  res.json({ success: true, message, reactions: message.reactions });
});

// PATCH /api/messages/:id/read
const readMessage = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid message ID');
  const message = await Message.findById(req.params.id);
  if (!message) throw new HttpError(404, 'Message not found');
  // throws 403 if the caller is not in the conversation
  await getAuthorizedConversation(message.conversationId, req.user._id);
  if (message.sender.equals(req.user._id)) throw new HttpError(403, 'You cannot mark your own message as read');

  await markRead(req.app.get('io'), message.conversationId, req.user._id, message._id);
  res.json({ success: true, message: await Message.findById(message._id) });
});

module.exports = {
  getMessages,
  createMessage,
  uploadMessage,
  getFile,
  updateMessage,
  removeMessage,
  reactToMessage,
  readMessage,
};