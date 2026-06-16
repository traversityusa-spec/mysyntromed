import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
   userService,
   requestService,
   activityService,
   notificationService,
   type Request,
   type ActivityItem,
 } from './firestore';

export type DashboardStats = {
   openRequests: number;
   inProgressRequests: number;
   unreadMessages: number;
   completedToday: number;
 };

export const useDashboardData = () => {
  const { user, sessionUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    openRequests: 0,
    inProgressRequests: 0,
    unreadMessages: 0,
    completedToday: 0,
  });
  const [requests, setRequests] = useState<Request[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityFilter, setActivityFilter] = useState<'today' | 'week' | 'month'>('today');
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubs: Array<() => void> = [];

    // Subscribe to requests
    const unsubRequests = requestService.subscribeToRequests(user.uid, (msgs) => {
      setRequests(msgs);
      setStats(prev => ({
        ...prev,
        openRequests: msgs.filter(r => r.status !== 'completed').length,
        inProgressRequests: msgs.filter(r => r.status === 'in_progress').length,
      }));
    });
    unsubs.push(unsubRequests);

    // Subscribe to notifications (unread count)
    const unsubNotifications = notificationService.subscribeToUnreadCount(user.uid, (count) => {
      setUnreadMessages(count);
      setStats(prev => ({ ...prev, unreadMessages: count }));
    });
    unsubs.push(unsubNotifications);

    // Initial load for others (can be converted later if needed)
    const loadOthers = async () => {
      try {
        const act = await activityService.getActivity(user.uid, activityFilter);
        setActivity(act);
        setStats(prev => ({
          ...prev,
          completedToday: act.filter(a => a.status === 'completed' && a.createdAt >= new Date(new Date().setHours(0,0,0,0))).length
        }));
      } catch (err) {
        console.error('Error loading dashboard extras:', err);
      } finally {
        setLoading(false);
      }
    };

    loadOthers();

    return () => unsubs.forEach(fn => fn());
  }, [user?.uid, activityFilter]);

  const refreshData = useCallback(() => {
    // The subscribers handle most things. This can trigger a reload of the non-real-time parts.
    setLoading(true);
  }, []);

  return {
    loading,
    error,
    stats,
    requests,
    activity,
    activityFilter,
    setActivityFilter,
    refreshData,
  };
};

export const useRequests = () => {
  const { user, sessionUser } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const callback = (data: Request[]) => {
      setRequests(data);
      setLoading(false);
    };

    let unsubscribe: () => void;

    if (sessionUser?.role === 'specialist') {
      unsubscribe = requestService.subscribeToRequestsForSpecialist(user.uid, callback);
    } else {
      unsubscribe = requestService.subscribeToRequests(user.uid, callback);
    }

    const handleSocketStatusUpdate = () => {
      refreshRequests();
    };

    window.addEventListener('socket:statusUpdated', handleSocketStatusUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener('socket:statusUpdated', handleSocketStatusUpdate);
    };
  }, [user?.uid, sessionUser?.role]);

  const createRequest = async (requestData: {
    type: string;
    description: string;
    priority: 'normal' | 'high' | 'urgent';
    preferredTime?: string;
  }) => {
    if (!user?.uid) throw new Error('Not authenticated');

    const isSpecialist = sessionUser?.role === 'specialist';
    const specialistId = isSpecialist ? user.uid : (sessionUser?.assignedSpecialistId || '');
    const specialistName = isSpecialist ? (sessionUser?.displayName || '') : (sessionUser?.assignedSpecialistName || '');
    
    const requestPayload: any = {
      ...requestData,
      userId: user.uid,
      clientName: sessionUser?.displayName || user.email || 'Client',
      clientEmail: user.email || '',
    };

    if (specialistId) {
      requestPayload.specialistId = specialistId;
      requestPayload.specialistName = specialistName;
    }

    await requestService.createRequest(requestPayload);
  };

  const refreshRequests = async () => {
    if (!user?.uid) return;
    try {
      let data: Request[] = [];
      if (sessionUser?.role === 'specialist') {
        const result = await requestService.getRequestsForSpecialist(user.uid);
        data = result || [];
      } else {
        const result = await requestService.getRequests(user.uid);
        data = result || [];
      }
      setRequests(data);
    } catch (err) {
      console.error('Error refreshing requests:', err);
      setError('Failed to load requests');
    }
  };

  return { requests, loading, error, createRequest, refreshRequests };
};

export const useActivity = () => {
  const { user } = useAuth();
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [filter, setFilter] = useState<'today' | 'week' | 'month'>('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivity = useCallback(async () => {
    if (!user?.uid) return;

    setLoading(true);
    try {
      const data = await activityService.getActivity(user.uid, filter);
      setActivity(data);
    } catch (err) {
      console.error('Error loading activity:', err);
      setError('Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, filter]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  return { activity, filter, setFilter, loading, error, refreshActivity: loadActivity };
};

export const useUserProfile = () => {
  const { user, sessionUser, refreshSessionUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const updateProfile = async (data: {
    displayName?: string;
    clinicName?: string;
    phone?: string;
    photoURL?: string;
    specialties?: string[];
    yearsExperience?: number;
    bio?: string;
  }) => {
    if (!user?.uid) throw new Error('Not authenticated');

    setLoading(true);
    try {
      await userService.updateProfile(user.uid, data);
      await refreshSessionUser();
    } finally {
      setLoading(false);
    }
  };

  const markAsOldUser = async () => {
    if (!user?.uid) return;
    await userService.markUserAsOld(user.uid);
    await refreshSessionUser();
  };

  const activateSubscription = async () => {
    if (!user?.uid) return;
    await userService.activateSubscription(user.uid);
    await refreshSessionUser();
  };

  const deactivateSubscription = async () => {
    if (!user?.uid) return;
    await userService.deactivateSubscription(user.uid);
    await refreshSessionUser();
  };

  return {
    profile: sessionUser,
    loading,
    updateProfile,
    markAsOldUser,
    activateSubscription,
    deactivateSubscription,
  };
};
