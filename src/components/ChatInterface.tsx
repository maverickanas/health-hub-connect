import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, MessageSquarePlus, Sparkles, Check, Menu, X, Loader2, MessageSquare, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/health-chat`;

export interface ChatInterfaceMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

interface ChatSessionRow {
  id: string;
  title: string;
  created_at: string;
}

const WELCOME: ChatInterfaceMessage = {
  id: 'welcome',
  role: 'model',
  text: "Welcome to your **Neural Fitness Coach** 💪\n\nI analyze your patterns and deliver personalized insights on workouts, nutrition, and recovery. Ask me anything.\n\n*Try: \"Create a meal plan for 2000 kcal\"*",
  timestamp: Date.now(),
};

interface ChatInterfaceProps {
  onAcceptPlan?: (dailyCalories: number) => void;
}

const extractCalorieTarget = (text: string): number | null => {
  const m = text.match(/(\d{3,4})\s*(?:kcal|calories|cal)\s*(?:per day|daily|\/day)?/i);
  return m ? parseInt(m[1]) : null;
};

const rowToMessage = (r: { id: string; role: string; content: string; created_at: string }): ChatInterfaceMessage => ({
  id: r.id,
  role: r.role === 'user' ? 'user' : 'model',
  text: r.content,
  timestamp: new Date(r.created_at).getTime(),
});

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onAcceptPlan }) => {
  const [messages, setMessages] = useState<ChatInterfaceMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSessionRow[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const fetchSessions = useCallback(async () => {
    if (!userId) return;
    setLoadingSessions(true);
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('id, title, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      toast.error('Failed to load history');
    } else {
      setSessions((data ?? []) as ChatSessionRow[]);
    }
    setLoadingSessions(false);
  }, [userId]);

  // Initial load: fetch sessions, open most recent (or start new)
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoadingSessions(true);
      const { data } = await supabase
        .from('chat_conversations')
        .select('id, title, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      const rows = (data ?? []) as ChatSessionRow[];
      setSessions(rows);
      setLoadingSessions(false);
      if (rows.length > 0) {
        await loadSession(rows[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const loadSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', sessionId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error(error);
      toast.error('Failed to load conversation');
      setMessages([WELCOME]);
    } else {
      const msgs = (data ?? []).map(rowToMessage);
      setMessages(msgs.length ? msgs : [WELCOME]);
    }
    setLoadingMessages(false);
    setDrawerOpen(false);
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([{ ...WELCOME, timestamp: Date.now() }]);
    setDrawerOpen(false);
    toast.success('New chat started');
  };

  const deleteChat = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const prev = sessions;
    // Optimistic remove
    setSessions(s => s.filter(x => x.id !== sessionId));
    // Delete messages first, then conversation (works with or without cascade)
    const { error: msgErr } = await supabase
      .from('chat_messages')
      .delete()
      .eq('conversation_id', sessionId);
    const { error: convErr } = await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', sessionId);
    if (msgErr || convErr) {
      console.error(msgErr || convErr);
      toast.error('Failed to delete chat');
      setSessions(prev); // rollback
      return;
    }
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setMessages([{ ...WELCOME, timestamp: Date.now() }]);
    }
    toast.success('Chat deleted');
  };


  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  const ensureSession = async (): Promise<string | null> => {
    if (activeSessionId) return activeSessionId;
    if (!userId) return null;
    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({ user_id: userId, title: 'New chat' })
      .select('id, title, created_at')
      .single();
    if (error || !data) {
      console.error(error);
      toast.error('Failed to create conversation');
      return null;
    }
    setActiveSessionId(data.id);
    setSessions(prev => [data as ChatSessionRow, ...prev]);
    return data.id;
  };

  const autoTitleIfNeeded = async (sessionId: string, firstUserText: string) => {
    const current = sessions.find(s => s.id === sessionId);
    const isDefault = !current || current.title === 'New chat' || current.title.trim() === '';
    if (!isDefault) return;
    const words = firstUserText.trim().split(/\s+/).slice(0, 5).join(' ');
    const newTitle = (words.length > 60 ? words.slice(0, 60) : words) + '…';
    // Optimistic local update
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s));
    const { error } = await supabase
      .from('chat_conversations')
      .update({ title: newTitle })
      .eq('id', sessionId);
    if (error) console.error('auto-title update failed', error);
  };

  const persistMessage = async (sessionId: string, role: 'user' | 'model', content: string) => {
    if (!userId) return;
    const dbRole = role === 'user' ? 'user' : 'assistant';
    const { error } = await supabase
      .from('chat_messages')
      .insert({ user_id: userId, conversation_id: sessionId, role: dbRole, content });
    if (error) console.error('persist message failed', error);
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;
    if (!userId) {
      toast.error('Please sign in to chat');
      return;
    }

    // Detect first message BEFORE session/state mutations
    const isFirstMessage =
      messages.filter(m => m.id !== 'welcome' && m.role === 'user').length === 0;

    const sessionId = await ensureSession();
    if (!sessionId) return;

    const userMsg: ChatInterfaceMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: trimmed,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    await persistMessage(sessionId, 'user', trimmed);

    if (isFirstMessage) {
      // Fire-and-forget so UI doesn't wait on the title UPDATE
      autoTitleIfNeeded(sessionId, trimmed);
    }


    const aiMessages = messages
      .filter(m => m.id !== 'welcome')
      .concat(userMsg)
      .map(m => ({
        role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));

    const assistantId = (Date.now() + 1).toString();
    setStreamingId(assistantId);
    let assistantText = '';

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Session expired. Sign in again.');
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
        else if (resp.status === 429) toast.error('Rate limit exceeded.');
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

      if (assistantText) await persistMessage(sessionId, 'model', assistantText);
    } catch (e) {
      console.error('Chat error:', e);
      toast.error('Failed to get AI response');
    } finally {
      setIsTyping(false);
      setStreamingId(null);
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#050505] relative">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4 border-b border-white/5">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => { setDrawerOpen(true); fetchSessions(); }}
          aria-label="Open chat history"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-400 hover:text-[#CCFF00] transition-colors"
        >
          <Menu size={20} strokeWidth={2} />
        </motion.button>
        <div className="text-center">
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

      {/* Scrollable history with top fade */}
      <div className="relative flex-1 flex flex-col min-h-0">
        <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-[#050505] to-transparent z-10 pointer-events-none" />
        <div ref={scrollRef} className="overflow-y-auto w-full h-full p-4 space-y-4 pb-10 scrollbar-hide no-scrollbar">
          {loadingMessages ? (
            <div className="h-full w-full flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-[#CCFF00]" />
            </div>
          ) : (
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
                <div className="flex flex-col gap-2 max-w-[85%]">
                  <div className={
                    msg.role === 'user'
                      ? 'bg-[#CCFF00] text-black p-3 rounded-2xl rounded-tr-sm font-medium text-sm self-end'
                      : 'bg-[#1A1A1A] border border-white/5 text-white p-3 rounded-2xl rounded-tl-sm text-sm self-start'
                  }>
                    <div className={`prose prose-sm max-w-none [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5 ${
                      msg.role === 'user'
                        ? '[&_*]:text-black [&_strong]:text-black'
                        : 'prose-invert [&_strong]:text-[#CCFF00]'
                    }`}>
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                  {msg.role === 'model' && msg.id !== 'welcome' && onAcceptPlan && extractCalorieTarget(msg.text) && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        const t = extractCalorieTarget(msg.text);
                        if (t) { onAcceptPlan(t); toast.success(`Target synchronized — ${t} kcal/day`); }
                      }}
                      className="self-start px-4 py-2 rounded-xl bg-[#CCFF00]/10 border border-[#CCFF00]/20 text-[#CCFF00] text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-1.5 hover:bg-[#CCFF00]/15 transition-colors"
                    >
                      <Check size={12} /> Accept Plan
                    </motion.button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          )}

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

      {/* History Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 bg-black/60 z-40"
            />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed top-0 left-0 h-full w-3/4 max-w-sm bg-[#0A0A0A]/95 backdrop-blur-2xl border-r border-white/10 z-50 flex flex-col"
            >
              <div className="flex items-center justify-between px-5 pt-14 pb-4 border-b border-white/5">
                <div>
                  <p className="text-[9px] font-extrabold text-[#CCFF00]/60 uppercase tracking-[0.4em]">History</p>
                  <h2 className="text-sm font-black text-white uppercase tracking-wider mt-0.5">Conversations</h2>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close history"
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <button
                onClick={handleNewChat}
                className="mx-4 mt-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#CCFF00]/10 border border-[#CCFF00]/20 text-[#CCFF00] text-xs font-bold uppercase tracking-widest hover:bg-[#CCFF00]/15 transition-colors"
              >
                <MessageSquarePlus size={14} /> New Chat
              </button>

              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 no-scrollbar">
                {loadingSessions ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 size={20} className="animate-spin text-[#CCFF00]" />
                  </div>
                ) : sessions.length === 0 ? (
                  <p className="text-center text-zinc-500 text-xs py-10">No conversations yet</p>
                ) : (
                  sessions.map((s) => (
                    <div
                      key={s.id}
                      className={`group w-full flex items-center gap-2 p-3 rounded-xl transition-colors ${
                        activeSessionId === s.id
                          ? 'bg-white/10 text-white'
                          : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <button
                        onClick={() => loadSession(s.id)}
                        className="flex-1 min-w-0 flex items-center gap-2 text-left"
                      >
                        <MessageSquare size={14} className="shrink-0 opacity-60" />
                        <span className="text-sm truncate">{s.title || 'Untitled'}</span>
                      </button>
                      <button
                        onClick={(e) => deleteChat(s.id, e)}
                        aria-label="Delete chat"
                        className="shrink-0 p-1.5 rounded-lg text-zinc-600 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatInterface;
