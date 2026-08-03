import React from 'react';
import { motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';

interface OfflineGateProps {
  /** Feature name shown in the message, e.g. "Food Lens". */
  feature: string;
  description?: string;
}

/** Full-screen placeholder for features that require a live connection. */
const OfflineGate: React.FC<OfflineGateProps> = ({ feature, description }) => (
  <div className="h-full w-full flex flex-col items-center justify-center px-8 text-center gap-4">
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="h-16 w-16 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center"
    >
      <WifiOff className="text-primary" size={26} />
    </motion.div>
    <h2 className="text-sm font-black uppercase tracking-[0.28em] text-foreground">
      {feature} needs internet
    </h2>
    <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
      {description ?? 'Reconnect to continue. Your steps, activity and profile keep working offline.'}
    </p>
  </div>
);

export default OfflineGate;
