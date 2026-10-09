const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { HttpError } = require('./httpError');
const { removeFile } = require('./uploads');

const MAX_LEN = 2000;
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const room = (userId) => `user:${userId}`;
const isOnline = (io, userId) => io.sockets.adapter.rooms.has(room(userId));

// Loads a conversation and guarantees the user is one of its participants.
const getAuthorizedConversation = async (conversationId, userId) => {
  if (!mongoose.isValidObjectId(conversationId)) throw new HttpError(400, 'Invalid conversation ID');
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw new HttpError(404, 'Conversation not found');
  if (!conv.participants.some((p) => p.equals(userId))) {
    throw new HttpError(403, 'You are not a participant of this conversation');
  }
  return conv;
};

const recipientsOf = (conv, userId) => conv.participants.filter((p) => !p.equals(userId));

const emitToParticipants = (io, conv, event, payload) => {
  let target = io;
  conv.participants.forEach((p) => {
    target = target.to(room(p));
  });
  target.emit(event, payload);
};

const cleanText = (content, { required }) => {
  const text = typeof content === 'string' ? content.trim() : '';
  if (required && !text) throw new HttpError(400, 'Message cannot be empty');
  if (text.length > MAX_LEN) throw new HttpError(400, `Message too long (max ${MAX_LEN} characters)`);
  return text;
};

const persistAndBroadcast = async (io, senderId, conv, fields, excludeSocketId) => {
  const recipients = recipientsOf(conv, senderId);
  const deliveredTo = recipients.filter((r) => isOnline(io, r));
  const allDelivered = recipients.length > 0 && deliveredTo.length === recipients.length;

  const message = await Message.create({
    conversationId: conv._id,
    sender: senderId,
    ...fields,
    deliveredTo,
    status: allDelivered ? 'delivered' : 'sent',
  });
  conv.lastMessage = message._id;
  await conv.save(); // bumps updatedAt

  const payload = message.toJSON();
  recipients.forEach((r) => io.to(room(r)).emit('message:receive', payload));
  // keep the sender's other tabs in sync
  const own = io.to(room(senderId));
  (excludeSocketId ? own.except(excludeSocketId) : own).emit('message:receive', payload);
  return payload;
};

const sendMessage = async (io, senderId, conversationId, content, excludeSocketId) => {
  const text = cleanText(content, { required: true });
  const conv = await getAuthorizedConversation(conversationId, senderId);
  return persistAndBroadcast(io, senderId, conv, { type: 'text', content: text }, excludeSocketId);
};

const sendAttachment = async (io, senderId, conversationId, attachment, isImage, caption) => {
  const text = cleanText(caption, { required: false });
  const conv = await getAuthorizedConversation(conversationId, senderId);
  return persistAndBroadcast(io, senderId, conv, {
    type: isImage ? 'image' : 'file',
    content: text,
    attachment,
  });
};

const loadMessage = async (messageId) => {
  if (!mongoose.isValidObjectId(messageId)) throw new HttpError(400, 'Invalid message ID');
  const message = await Message.findById(messageId);
  if (!message) throw new HttpError(404, 'Message not found');
  return message;
};

const editMessage = async (io, userId, messageId, content) => {
  const message = await loadMessage(messageId);
  const conv = await getAuthorizedConversation(message.conversationId, userId);
  if (!message.sender.equals(userId)) throw new HttpError(403, 'You can only edit your own messages');
  if (message.deleted) throw new HttpError(400, 'This message was deleted');
  if (message.type !== 'text') throw new HttpError(400, 'Only text messages can be edited');

  message.content = cleanText(content, { required: true });
  message.edited = true;
  message.editedAt = new Date();
  await message.save();
  const payload = message.toJSON();
  emitToParticipants(io, conv, 'message:edited', { conversationId: String(conv._id), message: payload });
  return payload;
};

const deleteMessage = async (io, userId, messageId) => {
  const message = await loadMessage(messageId);
  const conv = await getAuthorizedConversation(message.conversationId, userId);
  if (!message.sender.equals(userId)) throw new HttpError(403, 'You can only delete your own messages');
  if (message.deleted) return message.toJSON();

  const filename = message.attachment && message.attachment.filename;
  message.deleted = true;
  message.content = '';
  message.attachment = undefined;
  message.reactions = [];
  await message.save();
  await removeFile(filename);
  const payload = message.toJSON();
  emitToParticipants(io, conv, 'message:deleted', { conversationId: String(conv._id), message: payload });
  return payload;
};

// One reaction per user: same emoji removes it, a different emoji replaces it.
const toggleReaction = async (io, userId, messageId, emoji) => {
  if (!REACTIONS.includes(emoji)) throw new HttpError(400, 'Unsupported reaction');
  const message = await loadMessage(messageId);
  const conv = await getAuthorizedConversation(message.conversationId, userId);
  if (message.deleted) throw new HttpError(400, 'This message was deleted');

  const previous = message.reactions.find((r) => r.user.equals(userId));
  message.reactions = message.reactions.filter((r) => !r.user.equals(userId));
  if (!previous || previous.emoji !== emoji) message.reactions.push({ user: userId, emoji });
  await message.save();

  const payload = message.toJSON();
  emitToParticipants(io, conv, 'message:reaction', {
    conversationId: String(conv._id),
    messageId: String(message._id),
    reactions: payload.reactions,
  });
  return payload;
};

// Marks incoming messages as read by `userId` (optionally only one message).
// A message is "read" (blue ticks) once EVERY recipient has read it.
const markRead = async (io, conversationId, userId, onlyMessageId) => {
  const conv = await getAuthorizedConversation(conversationId, userId);
  const filter = {
    conversationId: conv._id,
    sender: { $ne: userId },
    readBy: { $ne: userId },
    status: { $ne: 'read' },
    deleted: { $ne: true },
  };
  if (onlyMessageId) filter._id = onlyMessageId;

  const ids = (await Message.find(filter).select('_id').lean()).map((m) => m._id);
  if (!ids.length) return { messageIds: [], fullyReadIds: [], readAt: null };

  await Message.updateMany({ _id: { $in: ids } }, { $addToSet: { readBy: userId } });
  const updated = await Message.find({ _id: { $in: ids } }).select('_id sender readBy').lean();
  const fullyRead = updated
    .filter((m) =>
      recipientsOf(conv, m.sender).every((r) => m.readBy.some((x) => String(x) === String(r)))
    )
    .map((m) => m._id);

  const readAt = new Date();
  if (fullyRead.length) {
    await Message.updateMany({ _id: { $in: fullyRead } }, { status: 'read', readAt });
  }

  const payload = {
    conversationId: String(conv._id),
    readerId: String(userId),
    messageIds: ids.map(String),
    fullyReadIds: fullyRead.map(String),
    readAt,
  };
  emitToParticipants(io, conv, 'message:read', payload);
  return payload;
};

// When a user comes online, messages addressed to them that were still "sent" become delivered.
const markPendingDelivered = async (io, userId) => {
  const convs = await Conversation.find({ participants: userId }).select('_id participants').lean();
  for (const conv of convs) {
    const pending = await Message.find({
      conversationId: conv._id,
      sender: { $ne: userId },
      status: 'sent',
      deliveredTo: { $ne: userId },
      deleted: { $ne: true },
    })
      .select('_id sender deliveredTo')
      .lean();
    if (!pending.length) continue;

    await Message.updateMany(
      { _id: { $in: pending.map((m) => m._id) } },
      { $addToSet: { deliveredTo: userId } }
    );

    const everyone = (m) =>
      conv.participants
        .filter((p) => String(p) !== String(m.sender))
        .every((p) => String(p) === String(userId) || m.deliveredTo.some((x) => String(x) === String(p)));
    const full = pending.filter(everyone);
    if (full.length) {
      await Message.updateMany({ _id: { $in: full.map((m) => m._id) } }, { status: 'delivered' });
    }

    const bySender = {};
    full.forEach((m) => {
      (bySender[m.sender] = bySender[m.sender] || []).push(String(m._id));
    });
    Object.entries(bySender).forEach(([senderId, messageIds]) => {
      io.to(room(senderId)).emit('message:delivered', {
        conversationId: String(conv._id),
        recipientId: String(userId),
        messageIds,
      });
    });
  }
};

const unreadCount = (conversationId, userId) =>
  Message.countDocuments({
    conversationId,
    sender: { $ne: userId },
    status: { $ne: 'read' },
    readBy: { $ne: userId },
    deleted: { $ne: true },
  });

// Deletes a conversation with all its messages and uploaded files.
const deleteConversationCascade = async (conversationId) => {
  const withFiles = await Message.find({ conversationId, 'attachment.filename': { $exists: true } })
    .select('attachment')
    .lean();
  await Promise.all(withFiles.map((m) => removeFile(m.attachment.filename)));
  await Message.deleteMany({ conversationId });
  await Conversation.deleteOne({ _id: conversationId });
};

module.exports = {
  REACTIONS,
  room,
  isOnline,
  getAuthorizedConversation,
  recipientsOf,
  emitToParticipants,
  sendMessage,
  sendAttachment,
  editMessage,
  deleteMessage,
  toggleReaction,
  markRead,
  markPendingDelivered,
  unreadCount,
  deleteConversationCascade,
};