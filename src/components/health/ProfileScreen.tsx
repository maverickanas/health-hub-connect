import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, Ruler, Weight, Calendar, Activity, Pencil, X, Save, Loader2, Check, Target, ChevronDown } from 'lucide-react';
import { UserMetrics } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ProfileScreenProps {
  userName: string;
  email: string;
  onLogout: () => void;
}

const ACTIVITY_LEVELS = ['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active'];
const FITNESS_GOALS = ['Weight Loss', 'Maintain', 'Muscle Gain'];
const GENDERS = ['Male', 'Female', 'Other'];

const ProfileScreen: React.FC<ProfileScreenProps> = ({ userName, email, onLogout }) => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [displayName, setDisplayName] = useState(userName);
  const [metrics, setMetrics] = useState<UserMetrics>({
    height: 170,
    weight: 70,
    age: 25,
    gender: 'Male',
    activityLevel: 'Lightly Active',
    fitnessGoal: 'Maintain',
  });

  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (data) {
        setDisplayName(data.display_name || 'Elite');
        setMetrics({
          height: Number(data.height) || 170,
          weight: Number(data.weight) || 70,
          age: (data as any).age || 25,
          gender: (data as any).gender || 'Male',
          activityLevel: (data as any).activity_level || 'Lightly Active',
          fitnessGoal: (data as any).fitness_goal || 'Maintain',
        });
      }
    };
    loadProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) {
      toast.error('Sign in to save your profile');
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          height: metrics.height,
          weight: metrics.weight,
          age: metrics.age,
          activity_level: metrics.activityLevel,
          fitness_goal: metrics.fitnessGoal,
          gender: metrics.gender,
        } as any)
        .eq('user_id', user.id);
      if (error) throw error;
      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const bmi = metrics.height > 0 ? (metrics.weight / ((metrics.height / 100) ** 2)).toFixed(1) : '0';

  const statCards = [
    { icon: Weight, label: 'MASS', value: `${metrics.weight} KG`, color: 'text-luxury-neon' },
    { icon: Ruler, label: 'HEIGHT', value: `${metrics.height} CM`, color: 'text-blue-400' },
    { icon: Calendar, label: 'AGE', value: `${metrics.age || 25} YRS`, color: 'text-amber-400' },
    { icon: Activity, label: 'ACTIVITY', value: metrics.activityLevel || 'Lightly Active', color: 'text-cyan-400' },
  ];

  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar bg-background pb-28">
      <div className="flex flex-col items-center p-6 pt-14 space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-[9px] font-extrabold text-luxury-neon/60 uppercase tracking-[0.4em]">Identity</p>
          <h1 className="text-lg font-black text-foreground uppercase tracking-wider">
            User <span className="text-luxury-neon">Profile</span>
          </h1>
        </div>

        {/* Avatar */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-28 h-28 rounded-full bg-luxury-neon/10 border-2 border-luxury-neon/30 flex items-center justify-center shadow-[0_0_40px_rgba(204,255,0,0.1)]"
        >
          <User size={48} className="text-luxury-neon" />
        </motion.div>

        {/* User Info */}
        <div className="text-center space-y-1.5">
          <h3 className="text-2xl font-black text-foreground uppercase tracking-wide">{displayName}</h3>
          <p className="text-xs text-muted-foreground font-medium">{email}</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="px-3 py-1 rounded-full bg-luxury-neon/10 border border-luxury-neon/20">
              <span className="text-[9px] font-black text-luxury-neon uppercase">BMI {bmi}</span>
            </div>
            <div className="px-3 py-1 rounded-full bg-muted border border-border">
              <span className="text-[9px] font-black text-muted-foreground uppercase">{metrics.fitnessGoal}</span>
            </div>
          </div>
        </div>

        {/* Update Identity Button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setIsEditing(true)}
          className="px-6 py-3 rounded-2xl border border-luxury-neon/30 text-luxury-neon text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-luxury-neon/5 transition-colors"
        >
          <Pencil size={12} /> Update Identity
        </motion.button>

        {/* 2x2 Metric Grid */}
        <div className="w-full max-w-sm grid grid-cols-2 gap-3">
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              className="glass-panel p-5 rounded-3xl flex flex-col items-center justify-center text-center space-y-3 aspect-square"
            >
              <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center">
                <card.icon size={20} className={card.color} />
              </div>
              <div>
                <p className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-[0.15em]">{card.label}</p>
                <p className="text-base font-black text-foreground mt-1">{card.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Logout */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onLogout}
          className="w-full max-w-sm py-4 rounded-2xl border border-destructive/20 bg-destructive/5 text-destructive text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-destructive/10 transition-colors"
        >
          <LogOut size={14} /> Sign Out
        </motion.button>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center"
            onClick={(e) => e.target === e.currentTarget && setIsEditing(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-md bg-background rounded-t-[2rem] p-6 pb-10 max-h-[85dvh] overflow-y-auto no-scrollbar border-t border-border"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-black text-foreground uppercase tracking-wider">Edit Profile</h2>
                  <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-[0.2em]">Update your identity</p>
                </div>
                <button onClick={() => setIsEditing(false)} className="p-2 rounded-xl hover:bg-muted">
                  <X size={18} className="text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-5">
                {/* Display Name */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-muted border border-border rounded-2xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-luxury-neon/50 transition-all"
                  />
                </div>

                {/* Height & Weight */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Height (CM)</label>
                    <input
                      type="number"
                      value={metrics.height || ''}
                      onChange={(e) => setMetrics(prev => ({ ...prev, height: Number(e.target.value) }))}
                      className="w-full bg-muted border border-border rounded-2xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-luxury-neon/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Weight (KG)</label>
                    <input
                      type="number"
                      value={metrics.weight || ''}
                      onChange={(e) => setMetrics(prev => ({ ...prev, weight: Number(e.target.value) }))}
                      className="w-full bg-muted border border-border rounded-2xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-luxury-neon/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                {/* Age & Gender */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Age</label>
                    <input
                      type="number"
                      value={metrics.age || ''}
                      onChange={(e) => setMetrics(prev => ({ ...prev, age: Number(e.target.value) }))}
                      className="w-full bg-muted border border-border rounded-2xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-luxury-neon/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Gender</label>
                    <select
                      value={metrics.gender || 'Male'}
                      onChange={(e) => setMetrics(prev => ({ ...prev, gender: e.target.value as any }))}
                      className="w-full bg-muted border border-border rounded-2xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-luxury-neon/50 transition-all appearance-none cursor-pointer"
                    >
                      {GENDERS.map(g => <option key={g} value={g} className="bg-background">{g}</option>)}
                    </select>
                  </div>
                </div>

                {/* Activity Level */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Activity Level</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ACTIVITY_LEVELS.map(level => (
                      <button
                        key={level}
                        onClick={() => setMetrics(prev => ({ ...prev, activityLevel: level as any }))}
                        className={`py-3 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                          metrics.activityLevel === level
                            ? 'bg-luxury-neon text-primary-foreground border-luxury-neon/50'
                            : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fitness Goal */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Fitness Goal</label>
                  <div className="grid grid-cols-3 gap-2">
                    {FITNESS_GOALS.map(goal => (
                      <button
                        key={goal}
                        onClick={() => setMetrics(prev => ({ ...prev, fitnessGoal: goal as any }))}
                        className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                          metrics.fitnessGoal === goal
                            ? 'bg-luxury-neon text-primary-foreground border-luxury-neon/50'
                            : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
                        }`}
                      >
                        {goal}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Save Button */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full py-4 rounded-2xl bg-luxury-neon text-primary-foreground font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,255,0,0.2)] disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfileScreen;
