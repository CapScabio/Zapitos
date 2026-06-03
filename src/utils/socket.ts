import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    socket = io(backendUrl, {
      autoConnect: false,
      reconnectionAttempts: 5,
      timeout: 10000,
    });
  }
  return socket;
};
