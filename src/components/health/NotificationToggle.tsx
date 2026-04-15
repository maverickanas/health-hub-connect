import React from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff } from 'lucide-react';

interface NotificationToggleProps {
  enabled: boolean;
  onToggle: () => void;
  onRequestPermission: () => Promise<boolean>;
}

const NotificationToggle: React.FC<NotificationToggleProps> = ({ enabled, onToggle, onRequestPermission }) => {
  const handleToggle = async () => {
    if (!enabled) {
      const granted = await onRequestPermission();
      if (!granted) return;
    }
    onToggle();
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={handleToggle}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all border ${
        enabled
          ? 'bg-luxury-neon/10 border-luxury-neon/30 text-luxury-neon'
          : 'bg-muted border-border text-muted-foreground'
      }`}
    >
      {enabled ? <Bell size={14} /> : <BellOff size={14} />}
      {enabled ? 'Reminders On' : 'Reminders Off'}
    </motion.button>
  );
};

export default NotificationToggle;
