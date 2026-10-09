const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { tokenPredatesPasswordChange } = require('../middleware/authMiddleware');
const {
  room,
  isOnline,
  getAuthorizedConversation,
  recipientsOf,
  sendMessage,
  markRead,
  markPendingDelivered,
} = require('../utils/chatService');

const errMsg = (err) => (err && err.expose ? err.message : 'Something went wrong');
const reply = (ack, payload) => typeof ack === 'function' && ack(payload);

module.exports = (io) => {
  // Presence is derived from the live socket rooms and written one-at-a-time per user.
  // Without this, a quick disconnect+reconnect (page refresh, React StrictMode) can run
  // two DB writes concurrently and leave a connected user flagged offline.
  const lastPresence = new Map(); // userId -> last broadcast state
  const chains = new Map(); // userId -> promise chain
  const syncPresence = (userId) => {
    const next = (chains.get(userId) || Promise.resolve()).then(async () => {
      const online = isOnline(io, userId);
      if (lastPresence.get(userId) === online) return;
      lastPresence.set(userId, online);
      const lastSeen = new Date();
      await User.updateOne({ _id: userId }, online ? { isOnline: true } : { isOnline: false, lastSeen });
      io.except(room(userId)).emit(online ? 'user:online' : 'user:offline', online ? { userId } : { userId, lastSeen });
    });
    const safe = next.catch((err) => console.error('presence error:', err.message));
    chains.set(userId, safe);
    return safe;
  };

  // JWT auth for every socket connection
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('+passwordChangedAt');
      if (!user) return next(new Error('User not found'));
      if (tokenPredatesPasswordChange(decoded, user)) return next(new Error('Invalid token'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error(err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = String(socket.user._id);
    socket.join(room(userId));

    // Presence work runs in the background so listeners below are registered immediately
    // (awaiting here would drop events the client sends right after connecting).
    (async () => {
      try {
        await syncPresence(userId);
        await markPendingDelivered(io, userId);
      } catch (err) {
        console.error('socket connect error:', err.message);
      }
    })();

    socket.on('message:send', async (data, ack) => {
      try {
        const { conversationId, content, tempId } = data || {};
        const message = await sendMessage(io, userId, conversationId, content, socket.id);
        reply(ack, { success: true, message, tempId });
      } catch (err) {
        if (!err.expose) console.error(err);
        reply(ack, { success: false, message: errMsg(err), tempId: data && data.tempId });
      }
    });

    // typing events go to every other member of the conversation (works for groups too)
    const relayTyping = (event) => async (data) => {
      try {
        const conv = await getAuthorizedConversation(data && data.conversationId, userId);
        recipientsOf(conv, userId).forEach((r) =>
          io.to(room(r)).emit(event, { conversationId: String(conv._id), userId, name: socket.user.name })
        );
      } catch (_) {
        /* ignore invalid typing events */
      }
    };
    socket.on('typing:start', relayTyping('typing:start'));
    socket.on('typing:stop', relayTyping('typing:stop'));

    socket.on('message:read', async (data, ack) => {
      try {
        const result = await markRead(io, data && data.conversationId, userId);
        reply(ack, { success: true, ...result });
      } catch (err) {
        if (!err.expose) console.error(err);
        reply(ack, { success: false, message: errMsg(err) });
      }
    });

    socket.on('error', (err) => console.error('socket error:', err.message));

    // other tabs of the same user may still be connected; syncPresence checks the live rooms
    socket.on('disconnect', () => syncPresence(userId));
  });
};