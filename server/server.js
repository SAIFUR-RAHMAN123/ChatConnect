require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const User = require('./models/User');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const registerSocket = require('./socket/socketHandler');

const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];

const createApp = () => {
  const origins = (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''));
  const corsOptions = { origin: origins, credentials: true };

  const app = express();
  app.set('trust proxy', 1); // correct client IP behind Render/Railway (used by the rate limiter)
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '10kb' }));

  app.get('/health', (_req, res) => res.json({ success: true, status: 'ok' }));
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/users', require('./routes/userRoutes'));
  app.use('/api/conversations', require('./routes/conversationRoutes'));
  app.use('/api/messages', require('./routes/messageRoutes'));
  app.use(notFound);
  app.use(errorHandler);

  const server = http.createServer(app);
  const io = new Server(server, { cors: corsOptions });
  app.set('io', io);
  registerSocket(io);
  return { app, server, io };
};

const start = async () => {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
  await connectDB();
  // no sockets survive a restart, so reset stale presence flags
  await User.updateMany({ isOnline: true }, { isOnline: false });

  const { server } = createApp();
  const port = process.env.PORT || 5000;
  server.listen(port, () => console.log(`Server running on port ${port}`));
};

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
}

module.exports = { createApp };