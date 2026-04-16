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

  const loadDashboardData = useCallback(async () => {
    if (!user?.uid) return;

    setLoading(true);
    setError(null);

    try {
      const [requestsData, upcomingCallsData, pastCallsData, activityData, unreadCount] = await Promise.all([
        requestService.getRequests(user.uid),
        callService.getUpcomingCalls(user.uid),
        callService.getPastCalls(user.uid),
        activityService.getActivity(user.uid, activityFilter),
        notificationService.getUnreadCount(user.uid),
      ]);

      setRequests(requestsData);
      setUpcomingCalls(upcomingCallsData);
      setPastCalls(pastCallsData);
      setActivity(activityData);
      setUnreadMessages(unreadCount);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const openRequests = requestsData.filter((r) => r.status !== 'completed').length;
      const inProgressRequests = requestsData.filter((r) => r.status === 'in_progress').length;
      const completedToday = activityData.filter(
        (a) => a.status === 'completed' && a.createdAt >= today
      ).length;

      setStats({
        openRequests,
        inProgressRequests,
        unreadMessages: unreadCount,
        nextCall: upcomingCallsData[0] || null,
        completedToday,
      });
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, activityFilter]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const refreshData = useCallback(() => {
    loadDashboardData();
  }, [loadDashboardData]);

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

  const loadRequests = useCallback(async () => {
    if (!user?.uid) return;

    setLoading(true);
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
      console.error('Error loading requests:', err);
      setError('Failed to load requests');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, sessionUser?.role]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const createRequest = async (requestData: {
    type: string;
    description: string;
    priority: 'normal' | 'high' | 'urgent';
    preferredTime?: string;
  }) => {
    if (!user?.uid) throw new Error('Not authenticated');

    await requestService.createRequest({
      ...requestData,
      userId: user.uid,
      clientName: sessionUser?.displayName || user.email || 'Client',
      clientEmail: user.email || '',
      specialistId: (sessionUser as any)?.assignedSpecialistId || '',
      specialistName: (sessionUser as any)?.assignedSpecialistName || '',
    });

    await loadRequests();
  };

  return { requests, loading, error, createRequest, refreshRequests: loadRequests };
};

export const useCalls = () => {
  const { user, sessionUser } = useAuth();
  const [upcomingCalls, setUpcomingCalls] = useState<ScheduledCall[]>([]);
  const [pastCalls, setPastCalls] = useState<ScheduledCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCalls = useCallback(async () => {
    if (!user?.uid) return;

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

    await callService.scheduleCall({
      ...callData,
      userId: callData.userId || user.uid,
      specialistId: callData.specialistId || assignedId,
      specialistName: callData.specialistName || assignedName,
    });

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
