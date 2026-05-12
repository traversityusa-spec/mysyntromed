import { useState, useRef, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, Loader2, Bot, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CONTACT_INFO } from '@/lib/constants';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'support' | 'system_contact';
  timestamp: Date;
}

const QUICK_REPLIES = [
  "What services do you offer?",
  "Are you HIPAA certified?",
  "Talk to a human"
];

const KNOWLEDGE_BASE: Record<string, string> = {
  hipaa: "Patient privacy is our priority. All our staff are rigorously HIPAA-certified and operate within secure, compliant workflows.",
  service: "We provide specialized Virtual Medical Scribes, Administrative Assistants, Receptionists, and Patient Coordination Support tailored for healthcare practices.",
  cost: "Our pricing is scalable and depends on your practice's exact needs. I can connect you to a human to get a tailored quote!",
  price: "Our pricing is scalable and depends on your practice's exact needs. I can connect you to a human to get a tailored quote!",
  time: "Most practices can onboard and begin receiving support within a few business days after our initial consultation.",
};

export const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! I am the MySyntroMed virtual assistant. How can I help your practice today?',
      sender: 'support',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // AI Logic Simulation
    setTimeout(() => {
      const lowerText = text.toLowerCase();
      let responseText = "I'm still learning, but I'd be happy to connect you with one of our human specialists who can answer that for you!";
      let showContact = false;

      // Intent matching
      if (lowerText.includes('human') || lowerText.includes('contact') || lowerText.includes('email') || lowerText.includes('talk')) {
        responseText = "I can certainly connect you to our administrative team! Here is our direct contact information:";
        showContact = true;
      } else {
        // Keyword matching
        for (const [key, answer] of Object.entries(KNOWLEDGE_BASE)) {
          if (lowerText.includes(key)) {
            responseText = answer;
            break;
          }
        }
      }

      setMessages((prev) => [
        ...prev, 
        {
          id: (Date.now() + 1).toString(),
          text: responseText,
          sender: 'support',
          timestamp: new Date(),
        },
        ...(showContact ? [{
          id: (Date.now() + 2).toString(),
          text: "CONTACT_CARD",
          sender: 'system_contact' as const,
          timestamp: new Date(),
        }] : [])
      ]);
      setIsTyping(false);
    }, 1200);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend(inputValue);
  };

  return (
    <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-[100] flex flex-col items-end gap-4">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            style={{ transformOrigin: 'bottom right' }}
            className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 w-[calc(100vw-2rem)] sm:w-80 md:w-96 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-navy-900 to-teal-800 p-5 text-white flex items-center justify-between shadow-sm relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-aqua-400 rounded-full flex items-center justify-center shadow-inner relative">
                  <Bot size={22} className="text-white" />
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-teal-800 rounded-full relative z-20">
                     <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-75"></div>
                  </div>
                </div>
                <div>
                  <p className="font-bold text-base tracking-tight">SyntroBot</p>
                  <p className="text-xs text-teal-100 font-medium">Virtual Assistant</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="hover:bg-white/10 p-2 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div 
              ref={scrollRef}
              className="h-[350px] p-5 bg-[#f8fafc] overflow-y-auto flex flex-col gap-4 scroll-smooth"
            >
              {messages.map((msg) => {
                if (msg.sender === 'system_contact') {
                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      key={msg.id} className="bg-white border border-teal-100 rounded-2xl p-4 shadow-sm self-start w-11/12"
                    >
                      <p className="text-xs font-bold text-navy-900 mb-3 uppercase tracking-wider">Direct Connect</p>
                      <a href={`tel:${CONTACT_INFO.phone}`} className="flex items-center gap-3 text-slate-600 hover:text-teal-600 mb-3 transition-colors bg-slate-50 p-2 rounded-lg">

                        <span className="text-sm font-medium">{CONTACT_INFO.phoneFormatted}</span>
                      </a>
                      <a href={`mailto:${CONTACT_INFO.email}`} className="flex items-center gap-3 text-slate-600 hover:text-teal-600 transition-colors bg-slate-50 p-2 rounded-lg">
                        <Mail size={16} className="text-teal-500" />
                        <span className="text-sm font-medium">{CONTACT_INFO.email}</span>
                      </a>
                    </motion.div>
                  );
                }

                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={msg.id}
                    className={cn(
                      "max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm",
                      msg.sender === 'user' 
                        ? "bg-teal-600 text-white self-end rounded-tr-none" 
                        : "bg-white text-slate-700 self-start rounded-tl-none border border-slate-100"
                    )}
                  >
                    {msg.text}
                  </motion.div>
                );
              })}
              
              {/* Quick Replies - Only show if the last message is from support and not typing */}
              {!isTyping && messages[messages.length - 1].sender !== 'user' && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {QUICK_REPLIES.map(reply => (
                    <button
                      key={reply}
                      onClick={() => handleSend(reply)}
                      className="text-xs bg-white border border-teal-100 text-teal-700 px-3 py-1.5 rounded-full hover:bg-teal-50 hover:border-teal-300 transition-colors shadow-sm"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}

              {isTyping && (
                <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm self-start flex items-center gap-2 border border-slate-100">
                  <Loader2 size={16} className="text-teal-600 animate-spin" />
                  <span className="text-xs text-slate-400 font-medium">Thinking...</span>
                </div>
              )}
            </div>

            {/* Input */}
            <form 
              onSubmit={onSubmit}
              className="p-4 bg-white border-t border-slate-100 flex gap-2 relative z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]"
            >
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask me anything..." 
                className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
              />
              <button 
                type="submit"
                disabled={!inputValue.trim()}
                className="bg-navy-900 text-white p-3 rounded-xl hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <Send size={18} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 relative group",
          isOpen ? "bg-white text-navy-900 rotate-90" : "bg-gradient-to-r from-teal-500 to-aqua-400 text-white"
        )}
      >
        <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
        {isOpen ? <X size={28} /> : <MessageCircle size={28} />}
      </motion.button>
    </div>
  );
};
