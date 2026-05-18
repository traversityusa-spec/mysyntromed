import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
  arrayUnion,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { rtdb } from './firebase';
import { ref, set, onValue, onDisconnect } from 'firebase/database';
import { encryption } from './encryption';
export { db };

const ENCRYPT_MESSAGES = false;
const CONVERSATION_KEYS_COLLECTION = 'conversation_keys';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const toDate = (value: unknown): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    try {
      const parsed = (value as { toDate: () => unknown }).toDate();
      if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed;
      if (typeof parsed === 'string' || typeof parsed === 'number') {
        const d = new Date(parsed);
        if (!Number.isNaN(d.getTime())) return d;
      }
    } catch {
      return new Date();
    }
  }
  return new Date();
};

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: 'client' | 'admin' | 'specialist';
  createdAt: Date;
  updatedAt: Date;
  isNewUser?: boolean;
  disabled?: boolean;
  clinicName?: string;
  phone?: string;
  photoURL?: string;
  assignedSpecialistId?: string;
  assignedSpecialistName?: string;
  specialties?: string[];
  yearsExperience?: number;
  bio?: string;
  specialistInviteVerified?: boolean;
  subscriptionStartDate?: Date;
  subscriptionActive?: boolean;
  subscriptionEndDate?: Date;
  subscriptionReminderSent?: boolean;
  notificationPreferences?: {
    emailRequests: boolean;
    emailMessages: boolean;
  };
};

export type Message = {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderPhotoURL?: string;
  receiverId: string;
  text: string;
  read: boolean;
  status?: 'sent' | 'delivered' | 'read';
  createdAt: Date;
  encrypted?: boolean;
  iv?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: 'image' | 'file';
  fileSize?: number;
};

const mapMessageDoc = (id: string, data: DocumentData): Message => ({
  id,
  senderId: data.senderId || '',
  senderName: data.senderName || 'User',
  senderRole: data.senderRole || 'client',
  senderPhotoURL: data.senderPhotoURL || '',
  receiverId: data.receiverId || '',
  text: typeof data.text === 'string' ? data.text : '',
  read: !!data.read,
  status: data.status || (data.read ? 'read' : 'sent'),
  createdAt: toDate(data.createdAt),
  encrypted: data.encrypted,
  iv: data.iv,
  fileUrl: data.fileUrl,
  fileName: data.fileName,
  fileType: data.fileType,
  fileSize: data.fileSize,
});

export type ConversationKey = {
  key: string;
  createdAt: Date;
  createdBy: string;
};

export type StatusEntry = {
  status: 'pending' | 'in_progress' | 'completed';
  timestamp: Date;
  changedBy?: string;
  changedByName?: string;
};

export type Request = {
  id: string;
  userId: string;
  type: string;
  description: string;
  priority: 'normal' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  submittedAt: Date;
  completedAt?: Date;
  assignedAt?: Date;
  specialistId?: string;
  specialistName?: string;
  specialistEmail?: string;
  clientName?: string;
  clientEmail?: string;
  seen?: boolean;
  assignmentRequestId?: string;
  statusHistory?: StatusEntry[];
};

export type ActivityItem = {
  id: string;
  userId: string;
  title: string;
  type: string;
  specialistId: string;
  specialistName: string;
  status: 'completed' | 'in_progress' | 'pending';
  createdAt: Date;
};

export type AppNotification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'request' | 'message' | 'system' | 'assignment';
  read: boolean;
  createdAt: Date;
};

export type WorkflowStatus = {
  morningPrepStatus: 'not_started' | 'in_progress' | 'completed';
  postClinicStatus: 'not_started' | 'in_progress' | 'completed';
  clinicDayFinished: boolean;
  updatedAt: Date;
};

export type SpecialistRating = {
  id: string;
  specialistId: string;
  clientId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
};

const getConversationKeyId = (userId1: string, userId2: string): string => {
  const sorted = [userId1, userId2].sort();
  return `${sorted[0]}_${sorted[1]}`;
};

export const conversationKeyService = {
  async getOrCreateKey(userId1: string, userId2: string): Promise<string> {
    const keyId = getConversationKeyId(userId1, userId2);
    const keyRef = doc(db, CONVERSATION_KEYS_COLLECTION, keyId);
    const keySnap = await getDoc(keyRef);

    if (keySnap.exists() && keySnap.data().key) {
      return keySnap.data().key;
    }

    const newKey = await encryption.exportKey(await encryption.generateKey());
    await setDoc(keyRef, {
      key: newKey,
      createdAt: serverTimestamp(),
      createdBy: userId1,
    });
    return newKey;
  },

  async getKey(userId1: string, userId2: string): Promise<string | null> {
    const keyId = getConversationKeyId(userId1, userId2);
    const keyRef = doc(db, CONVERSATION_KEYS_COLLECTION, keyId);
    const keySnap = await getDoc(keyRef);

    if (keySnap.exists() && keySnap.data().key) {
      return keySnap.data().key;
    }
    return null;
  },
};

export const typingService = {
  setTyping(userId: string, otherUserId: string, isTyping: boolean): void {
    const typingRef = ref(rtdb, `/typing/${otherUserId}/${userId}`);
    if (isTyping) {
      set(typingRef, {
        typing: true,
        timestamp: Date.now(),
      });
      onDisconnect(typingRef).remove();
    } else {
      set(typingRef, null);
    }
  },

  subscribeToTyping(userId: string, otherUserId: string, callback: (isTyping: boolean) => void): () => void {
    const typingRef = ref(rtdb, `/typing/${userId}/${otherUserId}`);
    const unsub = onValue(typingRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const isStale = Date.now() - data.timestamp > 5000;
        callback(!isStale && data.typing);
      } else {
        callback(false);
      }
    });
    return unsub;
  },
};

export const notificationSoundService = {
  playIncomingSound(): void {
    try {
      const ctx = new (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
      const playTone = (freq: number, delay: number) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        g.gain.value = 0.04;
        g.gain.setValueAtTime(0.04, ctx.currentTime + delay);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.15);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.15);
      };
      playTone(880, 0);
      playTone(1100, 0.1);
      setTimeout(() => ctx.close(), 300);
    } catch {}
  },

  playOutgoingSound(): void {
    try {
      const ctx = new (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 600;
      gain.gain.value = 0.03;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
      osc.onended = () => ctx.close();
    } catch {}
  },

  subscribeToSounds(userId: string, callback: (type: 'incoming' | 'outgoing') => void): () => void {
    const soundRef = ref(rtdb, `/sounds/${userId}`);
    const unsub = onValue(soundRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        if (Date.now() - data.timestamp < 2000) {
          callback(data.type);
          set(ref(rtdb, `/sounds/${userId}`), null);
        }
      }
    });
    return unsub;
  },

  broadcastSound(targetUserId: string, type: 'incoming' | 'outgoing'): void {
    set(ref(rtdb, `/sounds/${targetUserId}`), {
      type,
      timestamp: Date.now(),
    });
  },
};

export const userService = {
  async getProfile(uid: string): Promise<UserProfile | null> {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        uid: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as UserProfile;
    }
    return null;
  },

  async createProfile(uid: string, email: string | null, role: string = 'client'): Promise<void> {
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, {
      uid,
      email,
      role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isNewUser: true,
    }).catch(async () => {
      await import('firebase/firestore').then(async ({ setDoc }) => {
        await setDoc(docRef, {
          uid,
          email,
          role,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isNewUser: true,
        });
      });
    });
  },

  async updateProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
      isNewUser: false,
    });
  },

  async markUserAsOld(uid: string): Promise<void> {
    const docRef = doc(db, 'users', uid);
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    await updateDoc(docRef, {
      isNewUser: false,
      updatedAt: serverTimestamp(),
      subscriptionStartDate: startDate,
      subscriptionActive: true,
      subscriptionEndDate: endDate,
      subscriptionReminderSent: false,
    });
  },

  async activateSubscription(uid: string): Promise<void> {
    const docRef = doc(db, 'users', uid);
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    await updateDoc(docRef, {
      subscriptionActive: true,
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate,
      subscriptionReminderSent: false,
      updatedAt: serverTimestamp(),
    });
  },

  async deactivateSubscription(uid: string): Promise<void> {
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, {
      subscriptionActive: false,
      updatedAt: serverTimestamp(),
    });
  },

  subscribeToProfile(uid: string, callback: (profile: UserProfile | null) => void): Unsubscribe {
    const docRef = doc(db, 'users', uid);
    return onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        callback({
          uid: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          subscriptionStartDate: data.subscriptionStartDate?.toDate(),
          subscriptionEndDate: data.subscriptionEndDate?.toDate(),
        } as UserProfile);
      } else {
        callback(null);
      }
    });
  },
  async assignSpecialist(userId: string, specialistId: string, specialistName: string): Promise<void> {
    const docRef = doc(db, 'users', userId);
    await updateDoc(docRef, {
      assignedSpecialistId: specialistId,
      assignedSpecialistName: specialistName,
      updatedAt: serverTimestamp(),
    });
  },

  async getAssignedClients(specialistId: string): Promise<UserProfile[]> {
    const q = query(
      collection(db, 'users'),
      where('assignedSpecialistId', '==', specialistId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
      } as UserProfile;
    });
  },

  subscribeToAssignedClients(specialistId: string, callback: (clients: UserProfile[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'users'),
      where('assignedSpecialistId', '==', specialistId)
    );
    return onSnapshot(q, (snap) => {
      const clients = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        } as UserProfile;
      });
      callback(clients);
    });
  },
  async saveNotificationPreferences(uid: string, prefs: { emailRequests: boolean; emailMessages: boolean }): Promise<void> {
    const docRef = doc(db, 'users', uid);
    await updateDoc(docRef, {
      notificationPreferences: prefs,
      updatedAt: serverTimestamp(),
    });
  },
};

export const messageService = {
  async getConversations(userId: string): Promise<Message[]> {
    const q = query(
      collection(db, 'messages'),
      where('participants', 'array-contains', userId),
      orderBy('createdAt', 'desc'),
      limit(200)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => mapMessageDoc(doc.id, doc.data()));
  },

  async decryptMessage(message: Message, userId: string): Promise<Message> {
    if (!message.encrypted || !message.iv) {
      return message;
    }
    try {
      const key = await conversationKeyService.getKey(userId, message.senderId);
      if (!key) {
        return message;
      }
      const cryptoKey = await encryption.importKey(key);
      const decryptedText = await encryption.decryptMessage(message.text, message.iv, cryptoKey);
      return { ...message, text: decryptedText };
    } catch {
      return message;
    }
  },

  async decryptMessages(messages: Message[], userId: string): Promise<Message[]> {
    return Promise.all(messages.map((msg) => this.decryptMessage(msg, userId)));
  },

  subscribeToUserMessages(
    userId: string,
    callback: (messages: Message[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, 'messages'),
      where('participants', 'array-contains', userId)
    );

    return onSnapshot(q, async (snapshot) => {
      const messages = snapshot.docs.map((doc) => mapMessageDoc(doc.id, doc.data()));

      const sorted = messages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      if (ENCRYPT_MESSAGES) {
        const decrypted = await this.decryptMessages(sorted, userId);
        callback(decrypted);
      } else {
        callback(sorted);
      }
    });
  },

  async getConversation(userId: string, otherUserId: string): Promise<Message[]> {
    const q = query(
      collection(db, 'messages'),
      where('participants', 'array-contains', userId),
      orderBy('createdAt', 'asc'),
      limit(200)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((doc) => mapMessageDoc(doc.id, doc.data()))
      .filter((msg) => 
        (msg.senderId === userId && msg.receiverId === otherUserId) ||
        (msg.senderId === otherUserId && msg.receiverId === userId)
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  sanitizeText(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/[<>]/g, '').substring(0, 5000);
  },

  async sendMessage(message: Omit<Message, 'id' | 'createdAt'>): Promise<string> {
    const sanitizedText = this.sanitizeText(message.text);
    let finalMessage = { ...message, text: sanitizedText };
    let encrypted = false;

    if (ENCRYPT_MESSAGES) {
      try {
        const key = await conversationKeyService.getOrCreateKey(message.senderId, message.receiverId);
        const cryptoKey = await encryption.importKey(key);
        const { encrypted: encryptedText, iv } = await encryption.encryptMessage(message.text, cryptoKey);
        finalMessage = { ...message, text: encryptedText, iv, encrypted: true };
        encrypted = true;
      } catch (err) {
        console.error('Encryption failed, sending plain text:', err);
      }
    }

    const docRef = await addDoc(collection(db, 'messages'), {
      ...finalMessage,
      participants: [finalMessage.senderId, finalMessage.receiverId],
      status: finalMessage.status || 'sent',
      createdAt: serverTimestamp(),
    });

    notificationSoundService.broadcastSound(finalMessage.receiverId, 'incoming');

    try {
      await notificationService.addNotification({
        userId: finalMessage.receiverId,
        title: `New Message from ${finalMessage.senderName}`,
        message: finalMessage.text.length > 50 ? finalMessage.text.substring(0, 50) + '...' : finalMessage.text,
        type: 'message'
      });

      const token = await auth.currentUser?.getIdToken();
      if (token) {
        const loginUrl = window.location.origin;
        fetch(`${API_BASE_URL}/api/messages/notify-offline`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            receiverId: finalMessage.receiverId,
            senderName: finalMessage.senderName,
            messagePreview: finalMessage.text,
            loginUrl: loginUrl
          })
        }).catch(e => console.error('Error notifying offline user:', e));
      }
    } catch (e) {
      console.error('Failed to send message notifications:', e);
    }

    return docRef.id;
  },

  async markDelivered(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;
    const { writeBatch } = await import('firebase/firestore');
    const batch = writeBatch(db);
    messageIds.forEach((id) => {
      const refDoc = doc(db, 'messages', id);
      batch.update(refDoc, { status: 'delivered' });
    });
    await batch.commit();
  },

  async markRead(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;
    const { writeBatch } = await import('firebase/firestore');
    const batch = writeBatch(db);
    messageIds.forEach((id) => {
      const refDoc = doc(db, 'messages', id);
      batch.update(refDoc, { status: 'read', read: true });
    });
    await batch.commit();
  },

  subscribeToConversation(
    userId: string,
    otherUserId: string,
    callback: (messages: Message[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, 'messages'),
      where('participants', 'array-contains', userId),
      orderBy('createdAt', 'asc')
    );

    return onSnapshot(q, async (snapshot) => {
      const messages = snapshot.docs
        .map((doc) => mapMessageDoc(doc.id, doc.data()))
        .filter((msg) =>
          (msg.senderId === userId && msg.receiverId === otherUserId) ||
          (msg.senderId === otherUserId && msg.receiverId === userId)
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      if (ENCRYPT_MESSAGES) {
        const decrypted = await this.decryptMessages(messages, userId);
        callback(decrypted);
      } else {
        callback(messages);
      }
    });
  },
};

export const requestService = {
  async getRequests(userId: string): Promise<Request[]> {
    try {
      const q = query(
        collection(db, 'requests'),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map((doc) => {
          const data = doc.data();
          const history = (data.statusHistory || []).map((e: any) => ({
            ...e,
            timestamp: e.timestamp?.toDate ? e.timestamp.toDate() : new Date(e.timestamp || Date.now()),
          }));
          return {
            id: doc.id,
            ...data,
            statusHistory: history,
            submittedAt: data.submittedAt?.toDate() || new Date(),
            completedAt: data.completedAt?.toDate(),
            seen: data.seen || false,
          };
        })
        .sort((a: any, b: any) => b.submittedAt.getTime() - a.submittedAt.getTime()) as Request[];
    } catch (error) {
      console.error('Error fetching requests:', error);
      return [];
    }
  },


  async createRequest(request: Omit<Request, 'id' | 'submittedAt' | 'status'>): Promise<string> {
    const currentUid = auth.currentUser?.uid;
    const resolvedUserId = currentUid || request.userId;
    if (!resolvedUserId) {
      throw new Error('Not authenticated');
    }

    const docRef = await addDoc(collection(db, 'requests'), {
      ...request,
      userId: resolvedUserId,
      status: 'pending',
      seen: false,
      submittedAt: serverTimestamp(),
      statusHistory: [{
        status: 'pending',
        timestamp: new Date().toISOString(),
        changedByName: request.clientName || 'Client',
      }],
    });

    try {
      await addDoc(collection(db, 'activity'), {
        title: `New request: ${request.type}`,
        type: request.type,
        userId: request.userId,
        specialistId: request.specialistId,
        specialistName: request.specialistName,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('Failed to log activity for request', e);
    }

    notificationService.notifyAdminsOfNewRequest(
      request.clientName || request.clientEmail || 'A client',
      request.clientEmail || '',
      request.type
    ).catch(e => console.error('Admin notification failed:', e));
    if (request.specialistId) {
      notificationService.notifySpecialistOfNewRequest(
        request.specialistId,
        request.clientName || 'A client',
        request.type,
      ).catch(e => console.error('Specialist notification failed:', e));
    }
    notificationService.notifyClientRequestReceived(resolvedUserId).catch(e => console.error('Client notification failed:', e));

    try {
      const token = await auth.currentUser?.getIdToken();
      if (token) {
        fetch(`${API_BASE_URL}/api/requests/notify-admin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            clientName: request.clientName,
            clientEmail: request.clientEmail,
            requestType: request.type,
            description: request.description,
            priority: request.priority,
            loginUrl: window.location.origin,
            specialistName: request.specialistName,
            specialistId: request.specialistId,
          })
        }).catch(e => console.error('Failed to send admin email:', e));
      }
    } catch (e) {
      console.error('Failed to send admin email notification:', e);
    }

    return docRef.id;
  },

  async getRequestsForSpecialist(specialistId: string): Promise<Request[]> {
    try {
      const q = query(
        collection(db, 'requests'),
        where('specialistId', '==', specialistId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map((doc) => {
          const data = doc.data();
          const history = (data.statusHistory || []).map((e: any) => ({
            ...e,
            timestamp: e.timestamp?.toDate ? e.timestamp.toDate() : new Date(e.timestamp || Date.now()),
          }));
          return {
            id: doc.id,
            ...data,
            statusHistory: history,
            submittedAt: data.submittedAt?.toDate() || new Date(),
            completedAt: data.completedAt?.toDate(),
            assignedAt: data.assignedAt?.toDate?.(),
            seen: data.seen || false,
          };
        })
        .sort((a: any, b: any) => b.submittedAt.getTime() - a.submittedAt.getTime()) as Request[];
    } catch (error) {
      console.error('Error fetching requests for specialist:', error);
      return [];
    }
  },

  async getAllRequests(): Promise<Request[]> {
    const q = query(collection(db, 'requests'), orderBy('submittedAt', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      const history = (data.statusHistory || []).map((e: any) => ({
        ...e,
        timestamp: e.timestamp?.toDate ? e.timestamp.toDate() : new Date(e.timestamp || Date.now()),
      }));
      return {
        id: doc.id,
        ...data,
        statusHistory: history,
        submittedAt: data.submittedAt?.toDate() || new Date(),
        completedAt: data.completedAt?.toDate(),
        assignedAt: data.assignedAt?.toDate?.(),
        seen: data.seen || false,
      };
    }) as Request[];
  },

  async updateRequestStatus(requestId: string, status: 'pending' | 'in_progress' | 'completed', changedBy?: string, changedByName?: string): Promise<void> {
    const data: any = {
      status,
      statusHistory: arrayUnion({
        status,
        timestamp: new Date().toISOString(),
        changedBy,
        changedByName,
      }),
    };
    if (status === 'completed') {
      data.completedAt = serverTimestamp();
    }
    await updateDoc(doc(db, 'requests', requestId), data);

    try {
      const requestSnap = await getDoc(doc(db, 'requests', requestId));
      const request = requestSnap.data();
      if (request) {
        const token = await auth.currentUser?.getIdToken();
        if (token) {
          fetch(`${API_BASE_URL}/api/requests/notify-status-change`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              requestId,
              requestType: request.type,
              status,
              changedByName: changedByName || 'System',
              clientName: request.clientName,
              clientEmail: request.clientEmail,
              specialistName: request.specialistName,
              specialistId: request.specialistId,
              userId: request.userId,
              loginUrl: window.location.origin,
            }),
          }).catch((e) => console.error('Failed to send status email:', e));
        }
      }
    } catch (e) {
      console.error('Failed to notify status change:', e);
    }
  },

  async assignSpecialistToRequest(requestId: string, specialistId: string, specialistName: string, clientName?: string): Promise<void> {
    const docRef = doc(db, 'requests', requestId);
    await updateDoc(docRef, {
      specialistId,
      specialistName,
      status: 'in_progress',
      assignedAt: serverTimestamp(),
    });
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: specialistId,
        title: `New Request Assigned`,
        message: `A new request has been assigned to you.`,
        type: 'request',
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('Failed to notify specialist of assignment:', e);
    }
  },

  async completeAssignmentRequest(userId: string, specialistId: string, specialistName: string): Promise<void> {
    const q = query(
      collection(db, 'requests'),
      where('userId', '==', userId),
      where('type', '==', 'Specialist Assignment'),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);
    const batchUpdates: Promise<void>[] = [];
    
    for (const requestDoc of snap.docs) {
      batchUpdates.push(
        updateDoc(doc(db, 'requests', requestDoc.id), {
          specialistId,
          specialistName,
          status: 'completed',
          assignedAt: serverTimestamp(),
          completedAt: serverTimestamp(),
        })
      );
    }
    
    await Promise.all(batchUpdates);
  },

  subscribeToAllPendingRequests(callback: (requests: Request[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'requests'),
      orderBy('submittedAt', 'desc'),
      limit(100)
    );

    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          const history = (data.statusHistory || []).map((e: any) => ({
            ...e,
            timestamp: e.timestamp?.toDate ? e.timestamp.toDate() : new Date(e.timestamp || Date.now()),
          }));
          return {
            id: doc.id,
            ...data,
            statusHistory: history,
            submittedAt: data.submittedAt?.toDate() || new Date(),
            completedAt: data.completedAt?.toDate(),
            assignedAt: data.assignedAt?.toDate?.(),
            seen: data.seen || false,
          };
        }) as Request[];
      callback(requests);
    });
  },

  subscribeToRequests(userId: string, callback: (requests: Request[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'requests'),
      where('userId', '==', userId)
    );

    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          const history = (data.statusHistory || []).map((e: any) => ({
            ...e,
            timestamp: e.timestamp?.toDate ? e.timestamp.toDate() : new Date(e.timestamp || Date.now()),
          }));
          return {
            id: doc.id,
            ...data,
            statusHistory: history,
            submittedAt: data.submittedAt?.toDate() || new Date(),
            completedAt: data.completedAt?.toDate(),
            assignedAt: data.assignedAt?.toDate?.(),
            seen: data.seen || false,
          };
        })
        .sort((a: any, b: any) => b.submittedAt.getTime() - a.submittedAt.getTime()) as Request[];
      callback(requests);
    });
  },

  subscribeToRequestsForSpecialist(specialistId: string, callback: (requests: Request[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'requests'),
      where('specialistId', '==', specialistId)
    );

    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          const history = (data.statusHistory || []).map((e: any) => ({
            ...e,
            timestamp: e.timestamp?.toDate ? e.timestamp.toDate() : new Date(e.timestamp || Date.now()),
          }));
          return {
            id: doc.id,
            ...data,
            statusHistory: history,
            submittedAt: data.submittedAt?.toDate() || new Date(),
            completedAt: data.completedAt?.toDate(),
            assignedAt: data.assignedAt?.toDate?.(),
            seen: data.seen || false,
          };
        })
        .sort((a: any, b: any) => b.submittedAt.getTime() - a.submittedAt.getTime()) as Request[];
      callback(requests);
    });
  },
};

export const activityService = {
  async addActivity(data: Omit<ActivityItem, 'id' | 'createdAt'>): Promise<string> {
    const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
    const { db } = await import('./firebase');
    const docRef = await addDoc(collection(db, 'activity'), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async getActivity(userId: string, filter: 'today' | 'week' | 'month' = 'week'): Promise<ActivityItem[]> {
    let startDate = new Date();
    
    if (filter === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else {
      startDate.setMonth(startDate.getMonth() - 1);
    }

    const q = query(
      collection(db, 'activity'),
      where('userId', '==', userId)
    );
    
    const snapshot = await getDocs(q);
    const activities = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }))
      .filter((act: any) => act.createdAt >= startDate)
      .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime()) as ActivityItem[];
      
    return activities.slice(0, 50);
  },

  subscribeToActivity(userId: string, callback: (activity: ActivityItem[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'activity'),
      where('userId', '==', userId)
    );

    return onSnapshot(q, (snapshot) => {
      const activity = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        }))
        .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime()) as ActivityItem[];
      callback(activity.slice(0, 50));
    });
  },

  subscribeToSpecialistActivity(specialistId: string, callback: (activity: ActivityItem[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'activity'),
      where('specialistId', '==', specialistId)
    );

    return onSnapshot(q, (snapshot) => {
      const activity = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        }))
        .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime()) as ActivityItem[];
      callback(activity.slice(0, 50));
    });
  },
};

export const notificationService = {
  async addNotification(input: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'notifications'), {
      ...input,
      read: false,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  async notifySpecialistAssignment(specialistId: string, clientName: string, clientEmail: string): Promise<void> {
    await addDoc(collection(db, 'notifications'), {
      userId: specialistId,
      title: 'New Client Assignment',
      message: `You have been assigned to ${clientName || clientEmail}. Check your messages to introduce yourself.`,
      type: 'assignment',
      read: false,
      createdAt: serverTimestamp(),
    });
  },

  async notifyClientAssignment(clientId: string, specialistName: string, specialistEmail: string): Promise<void> {
    await addDoc(collection(db, 'notifications'), {
      userId: clientId,
      title: 'Specialist Assigned to You',
      message: `${specialistName} has been assigned as your specialist. You can now message them for assistance.`,
      type: 'assignment',
      read: false,
      createdAt: serverTimestamp(),
    });
  },

  async notifySpecialistOfNewRequest(specialistId: string, clientName: string, requestType: string): Promise<void> {
    await addDoc(collection(db, 'notifications'), {
      userId: specialistId,
      title: `New ${requestType} Request`,
      message: `${clientName} has submitted a ${requestType} request assigned to you.`,
      type: 'request',
      read: false,
      createdAt: serverTimestamp(),
    });
  },

  async notifyAdminsOfNewRequest(clientName: string, clientEmail: string, requestType: string): Promise<void> {
    const adminSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
    await Promise.all(
      adminSnap.docs.map((adminDoc) =>
        addDoc(collection(db, 'notifications'), {
          userId: adminDoc.id,
          title: `New ${requestType} Request`,
          message: `${clientName || clientEmail} has submitted a ${requestType} request. Please review and assign a specialist.`,
          type: 'request',
          read: false,
          createdAt: serverTimestamp(),
        })
      )
    );
  },

  async notifyClientRequestReceived(clientId: string): Promise<void> {
    await addDoc(collection(db, 'notifications'), {
      userId: clientId,
      title: 'Request Received',
      message: 'Your specialist request has been received. An admin will assign a specialist shortly.',
      type: 'request',
      read: false,
      createdAt: serverTimestamp(),
    });
  },

  async notifyAdminsOfDelayedReply(clientName: string, clientEmail: string, specialistName: string, lastMessageTime: Date): Promise<void> {
    const adminSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'admin')));
    const timeSinceMessage = Math.round((Date.now() - lastMessageTime.getTime()) / 60000);
    await Promise.all(
      adminSnap.docs.map((adminDoc) =>
        addDoc(collection(db, 'notifications'), {
          userId: adminDoc.id,
          title: 'Delayed Specialist Response',
          message: `${clientName || clientEmail} sent a message to ${specialistName} ${timeSinceMessage} minutes ago and has not received a response yet. Consider following up.`,
          type: 'message',
          read: false,
          createdAt: serverTimestamp(),
        })
      )
    );
  },

  subscribeToNotifications(userId: string, callback: (items: AppNotification[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
        } as AppNotification;
      });
      callback(items);
    });
  },

  async markAllRead(userId: string): Promise<void> {
    const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false));
    const snap = await getDocs(q);
    const { writeBatch } = await import('firebase/firestore');
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
  },

  async markNotificationRead(notificationId: string): Promise<void> {
    const { updateDoc } = await import('firebase/firestore');
    const docRef = doc(db, 'notifications', notificationId);
    await updateDoc(docRef, { read: true });
  },

  async getUnreadCount(userId: string): Promise<number> {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );
    const snap = await getDocs(q);
    return snap.size;
  },

  subscribeToUnreadCount(userId: string, callback: (count: number) => void): Unsubscribe {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );
    return onSnapshot(q, (snap) => {
      callback(snap.size);
    });
  },
};

export const workflowService = {
  subscribe(specialistId: string, callback: (wf: WorkflowStatus | null) => void): Unsubscribe {
    const ref = doc(db, 'workflows', specialistId);
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) { callback(null); return; }
      const d = snap.data();
      callback({
        morningPrepStatus: d.morningPrepStatus || 'not_started',
        postClinicStatus: d.postClinicStatus || 'not_started',
        clinicDayFinished: d.clinicDayFinished || false,
        updatedAt: d.updatedAt?.toDate() || new Date(),
      });
    });
  },

  async updateMorningPrep(specialistId: string, status: 'not_started' | 'in_progress' | 'completed'): Promise<void> {
    try {
      await setDoc(doc(db, 'workflows', specialistId), {
        morningPrepStatus: status,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('[WORKFLOW] Failed to update morning prep:', e);
    }
  },

  async updatePostClinic(specialistId: string, status: 'not_started' | 'in_progress' | 'completed'): Promise<void> {
    try {
      await setDoc(doc(db, 'workflows', specialistId), {
        postClinicStatus: status,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('[WORKFLOW] Failed to update post clinic:', e);
    }
  },

  async clinicDayFinished(specialistId: string): Promise<void> {
    try {
      await setDoc(doc(db, 'workflows', specialistId), {
        clinicDayFinished: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.error('[WORKFLOW] Failed to set clinic day finished:', e);
    }
  },
};

export const ratingService = {
  async submitRating(input: Omit<SpecialistRating, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'ratings'), {
      ...input,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  },

  subscribeToRatings(specialistId: string, callback: (ratings: SpecialistRating[]) => void): Unsubscribe {
    const q = query(
      collection(db, 'ratings'),
      where('specialistId', '==', specialistId),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
        } as SpecialistRating;
      });
      callback(items);
    });
  },
};
