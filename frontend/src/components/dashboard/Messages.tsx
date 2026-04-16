import { type FormEvent, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Paperclip, Phone, Plus, Search, Send, Shield, Video, X, MessageSquare, 
  Check, CheckCheck, MoreVertical, PhoneIncoming, PhoneOutgoing, Lock, Image
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { messageService, userService, notificationService, typingService, notificationSoundService, type Message, type UserProfile } from '@/lib/firestore';
import { presenceService } from '@/lib/presence';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const initialSoundLoadRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const chatEnabled = sessionUser?.role !== 'client' || !!sessionUser?.assignedSpecialistId;
  const clientPending = sessionUser?.role === 'client' && !sessionUser?.assignedSpecialistId;

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
    const allowedSpecialistIds = sessionUser?.role === 'specialist'
      ? new Set(assignedClients.map((c) => c.uid))
      : null;

    allMessages.forEach((msg) => {
      const otherId = msg.senderId === user.uid ? msg.receiverId : msg.senderId;
      // Allow all messages to show up, not just from assigned specialists
      const existing = conversationMap.get(otherId);
      const isUnread = msg.receiverId === user.uid && !msg.read;
      if (!existing) {
        conversationMap.set(otherId, {
          id: otherId,
          name: msg.senderId === user.uid ? (msg.receiverId === sessionUser?.assignedSpecialistId ? sessionUser.assignedSpecialistName || 'Specialist' : 'User') : msg.senderName,
          role: msg.senderId === user.uid ? 'User' : msg.senderRole,
          lastMessage: msg.text,
          time: formatMessageTime(msg.createdAt),
          lastTimestamp: msg.createdAt.getTime(),
          unread: isUnread ? 1 : 0,
          online: presenceMap[otherId] || false,
        });
      } else if (existing && msg.createdAt.getTime() > (existing.lastTimestamp || 0)) {
        existing.lastMessage = msg.text;
        existing.time = formatMessageTime(msg.createdAt);
        existing.lastTimestamp = msg.createdAt.getTime();
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

    setConversations(nextConversations);
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
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    setMessages(filtered);
  }, [allMessages, user?.uid, selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    const unsub = typingService.subscribeToTyping(user.uid, selectedConversation, (isTyping) => {
      if (isTyping) {
        setIsTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
      } else {
        setIsTyping(false);
      }
    });
    return () => unsub();
  }, [user?.uid, selectedConversation]);

  useEffect(() => {
    const ids = conversations.map((c) => c.id);
    const unsubs: Array<() => void> = [];
    ids.forEach((id) => {
      const unsub = presenceService.subscribeToPresence(id, (state) => {
        setPresenceMap((prev) => ({ ...prev, [id]: state?.state === 'online' }));
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach((fn) => fn());
  }, [conversations]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatMessageTime = (date: Date) => {
    const now = new Date();
    const msgDate = new Date(date);
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
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user?.uid || sending || !selectedConversation) return;
    if (!chatEnabled) return;

    setSending(true);
    const receiverId = selectedConversation;
    const senderName = sessionUser?.displayName || user?.email?.split('@')[0] || 'User';
    const senderRole = sessionUser?.role || 'client';

    try {
      await messageService.sendMessage({
        senderId: user.uid,
        senderName,
        senderRole,
        receiverId,
        text: newMessage.trim(),
        read: false,
        status: 'sent',
      });

      if (sessionUser?.role === 'client' && sessionUser.assignedSpecialistId) {
        const checkResponseDelay = () => {
          setTimeout(async () => {
            const msgs = allMessages.filter(m => 
              m.senderId === user.uid && 
              m.receiverId === sessionUser.assignedSpecialistId
            );
            if (msgs.length > 0) {
              const lastMsg = msgs[msgs.length - 1];
              const timeSinceLastMsg = Date.now() - lastMsg.createdAt.getTime();
              if (timeSinceLastMsg > 15 * 60 * 1000) {
                const specialist = await userService.getProfile(sessionUser.assignedSpecialistId);
                await notificationService.notifyAdminsOfDelayedReply(
                  sessionUser.displayName || sessionUser.email || 'Client',
                  sessionUser.email || '',
                  specialist?.displayName || 'Specialist',
                  lastMsg.createdAt
                );
              }
            }
          }, 15 * 60 * 1000);
        };
        checkResponseDelay();
      }

      notificationSoundService.playOutgoingSound();
      typingService.setTyping(user.uid, receiverId, false);
      setNewMessage('');
      setIsTyping(false);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (value: string) => {
    setNewMessage(value);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (selectedConversation) {
      typingService.setTyping(user.uid, selectedConversation, !!value);
    }
    
    if (value && !isTyping) {
      setIsTyping(true);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (selectedConversation) {
        typingService.setTyping(user.uid, selectedConversation, false);
      }
    }, 2000);
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
      const msgDate = new Date(msg.createdAt).toLocaleDateString('en-US', { 
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
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Conversation List */}
      <div
        className={`flex flex-col rounded-2xl border border-slate-200 bg-white ${
          mobileView === 'list' ? 'w-full lg:w-96' : 'hidden w-full lg:flex lg:w-96'
        }`}
      >
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-navy-900">Messages</h2>
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
                            className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`relative max-w-[70%] ${isOwn ? 'order-2' : 'order-1'}`}
                            >
                              <div
                                className={`rounded-2xl px-4 py-2.5 shadow-sm ${
                                  isOwn
                                    ? 'bg-teal-600 text-white rounded-br-md'
                                    : 'bg-white text-slate-900 rounded-bl-md'
                                }`}
                              >
                                {!isOwn && (
                                  <p className={`text-[10px] font-semibold mb-1 ${
                                    currentConversation.role === 'specialist' ? 'text-purple-600' : 'text-blue-600'
                                  }`}>
                                    {msg.senderName}
                                  </p>
                                )}
                                <p className="text-sm leading-relaxed">{msg.text}</p>
                                <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                                  <span className={`text-[10px] ${isOwn ? 'text-teal-200' : 'text-slate-400'}`}>
                                    {formatFullTime(msg.createdAt)}
                                  </span>
                                  {getStatusIcon(msg.status, isOwn)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="border-t border-slate-100 bg-white p-3">
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition"
                >
                  <Image size={22} />
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
