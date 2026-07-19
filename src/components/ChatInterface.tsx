import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, MessageSquarePlus, Sparkles, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'ai_coach_history';
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/health-chat`;

export interface ChatInterfaceMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

const WELCOME: ChatInterfaceMessage = {
  id: 'welcome',
  role: 'model',
  text: "Welcome to your **Neural Fitness Coach** 💪\n\nI analyze your patterns and deliver personalized insights on workouts, nutrition, and recovery. Ask me anything.\n\n*Try: \"Create a meal plan for 2000 kcal\"*",
  timestamp: Date.now(),
};

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<ChatInterfaceMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatInterfaceMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  // Persist on every change (after hydration to avoid clobbering)
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { /* ignore */ }
  }, [messages, hydrated]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  const handleNewChat = () => {
    setMessages([{ ...WELCOME, timestamp: Date.now() }]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    toast.success('New chat started');
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    const userMsg: ChatInterfaceMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: trimmed,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const aiMessages = messages
      .filter(m => m.id !== 'welcome')
      .concat(userMsg)
      .map(m => ({
        role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));

    const assistantId = (Date.now() + 1).toString();
    let assistantText = '';

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Please sign in to chat with your coach.');
        setIsTyping(false);
        return;
      }

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: aiMessages }),
      });

      if (!resp.ok) {
        if (resp.status === 401) toast.error('Session expired. Please sign in again.');
        else if (resp.status === 429) toast.error('Rate limit exceeded. Wait a moment.');
        else if (resp.status === 402) toast.error('AI credits exhausted.');
        else toast.error('AI service error');
        setIsTyping(false);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantText += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.id === assistantId) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, text: assistantText } : m);
                }
                return [...prev, { id: assistantId, role: 'model', text: assistantText, timestamp: Date.now() }];
              });
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error('Chat error:', e);
      toast.error('Failed to get AI response');
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#050505]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4 border-b border-white/5">
        <div>
          <p className="text-[9px] font-extrabold text-[#CCFF00]/60 uppercase tracking-[0.4em]">Neural Insights</p>
          <h1 className="text-base font-black text-white uppercase tracking-wider mt-0.5">
            AI <span className="text-[#CCFF00]">Coach</span>
          </h1>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleNewChat}
          aria-label="Start new chat"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-[#CCFF00] transition-colors"
        >
          <MessageSquarePlus size={20} strokeWidth={2} />
        </motion.button>
      </div>

      {/* Scrollable history */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide no-scrollbar">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-[#CCFF00]/10' : 'bg-[#1A1A1A] border border-white/5'
              }`}>
                {msg.role === 'user'
                  ? <User size={14} className="text-[#CCFF00]" />
                  : <Bot size={14} className="text-[#CCFF00]" />}
              </div>
              <div className={
                msg.role === 'user'
                  ? 'bg-[#CCFF00] text-black p-3 rounded-2xl rounded-tr-sm max-w-[85%] font-medium text-sm self-end'
                  : 'bg-[#1A1A1A] border border-white/5 text-white p-3 rounded-2xl rounded-tl-sm max-w-[85%] text-sm self-start'
              }>
                <div className={`prose prose-sm max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5 ${
                  msg.role === 'user'
                    ? '[&_*]:text-black [&_strong]:text-black'
                    : 'prose-invert [&_strong]:text-[#CCFF00]'
                }`}>
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && messages[messages.length - 1]?.role !== 'model' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#1A1A1A] border border-white/5 flex items-center justify-center">
              <Sparkles size={14} className="text-[#CCFF00] animate-pulse" />
            </div>
            <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl rounded-tl-sm p-4 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#CCFF00]/50 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-[#CCFF00]/50 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-[#CCFF00]/50 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </motion.div>
        )}
      </div>

      {/* Input area */}
      <div className="bg-[#0A0A0A] p-4 border-t border-white/10">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask your AI coach..."
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-[#CCFF00] focus:bg-white/[0.08] placeholder:text-zinc-500 transition-colors"
          />
          <motion.button
            whileTap={{ scale: 0.88 }}
            whileHover={{ scale: 1.05 }}
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            aria-label="Send message"
            className="w-11 h-11 rounded-2xl bg-[#CCFF00] text-black flex items-center justify-center disabled:opacity-30 transition-all"
          >
            <Send size={16} strokeWidth={2.5} />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
