import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  userService,
  requestService,
  callService,
  activityService,
  notificationService,
  type Request,
  type ScheduledCall,
  type ActivityItem,
} from './firestore';

export type DashboardStats = {
  openRequests: number;
  inProgressRequests: number;
  unreadMessages: number;
  nextCall: ScheduledCall | null;
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
    nextCall: null,
    completedToday: 0,
  });
  const [requests, setRequests] = useState<Request[]>([]);
  const [upcomingCalls, setUpcomingCalls] = useState<ScheduledCall[]>([]);
  const [pastCalls, setPastCalls] = useState<ScheduledCall[]>([]);
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
        const [upcoming, past, act] = await Promise.all([
          callService.getUpcomingCalls(user.uid),
          callService.getPastCalls(user.uid),
          activityService.getActivity(user.uid, activityFilter),
        ]);
        setUpcomingCalls(upcoming);
        setPastCalls(past);
        setActivity(act);
        setStats(prev => ({
          ...prev,
          nextCall: upcoming[0] || null,
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
    upcomingCalls,
    pastCalls,
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

    return () => unsubscribe();
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

export const useCalls = () => {
  const { user, sessionUser } = useAuth();
  const [upcomingCalls, setUpcomingCalls] = useState<ScheduledCall[]>([]);
  const [pastCalls, setPastCalls] = useState<ScheduledCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCalls = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const role = sessionUser?.role || 'client';
      const [upcoming, past] = await Promise.all([
        callService.getUpcomingCalls(user.uid, role),
        callService.getPastCalls(user.uid, role),
      ]);
      setUpcomingCalls(upcoming);
      setPastCalls(past);
    } catch (err) {
      console.error('Error loading calls:', err);
      setError('Failed to load calls');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  const scheduleCall = async (callData: {
    title: string;
    date: Date;
    specialistId?: string;
    specialistName?: string;
    userId?: string;
  }) => {
    if (!user?.uid) throw new Error('Not authenticated');

    const assignedId = (sessionUser as any)?.assignedSpecialistId;
    const assignedName = (sessionUser as any)?.assignedSpecialistName;
    if (!callData.specialistId && !assignedId && sessionUser?.role === 'client') {
      throw new Error('A specialist must be assigned to your account before you can schedule a call. Please contact support or wait for an admin to assign one.');
    }

    const isSpecialist = sessionUser?.role === 'specialist';
    
    // If client, they are the user and their assigned specialist is the specialist
    // If specialist, they are the specialist and the selected client is the user
    const finalUserId = isSpecialist ? (callData.userId || '') : user.uid;
    const finalSpecialistId = isSpecialist ? user.uid : (callData.specialistId || assignedId || '');
    const finalSpecialistName = isSpecialist ? (sessionUser as any)?.displayName || 'Specialist' : (callData.specialistName || assignedName || 'Specialist');

    const payload: any = {
      title: callData.title,
      date: callData.date,
      userId: finalUserId,
      specialistId: finalSpecialistId,
      specialistName: finalSpecialistName,
    };

    // Remove undefined values to prevent Firestore crashes
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    await callService.scheduleCall(payload);

    const targetUserId = isSpecialist ? finalUserId : finalSpecialistId;
    if (targetUserId) {
      const formattedDate = callData.date.toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      });
      await notificationService.addNotification({
        userId: targetUserId,
        title: 'New Call Scheduled',
        message: `${(sessionUser as any)?.displayName || 'The other party'} scheduled a call with you for ${formattedDate}.`,
        type: 'call'
      });
    }

    await loadCalls();
  };

  return { upcomingCalls, pastCalls, loading, error, scheduleCall, refreshCalls: loadCalls };
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

  return {
    profile: sessionUser,
    loading,
    updateProfile,
    markAsOldUser,
  };
};
