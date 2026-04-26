import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Loader2, Flame, Calendar, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  ActivityRow,
  DailyHistoryEntry,
  buildHistoryEntries,
  calculateCurrentStreak,
  calculateHighestStreak,
} from '@/lib/streak';

interface StreakHistoryModalProps {
  open: boolean;
  onClose: () => void;
  userId?: string;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

const StreakHistoryModal: React.FC<StreakHistoryModalProps> = ({ open, onClose, userId }) => {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<DailyHistoryEntry[]>([]);
  const [current, setCurrent] = useState(0);
  const [highest, setHighest] = useState(0);

  useEffect(() => {
    if (!open || !userId) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const { data } = await supabase
        .from('activity_data')
        .select('date, steps, step_goal, calories_consumed, calorie_goal')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(365);

      if (cancelled) return;
      const rows = (data || []) as ActivityRow[];
      setEntries(buildHistoryEntries(rows));
      setCurrent(calculateCurrentStreak(rows));
      setHighest(calculateHighestStreak(rows));
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [open, userId]);

  const totalActive = entries.filter(e => e.achieved).length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="w-full max-w-md bg-[#0A0A0A] rounded-t-[2rem] sm:rounded-3xl border-t sm:border border-white/10 overflow-hidden flex flex-col max-h-[90dvh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5">
              <div>
                <p className="text-[9px] font-extrabold text-primary/70 uppercase tracking-[0.4em]">Achievement</p>
                <h2 className="text-lg font-black text-foreground uppercase tracking-wider">Protocol History</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/5 transition-colors"
                aria-label="Close history"
              >
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-2 px-6 py-4 border-b border-white/5">
              {[
                { Icon: Calendar, label: 'Days Active', value: totalActive },
                { Icon: Trophy, label: 'Highest', value: highest },
                { Icon: Flame, label: 'Current', value: current },
              ].map(({ Icon, label, value }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 p-3 flex flex-col items-center justify-center text-center"
                  style={{ background: 'rgba(24,24,27,0.6)' }}
                >
                  <Icon size={14} className="text-primary mb-1" />
                  <p className="text-xl font-black text-foreground tabular-nums">{value}</p>
                  <p className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-[0.18em] mt-0.5">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 pb-8">
              {loading ? (
                <div className="h-40 flex items-center justify-center">
                  <Loader2 className="animate-spin text-primary" size={22} />
                </div>
              ) : entries.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-center gap-1">
                  <p className="text-sm font-black text-muted-foreground uppercase tracking-wider">No history yet</p>
                  <p className="text-[10px] text-muted-foreground/70">Hit your step goal to start a streak.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {entries.map(entry => (
                    <li
                      key={entry.date}
                      className="flex items-center gap-3 rounded-2xl border border-white/5 px-3 py-2.5"
                      style={{ background: 'rgba(18,18,18,0.7)' }}
                    >
                      {/* Status icon */}
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                          entry.achieved
                            ? 'bg-primary/15 border-primary/40'
                            : 'bg-destructive/10 border-destructive/30'
                        }`}
                        style={
                          entry.achieved
                            ? { boxShadow: '0 0 18px rgba(204,255,0,0.35)' }
                            : undefined
                        }
                      >
                        {entry.achieved ? (
                          <Check size={16} className="text-primary" strokeWidth={3} />
                        ) : (
                          <X size={16} className="text-destructive/80" strokeWidth={3} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-foreground uppercase tracking-wider">
                          {formatDate(entry.date)}
                        </p>
                        <div className="flex gap-3 mt-0.5">
                          <p className="text-[9px] font-bold text-muted-foreground tabular-nums">
                            <span className="text-foreground/80">{entry.steps.toLocaleString()}</span>
                            <span className="opacity-60">/{entry.stepGoal.toLocaleString()} steps</span>
                          </p>
                          {entry.calorieGoal > 0 && (
                            <p className="text-[9px] font-bold text-muted-foreground tabular-nums">
                              <span className="text-foreground/80">{entry.caloriesConsumed.toLocaleString()}</span>
                              <span className="opacity-60">/{entry.calorieGoal.toLocaleString()} kcal</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StreakHistoryModal;
