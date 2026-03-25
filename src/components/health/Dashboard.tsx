import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Sparkles, Play, Pause, Footprints, Settings2, Check, Droplets, Plus } from 'lucide-react';
import { ActivityData } from '@/types';
import ConcentricHUD from './ConcentricHUD';
import Logo from './Logo';
import GlowingButton from './GlowingButton';

interface DashboardProps {
  data: ActivityData;
  userName: string;
  streak: number;
  onToggleTracking: () => void;
  isTracking: boolean;
  onUpdateData: (updates: Partial<ActivityData>) => void;
}

const ProgressBar: React.FC<{ label: string; value: React.ReactNode; progress: number; color: string; icon: React.ReactNode }> = ({ label, value, progress, color, icon }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-end">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-muted text-muted-foreground">{icon}</div>
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <div className="text-xs font-black text-foreground">{value}</div>
    </div>
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, progress)}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="h-full rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}44` }}
      />
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ data, userName, streak, onToggleTracking, isTracking, onUpdateData }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedGoals, setEditedGoals] = useState({ stepGoal: data.stepGoal, calorieGoal: data.calorieGoal });
  const [customIntake, setCustomIntake] = useState('');

  const activeCaloriesProgress = (data.calories / data.calorieGoal) * 100;
  const stepsProgress = (data.steps / data.stepGoal) * 100;
  const intakeProgress = (data.caloriesConsumed / data.calorieGoal) * 100;
  const hydrationProgress = (data.hydration / data.hydrationGoal) * 100;
  const distanceProgress = (data.distance / data.distanceGoal) * 100;

  const handleSaveGoals = () => {
    onUpdateData(editedGoals);
    setIsEditing(false);
  };

  const handleLogIntake = (amount: number) => {
    onUpdateData({ caloriesConsumed: data.caloriesConsumed + amount });
    setCustomIntake('');
  };

  const greeting = new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening';

  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar p-6 space-y-8 pb-32 bg-background">
      {/* Header */}
      <div className="flex flex-col items-center mt-12 text-center space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center gap-4"
        >
          <Logo className="h-12 w-auto" />
          <div className="space-y-1">
            <p className="text-[10px] text-luxury-neon font-black uppercase tracking-[0.5em] opacity-80">
              {greeting} Protocol
            </p>
            <h1 className="text-4xl font-black text-foreground tracking-tighter leading-none">
              Welcome, <span className="text-luxury-neon">{userName}</span>
            </h1>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="h-px w-24 bg-gradient-to-r from-transparent via-foreground/20 to-transparent"
        />
      </div>

      {/* Streak Badge */}
      {streak > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-center gap-2 py-2"
        >
          <div className="px-4 py-2 rounded-full bg-luxury-neon/10 border border-luxury-neon/20 flex items-center gap-2">
            <span className="text-luxury-neon text-lg">🔥</span>
            <span className="text-xs font-black text-luxury-neon uppercase tracking-widest">{streak} Day Streak</span>
          </div>
        </motion.div>
      )}

      {/* Concentric HUD */}
      <div className="flex flex-col items-center justify-center py-10 relative">
        <ConcentricHUD
          caloriesProgress={activeCaloriesProgress}
          stepsProgress={stepsProgress}
          intakeProgress={intakeProgress}
          data={data}
        />
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onToggleTracking}
          className={`mt-12 px-10 py-4 rounded-full flex items-center justify-center gap-3 transition-all duration-300 backdrop-blur-xl ${
            isTracking
              ? 'bg-destructive/10 border border-destructive/30 text-destructive'
              : 'bg-luxury-neon text-primary-foreground border border-luxury-neon shadow-[0_0_40px_rgba(204,255,0,0.2)]'
          }`}
        >
          {isTracking ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          <span className="font-black uppercase tracking-widest text-[10px]">{isTracking ? 'Pause Sync' : 'Resume Sync'}</span>
        </motion.button>
      </div>

      {/* AI Insight Card */}
      <motion.div className="glass-panel p-6 rounded-[2.5rem] flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-luxury-neon/10 flex items-center justify-center shrink-0">
          <Sparkles size={18} className="text-luxury-neon" />
        </div>
        <div>
          <p className="text-[9px] font-black text-luxury-neon uppercase tracking-[0.2em] mb-1.5">Elite AI Insight</p>
          <p className="text-sm font-medium text-foreground/80 leading-relaxed italic">
            "Stay consistent with your goals. Every step counts towards your fitness journey!"
          </p>
        </div>
      </motion.div>

      {/* Daily Targets */}
      <div className="glass-panel p-8 rounded-[2.5rem] space-y-8">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em]">Daily Targets</h3>
          <button
            onClick={() => isEditing ? handleSaveGoals() : setIsEditing(true)}
            className="p-2 rounded-lg hover:bg-muted transition-all group"
          >
            {isEditing ? (
              <Check size={18} className="text-luxury-neon drop-shadow-[0_0_8px_#CCFF00]" />
            ) : (
              <Settings2 size={18} className="text-muted-foreground group-hover:text-luxury-neon transition-colors" />
            )}
          </button>
        </div>

        <div className="space-y-6">
          <ProgressBar
            label="Active Steps"
            value={isEditing ? (
              <input
                type="number"
                value={editedGoals.stepGoal}
                onChange={(e) => setEditedGoals(prev => ({ ...prev, stepGoal: parseInt(e.target.value) || 0 }))}
                className="w-16 bg-transparent border-b border-luxury-neon/50 text-right outline-none text-luxury-neon"
              />
            ) : (
              <span>{data.steps.toLocaleString()} <span className="text-muted-foreground">/ {data.stepGoal.toLocaleString()}</span></span>
            )}
            progress={stepsProgress}
            color="#F59E0B"
            icon={<Footprints size={14} />}
          />
          <ProgressBar
            label="Caloric Burn"
            value={<span>{Math.floor(data.calories).toLocaleString()} <span className="text-muted-foreground">/ {data.calorieGoal.toLocaleString()}</span></span>}
            progress={activeCaloriesProgress}
            color="#CCFF00"
            icon={<Flame size={14} />}
          />
          <ProgressBar
            label="Hydration"
            value={<span>{data.hydration.toFixed(1)}L <span className="text-muted-foreground">/ {data.hydrationGoal}L</span></span>}
            progress={hydrationProgress}
            color="#3B82F6"
            icon={<Droplets size={14} />}
          />
        </div>
      </div>

      {/* Quick Calorie Logger */}
      <div className="glass-panel p-6 rounded-[2.5rem] space-y-4">
        <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em]">Quick Intake Log</h3>
        <div className="flex gap-2">
          {[100, 250, 500].map((amount) => (
            <button
              key={amount}
              onClick={() => handleLogIntake(amount)}
              className="flex-1 py-3 rounded-2xl bg-muted border border-border text-xs font-black text-muted-foreground hover:text-luxury-neon hover:border-luxury-neon/30 transition-all uppercase tracking-wider"
            >
              +{amount}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={customIntake}
            onChange={(e) => setCustomIntake(e.target.value)}
            placeholder="Custom kcal"
            className="flex-1 bg-muted border border-border rounded-2xl px-4 py-3 text-sm text-foreground outline-none focus:border-luxury-neon/30 placeholder:text-muted-foreground"
          />
          <button
            onClick={() => customIntake && handleLogIntake(parseInt(customIntake))}
            className="px-4 py-3 rounded-2xl bg-luxury-neon/10 border border-luxury-neon/20 text-luxury-neon"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="text-center">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
            Today's Intake: <span className={`font-black ${data.caloriesConsumed > data.calorieGoal ? 'text-destructive' : 'text-luxury-neon'}`}>
              {Math.floor(data.caloriesConsumed).toLocaleString()} kcal
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
