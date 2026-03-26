import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Sparkles, Mic } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '@/types';
import { toast } from 'sonner';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/health-chat`;

const ChatBot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'model',
      text: "Welcome to your Neural Fitness Coach! 💪 I analyze your patterns and provide personalized insights. Ask me anything about workouts, nutrition, or recovery.",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const aiMessages = messages
      .filter(m => m.id !== '1')
      .concat(userMsg)
      .map(m => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.text,
      }));

    let assistantText = '';
    const assistantId = (Date.now() + 1).toString();

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: aiMessages }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'AI unavailable' }));
        if (resp.status === 429) toast.error('Rate limit exceeded. Wait a moment.');
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
    }

    setIsTyping(false);
  };

  return (
    <div className="h-full w-full flex flex-col bg-background">
      {/* Header */}
      <div className="pt-14 pb-4 px-6 text-center">
        <p className="text-[9px] font-extrabold text-luxury-neon/60 uppercase tracking-[0.4em]">Neural Insights</p>
        <h1 className="text-lg font-black text-foreground uppercase tracking-wider mt-1">
          AI <span className="text-luxury-neon">Coach</span>
        </h1>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar px-4 space-y-3 pb-4">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-luxury-neon/10' : 'bg-muted'
              }`}>
                {msg.role === 'user' ? (
                  <User size={14} className="text-luxury-neon" />
                ) : (
                  <Bot size={14} className="text-luxury-neon" />
                )}
              </div>
              <div className={`max-w-[80%] p-4 rounded-3xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-luxury-neon/10 border border-luxury-neon/15 text-foreground'
                  : 'glass-card rounded-3xl text-foreground/90'
              }`}>
                <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5 [&_strong]:text-luxury-neon [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && messages[messages.length - 1]?.role !== 'model' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
              <Sparkles size={14} className="text-luxury-neon animate-pulse" />
            </div>
            <div className="glass-card rounded-3xl p-4 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-luxury-neon/50 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-luxury-neon/50 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-luxury-neon/50 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 pb-24 bg-background/80 backdrop-blur-xl">
        <div className="flex gap-2 items-center">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask your AI coach..."
              className="w-full bg-muted border border-border rounded-2xl px-4 py-3 pr-10 text-sm text-foreground outline-none focus:border-luxury-neon/30 placeholder:text-muted-foreground transition-colors"
            />
            <Mic size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="w-11 h-11 rounded-2xl bg-luxury-neon text-primary-foreground flex items-center justify-center disabled:opacity-30 shadow-[0_0_15px_rgba(204,255,0,0.2)]"
          >
            <Send size={16} />
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;
