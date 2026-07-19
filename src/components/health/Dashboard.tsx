import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Footprints, Plus, Droplets, Minus, TrendingUp } from 'lucide-react';
import { ActivityData } from '@/types';
import ConcentricHUD from './ConcentricHUD';
import StepCounterWidget from './StepCounterWidget';
import ActivityHistoryChart from './ActivityHistoryChart';
import StreakHistoryModal from './StreakHistoryModal';

interface DashboardProps {
  data: ActivityData;
  userName: string;
  streak: number;
  onToggleTracking: () => void;
  isTracking: boolean;
  onUpdateData: (updates: Partial<ActivityData>) => void;
  userId?: string;
  notificationsEnabled?: boolean;
  onToggleNotifications?: () => void;
  onRequestNotificationPermission?: () => Promise<boolean>;
}

const Dashboard: React.FC<DashboardProps> = ({ data, userName, streak, onToggleTracking, isTracking, onUpdateData, userId, notificationsEnabled = false, onToggleNotifications, onRequestNotificationPermission }) => {
  const [customIntake, setCustomIntake] = useState('');
  const [activeSection, setActiveSection] = useState<'calories' | 'hydration'>('calories');
  const [showStreakHistory, setShowStreakHistory] = useState(false);
  // Notification props are intentionally unused here — reminders UI was replaced by Streak badge.
  void notificationsEnabled; void onToggleNotifications; void onRequestNotificationPermission;

  const activeCaloriesProgress = (data.calories / data.calorieGoal) * 100;
  const stepsProgress = (data.steps / data.stepGoal) * 100;
  const intakeProgress = (data.caloriesConsumed / data.calorieGoal) * 100;
  const hydrationProgress = (data.hydration / data.hydrationGoal) * 100;

  const handleLogIntake = (amount: number) => {
    onUpdateData({ caloriesConsumed: data.caloriesConsumed + amount });
    setCustomIntake('');
  };

  const handleLogHydration = (amount: number) => {
    const newVal = Math.max(0, Math.round((data.hydration + amount) * 10) / 10);
    onUpdateData({ hydration: newVal });
  };

  return (
    <div className="w-full h-[100dvh] flex flex-col overflow-hidden bg-[#0A0A0A]">
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-28 no-scrollbar">
      {/* Greeting */}
      <div className="px-6 pt-12 pb-2 flex items-center justify-between">
        <div>
          <p className="text-[9px] font-extrabold text-luxury-neon/60 uppercase tracking-[0.4em]">Welcome back</p>
          <h2 className="text-xl font-black text-foreground tracking-tight uppercase">{userName}</h2>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setShowStreakHistory(true)}
            aria-label="Open streak history"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-xl border transition-colors ${
              streak > 0
                ? 'bg-luxury-neon/10 border-luxury-neon/40 text-luxury-neon'
                : 'bg-white/5 border-white/10 text-muted-foreground hover:text-foreground'
            }`}
            style={
              streak > 0
                ? { boxShadow: '0 0 18px rgba(204,255,0,0.25)' }
                : undefined
            }
          >
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Streak</span>
            <span className="text-[11px] font-black tabular-nums">{streak}</span>
            <span className="text-sm leading-none">🔥</span>
          </motion.button>
        </div>
      </div>

      {/* Concentric HUD */}
      <div className="flex flex-col items-center justify-center pt-4 pb-6 px-6">
        <ConcentricHUD
          caloriesProgress={activeCaloriesProgress}
          stepsProgress={stepsProgress}
          intakeProgress={intakeProgress}
          data={data}
        />
      </div>

      {/* Toggle: Calories / Hydration */}
      <div className="px-6 pb-3">
        <div className="flex bg-muted rounded-2xl p-1">
          {(['calories', 'hydration'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveSection(tab)}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                activeSection === tab
                  ? 'bg-luxury-neon text-primary-foreground shadow-[0_0_15px_rgba(204,255,0,0.15)]'
                  : 'text-muted-foreground'
              }`}
            >
              {tab === 'calories' ? '🔥 Calories' : '💧 Hydration'}
            </button>
          ))}
        </div>
      </div>

      {/* Quick-Add Section */}
      <div className="px-6 pb-4">
        <AnimatePresence mode="wait">
          {activeSection === 'calories' ? (
            <motion.div
              key="cal"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex gap-2 justify-center flex-wrap"
            >
              {[100, 250, 500].map((amount) => (
                <motion.button
                  key={amount}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleLogIntake(amount)}
                  className="px-5 py-2.5 rounded-full bg-muted border border-border text-[11px] font-extrabold text-luxury-neon uppercase tracking-wider hover:border-luxury-neon/30 transition-all"
                >
                  +{amount}
                </motion.button>
              ))}
              <div className="flex gap-1.5">
                <input
                  type="number"
                  value={customIntake}
                  onChange={(e) => setCustomIntake(e.target.value)}
                  placeholder="kcal"
                  className="w-16 bg-muted border border-border rounded-full px-3 py-2 text-[11px] text-foreground outline-none focus:border-luxury-neon/30 placeholder:text-muted-foreground text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => customIntake && handleLogIntake(parseInt(customIntake))}
                  className="w-9 h-9 rounded-full bg-luxury-neon/10 border border-luxury-neon/20 text-luxury-neon flex items-center justify-center"
                >
                  <Plus size={14} />
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="hyd"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-center gap-4">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleLogHydration(-0.25)}
                  className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Minus size={16} />
                </motion.button>
                <div className="text-center">
                  <p className="text-3xl font-black text-foreground">{data.hydration.toFixed(1)}<span className="text-sm text-muted-foreground ml-1">L</span></p>
                  <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">of {data.hydrationGoal}L goal</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleLogHydration(0.25)}
                  className="w-10 h-10 rounded-full bg-luxury-neon/10 border border-luxury-neon/20 flex items-center justify-center text-luxury-neon"
                >
                  <Plus size={16} />
                </motion.button>
              </div>
              <div className="flex gap-2 justify-center">
                {[0.25, 0.5, 1.0].map(amount => (
                  <motion.button
                    key={amount}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => handleLogHydration(amount)}
                    className="px-4 py-2 rounded-full bg-muted border border-border text-[11px] font-extrabold text-cyan-400 uppercase tracking-wider hover:border-cyan-400/30 transition-all"
                  >
                    +{amount}L
                  </motion.button>
                ))}
              </div>
              {/* Hydration progress bar */}
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, hydrationProgress)}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Step Counter */}
      <div className="px-6 pb-4">
        <StepCounterWidget
          userId={userId}
          onSessionSaved={(newDailyTotal) => onUpdateData({ steps: newDailyTotal })}
        />
      </div>

      {/* Activity History Chart */}
      {userId && (
        <div className="px-6 pb-6">
          <ActivityHistoryChart userId={userId} />
        </div>
      )}

      {/* Stat Cards */}
      <div className="px-6 pb-6">
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-panel p-5 rounded-3xl space-y-3"
          >
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center">
              <Flame size={20} className="text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground tracking-tight">{Math.floor(data.calories).toLocaleString()}</p>
              <p className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-[0.15em] mt-1">Active KCAL</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-panel p-5 rounded-3xl space-y-3"
          >
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <Footprints size={20} className="text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground tracking-tight">{data.distance.toFixed(1)}</p>
              <p className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-[0.15em] mt-1">Distance KM</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-panel p-5 rounded-3xl space-y-3"
          >
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <TrendingUp size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground tracking-tight">{data.steps.toLocaleString()}</p>
              <p className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-[0.15em] mt-1">Total Steps</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-panel p-5 rounded-3xl space-y-3"
          >
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
              <Droplets size={20} className="text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground tracking-tight">{data.hydration.toFixed(1)}L</p>
              <p className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-[0.15em] mt-1">Hydration</p>
            </div>
          </motion.div>
          </div>
        </div>
      </main>


      <StreakHistoryModal
        open={showStreakHistory}
        onClose={() => setShowStreakHistory(false)}
        userId={userId}
      />
    </div>
  );
};

export default Dashboard;
