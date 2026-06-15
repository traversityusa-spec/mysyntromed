import { type FormEvent, useState, useEffect, useRef, type ChangeEvent, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Paperclip, Phone, Plus, Search, Send, Shield, Video, X, MessageSquare, 
  Check, CheckCheck, MoreVertical, PhoneIncoming, PhoneOutgoing, Lock, Image,
  Users, User
} from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import { messageService, userService, notificationService, typingService, notificationSoundService, groupChatService, type Message, type GroupInfo, type GroupMessage, API_BASE_URL } from '@/lib/firestore';
import { presenceService } from '@/lib/presence';
import { initSocket, emitMessage, emitTyping } from '@/lib/socket';

type ConversationPreview = {
  id: string;
  name: string;
  role: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  photoURL?: string;
  lastTimestamp?: number;
};

const getPersistentPhotoURL = (value?: string | null): string => {
  if (!value) return '';
  if (value.includes('firebasestorage.googleapis.com')) return '';
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:') ? value : '';
};

const toMessageDate = (value: unknown): Date => {
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

const normalizeRealtimeMessage = (raw: unknown): Message | null => {
  try {
    if (!raw || typeof raw !== 'object') return null;
    const data = raw as Partial<Message> & { createdAt?: unknown };

    if (!data.senderId || !data.receiverId) return null;

    const createdAt = toMessageDate(data.createdAt);
    const text = typeof data.text === 'string' ? data.text : '';

    return {
      id: data.id || `realtime-${data.senderId}-${data.receiverId}-${createdAt.getTime()}-${text.slice(0, 20)}`,
      senderId: data.senderId,
      senderName: data.senderName || 'User',
      senderRole: data.senderRole || 'client',
      senderPhotoURL: data.senderPhotoURL || '',
      receiverId: data.receiverId,
      text,
      read: !!data.read,
      status: data.status || 'sent',
      createdAt,
      encrypted: data.encrypted,
      iv: data.iv,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      fileType: data.fileType,
      fileSize: data.fileSize,
    };
  } catch (error) {
    console.error('[MESSAGES] Error normalizing realtime message:', error);
    return null;
  }
};

const Messages = () => {
  const { user, sessionUser } = useAuth();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [assignedClients, setAssignedClients] = useState<{ uid: string; displayName?: string | null; email?: string | null; photoURL?: string }[]>([]);
  const [presenceMap, setPresenceMap] = useState<Record<string, boolean>>({});
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUserName, setTypingUserName] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const initialSoundLoadRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const conversationNameRef = useRef<string>('');

  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<{ uid: string; displayName: string; email: string | null; role: string; photoURL?: string }[]>([]);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [addedConversations, setAddedConversations] = useState<ConversationPreview[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, { displayName?: string | null; email?: string | null; role?: string; photoURL?: string }>>({});

  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupParticipants, setSelectedGroupParticipants] = useState<string[]>([]);
  const [usersError, setUsersError] = useState('');
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showRenameGroup, setShowRenameGroup] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [groupMembersProfiles, setGroupMembersProfiles] = useState<Record<string, { displayName?: string | null; email?: string | null; role?: string; photoURL?: string }>>({});

  const isGroupChat = (id: string | null) => id?.startsWith('group_');
  const groupIdFromConversation = (id: string | null) => id?.replace('group_', '') || '';

  const [searchParams] = useSearchParams();
  const startUid = searchParams.get('start');

  const chatEnabled = sessionUser?.role !== 'client' || !!sessionUser?.assignedSpecialistId;
  const clientPending = sessionUser?.role === 'client' && !sessionUser?.assignedSpecialistId;
  const conversationIdsKey = useMemo(
    () => conversations.map((c) => c.id).sort().join('|'),
    [conversations]
  );

  useEffect(() => {
    if (user?.uid) {
      initSocket(user.uid);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!startUid || !user) return;
    const uid = user.uid;
    const existing = conversations.find(c => c.id === startUid);
    if (existing) {
      setSelectedConversation(startUid);
      return;
    }
    const profile = usersMap[startUid];
    if (!profile) return;
    const displayName = profile.displayName || profile.email?.split('@')[0] || 'User';
    const roleLabel = profile.role === 'specialist' ? 'Specialist' : profile.role === 'admin' ? 'Admin' : 'Client';
    setAddedConversations(prev => {
      if (prev.some(c => c.id === startUid)) return prev;
      return [...prev, { id: startUid, name: displayName, role: roleLabel, lastMessage: '', time: '', unread: 0, online: false, photoURL: profile.photoURL || '' }];
    });
    setSelectedConversation(startUid);
  }, [startUid, user?.uid, conversations, usersMap]);

  useEffect(() => {
    const handleNewMessage = (e: CustomEvent<unknown>) => {
      try {
        const msg = normalizeRealtimeMessage(e.detail);
        if (!msg) return;

        setAllMessages((prev) => {
          const exists = prev.some((m) =>
            m.id === msg.id ||
            (
              m.senderId === msg.senderId &&
              m.receiverId === msg.receiverId &&
              m.text === msg.text &&
              Math.abs(toMessageDate(m.createdAt).getTime() - msg.createdAt.getTime()) < 5000
            )
          );
          if (exists) return prev;
          return [...prev, msg];
        });

        if (selectedConversation && (msg.senderId === selectedConversation || msg.receiverId === selectedConversation)) {
          setMessages((prev) => {
            const exists = prev.some((m) =>
              m.id === msg.id ||
              (
                m.senderId === msg.senderId &&
                m.receiverId === msg.receiverId &&
                m.text === msg.text &&
                Math.abs(toMessageDate(m.createdAt).getTime() - msg.createdAt.getTime()) < 5000
              )
            );
            return exists ? prev : [...prev, msg];
          });
          notificationSoundService.playIncomingSound();
          scrollToBottom();
        }
      } catch (error) {
        console.error('[MESSAGES] Error handling new message:', error);
      }
    };
    window.addEventListener('socket:newMessage', handleNewMessage as EventListener);
    return () => {
      window.removeEventListener('socket:newMessage', handleNewMessage as EventListener);
    };
  }, [selectedConversation]);



  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    const unsubscribe = messageService.subscribeToUserMessages(user.uid, (msgs) => {
      setAllMessages(msgs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = groupChatService.subscribeToGroups(user.uid, (g) => setGroups(g));
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const gId = isGroupChat(selectedConversation) ? groupIdFromConversation(selectedConversation) : null;
    if (!gId) { setGroupMessages([]); return; }
    const unsub = groupChatService.subscribeToGroupMessages(gId, (msgs) => setGroupMessages(msgs));
    return () => unsub();
  }, [user?.uid, selectedConversation]);

  useEffect(() => {
    if (!user?.uid || sessionUser?.role !== 'specialist') {
      setAssignedClients([]);
      return;
    }
    const unsubscribe = userService.subscribeToAssignedClients(user.uid, (clients) => {
      setAssignedClients(clients);
    });
    return () => unsubscribe();
  }, [user?.uid, sessionUser?.role]);

  useEffect(() => {
    if (sessionUser?.role !== 'admin' || !user) return;
    const fetchAll = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`${API_BASE_URL}/api/auth/admin/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('API returned ' + res.status);
        const data = await res.json();
        const map: Record<string, { displayName?: string | null; email?: string | null; role?: string; photoURL?: string }> = {};
        (data.users || []).forEach((u: any) => {
          map[u.uid] = { displayName: u.displayName, email: u.email, role: u.role, photoURL: u.photoURL };
        });
        setUsersMap(map);
      } catch (err) {
        console.error('[MESSAGES] Failed to load users map:', err);
      }
    };
    fetchAll();
  }, [sessionUser?.role, user?.uid]);

  useEffect(() => {
    if (sessionUser?.role !== 'admin' || (!showNewMessageModal && !showCreateGroupModal && !showAddMembers) || !user) return;
    const fetchUsers = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`${API_BASE_URL}/api/auth/admin/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('API returned ' + res.status);
        const data = await res.json();
        const users = (data.users || [])
          .filter((u: any) => u.uid !== user?.uid)
          .map((u: any) => ({
            uid: u.uid,
            displayName: u.displayName || u.email?.split('@')[0] || 'Unknown',
            email: u.email || '',
            role: u.role === 'admin' ? 'admin' : u.role === 'specialist' ? 'specialist' : 'client',
            photoURL: u.photoURL || '',
          }));
        setAvailableUsers(users);
        setUsersError('');
      } catch (err) {
        console.error('[MESSAGES] Failed to fetch users:', err);
        setUsersError(err instanceof Error ? err.message : String(err));
      }
    };
    fetchUsers();
  }, [sessionUser?.role, showNewMessageModal, showCreateGroupModal, showAddMembers, user?.uid]);

  useEffect(() => {
    if (sessionUser?.role !== 'admin' || !user || !showGroupInfo) return;
    const gId = groupIdFromConversation(selectedConversation);
    if (!gId) return;
    const group = groups.find(g => g.id === gId);
    if (!group) return;
    const pIds = group.participantIds;
    const map: Record<string, { displayName?: string | null; email?: string | null; role?: string; photoURL?: string }> = {};
    pIds.forEach(id => {
      const p = usersMap[id];
      if (p) map[id] = p;
    });
    const missing = pIds.filter(id => !usersMap[id]);
    if (missing.length > 0) {
      (async () => {
        try {
          const token = await user.getIdToken();
          const res = await fetch(`${API_BASE_URL}/api/auth/admin/users`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!res.ok) return;
          const data = await res.json();
          (data.users || []).forEach((u: any) => {
            if (pIds.includes(u.uid)) {
              map[u.uid] = { displayName: u.displayName, email: u.email, role: u.role, photoURL: u.photoURL };
            }
          });
          setGroupMembersProfiles(map);
        } catch {}
      })();
    } else {
      setGroupMembersProfiles(map);
    }
  }, [sessionUser?.role, user?.uid, showGroupInfo, selectedConversation, groups, usersMap]);

  useEffect(() => {
    if (!user?.uid) return;
    const conversationMap = new Map<string, ConversationPreview>();
    allMessages.forEach((msg) => {
      const otherId = msg.senderId === user.uid ? msg.receiverId : msg.senderId;
      const existing = conversationMap.get(otherId);
      const isUnread = msg.receiverId === user.uid && !msg.read;
      
      const lastMsgText = msg.fileUrl ? (msg.fileType === 'image' ? '📷 Image' : '📎 File') : msg.text;
      
      if (!existing) {
        const otherId = msg.senderId === user.uid ? msg.receiverId : msg.senderId;
        const otherMsg = allMessages.find(m => m.senderId === otherId && m.senderName);
        const userProfile = usersMap[otherId];

        let otherName: string;
        let otherRole: string;
        let otherPhoto = '';

        if (msg.senderId === user.uid) {
          // I sent it — the other person is the receiver
          if (sessionUser?.role === 'client' && msg.receiverId === sessionUser?.assignedSpecialistId) {
            otherName = sessionUser.assignedSpecialistName || 'Specialist';
            otherRole = 'specialist';
          } else {
            otherName = userProfile?.displayName || userProfile?.email || otherMsg?.senderName || (otherMsg?.senderRole === 'specialist' ? 'Specialist' : 'Client');
            otherRole = userProfile?.role || otherMsg?.senderRole || 'client';
          }
        } else {
          // They sent it
          otherName = msg.senderName || userProfile?.displayName || userProfile?.email || 'User';
          otherRole = msg.senderRole;
          otherPhoto = getPersistentPhotoURL(msg.senderPhotoURL);
        }

        conversationMap.set(otherId, {
          id: otherId,
          name: otherName,
          role: otherRole,
          lastMessage: lastMsgText,
          time: formatMessageTime(msg.createdAt),
          lastTimestamp: toMessageDate(msg.createdAt).getTime(),
          unread: isUnread ? 1 : 0,
          online: presenceMap[otherId] || false,
          photoURL: otherPhoto,
        });
      } else if (existing && toMessageDate(msg.createdAt).getTime() > (existing.lastTimestamp || 0)) {
        existing.lastMessage = lastMsgText;
        existing.time = formatMessageTime(msg.createdAt);
        existing.lastTimestamp = toMessageDate(msg.createdAt).getTime();
        const latestPhoto = getPersistentPhotoURL(msg.senderPhotoURL);
        if (msg.senderId !== user.uid && latestPhoto) {
          existing.photoURL = latestPhoto;
        }
      }
      if (existing && isUnread) existing.unread += 1;
    });

    if (sessionUser?.role === 'client' && sessionUser.assignedSpecialistId) {
      const specialistId = sessionUser.assignedSpecialistId;
      if (!conversationMap.has(specialistId)) {
        conversationMap.set(specialistId, {
          id: specialistId,
          name: sessionUser.assignedSpecialistName || 'Specialist',
          role: 'Specialist',
          lastMessage: '',
          time: '',
          lastTimestamp: 0,
          unread: 0,
          online: presenceMap[specialistId] || false,
        });
      }
    }

    if (sessionUser?.role === 'specialist') {
      assignedClients.forEach((client) => {
        if (!conversationMap.has(client.uid)) {
          conversationMap.set(client.uid, {
            id: client.uid,
            name: client.displayName || client.email || 'Client',
            role: 'Client',
            lastMessage: '',
            time: '',
            lastTimestamp: 0,
            unread: 0,
            online: presenceMap[client.uid] || false,
            photoURL: getPersistentPhotoURL(client.photoURL),
          });
        }
      });
    }

    const nextConversations = Array.from(conversationMap.values())
      .map((conv) => ({
        ...conv,
        online: presenceMap[conv.id] || false,
      }))
      .sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));

    const nextIds = new Set(nextConversations.map(c => c.id));
    const groupConversations: ConversationPreview[] = groups.map(g => ({
      id: `group_${g.id}`,
      name: g.name,
      role: 'Group',
      lastMessage: g.lastMessage || 'No messages yet',
      time: formatMessageTime(g.lastTime),
      lastTimestamp: g.lastTime.getTime(),
      unread: 0,
      online: false,
      photoURL: '',
    }));
    const mergedConversations = [
      ...nextConversations,
      ...groupConversations,
      ...addedConversations.filter(ac => !nextIds.has(ac.id)),
    ].sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));

    setConversations((prev) => {
      const same =
        prev.length === mergedConversations.length &&
        prev.every((item, index) => {
          const next = mergedConversations[index];
          return next &&
            item.id === next.id &&
            item.name === next.name &&
            item.role === next.role &&
            item.lastMessage === next.lastMessage &&
            item.time === next.time &&
            item.unread === next.unread &&
            item.online === next.online &&
            item.photoURL === next.photoURL &&
            item.lastTimestamp === next.lastTimestamp;
        });
      return same ? prev : mergedConversations;
    });
    if (!selectedConversation && nextConversations.length > 0) {
      setSelectedConversation(nextConversations[0].id);
    }
  }, [
    allMessages,
    assignedClients,
    user?.uid,
    sessionUser?.role,
    sessionUser?.assignedSpecialistId,
    sessionUser?.assignedSpecialistName,
    presenceMap,
    selectedConversation,
    addedConversations,
    usersMap,
    groups,
  ]);

  useEffect(() => {
    if (!user?.uid || !selectedConversation) return;
    if (isGroupChat(selectedConversation)) {
      setMessages([]);
      return;
    }
    const filtered = allMessages
      .filter(
        (msg) =>
          (msg.senderId === user.uid && msg.receiverId === selectedConversation) ||
          (msg.senderId === selectedConversation && msg.receiverId === user.uid)
      )
      .sort((a, b) => toMessageDate(a.createdAt).getTime() - toMessageDate(b.createdAt).getTime());
    setMessages(filtered);
  }, [allMessages, user?.uid, selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (!user?.uid || !selectedConversation) return;
    const toDeliver = messages
      .filter((m) => m.receiverId === user.uid && m.status === 'sent')
      .map((m) => m.id);
    if (toDeliver.length > 0) {
      messageService.markDelivered(toDeliver).catch(() => {});
    }
    const toRead = messages
      .filter((m) => m.receiverId === user.uid && !m.read)
      .map((m) => m.id);
    if (toRead.length > 0) {
      messageService.markRead(toRead).catch(() => {});
    }
  }, [messages, user?.uid, selectedConversation]);

  useEffect(() => {
    if (!user?.uid) return;
    if (!messages.length) return;
    const latest = messages[messages.length - 1];
    if (!initialSoundLoadRef.current) {
      lastMessageIdRef.current = latest.id;
      initialSoundLoadRef.current = true;
      return;
    }
    if (latest.id !== lastMessageIdRef.current && latest.senderId !== user.uid) {
      notificationSoundService.playIncomingSound();
    }
    lastMessageIdRef.current = latest.id;
  }, [messages, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = notificationSoundService.subscribeToSounds(user.uid, (type) => {
      if (type === 'outgoing') {
        notificationSoundService.playOutgoingSound();
      }
    });
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || !selectedConversation) return;
    const conv = conversations.find(c => c.id === selectedConversation);
    conversationNameRef.current = conv?.name || 'User';
  }, [selectedConversation, conversations]);

  useEffect(() => {
    if (!user?.uid || !selectedConversation || isGroupChat(selectedConversation)) return;
    const unsub = typingService.subscribeToTyping(user.uid, selectedConversation, (isTypingVal) => {
      if (isTypingVal) {
        setIsTyping(true);
        setTypingUserName(conversationNameRef.current);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
          setTypingUserName('');
        }, 5000);
      } else {
        setIsTyping(false);
        setTypingUserName('');
      }
    });
    return () => unsub();
  }, [user?.uid, selectedConversation]);



  useEffect(() => {
    const ids = conversationIdsKey ? conversationIdsKey.split('|') : [];
    const unsubs: Array<() => void> = [];
    ids.forEach((id) => {
      const unsub = presenceService.subscribeToPresence(id, (state) => {
        const online = state?.state === 'online';
        setPresenceMap((prev) => {
          if (prev[id] === online) return prev;
          return { ...prev, [id]: online };
        });
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach((fn) => fn());
  }, [conversationIdsKey]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatMessageTime = (date: Date) => {
    const now = new Date();
    const msgDate = toMessageDate(date);
    const diff = now.getTime() - msgDate.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 1) {
      return msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else {
      return msgDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
  };

  const formatFullTime = (date: Date) => {
    return toMessageDate(date).toLocaleTimeString('en-US', {
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim()) {
      return;
    }
    if (!user?.uid) {
      alert('Please log in to send messages');
      return;
    }
    if (sending) {
      return;
    }
    if (!selectedConversation) {
      alert('Please select a conversation first');
      return;
    }
    if (!chatEnabled && !isGroupChat(selectedConversation)) {
      alert('Chat is not enabled. Please wait for specialist assignment.');
      return;
    }

    setSending(true);
    const senderName = sessionUser?.displayName || user?.email?.split('@')[0] || 'User';
    const senderRole = sessionUser?.role || 'client';
    const messageText = newMessage.trim();
    const photoURL = getPersistentPhotoURL(sessionUser?.photoURL);

    try {
      if (isGroupChat(selectedConversation)) {
        const gId = groupIdFromConversation(selectedConversation);
        await groupChatService.sendGroupMessage({
          groupId: gId,
          senderId: user.uid,
          senderName,
          senderRole,
          text: messageText,
        });
      } else {
        const receiverId = selectedConversation;
        const messageId = await messageService.sendMessage({
          senderId: user.uid,
          senderName,
          senderRole,
          senderPhotoURL: photoURL,
          receiverId,
          text: messageText,
          read: false,
          status: 'sent',
        });

        emitMessage(receiverId, {
          id: messageId,
          senderId: user.uid,
          senderName,
          senderRole,
          senderPhotoURL: photoURL,
          receiverId,
          text: messageText,
          read: false,
          status: 'sent',
          createdAt: new Date().toISOString(),
        });
        typingService.setTyping(user.uid, receiverId, false);
      }

      notificationSoundService.playOutgoingSound();
      setNewMessage('');
    } catch (error) {
      console.error('[MESSAGES] ERROR sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid || !selectedConversation) return;
    if (isGroupChat(selectedConversation)) {
      alert('File sharing in groups is coming soon');
      return;
    }

    // Check file size (Firestore document limit is 1MB, so let's cap at 800KB for safety)
    if (file.size > 800 * 1024) {
      alert('File is too large. Please select a file smaller than 800KB.');
      return;
    }

    setSending(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const isImage = file.type.startsWith('image/');
      const uploadPhotoURL = getPersistentPhotoURL(sessionUser?.photoURL);
      
      try {
        await messageService.sendMessage({
          senderId: user.uid,
          senderName: sessionUser?.displayName || user?.email?.split('@')[0] || 'User',
          senderRole: sessionUser?.role || 'client',
          senderPhotoURL: uploadPhotoURL,
          receiverId: selectedConversation,
          text: `Sent a ${file.type.startsWith('image/') ? 'photo' : 'file'}`,
          read: false,
          status: 'sent',
          fileUrl: base64,
          fileName: file.name,
          fileType: file.type.startsWith('image/') ? 'image' : 'file',
          fileSize: file.size,
        });
        notificationSoundService.playOutgoingSound();
      } catch (err) {
        console.error('File upload failed:', err);
        alert('Failed to send file. Please try again.');
      } finally {
        setSending(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTyping = (value: string) => {
    setNewMessage(value);
    
    const senderName = sessionUser?.displayName || sessionUser?.assignedSpecialistName || user?.email?.split('@')[0] || 'User';
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (selectedConversation && user?.uid && !isGroupChat(selectedConversation)) {
      typingService.setTyping(user.uid, selectedConversation, !!value);
      emitTyping(selectedConversation, !!value, senderName);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      if (selectedConversation && user?.uid && !isGroupChat(selectedConversation)) {
        typingService.setTyping(user.uid, selectedConversation, false);
        emitTyping(selectedConversation, false, senderName);
      }
    }, 3000);
  };

  const handleStartNewConversation = (user: { uid: string; displayName: string; email: string | null; role: string; photoURL?: string }) => {
    const existing = conversations.find(c => c.id === user.uid);
    if (!existing) {
      setAddedConversations(prev => {
        if (prev.some(c => c.id === user.uid)) return prev;
        return [...prev, {
          id: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'Unknown',
          role: user.role === 'specialist' ? 'Specialist' : user.role === 'admin' ? 'Admin' : 'Client',
          lastMessage: '',
          time: '',
          lastTimestamp: 0,
          unread: 0,
          online: presenceMap[user.uid] || false,
          photoURL: getPersistentPhotoURL(user.photoURL),
        }];
      });
    }
    setSelectedConversation(user.uid);
    setShowNewMessageModal(false);
    setSearchUserQuery('');
    setMobileView('chat');
  };

  const getStatusIcon = (status?: string, isOwn: boolean = false) => {
    if (!isOwn) return null;
    if (status === 'read') return <CheckCheck size={14} className="text-blue-400" />;
    if (status === 'delivered') return <CheckCheck size={14} className="text-gray-400" />;
    return <Check size={14} className="text-gray-400" />;
  };

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';
    
    messages.forEach((msg) => {
      const msgDate = toMessageDate(msg.createdAt).toLocaleDateString('en-US', {
        month: 'long', 
        day: 'numeric',
        year: 'numeric'
      });
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });
    
    return groups;
  };

  const currentConversation = conversations.find((c) => c.id === selectedConversation);
  const filteredConversations = conversations.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const displayMessages = isGroupChat(selectedConversation)
    ? groupMessages.map(msg => ({
        id: msg.id,
        senderId: msg.senderId,
        senderName: msg.senderName,
        senderRole: msg.senderRole,
        text: msg.text,
        createdAt: msg.createdAt,
        read: true,
        status: 'sent' as const,
        receiverId: '',
        senderPhotoURL: '',
      }))
    : messages;
  const messageGroups = groupMessagesByDate(displayMessages);
  const currentConversationPhotoURL = currentConversation
    ? getPersistentPhotoURL(currentConversation.photoURL)
    : '';
  const currentUserPhotoURL = getPersistentPhotoURL(sessionUser?.photoURL);

  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* Conversation List */}
      <div
        className={`flex flex-col rounded-2xl border border-slate-200 bg-white ${
          mobileView === 'list' ? 'w-full lg:w-96' : 'hidden w-full lg:flex lg:w-96'
        }`}
      >
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-xl font-bold text-navy-900">Messages</h2>
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Online
                </span>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                <Lock size={10} />
                E2E Encrypted
              </div>
            </div>
            {sessionUser?.role === 'admin' ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowCreateGroupModal(true); setSearchUserQuery(''); setUsersError(''); }}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500 text-white hover:bg-amber-600 transition"
                  title="New Group"
                >
                  <Users size={16} />
                </button>
                <button
                  onClick={() => setShowNewMessageModal(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-white hover:bg-teal-700 transition"
                  title="New Message"
                >
                  <Plus size={18} />
                </button>
              </div>
            ) : (
              <Link
                to="/portal/specialist"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-white hover:bg-teal-700 transition"
              >
                <Plus size={18} />
              </Link>
            )}
          </div>
          <div className="relative mt-4">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-teal-500 focus:bg-white transition"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {clientPending && (
            <div className="m-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-amber-800">
                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-sm font-medium">Awaiting Specialist Assignment</span>
              </div>
              <p className="mt-2 text-xs text-amber-700">
                Your specialist will appear here once an admin assigns one to you.
              </p>
            </div>
          )}
          
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
            </div>
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => { setGroupMenuOpen(false); setSelectedConversation(conv.id); setMobileView('chat'); }}
                className={`flex w-full items-start gap-3 border-b border-slate-50 p-4 text-left transition hover:bg-slate-50 ${
                  selectedConversation === conv.id ? 'bg-teal-50' : ''
                }`}
              >
                <div className="relative">
                  {conv.role === 'Group' ? (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white">
                      <Users size={18} />
                    </div>
                  ) : conv.photoURL ? (
                    <img src={conv.photoURL} alt={conv.name} className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-lg font-bold text-white">
                      {conv.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {conv.online && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{conv.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        conv.role === 'Group' ? 'bg-amber-100 text-amber-700' :
                        conv.role === 'specialist' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {conv.role === 'Group' ? 'Group' : conv.role}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">{conv.time}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="truncate text-sm text-slate-500 max-w-[180px]">
                      {conv.lastMessage || 'Start a conversation'}
                    </p>
                    {conv.unread > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-teal-600 px-1.5 text-xs font-bold text-white">
                        {conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="flex flex-col items-center py-16 text-slate-500">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <MessageSquare size={28} className="text-slate-400" />
              </div>
              <p className="font-medium">No conversations yet</p>
              {sessionUser?.role === 'admin' ? (
                <button
                  onClick={() => setShowNewMessageModal(true)}
                  className="mt-2 text-sm text-teal-600 hover:underline"
                >
                  Start a new conversation
                </button>
              ) : (
                <p className="mt-1 text-sm">Start chatting with your specialist</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div
        className={`flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white ${
          mobileView === 'chat' ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {selectedConversation && currentConversation ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileView('list')}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 lg:hidden"
                >
                  <X size={20} />
                </button>
                {isGroupChat(selectedConversation) ? (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white">
                    <Users size={18} />
                  </div>
                ) : currentConversationPhotoURL ? (
                  <img src={currentConversationPhotoURL} alt={currentConversation.name} className="h-11 w-11 rounded-full object-cover" />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-lg font-bold text-white">
                    {currentConversation.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{currentConversation.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      currentConversation.role === 'Group' ? 'bg-amber-100 text-amber-700' :
                      currentConversation.role === 'specialist' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {currentConversation.role === 'Group' ? 'Group' : currentConversation.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {isGroupChat(selectedConversation) ? (
                      <span>{groups.find(g => `group_${g.id}` === selectedConversation)?.participantIds.length || 0} participants</span>
                    ) : currentConversation.online ? (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Online
                      </span>
                    ) : (
                      'Last seen recently'
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 relative">
                {isGroupChat(selectedConversation) ? (
                  <>
                    <button
                      onClick={async () => {
                        const gId = groupIdFromConversation(selectedConversation);
                        const group = groups.find(g => g.id === gId);
                        if (!group || !user) return;
                        try {
                          const token = await user.getIdToken();
                          await fetch(`${API_BASE_URL}/api/notify/create`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({
                              type: 'system',
                              recipientIds: group.participantIds.filter(id => id !== user.uid),
                              title: `Voice Call`,
                              message: `${sessionUser?.displayName || user.email} started a voice call in ${group.name}`,
                            }),
                          });
                          alert(`Voice call initiated in ${group.name}. Participants will be notified.`);
                        } catch { alert('Failed to start call'); }
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition"
                      title="Voice call group"
                    >
                      <Phone size={20} />
                    </button>
                    <button
                      onClick={async () => {
                        const gId = groupIdFromConversation(selectedConversation);
                        const group = groups.find(g => g.id === gId);
                        if (!group || !user) return;
                        try {
                          const token = await user.getIdToken();
                          await fetch(`${API_BASE_URL}/api/notify/create`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({
                              type: 'system',
                              recipientIds: group.participantIds.filter(id => id !== user.uid),
                              title: `Video Call`,
                              message: `${sessionUser?.displayName || user.email} started a video call in ${group.name}`,
                            }),
                          });
                          alert(`Video call initiated in ${group.name}. Participants will be notified.`);
                        } catch { alert('Failed to start call'); }
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition"
                      title="Video call group"
                    >
                      <Video size={20} />
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => setGroupMenuOpen(!groupMenuOpen)}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition"
                      >
                        <MoreVertical size={20} />
                      </button>
                      {groupMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-slate-200 bg-white shadow-lg py-1">
                          <button
                            onClick={() => { setGroupMenuOpen(false); setRenameValue(currentConversation?.name || ''); setShowRenameGroup(true); }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <MessageSquare size={16} /> Rename Group
                          </button>
                          <button
                            onClick={() => { setGroupMenuOpen(false); setSearchUserQuery(''); setShowAddMembers(true); }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <Users size={16} /> Add Members
                          </button>
                          <button
                            onClick={() => { setGroupMenuOpen(false); setShowGroupInfo(true); }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <User size={16} /> Group Info
                          </button>
                          <hr className="my-1 border-slate-100" />
                          <button
                            onClick={async () => {
                              setGroupMenuOpen(false);
                              const gId = groupIdFromConversation(selectedConversation);
                              if (!gId || !confirm('Delete this group? This cannot be undone.')) return;
                              try {
                                await groupChatService.deleteGroup(gId);
                                setSelectedConversation(null);
                              } catch { alert('Failed to delete group'); }
                            }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                          >
                            <X size={16} /> Delete Group
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <button className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition">
                      <Phone size={20} />
                    </button>
                    <button className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition">
                      <Video size={20} />
                    </button>
                    <button className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition">
                      <MoreVertical size={20} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {!chatEnabled && sessionUser?.role === 'client' && (
              <div className="border-b border-amber-100 bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-800">
                  Chat will unlock once an admin assigns a specialist to you.
                </p>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto bg-[#f0f2f5] p-4">
              <div className="space-y-4">
                {messageGroups.map((group) => (
                  <div key={group.date}>
                    <div className="flex justify-center my-4">
                      <span className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                        {group.date}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {group.messages.map((msg) => {
                        const isOwn = msg.senderId === user?.uid;
                        const senderPhotoURL = getPersistentPhotoURL(msg.senderPhotoURL);
                        return (
                          <div
                            key={msg.id}
                            className={`flex gap-2 mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}
                          >
                            {!isOwn && (
                              <div className="flex-shrink-0 mt-auto mb-1">
                                {senderPhotoURL ? (
                                  <img 
                                    src={senderPhotoURL} 
                                    alt={msg.senderName} 
                                    className="h-8 w-8 rounded-full object-cover border border-slate-200" 
                                  />
                                ) : (
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-400 to-slate-500 text-[10px] font-bold text-white uppercase">
                                    {msg.senderName.charAt(0)}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <div
                              className="relative max-w-[75%]"
                            >
                              <div
                                className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                                  isOwn
                                    ? 'bg-teal-600 text-white rounded-br-none'
                                    : 'bg-white text-slate-900 rounded-bl-none'
                                }`}
                              >
                                <div className={`flex items-center gap-1.5 mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                  {isOwn && (
                                    <span className="text-[8px] px-1 rounded uppercase font-bold bg-white/20 text-white opacity-80">
                                      You
                                    </span>
                                  )}
                                  <p className={`text-[10px] font-bold ${
                                    isOwn ? 'text-teal-100' : (msg.senderRole === 'specialist' ? 'text-purple-600' : 'text-blue-600')
                                  }`}>
                                    {isOwn ? 'You' : msg.senderName}
                                  </p>
                                  {!isOwn && (
                                    <span className={`text-[8px] px-1 rounded uppercase font-bold opacity-80 ${
                                      msg.senderRole === 'specialist' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                                    }`}>
                                      {msg.senderRole}
                                    </span>
                                  )}
                                </div>

                                
                                {msg.fileUrl ? (
                                  <div className="space-y-2">
                                    {msg.fileType === 'image' ? (
                                      <img 
                                        src={msg.fileUrl} 
                                        alt={msg.fileName} 
                                        className="rounded-lg max-w-full cursor-pointer hover:opacity-90 transition"
                                        onClick={() => window.open(msg.fileUrl, '_blank')}
                                      />
                                    ) : (
                                      <div className={`flex items-center gap-3 p-3 rounded-lg border ${isOwn ? 'bg-teal-700 border-teal-500' : 'bg-slate-50 border-slate-200'}`}>
                                        <div className="p-2 rounded bg-white/20 text-current">
                                          <Paperclip size={20} />
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                          <p className="text-sm font-medium truncate">{msg.fileName}</p>
                                          <p className="text-[10px] opacity-70">
                                            {msg.fileSize ? `${(msg.fileSize / 1024).toFixed(1)} KB` : 'File'}
                                          </p>
                                        </div>
                                        <a 
                                          href={msg.fileUrl} 
                                          download={msg.fileName}
                                          className={`p-2 rounded-full hover:bg-black/10 transition`}
                                        >
                                          <Send size={16} className="rotate-90" />
                                        </a>
                                      </div>
                                    )}
                                    {msg.text && !msg.text.startsWith('Sent a ') && (
                                      <p className="text-sm leading-relaxed">{msg.text}</p>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-sm leading-relaxed">{msg.text}</p>
                                )}
                                                           <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                  <p className={`text-[10px] ${isOwn ? 'text-teal-200' : 'text-slate-400'}`}>
                                    {formatMessageTime(msg.createdAt)}
                                  </p>
                                  {isOwn && (
                                    msg.read ? <CheckCheck size={12} className="text-teal-200" /> : <Check size={12} className="text-teal-200 opacity-70" />
                                  )}
                                </div>
                              </div>
                            </div>

                            {isOwn && (
                              <div className="flex-shrink-0 mt-auto mb-1">
                                {currentUserPhotoURL ? (
                                  <img 
                                    src={currentUserPhotoURL} 
                                    alt="You" 
                                    className="h-8 w-8 rounded-full object-cover border border-slate-200 shadow-sm" 
                                  />
                                ) : (
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600 text-[10px] font-bold text-white uppercase shadow-sm">
                                    {sessionUser?.displayName?.charAt(0) || 'U'}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                
                {isTyping && currentConversation && (
                  <div className="flex justify-start gap-3 mb-4">
                    <div className="flex-shrink-0">
                      {currentConversationPhotoURL ? (
                        <img 
                          src={currentConversationPhotoURL} 
                          alt={currentConversation.name} 
                          className="h-8 w-8 rounded-full object-cover border border-slate-100 shadow-sm" 
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-400 uppercase border border-slate-200">
                          {currentConversation.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="bg-white text-slate-900 rounded-2xl rounded-bl-none px-4 py-2 shadow-sm flex items-center gap-2 border border-slate-100">
                      <div className="flex gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-[fadeIn_1.4s_ease-in-out_infinite]" />
                        <div className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-[fadeIn_1.4s_ease-in-out_infinite_0.2s]" />
                        <div className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-[fadeIn_1.4s_ease-in-out_infinite_0.4s]" />
                      </div>
                      <span className="text-[11px] font-semibold text-teal-600">
                        {typingUserName || currentConversation.name} is typing...
                      </span>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="border-t border-slate-100 bg-amber-50 px-4 py-2 text-center text-[10px] font-medium text-amber-700">
              Patient-specific data must remain inside your EHR system.
            </div>
            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="bg-white p-3">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileUpload}
                accept="image/*,.pdf,.doc,.docx,.txt"
              />
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition"
                >
                  <Paperclip size={22} />
                </button>
                <div className="flex-1">
                  <textarea
                    placeholder={chatEnabled ? 'Type a message...' : 'Assignment pending...'}
                    value={newMessage}
                    onChange={(e) => handleTyping(e.target.value)}
                    disabled={!chatEnabled}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e as unknown as FormEvent);
                      }
                    }}
                    rows={1}
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:bg-white transition disabled:bg-slate-100 max-h-32"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending || !chatEnabled}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-600 text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Send size={20} />
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center bg-[#f0f2f5] text-slate-500">
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-lg">
              <MessageSquare size={48} className="text-teal-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">MySyntroMed Messages</h3>
            <p className="mt-2 text-center text-sm text-slate-500 max-w-sm">
              Send and receive messages with your specialist. All conversations are end-to-end encrypted for your privacy.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs text-slate-500 shadow-sm">
              <Lock size={12} className="text-emerald-600" />
              <span>Messages are end-to-end encrypted</span>
            </div>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16">
          <div className="mx-4 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h3 className="text-lg font-bold text-navy-900">Create Group</h3>
              <button
                onClick={() => { setShowCreateGroupModal(false); setNewGroupName(''); setSelectedGroupParticipants([]); }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Group Name</label>
                <input
                  type="text"
                  placeholder="e.g. All Specialists"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-500 focus:bg-white transition"
                />
              </div>
              {usersError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  Failed to load users: {usersError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Participants</label>
                <div className="relative mb-2">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchUserQuery}
                    onChange={(e) => setSearchUserQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm outline-none focus:border-amber-500 focus:bg-white transition"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl">
                  {availableUsers
                    .filter(u =>
                      u.displayName.toLowerCase().includes(searchUserQuery.toLowerCase()) ||
                      (u.email && u.email.toLowerCase().includes(searchUserQuery.toLowerCase()))
                    )
                    .sort((a, b) => a.displayName.localeCompare(b.displayName))
                    .map((u) => {
                      const selected = selectedGroupParticipants.includes(u.uid);
                      return (
                        <button
                          key={u.uid}
                          onClick={() => {
                            setSelectedGroupParticipants(prev =>
                              selected ? prev.filter(id => id !== u.uid) : [...prev, u.uid]
                            );
                          }}
                          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition border-b border-slate-50 last:border-0 ${
                            selected ? 'bg-amber-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className={`h-5 w-5 rounded border-2 flex items-center justify-center ${
                            selected ? 'bg-amber-500 border-amber-500' : 'border-slate-300'
                          }`}>
                            {selected && <span className="text-white text-xs">✓</span>}
                          </div>
                          <div className="relative">
                            {u.photoURL ? (
                              <img src={u.photoURL} alt={u.displayName} className="h-9 w-9 rounded-full object-cover" />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-xs font-bold text-white">
                                {u.displayName.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-semibold text-slate-900">{u.displayName}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              u.role === 'specialist' ? 'bg-purple-100 text-purple-700' :
                              u.role === 'admin' ? 'bg-teal-100 text-teal-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {u.role === 'specialist' ? 'Specialist' : u.role === 'admin' ? 'Admin' : 'Client'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {selectedGroupParticipants.length} participant(s) selected
                </p>
              </div>
              <button
                onClick={async () => {
                  if (!newGroupName.trim() || selectedGroupParticipants.length === 0 || !user?.uid) return;
                  try {
                    const gId = await groupChatService.createGroup(
                      newGroupName.trim(),
                      [...selectedGroupParticipants, user.uid],
                      user.uid
                    );
                    setShowCreateGroupModal(false);
                    setNewGroupName('');
                    setSelectedGroupParticipants([]);
                    setSearchUserQuery('');
                    setSelectedConversation(`group_${gId}`);
                    setMobileView('chat');
                  } catch (err) {
                    console.error('Failed to create group:', err);
                    alert('Failed to create group');
                  }
                }}
                disabled={!newGroupName.trim() || selectedGroupParticipants.length === 0}
                className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white hover:bg-amber-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Group Modal */}
      {showRenameGroup && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h3 className="text-lg font-bold text-navy-900">Rename Group</h3>
              <button onClick={() => setShowRenameGroup(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-4">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-500 focus:bg-white transition"
                autoFocus
              />
              <button
                onClick={async () => {
                  const gId = groupIdFromConversation(selectedConversation);
                  if (!gId || !renameValue.trim()) return;
                  try {
                    await groupChatService.updateGroupName(gId, renameValue.trim());
                    setShowRenameGroup(false);
                  } catch { alert('Failed to rename group'); }
                }}
                disabled={!renameValue.trim()}
                className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white hover:bg-amber-600 transition disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Members Modal */}
      {showAddMembers && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16">
          <div className="mx-4 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h3 className="text-lg font-bold text-navy-900">Add Members</h3>
              <button onClick={() => setShowAddMembers(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="p-4">
              <div className="relative mb-2">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchUserQuery}
                  onChange={(e) => setSearchUserQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-amber-500 focus:bg-white transition"
                />
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto border-t border-slate-100">
              {(() => {
                const gId = groupIdFromConversation(selectedConversation);
                const group = groups.find(g => g.id === gId);
                const existingIds = group?.participantIds || [];
                const eligible = availableUsers.filter(u => !existingIds.includes(u.uid));
                const filtered = eligible.filter(u =>
                  u.displayName.toLowerCase().includes(searchUserQuery.toLowerCase()) ||
                  (u.email && u.email.toLowerCase().includes(searchUserQuery.toLowerCase()))
                ).sort((a, b) => a.displayName.localeCompare(b.displayName));
                return filtered.length > 0 ? filtered.map((u) => (
                  <button
                    key={u.uid}
                    onClick={async () => {
                      const gId2 = groupIdFromConversation(selectedConversation);
                      if (!gId2) return;
                      try {
                        await groupChatService.addParticipantsToGroup(gId2, [u.uid]);
                      } catch { alert('Failed to add member'); }
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-amber-50 transition border-b border-slate-50"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-xs font-bold text-white">
                      {u.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-semibold text-slate-900">{u.displayName}</p>
                      <span className="text-xs text-slate-400">{u.role}</span>
                    </div>
                    <span className="text-amber-600 text-sm font-medium">+ Add</span>
                  </button>
                )) : (
                  <div className="flex flex-col items-center py-8 text-slate-400">
                    <Users size={24} className="mb-2" />
                    <p className="text-sm font-medium">No users to add</p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Group Info Modal */}
      {showGroupInfo && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h3 className="text-lg font-bold text-navy-900">{currentConversation?.name || 'Group Info'}</h3>
              <button onClick={() => setShowGroupInfo(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="p-4 border-b border-slate-100">
              <p className="text-sm text-slate-500">
                {(() => {
                  const gId = groupIdFromConversation(selectedConversation);
                  const group = groups.find(g => g.id === gId);
                  return group ? `${group.participantIds.length} participants` : '';
                })()}
              </p>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {(() => {
                const gId = groupIdFromConversation(selectedConversation);
                const group = groups.find(g => g.id === gId);
                if (!group) return null;
                return group.participantIds.map((pId) => {
                  const profile = groupMembersProfiles[pId] || usersMap[pId] || {};
                  const isMe = pId === user?.uid;
                  const canRemove = sessionUser?.role === 'admin' && !isMe;
                  return (
                    <div key={pId} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-xs font-bold text-white">
                        {(profile.displayName || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {profile.displayName || profile.email || 'Unknown'}
                          {isMe && <span className="text-xs text-slate-400 ml-1">(You)</span>}
                        </p>
                        <span className="text-xs text-slate-400">{profile.role || ''}</span>
                      </div>
                      {canRemove && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Remove ${profile.displayName || 'this user'} from the group?`)) return;
                            try {
                              await groupChatService.removeParticipantsFromGroup(gId, [pId]);
                            } catch { alert('Failed to remove member'); }
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-red-400 hover:bg-red-50 hover:text-red-600 transition"
                          title="Remove from group"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* New Message Modal */}
      {showNewMessageModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16">
          <div className="mx-4 w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h3 className="text-lg font-bold text-navy-900">New Message</h3>
              <button
                onClick={() => { setShowNewMessageModal(false); setSearchUserQuery(''); }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchUserQuery}
                  onChange={(e) => setSearchUserQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-teal-500 focus:bg-white transition"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto border-t border-slate-100">
              {availableUsers
                .filter(u =>
                  u.displayName.toLowerCase().includes(searchUserQuery.toLowerCase()) ||
                  (u.email && u.email.toLowerCase().includes(searchUserQuery.toLowerCase()))
                )
                .sort((a, b) => a.displayName.localeCompare(b.displayName))
                .map((user) => (
                  <button
                    key={user.uid}
                    onClick={() => handleStartNewConversation(user)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-teal-50 transition border-b border-slate-50 last:border-0"
                  >
                    <div className="relative">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName} className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-sm font-bold text-white">
                          {user.displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-slate-900">{user.displayName}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          user.role === 'specialist' ? 'bg-purple-100 text-purple-700' :
                          user.role === 'admin' ? 'bg-teal-100 text-teal-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {user.role === 'specialist' ? 'Specialist' : user.role === 'admin' ? 'Admin' : 'Client'}
                        </span>
                      </div>
                      {user.email && (
                        <p className="truncate text-xs text-slate-400">{user.email}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-teal-600">
                      <MessageSquare size={16} />
                    </div>
                  </button>
                ))}
              {availableUsers.filter(u =>
                u.displayName.toLowerCase().includes(searchUserQuery.toLowerCase()) ||
                (u.email && u.email.toLowerCase().includes(searchUserQuery.toLowerCase()))
              ).length === 0 && (
                <div className="flex flex-col items-center py-8 text-slate-400">
                  <Users size={24} className="mb-2" />
                  <p className="text-sm font-medium">No users found</p>
                  <p className="text-xs">Try a different search term</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;
