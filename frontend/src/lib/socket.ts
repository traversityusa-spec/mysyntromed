import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './firestore';

let socket: Socket | null = null;
let currentUserId: string | null = null;
let reconnectAttempts = 0;

export const initSocket = (userId: string): Socket => {
  if (socket?.connected && currentUserId === userId) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  currentUserId = userId;
  reconnectAttempts = 0;
  
  socket = io(API_BASE_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  socket.on('connect', () => {
    console.log('[SOCKET] Connected to server');
    reconnectAttempts = 0;
    socket?.emit('authenticate', userId);
  });

  socket.on('connect_error', (error) => {
    reconnectAttempts++;
    console.error('[SOCKET] Connection error:', error.message, 'Attempt:', reconnectAttempts);
  });

  socket.on('disconnect', () => {
    console.log('[SOCKET] Disconnected from server');
  });

  socket.on('newMessage', (message: unknown) => {
    console.log('[SOCKET] New message received via socket:', message);
    window.dispatchEvent(new CustomEvent('socket:newMessage', { detail: message }));
  });

  socket.on('userTyping', (data: { isTyping: boolean; senderName?: string; senderId?: string }) => {
    // Don't show typing indicator if it's from ourselves
    if (data.senderId && data.senderId === currentUserId) {
      console.log('[SOCKET] Ignoring own typing event');
      return;
    }
    window.dispatchEvent(new CustomEvent('socket:typing', { detail: data }));
  });

  if (!socket.connected) {
    console.log('[SOCKET] Attempting to connect...');
  }

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const isConnected = (): boolean => socket?.connected ?? false;

export const emitMessage = (to: string, message: unknown): void => {
  if (socket?.connected) {
    socket.emit('sendMessage', { to, message });
    console.log('[SOCKET] Message emitted to:', to);
  } else {
    console.log('[SOCKET] Not connected, message will rely on Firestore only');
  }
};

export const emitTyping = (to: string, isTyping: boolean, senderName?: string): void => {
  if (socket?.connected) {
    socket.emit('typing', { to, isTyping, senderName: senderName || 'User', senderId: currentUserId || '' });
    console.log('[SOCKET] Emitting typing:', isTyping, 'senderName:', senderName, 'to:', to);
  }
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentUserId = null;
  }
};