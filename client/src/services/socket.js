import { io } from 'socket.io-client';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin);

let socket = null;

export const connectSocket = (token) => {
  if (socket) socket.disconnect();
  socket = io(SOCKET_URL, { auth: { token }, autoConnect: true });
  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
