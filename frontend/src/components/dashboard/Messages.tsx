import { type FormEvent, useState, useEffect, useRef, type ChangeEvent, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Paperclip, Phone, Plus, Search, Send, Shield, Video, X, MessageSquare, 
  Check, CheckCheck, MoreVertical, PhoneIncoming, PhoneOutgoing, Lock, Image
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { messageService, userService, notificationService, typingService, notificationSoundService, type Message, type UserProfile } from '@/lib/firestore';
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
  const [assignedClients, setAssignedClients] = useState<UserProfile[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, UserProfile>>({});
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
    if (!user?.uid) return;
    const conversationMap = new Map<string, ConversationPreview>();
    allMessages.forEach((msg) => {
      const otherId = msg.senderId === user.uid ? msg.receiverId : msg.senderId;
      const existing = conversationMap.get(otherId);
      const isUnread = msg.receiverId === user.uid && !msg.read;
      
      const lastMsgText = msg.fileUrl ? (msg.fileType === 'image' ? '📷 Image' : '📎 File') : msg.text;
      
      if (!existing) {
        // Resolve name and role for the other person
        let otherName = 'User';
        let otherRole = 'client';
        let otherPhoto = '';

        if (msg.senderId === user.uid) {
          // I sent it, so the other person is the receiver
          otherName = msg.receiverId === sessionUser?.assignedSpecialistId ? (sessionUser.assignedSpecialistName || 'Specialist') : 'Client';
          otherRole = msg.receiverId === sessionUser?.assignedSpecialistId ? 'specialist' : 'client';
        } else {
          // They sent it
          otherName = msg.senderName;
          otherRole = msg.senderRole;
          otherPhoto = msg.senderPhotoURL || '';
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
        if (msg.senderId !== user.uid && msg.senderPhotoURL) {
          existing.photoURL = msg.senderPhotoURL;
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
            photoURL: client.photoURL,
          });
        }
      });
    }

    const ids = Array.from(conversationMap.keys());
    const missingProfiles = ids.filter((id) => !profileMap[id]);
    if (missingProfiles.length > 0) {
      missingProfiles.forEach(async (id) => {
        const profile = await userService.getProfile(id);
        if (profile) {
          setProfileMap((prev) => ({ ...prev, [id]: profile }));
        }
      });
    }

    const nextConversations = Array.from(conversationMap.values())
      .map((conv) => {
      const profile = profileMap[conv.id];
      return {
        ...conv,
        name: profile?.displayName || profile?.email || conv.name,
        role: profile?.role || conv.role,
        photoURL: profile?.photoURL,
        online: presenceMap[conv.id] || false,
      };
    })
      .sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));

    setConversations((prev) => {
      const same =
        prev.length === nextConversations.length &&
        prev.every((item, index) => {
          const next = nextConversations[index];
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
      return same ? prev : nextConversations;
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
    profileMap,
    presenceMap,
    selectedConversation,
  ]);

  useEffect(() => {
    if (!user?.uid || !selectedConversation) return;
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
    const profile = profileMap[selectedConversation];
    conversationNameRef.current = profile?.displayName || profile?.email || 'User';
  }, [selectedConversation, profileMap]);

  useEffect(() => {
    if (!user?.uid || !selectedConversation) return;
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
    if (!chatEnabled) {
      alert('Chat is not enabled. Please wait for specialist assignment.');
      return;
    }

    setSending(true);
    const receiverId = selectedConversation;
    const senderName = sessionUser?.displayName || user?.email?.split('@')[0] || 'User';
    const senderRole = sessionUser?.role || 'client';
    const messageText = newMessage.trim();

    try {
      const messageId = await messageService.sendMessage({
        senderId: user.uid,
        senderName,
        senderRole,
        senderPhotoURL: sessionUser?.photoURL || '',
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
        senderPhotoURL: sessionUser?.photoURL || '',
        receiverId,
        text: messageText,
        read: false,
        status: 'sent',
        createdAt: new Date().toISOString(),
      });

      notificationSoundService.playOutgoingSound();
      typingService.setTyping(user.uid, receiverId, false);
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
      
      try {
        await messageService.sendMessage({
          senderId: user.uid,
          senderName: sessionUser?.displayName || user?.email?.split('@')[0] || 'User',
          senderRole: sessionUser?.role || 'client',
          senderPhotoURL: sessionUser?.photoURL || '',
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
    
    if (selectedConversation && user?.uid) {
      typingService.setTyping(user.uid, selectedConversation, !!value);
      emitTyping(selectedConversation, !!value, senderName);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      if (selectedConversation && user?.uid) {
        typingService.setTyping(user.uid, selectedConversation, false);
        emitTyping(selectedConversation, false, senderName);
      }
    }, 3000);
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
  const messageGroups = groupMessagesByDate(messages);

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
            <Link
              to="/portal/specialist"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-white hover:bg-teal-700 transition"
            >
              <Plus size={18} />
            </Link>
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
                onClick={() => {
                  setSelectedConversation(conv.id);
                  setMobileView('chat');
                }}
                className={`flex w-full items-start gap-3 border-b border-slate-50 p-4 text-left transition hover:bg-slate-50 ${
                  selectedConversation === conv.id ? 'bg-teal-50' : ''
                }`}
              >
                <div className="relative">
                  {conv.photoURL ? (
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
                        conv.role === 'specialist' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {conv.role}
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
              <p className="mt-1 text-sm">Start chatting with your specialist</p>
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
                {currentConversation.photoURL ? (
                  <img src={currentConversation.photoURL} alt={currentConversation.name} className="h-11 w-11 rounded-full object-cover" />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-lg font-bold text-white">
                    {currentConversation.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">{currentConversation.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      currentConversation.role === 'specialist' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {currentConversation.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {currentConversation.online ? (
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
              <div className="flex items-center gap-1">
                <button className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition">
                  <Phone size={20} />
                </button>
                <button className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition">
                  <Video size={20} />
                </button>
                <button className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition">
                  <MoreVertical size={20} />
                </button>
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
                        return (
                          <div
                            key={msg.id}
                            className={`flex gap-2 mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}
                          >
                            {!isOwn && (
                              <div className="flex-shrink-0 mt-auto mb-1">
                                {msg.senderPhotoURL || profileMap[msg.senderId]?.photoURL ? (
                                  <img 
                                    src={msg.senderPhotoURL || profileMap[msg.senderId]?.photoURL} 
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
                                {sessionUser?.photoURL ? (
                                  <img 
                                    src={sessionUser.photoURL} 
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
                      {(currentConversation.photoURL || profileMap[currentConversation.id]?.photoURL) ? (
                        <img 
                          src={currentConversation.photoURL || profileMap[currentConversation.id]?.photoURL} 
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
    </div>
  );
};

export default Messages;
