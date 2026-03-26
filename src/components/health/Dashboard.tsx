import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Footprints, Plus, Settings2, Check, Droplets } from 'lucide-react';
import { ActivityData } from '@/types';
import ConcentricHUD from './ConcentricHUD';

interface DashboardProps {
  data: ActivityData;
  userName: string;
  streak: number;
  onToggleTracking: () => void;
  isTracking: boolean;
  onUpdateData: (updates: Partial<ActivityData>) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ data, userName, streak, onToggleTracking, isTracking, onUpdateData }) => {
  const [customIntake, setCustomIntake] = useState('');

  const activeCaloriesProgress = (data.calories / data.calorieGoal) * 100;
  const stepsProgress = (data.steps / data.stepGoal) * 100;
  const intakeProgress = (data.caloriesConsumed / data.calorieGoal) * 100;

  const handleLogIntake = (amount: number) => {
    onUpdateData({ caloriesConsumed: data.caloriesConsumed + amount });
    setCustomIntake('');
  };

  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar pb-28">
      {/* Concentric HUD - Hero */}
      <div className="flex flex-col items-center justify-center pt-12 pb-6 px-6">
        <ConcentricHUD
          caloriesProgress={activeCaloriesProgress}
          stepsProgress={stepsProgress}
          intakeProgress={intakeProgress}
          data={data}
        />
      </div>

      {/* Quick Intake Pills */}
      <div className="px-6 pb-4">
        <div className="flex gap-2 justify-center">
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
              className="w-16 bg-muted border border-border rounded-full px-3 py-2 text-[11px] text-foreground outline-none focus:border-luxury-neon/30 placeholder:text-muted-foreground text-center"
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => customIntake && handleLogIntake(parseInt(customIntake))}
              className="w-9 h-9 rounded-full bg-luxury-neon/10 border border-luxury-neon/20 text-luxury-neon flex items-center justify-center"
            >
              <Plus size={14} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Stat Cards - 2 Column Grid */}
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
              <Footprints size={20} className="text-amber-400" />
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

      {/* Streak */}
      {streak > 0 && (
        <div className="px-6 pb-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-panel p-4 rounded-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔥</span>
              <div>
                <p className="text-sm font-black text-foreground">{streak} Day Streak</p>
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Keep it going!</p>
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-full bg-luxury-neon/10 border border-luxury-neon/20">
              <span className="text-[10px] font-black text-luxury-neon uppercase">Elite</span>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
