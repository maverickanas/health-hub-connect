import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, Ruler, Weight, Calendar, Activity, Pencil, Loader2, Trash2, AlertTriangle, Percent } from 'lucide-react';
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

// Activity / fitness / gender constants now live inside <EditProfileScreen/>.

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
  const { user, profile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
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
    // Re-run whenever the shared auth profile changes (e.g. after Edit Profile save).
  }, [user, profile?.display_name, profile?.height, profile?.weight, profile?.age, profile?.avatar_url]);


  // Save is handled inside <EditProfileScreen/>; this just syncs local state on close.
  const handleSaved = (next: { displayName: string; metrics: UserMetrics }) => {
    setDisplayName(next.displayName);
    setMetrics(next.metrics);
  };

  const bmi = metrics.height > 0 ? (metrics.weight / ((metrics.height / 100) ** 2)).toFixed(1) : '0';

  // Derive body-fat estimate via BMI when no explicit measurement is stored.
  // (Deurenberg formula — rough but good enough for a placeholder badge.)
  const bmiNum = parseFloat(bmi);
  const bodyFatEstimate = Number.isFinite(bmiNum) && bmiNum > 0
    ? Math.max(
        5,
        Math.round(
          1.20 * bmiNum + 0.23 * (metrics.age || 25) - (metrics.gender === 'Female' ? 5.4 : 16.2),
        ),
      )
    : null;

  const statCards = [
    {
      icon: Weight,
      label: 'Current Weight',
      value: `${metrics.weight}`,
      unit: 'KG',
      tint: 'text-[#CCFF00]',
      iconBg: 'bg-[#CCFF00]/10',
      ring: 'hover:shadow-[0_0_30px_rgba(204,255,0,0.25)] hover:border-[#CCFF00]/30',
    },
    {
      icon: Percent,
      label: 'Body Fat',
      value: bodyFatEstimate != null ? `${bodyFatEstimate}` : '15',
      unit: '%',
      tint: 'text-blue-400',
      iconBg: 'bg-blue-400/10',
      ring: 'hover:shadow-[0_0_30px_rgba(96,165,250,0.25)] hover:border-blue-400/30',
    },
    {
      icon: Ruler,
      label: 'Height',
      value: `${metrics.height}`,
      unit: 'CM',
      tint: 'text-amber-400',
      iconBg: 'bg-amber-400/10',
      ring: 'hover:shadow-[0_0_30px_rgba(251,191,36,0.22)] hover:border-amber-400/30',
    },
    {
      icon: Calendar,
      label: 'Age',
      value: `${metrics.age || 25}`,
      unit: 'YRS',
      tint: 'text-cyan-400',
      iconBg: 'bg-cyan-400/10',
      ring: 'hover:shadow-[0_0_30px_rgba(34,211,238,0.22)] hover:border-cyan-400/30',
    },
  ];

  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar bg-background pb-28">
      <div className="flex flex-col items-center p-6 pt-14 space-y-6">
        <div className="text-center space-y-1">
          <p className="text-[9px] font-extrabold text-primary/60 uppercase tracking-[0.4em]">Identity</p>
          <h1 className="text-lg font-black text-foreground uppercase tracking-wider">User <span className="text-primary">Profile</span></h1>
        </div>

        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="w-28 h-28 rounded-full overflow-hidden bg-primary/10 border-2 border-[#CCFF00] flex items-center justify-center shadow-[0_0_40px_rgba(204,255,0,0.18)]">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="User Avatar"
              className="w-full h-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <User size={48} className="text-[#CCFF00]" />
          )}
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

      <EditProfileScreen
        open={isEditing}
        onClose={() => setIsEditing(false)}
        initialDisplayName={displayName}
        initialMetrics={metrics}
        avatarUrl={profile?.avatar_url ?? null}
        onSaved={handleSaved}
      />
    </div>
  );
};

export default ProfileScreen;
