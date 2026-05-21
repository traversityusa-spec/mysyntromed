import { onValue, ref, set, onDisconnect, serverTimestamp, type DatabaseReference } from 'firebase/database';
import { rtdb } from './firebase';

export type PresenceState = {
  state: 'online' | 'offline';
  last_changed: number | object;
  role?: 'client' | 'admin' | 'specialist';
  displayName?: string;
};

export const presenceService = {
  setupPresence(uid: string, role?: PresenceState['role'], displayName?: string) {
    const userStatusRef = ref(rtdb, `/status/${uid}`);
    const connectedRef = ref(rtdb, '.info/connected');

    const offlineState: PresenceState = {
      state: 'offline',
      last_changed: serverTimestamp(),
      role,
      displayName,
    };

    const onlineState: PresenceState = {
      state: 'online',
      last_changed: serverTimestamp(),
      role,
      displayName,
    };

    const unsubscribe = onValue(connectedRef, (snap) => {
      if (snap.val() === false) return;
      onDisconnect(userStatusRef).set(offlineState).catch((err) => console.warn('[PRESENCE] onDisconnect error:', err));
      set(userStatusRef, onlineState).catch((err) => console.warn('[PRESENCE] set online error:', err));
    });

    return () => {
      unsubscribe();
      set(userStatusRef, offlineState).catch((err) => console.warn('[PRESENCE] cleanup error:', err));
    };
  },

  subscribeToPresence(uid: string, callback: (state: PresenceState | null) => void) {
    const userStatusRef: DatabaseReference = ref(rtdb, `/status/${uid}`);
    return onValue(userStatusRef, (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback(snap.val() as PresenceState);
    });
  },
};
