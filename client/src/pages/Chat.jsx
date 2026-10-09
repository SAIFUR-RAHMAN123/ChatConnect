import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api, { TOKEN_KEY, getErrorMessage } from '../services/api';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import NewGroupModal from '../components/NewGroupModal';

const PAGE_SIZE = 30;
const MAX_FILE = 5 * 1024 * 1024;
const isViewing = () => document.visibilityState === 'visible' && document.hasFocus();
const tempIdFor = () => `tmp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export default function Chat() {
  const { user, logout } = useAuth();
  const userId = user._id;

  const [conversations, setConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(true);
  const [convError, setConvError] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typing, setTyping] = useState({}); // conversationId -> { userId: name }
  const [presence, setPresence] = useState({}); // userId -> { isOnline, lastSeen }
  const [connected, setConnected] = useState(true);
  const [notice, setNotice] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);

  const activeIdRef = useRef(null);
  activeIdRef.current = activeId;
  const convsRef = useRef([]);
  convsRef.current = conversations;
  const typingTimers = useRef({});
  const pendingFiles = useRef({}); // tempId -> { file, caption } so a failed upload can be retried

  const showNotice = useCallback((text) => {
    setNotice(text);
    clearTimeout(showNotice.t);
    showNotice.t = setTimeout(() => setNotice(''), 4000);
  }, []);

  const withPresence = useCallback((u) => ({ ...u, ...presence[u._id] }), [presence]);

  // helpers that keep both the open thread and the conversation list in sync
  const patchMessage = useCallback((convId, messageId, patcher) => {
    if (activeIdRef.current === convId) {
      setMessages((ms) => ms.map((m) => (m._id === messageId ? patcher(m) : m)));
    }
    setConversations((cs) =>
      cs.map((c) => (c._id === convId && c.lastMessage?._id === messageId ? { ...c, lastMessage: patcher(c.lastMessage) } : c))
    );
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const { data } = await api.get('/conversations');
      setConversations(data.conversations);
      setPresence({}); // fresh server data supersedes live overrides
      setConvError('');
    } catch (err) {
      setConvError(getErrorMessage(err));
    } finally {
      setConvLoading(false);
    }
  }, []);

  const markRead = useCallback((convId) => {
    const socket = getSocket();
    if (!socket?.connected) return;
    socket.emit('message:read', { conversationId: convId });
    setConversations((cs) => cs.map((c) => (c._id === convId && c.unreadCount ? { ...c, unreadCount: 0 } : c)));
  }, []);

  const loadMessages = useCallback(
    async (convId, { silent = false } = {}) => {
      if (!silent) setMsgLoading(true);
      setMsgError('');
      try {
        const { data } = await api.get(`/messages/${convId}`, { params: { limit: PAGE_SIZE } });
        if (activeIdRef.current !== convId) return;
        setMessages(data.messages);
        setHasMore(data.hasMore);
        if (isViewing()) markRead(convId);
      } catch (err) {
        if (activeIdRef.current === convId) setMsgError(getErrorMessage(err));
      } finally {
        if (activeIdRef.current === convId) setMsgLoading(false);
      }
    },
    [markRead]
  );

  const setTypingFor = useCallback((convId, uid, name, value) => {
    const key = `${convId}:${uid}`;
    clearTimeout(typingTimers.current[key]);
    setTyping((t) => {
      const users = { ...(t[convId] || {}) };
      if (value) users[uid] = name;
      else delete users[uid];
      const next = { ...t };
      if (Object.keys(users).length) next[convId] = users;
      else delete next[convId];
      return next;
    });
    // safety net in case "typing:stop" is never received
    if (value) typingTimers.current[key] = setTimeout(() => setTypingFor(convId, uid, name, false), 5000);
  }, []);

  const closeConversation = useCallback((convId) => {
    setConversations((cs) => cs.filter((c) => c._id !== convId));
    if (activeIdRef.current === convId) {
      setActiveId(null);
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ---- Socket.IO wiring ----
  useEffect(() => {
    const socket = connectSocket(localStorage.getItem(TOKEN_KEY));
    let firstConnect = true;

    socket.on('connect', () => {
      setConnected(true);
      if (!firstConnect) {
        // resync anything missed while offline
        loadConversations();
        if (activeIdRef.current) loadMessages(activeIdRef.current, { silent: true });
      }
      firstConnect = false;
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err) => {
      setConnected(false);
      if (/token|authentication|not found/i.test(err.message)) logout();
    });

    socket.on('message:receive', (msg) => {
      const convId = String(msg.conversationId);
      const mine = msg.sender === userId;
      const exists = convsRef.current.some((c) => c._id === convId);
      if (!exists) return loadConversations(); // brand-new conversation started by someone else

      const isActive = activeIdRef.current === convId;
      const viewing = isActive && isViewing();

      setConversations((cs) => {
        const c = cs.find((x) => x._id === convId);
        if (!c) return cs;
        const unreadCount = mine || viewing ? c.unreadCount : c.unreadCount + 1;
        return [{ ...c, lastMessage: msg, updatedAt: msg.createdAt, unreadCount }, ...cs.filter((x) => x._id !== convId)];
      });
      if (isActive) {
        setMessages((ms) => (ms.some((m) => m._id === msg._id) ? ms : [...ms, msg]));
        if (!mine && viewing) markRead(convId);
      }
      if (!mine) setTypingFor(convId, msg.sender, '', false);
    });

    // only messages delivered to EVERYONE are listed (matters in groups)
    socket.on('message:delivered', ({ conversationId, messageIds = [] }) => {
      const ids = new Set(messageIds);
      const upgrade = (m) => (ids.has(m._id) && m.status === 'sent' ? { ...m, status: 'delivered' } : m);
      if (activeIdRef.current === conversationId) setMessages((ms) => ms.map(upgrade));
      setConversations((cs) =>
        cs.map((c) => (c._id === conversationId && c.lastMessage ? { ...c, lastMessage: upgrade(c.lastMessage) } : c))
      );
    });

    socket.on('message:read', ({ conversationId, readerId, messageIds, fullyReadIds, readAt }) => {
      if (readerId === userId) {
        // I read it in another tab
        setConversations((cs) => cs.map((c) => (c._id === conversationId ? { ...c, unreadCount: 0 } : c)));
        return;
      }
      const seen = new Set(messageIds);
      const full = new Set(fullyReadIds || messageIds);
      const apply = (m) =>
        seen.has(m._id)
          ? {
              ...m,
              readBy: [...new Set([...(m.readBy || []), readerId])],
              ...(full.has(m._id) ? { status: 'read', readAt } : {}),
            }
          : m;
      if (activeIdRef.current === conversationId) setMessages((ms) => ms.map(apply));
      setConversations((cs) =>
        cs.map((c) => (c._id === conversationId && c.lastMessage ? { ...c, lastMessage: apply(c.lastMessage) } : c))
      );
    });

    const replace = ({ conversationId, message }) =>
      patchMessage(String(conversationId), message._id, (old) => ({ ...message, tempId: old.tempId }));
    socket.on('message:edited', replace);
    socket.on('message:deleted', replace);
    socket.on('message:reaction', ({ conversationId, messageId, reactions }) =>
      patchMessage(String(conversationId), messageId, (m) => ({ ...m, reactions }))
    );

    socket.on('typing:start', ({ conversationId, userId: uid, name }) => setTypingFor(conversationId, uid, name, true));
    socket.on('typing:stop', ({ conversationId, userId: uid }) => setTypingFor(conversationId, uid, '', false));

    socket.on('user:online', ({ userId: id }) => setPresence((p) => ({ ...p, [id]: { isOnline: true } })));
    socket.on('user:offline', ({ userId: id, lastSeen }) =>
      setPresence((p) => ({ ...p, [id]: { isOnline: false, lastSeen } }))
    );

    // group created / renamed / members changed
    socket.on('conversation:updated', () => loadConversations());
    socket.on('conversation:removed', ({ conversationId }) => {
      if (activeIdRef.current === conversationId) showNotice('You are no longer a member of that group.');
      closeConversation(conversationId);
    });

    return () => disconnectSocket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // mark the open conversation as read when the user comes back to the tab
  useEffect(() => {
    const onFocus = () => {
      if (activeIdRef.current && isViewing()) markRead(activeIdRef.current);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [markRead]);

  // ---- actions ----
  const selectConversation = (id) => {
    if (id === activeIdRef.current) return;
    setActiveId(id);
    activeIdRef.current = id;
    setMessages([]);
    setHasMore(false);
    loadMessages(id);
  };

  const startConversation = async (other) => {
    try {
      const { data } = await api.post('/conversations', { participantId: other._id });
      const conv = data.conversation;
      setConversations((cs) => (cs.some((c) => c._id === conv._id) ? cs : [conv, ...cs]));
      selectConversation(conv._id);
    } catch (err) {
      showNotice(getErrorMessage(err));
    }
  };

  const groupCreated = (conv) => {
    setShowNewGroup(false);
    setConversations((cs) => (cs.some((c) => c._id === conv._id) ? cs : [conv, ...cs]));
    selectConversation(conv._id);
  };

  const loadMore = async () => {
    if (loadingMore || !messages.length) return;
    const convId = activeIdRef.current;
    setLoadingMore(true);
    try {
      const { data } = await api.get(`/messages/${convId}`, { params: { limit: PAGE_SIZE, before: messages[0]._id } });
      if (activeIdRef.current !== convId) return;
      setMessages((ms) => [...data.messages, ...ms]);
      setHasMore(data.hasMore);
    } catch (err) {
      showNotice(getErrorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  const bumpConversation = (convId, message) =>
    setConversations((cs) => {
      const c = cs.find((x) => x._id === convId);
      if (!c) return cs;
      return [{ ...c, lastMessage: message, updatedAt: message.createdAt }, ...cs.filter((x) => x._id !== convId)];
    });

  const sendMessage = (text, retryTempId) => {
    const convId = activeIdRef.current;
    if (!convId) return;
    const tempId = retryTempId || tempIdFor();
    const optimistic = {
      _id: tempId, tempId, conversationId: convId, sender: userId, type: 'text', content: text,
      status: 'sending', reactions: [], createdAt: new Date().toISOString(),
    };
    setMessages((ms) => (retryTempId ? ms.map((m) => (m.tempId === tempId ? optimistic : m)) : [...ms, optimistic]));

    const fail = () => setMessages((ms) => ms.map((m) => (m.tempId === tempId ? { ...m, status: 'failed' } : m)));

    const socket = getSocket();
    if (!socket?.connected) {
      fail();
      return showNotice('You are offline. Message not sent.');
    }
    socket.timeout(10000).emit('message:send', { conversationId: convId, content: text, tempId }, (err, res) => {
      if (err || !res?.success) {
        fail();
        return showNotice(res?.message || 'Message could not be sent.');
      }
      const real = { ...res.message, tempId }; // keep tempId so the React key stays stable
      setMessages((ms) => ms.map((m) => (m.tempId === tempId ? real : m)));
      bumpConversation(convId, real);
    });
  };

  const sendFile = async (file, caption = '', retryTempId) => {
    const convId = activeIdRef.current;
    if (!convId) return;
    if (file.size > MAX_FILE) return showNotice('File too large (max 5 MB)');
    const tempId = retryTempId || tempIdFor();
    const isImage = file.type.startsWith('image/');
    const pending = {
      _id: tempId, tempId, conversationId: convId, sender: userId, type: isImage ? 'image' : 'file',
      content: caption, attachment: { originalName: file.name, size: file.size, mimeType: file.type },
      localUrl: isImage ? URL.createObjectURL(file) : null,
      status: 'sending', progress: 0, reactions: [], createdAt: new Date().toISOString(),
    };
    pendingFiles.current[tempId] = { file, caption };
    setMessages((ms) => (retryTempId ? ms.map((m) => (m.tempId === tempId ? pending : m)) : [...ms, pending]));

    const form = new FormData();
    form.append('conversationId', convId);
    if (caption) form.append('caption', caption);
    form.append('file', file);
    const stillOpen = () => activeIdRef.current === convId;
    try {
      const { data } = await api.post('/messages/upload', form, {
        onUploadProgress: (e) => {
          if (!e.total || !stillOpen()) return;
          const progress = Math.round((e.loaded * 100) / e.total);
          setMessages((ms) => ms.map((m) => (m.tempId === tempId ? { ...m, progress } : m)));
        },
      });
      delete pendingFiles.current[tempId];
      if (pending.localUrl) URL.revokeObjectURL(pending.localUrl);
      if (stillOpen()) {
        // the real message may already have arrived over the socket: never show it twice
        setMessages((ms) => {
          const rest = ms.filter((m) => m.tempId !== tempId);
          return rest.some((m) => m._id === data.message._id) ? rest : [...rest, data.message];
        });
      }
      bumpConversation(convId, data.message);
    } catch (err) {
      if (stillOpen()) setMessages((ms) => ms.map((m) => (m.tempId === tempId ? { ...m, status: 'failed' } : m)));
      showNotice(getErrorMessage(err));
    }
  };

  const retry = (m) => {
    const saved = pendingFiles.current[m.tempId];
    if (m.attachment && saved) return sendFile(saved.file, saved.caption, m.tempId);
    return sendMessage(m.content, m.tempId);
  };

  // resolves true when saved so the input can leave edit mode
  const saveEdit = async (messageId, text, original) => {
    if (original && text === original.content) return true;
    try {
      await api.patch(`/messages/${messageId}`, { content: text });
      return true; // the updated message arrives through the message:edited event
    } catch (err) {
      showNotice(getErrorMessage(err));
      return false;
    }
  };

  const deleteMessage = async (m) => {
    try {
      await api.delete(`/messages/${m._id}`);
    } catch (err) {
      showNotice(getErrorMessage(err));
    }
  };

  const react = async (m, emoji) => {
    try {
      await api.put(`/messages/${m._id}/reactions`, { emoji });
    } catch (err) {
      showNotice(getErrorMessage(err));
    }
  };

  const emitTyping = (event, convId) => getSocket()?.emit(event, { conversationId: convId });

  const active = conversations.find((c) => c._id === activeId);
  const members = active ? active.participants.map(withPresence) : [];
  const typingNames = active ? Object.values(typing[active._id] || {}).filter(Boolean) : [];

  return (
    <div className="flex h-dvh flex-col bg-surface">
      {!connected && (
        <div role="status" className="bg-amber-100 px-4 py-1.5 text-center text-sm text-amber-800">
          Connection lost. Reconnecting...
        </div>
      )}
      {notice && (
        <div role="alert" className="bg-red-100 px-4 py-1.5 text-center text-sm text-red-700">
          {notice}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <Sidebar
          className={activeId ? 'hidden md:flex' : 'flex'}
          me={user}
          conversations={conversations}
          loading={convLoading}
          error={convError}
          onRetry={loadConversations}
          activeId={activeId}
          onSelectConversation={selectConversation}
          onStartConversation={startConversation}
          onNewGroup={() => setShowNewGroup(true)}
          typing={typing}
          withPresence={withPresence}
          onLogout={logout}
        />

        <main className={`min-w-0 flex-1 ${active ? 'flex' : 'hidden md:flex'}`}>
          {active ? (
            <ChatWindow
              key={active._id}
              conversation={active}
              participant={active.isGroup ? null : withPresence(active.participant)}
              members={members}
              messages={messages}
              meId={userId}
              loading={msgLoading}
              error={msgError}
              hasMore={hasMore}
              loadingMore={loadingMore}
              typingNames={typingNames}
              onLoadMore={loadMore}
              onReload={() => loadMessages(active._id)}
              onSend={(text) => sendMessage(text)}
              onSendFile={(file, caption) => sendFile(file, caption)}
              onRetry={retry}
              onTyping={emitTyping}
              onBack={() => setActiveId(null)}
              onEditSave={saveEdit}
              onDelete={deleteMessage}
              onReact={react}
              onError={showNotice}
              onGroupChanged={loadConversations}
              onGroupLeft={closeConversation}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-accent">
                <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor" aria-hidden="true">
                  <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-slate-700">Select a conversation to start chatting</p>
              <p className="mt-1 text-sm text-slate-500">Or search for a user in the sidebar to begin a new one.</p>
            </div>
          )}
        </main>
      </div>

      {showNewGroup && <NewGroupModal onClose={() => setShowNewGroup(false)} onCreated={groupCreated} />}
    </div>
  );
}