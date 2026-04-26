import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, Ruler, Weight, Calendar, Activity, Pencil, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { UserMetrics } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import GoalSliders from './GoalSliders';
import EditProfileScreen from './EditProfileScreen';

interface ProfileScreenProps {
  userName: string;
  email: string;
  onLogout: () => void;
  stepGoal: number;
  calorieGoal: number;
  hydrationGoal: number;
  onUpdateGoals: (updates: { stepGoal?: number; calorieGoal?: number; hydrationGoal?: number }) => void;
}

const ACTIVITY_LEVELS = ['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active'];
const FITNESS_GOALS = ['Weight Loss', 'Maintain', 'Muscle Gain'];
const GENDERS = ['Male', 'Female', 'Other'];

const DeleteAccountButton: React.FC = () => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return;
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.error) throw res.error;
      await supabase.auth.signOut();
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete account');
      setIsDeleting(false);
    }
  };

  return (
    <>
      <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowConfirm(true)}
        className="w-full max-w-sm py-4 rounded-2xl border border-destructive/10 text-destructive/60 text-[9px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-destructive/5 transition-colors mt-2">
        <Trash2 size={12} /> Delete Account Permanently
      </motion.button>
      <AnimatePresence>
        {showConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={(e) => e.target === e.currentTarget && setShowConfirm(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-background rounded-3xl p-6 border border-destructive/20 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle size={24} className="text-destructive" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground uppercase">Delete Account</h3>
                  <p className="text-[10px] text-muted-foreground">This action is irreversible</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                All your data will be permanently deleted. Type <span className="text-destructive font-black">DELETE</span> to confirm.
              </p>
              <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
                placeholder='Type "DELETE" to confirm'
                className="w-full bg-muted border border-border rounded-2xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-destructive/50 transition-all placeholder:text-muted-foreground" />
              <div className="flex gap-3">
                <button onClick={() => { setShowConfirm(false); setConfirmText(''); }}
                  className="flex-1 py-3.5 rounded-2xl border border-border text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">Cancel</button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleDelete} disabled={confirmText !== 'DELETE' || isDeleting}
                  className="flex-1 py-3.5 rounded-2xl bg-destructive text-destructive-foreground text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 disabled:opacity-40">
                  {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={12} />}
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const ProfileScreen: React.FC<ProfileScreenProps> = ({ userName, email, onLogout, stepGoal, calorieGoal, hydrationGoal, onUpdateGoals }) => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [displayName, setDisplayName] = useState(userName);
  const [metrics, setMetrics] = useState<UserMetrics>({
    height: 170, weight: 70, age: 25, gender: 'Male', activityLevel: 'Lightly Active', fitnessGoal: 'Maintain',
  });

  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      if (data) {
        setDisplayName(data.display_name || 'Elite');
        setMetrics({
          height: Number(data.height) || 170, weight: Number(data.weight) || 70,
          age: (data as any).age || 25, gender: (data as any).gender || 'Male',
          activityLevel: (data as any).activity_level || 'Lightly Active',
          fitnessGoal: (data as any).fitness_goal || 'Maintain',
        });
      }
    };
    loadProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) { toast.error('Sign in to save your profile'); return; }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        display_name: displayName, height: metrics.height, weight: metrics.weight,
        age: metrics.age, activity_level: metrics.activityLevel, fitness_goal: metrics.fitnessGoal, gender: metrics.gender,
      } as any).eq('user_id', user.id);
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
    { icon: Weight, label: 'MASS', value: `${metrics.weight} KG`, color: 'text-primary' },
    { icon: Ruler, label: 'HEIGHT', value: `${metrics.height} CM`, color: 'text-blue-400' },
    { icon: Calendar, label: 'AGE', value: `${metrics.age || 25} YRS`, color: 'text-amber-400' },
    { icon: Activity, label: 'ACTIVITY', value: metrics.activityLevel || 'Lightly Active', color: 'text-cyan-400' },
  ];

  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar bg-background pb-28">
      <div className="flex flex-col items-center p-6 pt-14 space-y-6">
        <div className="text-center space-y-1">
          <p className="text-[9px] font-extrabold text-primary/60 uppercase tracking-[0.4em]">Identity</p>
          <h1 className="text-lg font-black text-foreground uppercase tracking-wider">User <span className="text-primary">Profile</span></h1>
        </div>

        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="w-28 h-28 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center shadow-[0_0_40px_rgba(204,255,0,0.1)]">
          <User size={48} className="text-primary" />
        </motion.div>

        <div className="text-center space-y-1.5">
          <h3 className="text-2xl font-black text-foreground uppercase tracking-wide">{displayName}</h3>
          <p className="text-xs text-muted-foreground font-medium">{email}</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              <span className="text-[9px] font-black text-primary uppercase">BMI {bmi}</span>
            </div>
            <div className="px-3 py-1 rounded-full bg-muted border border-border">
              <span className="text-[9px] font-black text-muted-foreground uppercase">{metrics.fitnessGoal}</span>
            </div>
          </div>
        </div>

        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setIsEditing(true)}
          className="px-6 py-3 rounded-2xl border border-primary/30 text-primary text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-primary/5 transition-colors">
          <Pencil size={12} /> Update Identity
        </motion.button>

        <div className="w-full max-w-sm grid grid-cols-2 gap-3">
          {statCards.map((card, i) => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}
              className="glass-panel p-5 rounded-3xl flex flex-col items-center justify-center text-center space-y-3 aspect-square">
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

        {/* Goal Sliders */}
        <GoalSliders
          stepGoal={stepGoal}
          calorieGoal={calorieGoal}
          hydrationGoal={hydrationGoal}
          onUpdate={onUpdateGoals}
        />

        <motion.button whileTap={{ scale: 0.97 }} onClick={onLogout}
          className="w-full max-w-sm py-4 rounded-2xl border border-destructive/20 bg-destructive/5 text-destructive text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-destructive/10 transition-colors">
          <LogOut size={14} /> Sign Out
        </motion.button>

        {user && <DeleteAccountButton />}
      </div>

      <AnimatePresence>
        {isEditing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center"
            onClick={(e) => e.target === e.currentTarget && setIsEditing(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-md bg-background rounded-t-[2rem] p-6 pb-10 max-h-[85dvh] overflow-y-auto no-scrollbar border-t border-border">
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
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Display Name</label>
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-muted border border-border rounded-2xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-primary/50 transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Height (CM)</label>
                    <input type="number" value={metrics.height || ''} onChange={(e) => setMetrics(prev => ({ ...prev, height: Number(e.target.value) }))}
                      className="w-full bg-muted border border-border rounded-2xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-primary/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Weight (KG)</label>
                    <input type="number" value={metrics.weight || ''} onChange={(e) => setMetrics(prev => ({ ...prev, weight: Number(e.target.value) }))}
                      className="w-full bg-muted border border-border rounded-2xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-primary/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Age</label>
                    <input type="number" value={metrics.age || ''} onChange={(e) => setMetrics(prev => ({ ...prev, age: Number(e.target.value) }))}
                      className="w-full bg-muted border border-border rounded-2xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-primary/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Gender</label>
                    <select value={metrics.gender || 'Male'} onChange={(e) => setMetrics(prev => ({ ...prev, gender: e.target.value as any }))}
                      className="w-full bg-muted border border-border rounded-2xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-primary/50 transition-all appearance-none cursor-pointer">
                      {GENDERS.map(g => <option key={g} value={g} className="bg-background">{g}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Activity Level</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ACTIVITY_LEVELS.map(level => (
                      <button key={level} onClick={() => setMetrics(prev => ({ ...prev, activityLevel: level as any }))}
                        className={`py-3 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                          metrics.activityLevel === level ? 'bg-primary text-primary-foreground border-primary/50' : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
                        }`}>{level}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Fitness Goal</label>
                  <div className="grid grid-cols-3 gap-2">
                    {FITNESS_GOALS.map(goal => (
                      <button key={goal} onClick={() => setMetrics(prev => ({ ...prev, fitnessGoal: goal as any }))}
                        className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                          metrics.fitnessGoal === goal ? 'bg-primary text-primary-foreground border-primary/50' : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
                        }`}>{goal}</button>
                    ))}
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={isSaving}
                  className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,255,0,0.2)] disabled:opacity-50">
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
