const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { HttpError, asyncHandler } = require('../utils/httpError');
const {
  getAuthorizedConversation,
  emitToParticipants,
  room,
  unreadCount,
  deleteConversationCascade,
} = require('../utils/chatService');

const MAX_GROUP_MEMBERS = 50;

const populate = (q) =>
  q.populate('participants', 'name email avatar isOnline lastSeen').populate('lastMessage');

const toDTO = async (conv, userId) => {
  const dto = {
    _id: conv._id,
    isGroup: Boolean(conv.isGroup),
    name: conv.name || '',
    admin: conv.admin || null,
    participants: conv.participants,
    lastMessage: conv.lastMessage || null,
    unreadCount: await unreadCount(conv._id, userId),
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
  };
  if (!conv.isGroup) {
    dto.participant = conv.participants.find((p) => String(p._id) !== String(userId));
  }
  return dto;
};

const fullDTO = async (id, userId) => toDTO(await populate(Conversation.findById(id)), userId);

// Validates a list of user ids from the request body; returns unique ObjectId strings.
const parseUserIds = async (ids, { exclude = [] } = {}) => {
  if (!Array.isArray(ids)) throw new HttpError(400, 'A list of user IDs is required');
  const unique = [...new Set(ids.map(String))].filter((id) => !exclude.includes(id));
  if (!unique.every((id) => mongoose.isValidObjectId(id))) throw new HttpError(400, 'Invalid user ID');
  if ((await User.countDocuments({ _id: { $in: unique } })) !== unique.length) {
    throw new HttpError(404, 'One or more users were not found');
  }
  return unique;
};

const requireGroupAdmin = (conv, userId) => {
  if (!conv.isGroup) throw new HttpError(400, 'This is not a group conversation');
  if (!conv.admin || !conv.admin.equals(userId)) throw new HttpError(403, 'Only the group admin can do this');
};

const listConversations = asyncHandler(async (req, res) => {
  const convs = await populate(
    Conversation.find({ participants: req.user._id }).sort({ updatedAt: -1 })
  );
  const conversations = await Promise.all(convs.map((c) => toDTO(c, req.user._id)));
  res.json({ success: true, conversations });
});

const createConversation = asyncHandler(async (req, res) => {
  const { participantId } = req.body || {};
  if (!participantId) throw new HttpError(400, 'participantId is required');
  if (!mongoose.isValidObjectId(participantId)) throw new HttpError(400, 'Invalid user ID');
  if (String(participantId) === String(req.user._id)) {
    throw new HttpError(400, 'You cannot start a conversation with yourself');
  }
  if (!(await User.exists({ _id: participantId }))) throw new HttpError(404, 'User not found');

  const pairKey = [String(req.user._id), String(participantId)].sort().join('_');
  let created = false;
  let conv = await Conversation.findOne({ pairKey });
  if (!conv) {
    try {
      conv = await Conversation.create({ participants: [req.user._id, participantId], pairKey });
      created = true;
    } catch (err) {
      if (err.code !== 11000) throw err;
      conv = await Conversation.findOne({ pairKey }); // lost a race: reuse existing
    }
  }
  res.status(created ? 201 : 200).json({ success: true, conversation: await fullDTO(conv._id, req.user._id) });
});

const getConversation = asyncHandler(async (req, res) => {
  await getAuthorizedConversation(req.params.id, req.user._id);
  res.json({ success: true, conversation: await fullDTO(req.params.id, req.user._id) });
});

// ---------- groups ----------

// POST /api/conversations/group  { name, participantIds }
const createGroup = asyncHandler(async (req, res) => {
  const { name, participantIds } = req.body || {};
  const title = typeof name === 'string' ? name.trim() : '';
  if (!title) throw new HttpError(400, 'Group name is required');
  if (title.length > 50) throw new HttpError(400, 'Group name is too long (max 50 characters)');
  const others = await parseUserIds(participantIds, { exclude: [String(req.user._id)] });
  if (others.length < 1) throw new HttpError(400, 'Add at least one other member');
  if (others.length + 1 > MAX_GROUP_MEMBERS) throw new HttpError(400, `A group can have at most ${MAX_GROUP_MEMBERS} members`);

  const _id = new mongoose.Types.ObjectId();
  const conv = await Conversation.create({
    _id,
    isGroup: true,
    name: title,
    admin: req.user._id,
    participants: [req.user._id, ...others],
    pairKey: `group_${_id}`,
  });
  emitToParticipants(req.app.get('io'), conv, 'conversation:updated', { conversationId: String(_id) });
  res.status(201).json({ success: true, conversation: await fullDTO(_id, req.user._id) });
});

// PATCH /api/conversations/:id  { name }   (admin only)
const renameGroup = asyncHandler(async (req, res) => {
  const conv = await getAuthorizedConversation(req.params.id, req.user._id);
  requireGroupAdmin(conv, req.user._id);
  const title = typeof (req.body || {}).name === 'string' ? req.body.name.trim() : '';
  if (!title) throw new HttpError(400, 'Group name is required');
  if (title.length > 50) throw new HttpError(400, 'Group name is too long (max 50 characters)');
  conv.name = title;
  await conv.save();
  emitToParticipants(req.app.get('io'), conv, 'conversation:updated', { conversationId: String(conv._id) });
  res.json({ success: true, conversation: await fullDTO(conv._id, req.user._id) });
});

// POST /api/conversations/:id/members  { userIds }   (admin only)
const addMembers = asyncHandler(async (req, res) => {
  const conv = await getAuthorizedConversation(req.params.id, req.user._id);
  requireGroupAdmin(conv, req.user._id);
  const current = conv.participants.map(String);
  const toAdd = await parseUserIds((req.body || {}).userIds, { exclude: current });
  if (!toAdd.length) throw new HttpError(400, 'Those users are already in the group');
  if (current.length + toAdd.length > MAX_GROUP_MEMBERS) {
    throw new HttpError(400, `A group can have at most ${MAX_GROUP_MEMBERS} members`);
  }
  conv.participants.push(...toAdd);
  await conv.save();
  emitToParticipants(req.app.get('io'), conv, 'conversation:updated', { conversationId: String(conv._id) });
  res.json({ success: true, conversation: await fullDTO(conv._id, req.user._id) });
});

// DELETE /api/conversations/:id/members/:userId
// Members can remove themselves (leave); the admin can remove anyone.
const removeMember = asyncHandler(async (req, res) => {
  const conv = await getAuthorizedConversation(req.params.id, req.user._id);
  if (!conv.isGroup) throw new HttpError(400, 'This is not a group conversation');
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) throw new HttpError(400, 'Invalid user ID');
  const leaving = String(userId) === String(req.user._id);
  if (!leaving) requireGroupAdmin(conv, req.user._id);
  if (!conv.participants.some((p) => p.equals(userId))) throw new HttpError(404, 'User is not in this group');

  const io = req.app.get('io');
  conv.participants = conv.participants.filter((p) => !p.equals(userId));

  if (conv.participants.length === 0) {
    await deleteConversationCascade(conv._id);
  } else {
    if (conv.admin && conv.admin.equals(userId)) conv.admin = conv.participants[0]; // hand over admin
    await conv.save();
  }

  io.to(room(userId)).emit('conversation:removed', { conversationId: String(conv._id) });
  if (conv.participants.length) {
    emitToParticipants(io, conv, 'conversation:updated', { conversationId: String(conv._id) });
  }
  if (leaving) return res.json({ success: true });
  res.json({ success: true, conversation: await fullDTO(conv._id, req.user._id) });
});

module.exports = {
  listConversations,
  createConversation,
  getConversation,
  createGroup,
  renameGroup,
  addMembers,
  removeMember,
};