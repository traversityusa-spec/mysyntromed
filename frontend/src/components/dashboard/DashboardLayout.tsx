import React, { type ReactNode, useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Calendar,
  ChartBar,
  Check,
  ChevronLeft,
  ClipboardList,
  Home,
  List,
  LogOut,
  MessageSquare,
  Phone,
  Settings,
  Stethoscope,
  User,
  Users,
  Video,
  Workflow,
  X,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { messageService, notificationService, type AppNotification } from '@/lib/firestore';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { showToast } from '@/components/ui/Toast';
import JitsiCall from '@/components/ui/JitsiCall';
import { initSocket } from '@/lib/socket';

type NavItem = {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  to: string;
  adminOnly?: boolean;
  badge?: number;
};

const getNavItems = (role: 'client' | 'admin' | 'specialist', pendingAssignments: number): NavItem[] => {
  const portal = role === 'admin' ? '/admin' : role === 'specialist' ? '/specialist' : '/portal';
  
  if (role === 'specialist') {
    return [
      { label: 'Dashboard', icon: Home, to: `${portal}/dashboard` },
      { label: 'Messages', icon: MessageSquare, to: `${portal}/messages` },
      { label: 'Requests', icon: Workflow, to: `${portal}/requests` },
      { label: 'Calls', icon: Phone, to: `${portal}/calls` },
      { label: 'Settings', icon: Settings, to: `${portal}/settings` },
    ];
  }

  if (role === 'admin') {
    return [
      { label: 'Dashboard', icon: Home, to: `${portal}/dashboard` },
      { label: 'Clients', icon: Users, to: `${portal}/clients` },
      { label: 'Specialists', icon: Stethoscope, to: `${portal}/specialists` },
      { label: 'Admins', icon: Shield, to: `${portal}/admins` },
      { label: 'Messages', icon: MessageSquare, to: `${portal}/messages` },
      { label: 'Conversations', icon: MessageSquare, to: `${portal}/conversations`, badge: pendingAssignments },
      { label: 'Analytics', icon: ChartBar, to: `${portal}/analytics` },
      { label: 'Settings', icon: Settings, to: `${portal}/settings` },
    ];
  }

  return [
    { label: 'Dashboard', icon: Home, to: '/portal/dashboard' },
    { label: 'Messages', icon: MessageSquare, to: '/portal/messages' },
    { label: 'Requests', icon: Workflow, to: '/portal/requests' },
    { label: 'Specialist', icon: User, to: '/portal/specialist' },
    { label: 'Activity', icon: ChartBar, to: '/portal/activity' },
    { label: 'Settings', icon: Settings, to: '/portal/settings' },
  ];
};

type DashboardLayoutProps = {
  children: ReactNode;
};

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [pendingAssignments, setPendingAssignments] = useState(0);
  const lastMessageIdRef = useRef<string | null>(null);
  const initialSoundLoadRef = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, sessionUser, logout } = useAuth();

const role = sessionUser?.role || 'client';
  const basePath = role === 'admin' ? '/admin' : role === 'specialist' ? '/specialist' : '/portal';
  const displayedNavItems = getNavItems(role, pendingAssignments);

  const playNotificationSound = () => {
    try {
      const AudioContextRef = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextRef) return;
      const ctx = new AudioContextRef();
      if (ctx.state === 'closed') return;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.value = 0.04;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.1);
      oscillator.onended = () => { try { ctx.close(); } catch {} };
    } catch {
      // ignore audio failures
    }
  };

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [incomingCall, setIncomingCall] = useState<{ callerName: string; meetingLink: string; callerId: string; callType: string } | null>(null);
  const [activeCall, setActiveCall] = useState<{ roomName: string; meetingLink: string; callType: string } | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    initSocket(user.uid);

    const handleCallStart = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.meetingLink) return;
      setActiveCall({ roomName: detail.roomName || '', meetingLink: detail.meetingLink, callType: detail.callType || 'video' });
    };
    window.addEventListener('call:start', handleCallStart);

    const messageUnsub = messageService.subscribeToUserMessages(user.uid, (messages) => {
      try {
        const unread = messages.filter((m) => !m.read && m.senderId !== user.uid).length;
        setUnreadMessages(unread);
        if (!messages.length) return;
        const latest = messages[messages.length - 1];
        if (!initialSoundLoadRef.current) {
          lastMessageIdRef.current = latest.id;
          initialSoundLoadRef.current = true;
          return;
        }
        if (latest.id !== lastMessageIdRef.current && latest.senderId !== user.uid) {
          if (soundEnabled) playNotificationSound();
          const preview = latest.text || 'New message';
          showToast('message', latest.senderName || 'New message', preview.length > 60 ? preview.substring(0, 60) + '...' : preview);
        }
        lastMessageIdRef.current = latest.id;
      } catch (e) {
        console.error('[DashboardLayout] Message subscription error:', e);
      }
    });
    const notificationUnsub = notificationService.subscribeToNotifications(user.uid, (items) => {
      setNotifications(items);
      const newNotifs = items.filter(n => !n.read);
      if (newNotifs.length > 0) {
        const latest = newNotifs[0];
        showToast(latest.type, latest.title, latest.message);
      }
    });

    const handleCallInvite = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.meetingLink) return;
      setIncomingCall({ callerName: detail.callerName || 'Someone', meetingLink: detail.meetingLink, callerId: detail.callerId, callType: detail.callType || 'video' });
      if (soundEnabled) {
        playNotificationSound();
        setTimeout(() => playNotificationSound(), 600);
        setTimeout(() => playNotificationSound(), 1200);
      }
    };
    window.addEventListener('socket:callInvite', handleCallInvite);

    return () => {
      window.removeEventListener('call:start', handleCallStart);
      window.removeEventListener('socket:callInvite', handleCallInvite);
      messageUnsub();
      notificationUnsub();
    };
  }, [user?.uid, soundEnabled]);

  useEffect(() => {
    if (role !== 'admin') return;
    const q = query(
      collection(db, 'requests'),
      where('status', '==', 'pending')
    );
    const unsub = onSnapshot(q, (snap) => {
      const pending = snap.docs.filter((d) => !d.data().specialistId).length;
      setPendingAssignments(pending);
    });
    return () => unsub();
  }, [role]);

  const unreadCount = notifications.filter(n => !n.read).length;

const markAllRead = () => {
    if (user?.uid) {
      notificationService.markAllRead(user.uid).catch(() => {});
    }
  };

  const handleNotificationClick = (notificationId: string, read: boolean, type?: string) => {
    if (!read) {
      notificationService.markNotificationRead(notificationId).catch(() => {});
    }
    setShowNotifications(false);
    if (type === 'message') {
      navigate(`${basePath}/messages`);
    } else if (type === 'request' || type === 'assignment') {
      if (role === 'admin') {
        navigate(`${basePath}/dashboard`);
      } else {
        navigate(`${basePath}/requests`);
      }
    } else {
      navigate(`${basePath}/dashboard`);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/portal');
  };

  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname === item.to;
    const Icon = item.icon;

    const handleClick = () => {
      if (item.to.includes('conversations') && pendingAssignments > 0) {
        setPendingAssignments(0);
      }
    };

    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={handleClick}
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
          isActive
            ? 'bg-teal-50 text-teal-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <Icon size={18} className={isActive ? 'text-teal-600' : 'text-slate-400'} />
        {sidebarOpen && <span>{item.label}</span>}
        {sidebarOpen && item.badge && item.badge > 0 && (
          <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">
            {item.badge}
          </span>
)}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-100 md:h-screen md:overflow-hidden">
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white transition-all duration-300 lg:sticky lg:top-0 lg:h-screen ${
          sidebarOpen ? 'w-64' : 'w-20'
        } ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <Link to={`${basePath}/dashboard`} className="flex items-center gap-3">
            <img src="/MySyntroMed-LM-AQUA.png" alt="MySyntroMed Logo" className="h-8 w-auto object-contain" />
            {sidebarOpen && (
              <div>
                <p className="text-xs font-semibold tracking-wider text-slate-500">MYSYNTROMED</p>
                <p className="text-sm font-bold text-navy-900">Portal</p>
              </div>
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:block"
          >
            <ChevronLeft
              size={18}
              className={`transition-transform ${sidebarOpen ? '' : 'rotate-180'}`}
            />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {displayedNavItems.map(renderNavItem)}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={18} className="text-slate-400" />
            {sidebarOpen && <span>Log out</span>}
          </button>
        </div>
      </aside>

      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <List size={20} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotifications(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
                    <div className="flex items-center justify-between border-b border-slate-200 p-4">
                      <h3 className="font-semibold text-navy-900">Notifications</h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-xs text-teal-600 hover:underline"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification.id, notification.read, notification.type)}
                            className={`cursor-pointer border-b border-slate-100 p-4 hover:bg-slate-50 ${
                              !notification.read ? 'bg-teal-50' : ''
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full ${notification.type === 'request' ? 'bg-amber-100' : notification.type === 'system' ? 'bg-blue-100' : 'bg-teal-100'}`}>
                                {notification.type === 'request' ? <ClipboardList size={14} className="text-amber-600" /> : notification.type === 'system' ? <Bell size={14} className="text-blue-600" /> : <Bell size={14} className="text-teal-600" />}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-slate-900">{notification.title}</p>
                                <p className="mt-1 text-xs text-slate-500">{notification.message}</p>
                              </div>
                              {!notification.read && (
                                <span className="h-2 w-2 rounded-full bg-teal-500" />
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-slate-500">
                          No notifications
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <Link
              to={`${basePath}/messages`}
              className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            >
              <MessageSquare size={20} />
              {unreadMessages > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-teal-500 text-xs font-medium text-white">
                  {unreadMessages}
                </span>
              )}
            </Link>
            <Link
              to={`${basePath}/settings`}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-teal-100 text-teal-700">
                {sessionUser?.photoURL ? (
                  <img src={sessionUser.photoURL} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <User size={16} />
                )}
              </div>
              <span className="hidden md:inline">{sessionUser?.displayName || sessionUser?.email?.split('@')[0] || 'User'}</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {incomingCall && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 p-4 shadow-sm animate-pulse">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-200">
                {incomingCall.callType === 'voice' ? <Phone size={18} className="text-purple-700" /> : <Video size={18} className="text-purple-700" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-purple-900">Incoming {incomingCall.callType === 'voice' ? 'Voice' : 'Video'} Call</p>
                <p className="text-xs text-purple-700 truncate">{incomingCall.callerName} is calling you</p>
              </div>
              <button
                onClick={() => {
                  setActiveCall({ roomName: incomingCall.meetingLink.split('/').pop() || '', meetingLink: incomingCall.meetingLink, callType: incomingCall.callType });
                  setIncomingCall(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition shrink-0"
              >
                {incomingCall.callType === 'voice' ? <Phone size={16} /> : <Video size={16} />}
                Join Call
              </button>
              <button
                onClick={() => setIncomingCall(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-purple-400 hover:bg-purple-100 shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {children}
        </main>
      </div>
      {activeCall && (
        <JitsiCall
          roomName={activeCall.roomName}
          callType={activeCall.callType as 'voice' | 'video'}
          displayName={sessionUser?.displayName || sessionUser?.email?.split('@')[0] || 'User'}
          onLeave={() => setActiveCall(null)}
        />
      )}
    </div>
  );
};

export default DashboardLayout;
