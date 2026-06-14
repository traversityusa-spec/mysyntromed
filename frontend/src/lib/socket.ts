import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './firestore';

let socket: Socket | null = null;
let currentUserId: string | null = null;
let listenersInitialized = false;

const ensureListeners = (userId: string) => {
  if (!socket) return;
  if (listenersInitialized && currentUserId === userId) return;

  socket.removeAllListeners();
  listenersInitialized = false;
  currentUserId = userId;

  socket.on('connect', () => {
    console.log('[SOCKET] Connected, socket ID:', socket?.id);
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
    window.dispatchEvent(new CustomEvent('socket:newMessage', { detail: message }));
  });

  socket.on('userTyping', (data: { isTyping: boolean; senderName?: string; senderId?: string }) => {
    if (data.senderId && data.senderId === currentUserId) return;
    window.dispatchEvent(new CustomEvent('socket:typing', { detail: data }));
  });

  listenersInitialized = true;
};

export const initSocket = (userId: string): Socket => {
  if (!socket) {
    console.log('[SOCKET] Creating socket connection to:', API_BASE_URL);
    socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 30000,
    });
  }

  if (currentUserId !== userId) {
    listenersInitialized = false;
  }

  ensureListeners(userId);

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const isConnected = (): boolean => socket?.connected ?? false;

export const emitMessage = (to: string, message: unknown): void => {
  if (!socket) {
    console.warn('[SOCKET] emitMessage: socket is null, reconnecting...');
    return;
  }
  if (!socket.connected) {
    console.warn('[SOCKET] emitMessage: socket not connected, will rely on Firestore');
    return;
  }
  socket.emit('sendMessage', { to, message });
};

export const emitCallInvite = (to: string, data: { callType: string; callerId: string; callerName: string; meetingLink: string; sessionId: string }): void => {
  if (!socket?.connected) {
    console.warn('[SOCKET] Cannot emit call invite - not connected');
    return;
  }
  socket.emit('callInvite', { to, ...data });
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
