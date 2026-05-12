import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './firestore';

let socket: Socket | null = null;
let currentUserId: string | null = null;

export const initSocket = (userId: string): Socket => {
  if (socket?.connected && currentUserId === userId) {
    console.log('[SOCKET] Already connected for user:', userId, 'socket ID:', socket.id);
    return socket;
  }

  if (socket) {
    console.log('[SOCKET] Disconnecting existing socket before reconnecting');
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  currentUserId = userId;

  console.log('[SOCKET] Creating new socket connection to:', API_BASE_URL, 'for user:', userId);

  socket = io(API_BASE_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 30000,
    forceNew: true,
  });

  socket.on('connect', () => {
    console.log('[SOCKET] Connected to server, socket ID:', socket?.id);
    socket?.emit('authenticate', userId);
    window.dispatchEvent(new CustomEvent('socket:connected'));
  });

  socket.on('connect_error', (error) => {
    console.error('[SOCKET] Connection error:', error.message);
    window.dispatchEvent(new CustomEvent('socket:error', { detail: error.message }));
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('[SOCKET] Reconnected after', attemptNumber, 'attempts');
    if (currentUserId) {
      socket?.emit('authenticate', currentUserId);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('[SOCKET] Disconnected:', reason);
    window.dispatchEvent(new CustomEvent('socket:disconnected', { detail: reason }));
  });

  socket.on('newMessage', (message: unknown) => {
    console.log('[SOCKET] NEW MESSAGE RECEIVED via socket:', JSON.stringify(message, null, 2));
    window.dispatchEvent(new CustomEvent('socket:newMessage', { detail: message }));
  });

  socket.on('userTyping', (data: { isTyping: boolean; senderName?: string; senderId?: string }) => {
    console.log('[SOCKET] USER TYPING EVENT:', JSON.stringify(data));
    if (data.senderId && data.senderId === currentUserId) {
      console.log('[SOCKET] Ignoring own typing event');
      return;
    }
    window.dispatchEvent(new CustomEvent('socket:typing', { detail: data }));
  });

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const isConnected = (): boolean => socket?.connected ?? false;

export const emitMessage = (to: string, message: unknown): void => {
  console.log('[SOCKET] emitMessage called - to:', to, 'socket exists:', !!socket, 'connected:', socket?.connected);
  if (!socket) {
    console.warn('[SOCKET] emitMessage: socket is null, reconnecting...');
    return;
  }
  if (!socket.connected) {
    console.warn('[SOCKET] emitMessage: socket not connected, will rely on Firestore');
    return;
  }
  console.log('[SOCKET] EMITTING MESSAGE to user:', to);
  socket.emit('sendMessage', { to, message });
  console.log('[SOCKET] Message emit called successfully');
};

export const emitTyping = (to: string, isTyping: boolean, senderName?: string): void => {
  if (!socket?.connected) {
    console.warn('[SOCKET] Cannot emit typing - not connected');
    return;
  }
  socket.emit('typing', { to, isTyping, senderName: senderName || 'User', senderId: currentUserId || '' });
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentUserId = null;
  }
};
