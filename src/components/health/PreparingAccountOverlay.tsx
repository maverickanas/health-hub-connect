import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const PreparingAccountOverlay = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
    className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-md pointer-events-none"
    aria-live="polite"
    role="status"
  >
    <div className="flex flex-col items-center gap-4 px-8 py-6 rounded-2xl border border-primary/20 bg-card/40 shadow-2xl">
      <Loader2 className="animate-spin text-primary" size={36} />
      <div className="text-center">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-primary">
          Preparing your account
        </p>
        <p className="text-xs text-muted-foreground mt-1 tracking-wide">
          Syncing your protocol…
        </p>
      </div>
    </div>
  </motion.div>
);

export default PreparingAccountOverlay;
