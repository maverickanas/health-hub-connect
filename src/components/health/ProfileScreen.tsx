import React from 'react';
import { motion } from 'framer-motion';
import { User, LogOut, Ruler, Weight, Calendar, Activity, Pencil } from 'lucide-react';
import { UserMetrics } from '@/types';
import useLocalStorage from '@/hooks/useLocalStorage';

interface ProfileScreenProps {
  userName: string;
  email: string;
  onLogout: () => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ userName, email, onLogout }) => {
  const [metrics] = useLocalStorage<UserMetrics>('bmi_metrics', { height: 180, weight: 78, age: 18, activityLevel: 'Lightly Active' });

  const statCards = [
    { icon: Weight, label: 'MASS', value: `${metrics.weight} KG`, color: 'text-luxury-neon' },
    { icon: Ruler, label: 'HEIGHT', value: `${metrics.height} CM`, color: 'text-blue-400' },
    { icon: Calendar, label: 'BIOLOGICAL AGE', value: `${metrics.age || 18} YRS`, color: 'text-amber-400' },
    { icon: Activity, label: 'ACTIVITY LEVEL', value: metrics.activityLevel || 'Lightly Active', color: 'text-cyan-400' },
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
          <h3 className="text-2xl font-black text-foreground uppercase tracking-wide">{userName}</h3>
          <p className="text-xs text-muted-foreground font-medium">{email}</p>
        </div>

        {/* Update Identity Button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
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
              <div className={`w-10 h-10 rounded-2xl bg-muted flex items-center justify-center`}>
                <card.icon size={20} className={card.color} />
              </div>
              <div>
                <p className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-[0.15em]">{card.label}</p>
                <p className="text-lg font-black text-foreground mt-1">{card.value}</p>
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
    </div>
  );
};

export default ProfileScreen;
