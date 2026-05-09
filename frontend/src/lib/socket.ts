import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './firestore';

let socket: Socket | null = null;
let currentUserId: string | null = null;
let reconnectAttempts = 0;

export type IncomingCallData = {
  callType: 'audio' | 'video';
  callerName: string;
  meetingLink: string;
  sessionId?: string;
};

type CallEventCallback = (data?: IncomingCallData) => void;
const callInviteListeners: CallEventCallback[] = [];
const callAnsweredListeners: CallEventCallback[] = [];
const callEndListeners: CallEventCallback[] = [];

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
    if (data.senderId && data.senderId === currentUserId) {
      console.log('[SOCKET] Ignoring own typing event');
      return;
    }
    window.dispatchEvent(new CustomEvent('socket:typing', { detail: data }));
  });

  socket.on('incomingCall', (data: IncomingCallData) => {
    console.log('[SOCKET] Incoming call:', data);
    callInviteListeners.forEach(cb => cb(data));
    window.dispatchEvent(new CustomEvent('socket:incomingCall', { detail: data }));
  });

  socket.on('callAnswered', () => {
    console.log('[SOCKET] Call answered');
    callAnsweredListeners.forEach(cb => cb());
    window.dispatchEvent(new CustomEvent('socket:callAnswered'));
  });

  socket.on('callRejected', () => {
    console.log('[SOCKET] Call rejected/ended');
    callEndListeners.forEach(cb => cb());
    window.dispatchEvent(new CustomEvent('socket:callRejected'));
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

export const emitCallInvite = (to: string, callType: 'audio' | 'video', callerName: string, meetingLink: string): void => {
  if (socket?.connected) {
    socket.emit('callInvite', { to, callType, callerName, meetingLink });
    console.log('[SOCKET] Emit call invite to:', to, 'type:', callType);
  }
};

export const emitCallAccepted = (to: string): void => {
  if (socket?.connected) {
    socket.emit('callAccepted', { to });
    console.log('[SOCKET] Emit call accepted to:', to);
  }
};

export const emitCallEnded = (to: string): void => {
  if (socket?.connected) {
    socket.emit('callEnded', { to });
    console.log('[SOCKET] Emit call ended to:', to);
  }
};

export const onCallInvite = (callback: CallEventCallback): (() => void) => {
  callInviteListeners.push(callback);
  return () => {
    const idx = callInviteListeners.indexOf(callback);
    if (idx > -1) callInviteListeners.splice(idx, 1);
  };
};

export const onCallAnswered = (callback: CallEventCallback): (() => void) => {
  callAnsweredListeners.push(callback);
  return () => {
    const idx = callAnsweredListeners.indexOf(callback);
    if (idx > -1) callAnsweredListeners.splice(idx, 1);
  };
};

export const onCallEnd = (callback: CallEventCallback): (() => void) => {
  callEndListeners.push(callback);
  return () => {
    const idx = callEndListeners.indexOf(callback);
    if (idx > -1) callEndListeners.splice(idx, 1);
  };
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentUserId = null;
  }
};