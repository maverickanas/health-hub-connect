import React from 'react';
import { motion } from 'framer-motion';
import { User, LogOut, Activity, Target, Ruler, Weight } from 'lucide-react';
import { UserMetrics } from '@/types';
import useLocalStorage from '@/hooks/useLocalStorage';
import GlowingButton from './GlowingButton';

interface ProfileScreenProps {
  userName: string;
  email: string;
  onLogout: () => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ userName, email, onLogout }) => {
  const [metrics] = useLocalStorage<UserMetrics>('bmi_metrics', { height: 175, weight: 70 });

  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar bg-background pb-32">
      <div className="flex flex-col items-center p-6 pt-12 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.5em]">Elite Profile</h2>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            USER <span className="text-luxury-neon">IDENTITY</span>
          </h1>
        </div>

        {/* Avatar */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-28 h-28 rounded-full bg-luxury-neon/10 border-2 border-luxury-neon/30 flex items-center justify-center shadow-[0_0_30px_rgba(204,255,0,0.15)]"
        >
          <User size={48} className="text-luxury-neon" />
        </motion.div>

        {/* User Info */}
        <div className="text-center space-y-1">
          <h3 className="text-xl font-black text-foreground">{userName}</h3>
          <p className="text-xs text-muted-foreground">{email}</p>
        </div>

        {/* Stats Grid */}
        <div className="w-full max-w-sm grid grid-cols-2 gap-4">
          <div className="glass-panel p-5 rounded-2xl text-center space-y-2">
            <Ruler size={18} className="text-luxury-neon mx-auto" />
            <p className="text-2xl font-black text-foreground">{metrics.height}</p>
            <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">Height (cm)</p>
          </div>
          <div className="glass-panel p-5 rounded-2xl text-center space-y-2">
            <Weight size={18} className="text-luxury-neon mx-auto" />
            <p className="text-2xl font-black text-foreground">{metrics.weight}</p>
            <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">Weight (kg)</p>
          </div>
          <div className="glass-panel p-5 rounded-2xl text-center space-y-2">
            <Activity size={18} className="text-luxury-neon mx-auto" />
            <p className="text-2xl font-black text-foreground">{metrics.activityLevel || 'Active'}</p>
            <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">Activity Level</p>
          </div>
          <div className="glass-panel p-5 rounded-2xl text-center space-y-2">
            <Target size={18} className="text-luxury-neon mx-auto" />
            <p className="text-2xl font-black text-foreground">{metrics.fitnessGoal || 'Maintain'}</p>
            <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">Goal</p>
          </div>
        </div>

        {/* Logout */}
        <GlowingButton onClick={onLogout} className="w-full max-w-sm py-4 flex items-center justify-center gap-2">
          <LogOut size={16} /> Sign Out
        </GlowingButton>
      </div>
    </div>
  );
};

export default ProfileScreen;
