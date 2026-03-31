import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Flame, Clock, Zap, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const ACTIVITIES = [
  { name: 'Running', met: 9.8 },
  { name: 'Walking', met: 3.8 },
  { name: 'Cycling', met: 7.5 },
  { name: 'Swimming', met: 8 },
  { name: 'HIIT', met: 11 },
  { name: 'Yoga', met: 2.5 },
  { name: 'Strength', met: 5 },
  { name: 'Pilates', met: 3 },
  { name: 'Boxing', met: 9 },
  { name: 'Dance', met: 5 },
  { name: 'Rowing', met: 7 },
  { name: 'Hiking', met: 6 },
  { name: 'Tennis', met: 7.3 },
  { name: 'Other', met: 4 },
];

interface ActivityLoggerProps {
  userWeight: number;
  onLogWorkout: (calories: number) => void;
}

const ActivityLogger: React.FC<ActivityLoggerProps> = ({ userWeight, onLogWorkout }) => {
  const [selectedActivity, setSelectedActivity] = useState(ACTIVITIES[0]);
  const [duration, setDuration] = useState(30);
  const [intensity, setIntensity] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [calories, setCalories] = useState(0);
  const [isManualCalories, setIsManualCalories] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isManualCalories) return;
    let multiplier = 1;
    if (intensity === 'Low') multiplier = 0.8;
    if (intensity === 'High') multiplier = 1.2;
    const hours = duration / 60;
    const weight = userWeight || 70;
    const calculated = Math.round(selectedActivity.met * multiplier * weight * hours);
    setCalories(calculated);
  }, [selectedActivity, duration, intensity, userWeight, isManualCalories]);

  const handleLogWorkout = () => {
    if (duration <= 0) {
      toast.error('Please set a valid duration');
      return;
    }
    setIsSubmitting(true);
    onLogWorkout(calories);
    toast.success(`${selectedActivity.name} logged — ${calories} kcal burned!`);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setIsSubmitting(false);
    }, 1500);
  };

  return (
    <div className="h-full w-full bg-background overflow-y-auto no-scrollbar pb-32">
      <div className="p-6 pt-12 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3 bg-luxury-neon/10 rounded-2xl border border-luxury-neon/20">
            <Activity className="text-luxury-neon" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground uppercase tracking-tighter">Log Workout</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">Elite Tracking Protocol</p>
          </div>
        </div>

        {/* Success Toast */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-3 p-4 bg-luxury-neon/10 border border-luxury-neon/20 rounded-2xl"
            >
              <CheckCircle2 className="text-luxury-neon" size={20} />
              <span className="text-sm font-black text-luxury-neon uppercase tracking-wider">Protocol Logged Successfully</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Activity Grid */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Select Discipline</label>
          <div className="grid grid-cols-3 gap-2">
            {ACTIVITIES.map((act) => (
              <button
                key={act.name}
                onClick={() => setSelectedActivity(act)}
                className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                  selectedActivity.name === act.name
                    ? 'bg-luxury-neon text-primary-foreground border-luxury-neon/50 shadow-[0_0_20px_rgba(204,255,0,0.3)]'
                    : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/80 hover:text-foreground'
                }`}
              >
                {act.name}
              </button>
            ))}
          </div>
        </div>

        {/* Duration & Intensity */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] flex items-center gap-2">
              <Clock size={12} /> Duration
            </label>
            <div className="relative">
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min={1}
                className="w-full bg-transparent border-b border-border py-2 text-2xl font-black text-foreground outline-none focus:border-luxury-neon transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute right-0 bottom-2 text-[10px] font-bold text-muted-foreground uppercase">Min</span>
            </div>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] flex items-center gap-2">
              <Zap size={12} /> Intensity
            </label>
            <div className="flex flex-col gap-1.5">
              {(['Low', 'Medium', 'High'] as const).map(level => (
                <button
                  key={level}
                  onClick={() => setIntensity(level)}
                  className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    intensity === level
                      ? 'bg-luxury-neon/15 text-luxury-neon border border-luxury-neon/30'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Estimated Burn Card */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500/20 to-transparent blur opacity-50 group-hover:opacity-100 transition duration-1000" />
          <div className="relative bg-gradient-to-r from-muted to-transparent backdrop-blur-md rounded-3xl p-6 border border-border flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-500/10 rounded-2xl border border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                <Flame className="text-orange-500" size={24} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Estimated Burn</p>
                <div className="flex items-baseline gap-2">
                  {isManualCalories ? (
                    <input
                      type="number"
                      value={calories}
                      onChange={(e) => setCalories(Number(e.target.value))}
                      className="bg-transparent text-3xl font-black text-foreground w-24 outline-none border-b border-luxury-neon/30 focus:border-luxury-neon [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      autoFocus
                    />
                  ) : (
                    <span className="text-3xl font-black text-foreground">{calories}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Kcal</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsManualCalories(!isManualCalories)}
              className="p-2 bg-muted rounded-xl text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:bg-muted/80 hover:text-foreground transition-all"
            >
              {isManualCalories ? 'Auto' : 'Edit'}
            </button>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Session Notes</label>
          <input
            type="text"
            placeholder="How did it feel? (Optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-muted border border-border rounded-2xl px-4 py-3 text-sm text-foreground/80 outline-none focus:border-luxury-neon/30 transition-all placeholder:text-muted-foreground"
          />
        </div>

        {/* Log Button */}
        <motion.button
          onClick={handleLogWorkout}
          disabled={isSubmitting || showSuccess}
          className="w-full bg-secondary text-luxury-neon border border-luxury-neon/50 px-6 py-5 rounded-2xl font-black uppercase tracking-[0.3em] text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
          initial={{ boxShadow: "0px 0px 0px 0px rgba(206, 242, 69, 0)" }}
          whileHover={{ boxShadow: "0px 0px 20px 0px rgba(206, 242, 69, 0.4)" }}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.3 }}
        >
          {isSubmitting ? (
            <><Loader2 className="animate-spin" size={18} /> LOGGING PROTOCOL...</>
          ) : (
            <><Save size={18} /> LOG WORKOUT</>
          )}
        </motion.button>
      </div>
    </div>
  );
};

export default ActivityLogger;
