// End-to-end test: boots the real server against MONGODB_URI and exercises REST + Socket.IO.
// Run: set MONGODB_URI / JWT_SECRET (or use .env) then `npm test`
require('dotenv').config();
const mongoose = require('mongoose');
const { io: connect } = require('socket.io-client');
const connectDB = require('../config/db');
const { createApp } = require('../server');

let passed = 0;
let failed = 0;
const check = (name, cond, extra = '') => {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; console.log(`  FAIL ${name} ${extra}`); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const once = (sock, ev, ms = 2000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${ev}`)), ms);
    sock.once(ev, (d) => { clearTimeout(t); resolve(d); });
  });
const noEvent = async (sock, ev, ms = 400) => {
  let got = false;
  const h = () => { got = true; };
  sock.on(ev, h);
  await wait(ms);
  sock.off(ev, h);
  return !got;
};

(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';
  await connectDB();
  // this suite DROPS the database when it finishes, so only run it against a throwaway DB
  if (!/test/i.test(mongoose.connection.name)) {
    console.error(`Refusing to run: database "${mongoose.connection.name}" is not named like a test DB (must contain "test").`);
    await mongoose.disconnect();
    process.exit(1);
  }
  const { server } = createApp();
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const base = `http://localhost:${port}`;
  const api = async (method, path, { token, body } = {}) => {
    const res = await fetch(`${base}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, data: await res.json() };
  };
  const sock = (token) =>
    new Promise((resolve, reject) => {
      const s = connect(base, { auth: { token }, transports: ['websocket'], reconnection: false });
      s.on('connect', () => resolve(s));
      s.on('connect_error', reject);
    });

  const tag = Date.now();
  const A = { name: 'Alice', email: `alice${tag}@test.com`, password: 'secret1', confirmPassword: 'secret1' };
  const B = { name: 'Bob', email: `bob${tag}@test.com`, password: 'secret2', confirmPassword: 'secret2' };
  const C = { name: 'Carol', email: `carol${tag}@test.com`, password: 'secret3', confirmPassword: 'secret3' };

  console.log('Auth');
  let r = await api('POST', '/auth/register', { body: A });
  check('register 201', r.status === 201 && r.data.token);
  check('no password in response', !('password' in r.data.user));
  const tokA = r.data.token; const idA = r.data.user._id;
  r = await api('POST', '/auth/register', { body: B }); const tokB = r.data.token; const idB = r.data.user._id;
  r = await api('POST', '/auth/register', { body: C }); const tokC = r.data.token; const idC = r.data.user._id;
  r = await api('POST', '/auth/register', { body: A });
  check('duplicate email 409', r.status === 409);
  r = await api('POST', '/auth/register', { body: { ...A, email: 'x@y.com', confirmPassword: 'nope' } });
  check('password mismatch 400', r.status === 400);
  r = await api('POST', '/auth/register', { body: { ...A, email: 'bad', } });
  check('invalid email 400', r.status === 400);
  r = await api('POST', '/auth/register', { body: { ...A, email: 'z@y.com', password: '123', confirmPassword: '123' } });
  check('short password 400', r.status === 400);
  r = await api('POST', '/auth/register', { body: {} });
  check('missing fields 400', r.status === 400);
  r = await api('POST', '/auth/login', { body: { email: A.email, password: A.password } });
  check('login 200', r.status === 200 && r.data.token);
  r = await api('POST', '/auth/login', { body: { email: A.email, password: 'wrongpass' } });
  check('wrong password 401', r.status === 401);
  r = await api('POST', '/auth/login', { body: { email: 'nobody@test.com', password: 'x12345' } });
  check('unknown user 401', r.status === 401);
  r = await api('GET', '/auth/me');
  check('me without token 401', r.status === 401);
  r = await api('GET', '/auth/me', { token: 'garbage' });
  check('me bad token 401', r.status === 401 && /invalid/i.test(r.data.message));
  r = await api('GET', '/auth/me', { token: tokA });
  check('me with token', r.status === 200 && r.data.user.email === A.email.toLowerCase());

  console.log('Users');
  r = await api('GET', `/users/search?q=bob`, { token: tokA });
  check('search finds Bob', r.data.users.some((u) => u._id === idB));
  r = await api('GET', `/users/search?q=alice${tag}`, { token: tokA });
  check('search excludes self', !r.data.users.some((u) => u._id === idA));
  r = await api('GET', `/users/search?q=${encodeURIComponent('.*')}`, { token: tokA });
  check('regex input is escaped', r.status === 200 && r.data.users.length === 0);
  r = await api('GET', '/users', { token: tokA });
  check('list excludes self', r.status === 200 && !r.data.users.some((u) => u._id === idA));
  r = await api('GET', `/users/${idB}`, { token: tokA });
  check('get user', r.status === 200 && r.data.user.name === 'Bob');
  r = await api('GET', '/users/notanid', { token: tokA });
  check('invalid id 400', r.status === 400);
  r = await api('GET', '/users', {});
  check('users requires auth', r.status === 401);

  console.log('Conversations');
  r = await api('POST', '/conversations', { token: tokA, body: { participantId: idA } });
  check('self conversation rejected', r.status === 400);
  r = await api('POST', '/conversations', { token: tokA, body: { participantId: idB } });
  check('create 201', r.status === 201);
  const convId = r.data.conversation._id;
  r = await api('POST', '/conversations', { token: tokB, body: { participantId: idA } });
  check('duplicate (reverse direction) returns same conv 200', r.status === 200 && r.data.conversation._id === convId);
  r = await api('GET', '/conversations', { token: tokA });
  check('list has conversation w/ participant', r.data.conversations.length === 1 && r.data.conversations[0].participant._id === idB);
  r = await api('GET', `/conversations/${convId}`, { token: tokC });
  check('outsider GET conversation 403', r.status === 403);
  r = await api('GET', `/conversations/${convId}`, { token: tokA });
  check('participant GET conversation', r.status === 200);

  console.log('Messages (REST)');
  r = await api('POST', '/messages', { token: tokA, body: { conversationId: convId, content: '   ' } });
  check('empty message 400', r.status === 400);
  r = await api('POST', '/messages', { token: tokC, body: { conversationId: convId, content: 'hack' } });
  check('outsider send 403', r.status === 403);
  r = await api('GET', `/messages/${convId}`, { token: tokC });
  check('outsider history 403', r.status === 403);
  r = await api('GET', '/messages/badid', { token: tokA });
  check('invalid conversation id 400', r.status === 400);
  r = await api('POST', '/messages', { token: tokA, body: { conversationId: convId, content: 'offline hello' } });
  check('send 201, recipient offline => sent', r.status === 201 && r.data.message.status === 'sent');
  const offlineMsgId = r.data.message._id;
  r = await api('GET', `/messages/${convId}`, { token: tokB });
  check('history persisted', r.data.messages.length === 1 && r.data.messages[0].content === 'offline hello');
  r = await api('GET', '/conversations', { token: tokB });
  check('unread count 1 for Bob', r.data.conversations[0].unreadCount === 1);
  check('last message preview', r.data.conversations[0].lastMessage.content === 'offline hello');
  r = await api('PATCH', `/messages/${offlineMsgId}/read`, { token: tokA });
  check('sender cannot mark own message read 403', r.status === 403);
  r = await api('PATCH', `/messages/${offlineMsgId}/read`, { token: tokC });
  check('outsider cannot mark read 403', r.status === 403);

  console.log('Sockets');
  try { await sock('bad.token.here'); check('bad socket token rejected', false); }
  catch (e) { check('bad socket token rejected', /invalid/i.test(e.message)); }
  try { await sock(undefined); check('missing socket token rejected', false); }
  catch (e) { check('missing socket token rejected', /required/i.test(e.message)); }

  const sA = await sock(tokA);
  const deliveredP = once(sA, 'message:delivered');
  const onlineP = once(sA, 'user:online');
  const sB = await sock(tokB);
  check('user:online broadcast', (await onlineP).userId === idB);
  check('pending messages marked delivered on connect', (await deliveredP).conversationId === convId);
  r = await api('GET', `/users/${idB}`, { token: tokA });
  check('Bob isOnline in DB', r.data.user.isOnline === true);

  // realtime send A -> B
  const recvP = once(sB, 'message:receive');
  const ack = await new Promise((res) => sA.emit('message:send', { conversationId: convId, content: 'hi bob', tempId: 't1' }, res));
  const got = await recvP;
  check('ack success with tempId', ack.success && ack.tempId === 't1');
  check('recipient online => delivered', ack.message.status === 'delivered');
  check('Bob receives instantly', got.content === 'hi bob' && got.sender === idA);

  const bad = await new Promise((res) => sA.emit('message:send', { conversationId: convId, content: '' }, res));
  check('socket empty message rejected', bad.success === false);
  const forbidden = await new Promise((res) => sA.emit('message:send', { conversationId: '000000000000000000000000', content: 'x' }, res));
  check('socket unknown conversation rejected', forbidden.success === false);
  const sC = await sock(tokC);
  const outsider = await new Promise((res) => sC.emit('message:send', { conversationId: convId, content: 'sneaky' }, res));
  check('socket outsider send rejected', outsider.success === false);
  check('outsider typing not relayed', await noEvent(sB, 'typing:start', 300) && (sC.emit('typing:start', { conversationId: convId }), await noEvent(sB, 'typing:start', 400)));

  // typing
  const typP = once(sB, 'typing:start');
  sA.emit('typing:start', { conversationId: convId });
  const typ = await typP;
  check('typing:start relayed', typ.userId === idA && typ.conversationId === convId && typ.name === 'Alice');
  const stopP = once(sB, 'typing:stop');
  sA.emit('typing:stop', { conversationId: convId });
  check('typing:stop relayed', (await stopP).userId === idA);

  // read receipts
  r = await api('GET', '/conversations', { token: tokB });
  check('Bob unread = 2 before reading', r.data.conversations[0].unreadCount === 2);
  const readP = once(sA, 'message:read');
  const readAck = await new Promise((res) => sB.emit('message:read', { conversationId: convId }, res));
  const readEv = await readP;
  check('read ack', readAck.success && readAck.messageIds.length === 2);
  check('sender notified of read', readEv.readerId === idB && readEv.messageIds.length === 2);
  r = await api('GET', `/messages/${convId}`, { token: tokA });
  check('messages persisted as read', r.data.messages.every((m) => m.status === 'read' && m.readAt));
  r = await api('GET', '/conversations', { token: tokB });
  check('unread = 0 after read', r.data.conversations[0].unreadCount === 0);

  // PATCH single message read
  const m2 = await new Promise((res) => sA.emit('message:send', { conversationId: convId, content: 'second' }, res));
  const readP2 = once(sA, 'message:read');
  r = await api('PATCH', `/messages/${m2.message._id}/read`, { token: tokB });
  check('PATCH read 200 & status read', r.status === 200 && r.data.message.status === 'read');
  check('PATCH read emits socket event', (await readP2).messageIds[0] === m2.message._id);

  // pagination
  for (let i = 0; i < 5; i++) await api('POST', '/messages', { token: tokA, body: { conversationId: convId, content: `p${i}` } });
  r = await api('GET', `/messages/${convId}?limit=3`, { token: tokA });
  check('pagination limit + hasMore', r.data.messages.length === 3 && r.data.hasMore === true);
  const chrono = r.data.messages.every((m, i, a) => i === 0 || new Date(a[i - 1].createdAt) <= new Date(m.createdAt));
  check('chronological order', chrono);
  r = await api('GET', `/messages/${convId}?limit=100&before=${r.data.messages[0]._id}`, { token: tokA });
  check('before cursor returns older (5, no overlap)', r.data.messages.length === 5 && r.data.hasMore === false);
  r = await api('GET', `/messages/${convId}?before=notanid`, { token: tokA });
  check('invalid cursor 400', r.status === 400);

  // multi-tab + presence
  const sB2 = await sock(tokB);
  sB2.disconnect(); await wait(300);
  r = await api('GET', `/users/${idB}`, { token: tokA });
  check('Bob still online with one tab left', r.data.user.isOnline === true);
  const offP = once(sA, 'user:offline');
  sB.disconnect();
  const off = await offP;
  check('user:offline broadcast with lastSeen', off.userId === idB && off.lastSeen);
  r = await api('GET', `/users/${idB}`, { token: tokA });
  check('Bob offline + lastSeen in DB', r.data.user.isOnline === false && r.data.user.lastSeen);

  // offline message then reconnect => delivered
  const m3 = await api('POST', '/messages', { token: tokA, body: { conversationId: convId, content: 'while offline' } });
  check('message to offline user is "sent"', m3.data.message.status === 'sent');
  const delP = once(sA, 'message:delivered');
  const sB3 = await sock(tokB);
  check('delivered on reconnect', (await delP).recipientId === idB);

  [sA, sB3, sC].forEach((s) => s.disconnect());
  console.log(`\n${passed} passed, ${failed} failed`);
  await wait(500);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  server.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('TEST CRASH', e); process.exit(1); });
