import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Sparkles, Mic, Check, MessageSquarePlus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '@/types';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/health-chat`;
const STORAGE_KEY = 'healthyhub.chat.messages.v1';

const WELCOME_MESSAGE: ChatMessage = {
  id: '1',
  role: 'model',
  text: "Welcome to your Neural Fitness Coach! 💪 I analyze your patterns and provide personalized insights. Ask me anything about workouts, nutrition, or recovery.\n\nTry: *\"Create a meal plan for 2000 kcal\"*",
  timestamp: Date.now(),
};

interface ChatBotProps {
  onAcceptPlan?: (dailyCalories: number) => void;
}

const ChatBot: React.FC<ChatBotProps> = ({ onAcceptPlan }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return [WELCOME_MESSAGE];
  });
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch { /* ignore */ }
  }, [messages]);

  const handleNewChat = () => {
    setMessages([{ ...WELCOME_MESSAGE, timestamp: Date.now() }]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    toast.success('New chat started');
  };

  const extractCalorieTarget = (text: string): number | null => {
    const match = text.match(/(\d{3,4})\s*(?:kcal|calories|cal)\s*(?:per day|daily|\/day)?/i);
    return match ? parseInt(match[1]) : null;
  };

  const handleAcceptPlan = (msgText: string) => {
    const target = extractCalorieTarget(msgText);
    if (target && onAcceptPlan) {
      onAcceptPlan(target);
      toast.success(`Target synchronized — ${target} kcal/day`);
    } else {
      toast.info('No specific calorie target found in this plan');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(), role: 'user', text: input.trim(), timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const aiMessages = messages
      .filter(m => m.id !== '1')
      .concat(userMsg)
      .map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.text }));

    let assistantText = '';
    const assistantId = (Date.now() + 1).toString();

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
        const err = await resp.json().catch(() => ({ error: 'AI unavailable' }));
        if (resp.status === 401) toast.error('Session expired. Please sign in again.');
        else if (resp.status === 429) toast.error('Rate limit exceeded. Wait a moment.');
        else if (resp.status === 402) toast.error('AI credits exhausted.');
        else toast.error(err.error || 'AI service error');
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

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
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
    <div className="h-full w-full flex flex-col bg-background">
      <div className="pt-14 pb-4 px-6 flex items-center justify-between">
        <div className="flex-1 text-center">
          <p className="text-[9px] font-extrabold text-primary/60 uppercase tracking-[0.4em]">Neural Insights</p>
          <h1 className="text-lg font-black text-foreground uppercase tracking-wider mt-1">
            AI <span className="text-primary">Coach</span>
          </h1>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleNewChat}
          aria-label="Start new chat"
          className="absolute right-5 top-14 w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-[#CCFF00] transition-colors"
        >
          <MessageSquarePlus size={20} strokeWidth={2} />
        </motion.button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-4 space-y-3 pb-4">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-[#CCFF00]/10' : 'bg-[#1A1A1A] border border-white/5'
              }`}>
                {msg.role === 'user' ? <User size={14} className="text-[#CCFF00]" /> : <Bot size={14} className="text-[#CCFF00]" />}
              </div>
              <div className="max-w-[85%] space-y-2">
                <div className={
                  msg.role === 'user'
                    ? 'bg-[#CCFF00] text-black rounded-2xl rounded-tr-sm p-4 text-sm font-medium'
                    : 'bg-[#1A1A1A] border border-white/5 text-white rounded-2xl rounded-tl-sm p-4 text-sm'
                }>
                  <div className={`prose prose-sm max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm ${
                    msg.role === 'user'
                      ? '[&_*]:text-black [&_strong]:text-black [&_a]:text-black'
                      : 'prose-invert [&_strong]:text-[#CCFF00]'
                  }`}>
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                </div>
                {msg.role === 'model' && msg.id !== '1' && onAcceptPlan && extractCalorieTarget(msg.text) && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAcceptPlan(msg.text)}
                    className="ml-2 px-4 py-2 rounded-xl bg-[#CCFF00]/10 border border-[#CCFF00]/20 text-[#CCFF00] text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-1.5 hover:bg-[#CCFF00]/15 transition-colors"
                  >
                    <Check size={12} /> Accept Plan
                  </motion.button>
                )}
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

      <div className="px-4 pt-3 pb-3 bg-background/80 backdrop-blur-xl border-t border-white/5">
        <div className="flex gap-2 items-center">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask your AI coach..."
              className="w-full bg-white/[0.06] border border-white/10 rounded-2xl px-4 py-3 pr-10 text-sm text-white outline-none focus:border-[#CCFF00]/50 focus:bg-white/[0.08] placeholder:text-gray-400 transition-colors"
            />
            <Mic size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
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

export default ChatBot;
