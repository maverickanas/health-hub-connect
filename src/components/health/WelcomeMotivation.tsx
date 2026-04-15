import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Zap } from 'lucide-react';

const MOTIVATIONAL_QUOTES = [
  { text: "The only bad workout is the one that didn't happen.", author: "Unknown" },
  { text: "Your body can stand almost anything. It's your mind you have to convince.", author: "Unknown" },
  { text: "Success isn't always about greatness. It's about consistency.", author: "Dwayne Johnson" },
  { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },
  { text: "The groundwork for all happiness is good health.", author: "Leigh Hunt" },
  { text: "Fitness is not about being better than someone else. It's about being better than you used to be.", author: "Khloe Kardashian" },
  { text: "Don't limit your challenges. Challenge your limits.", author: "Jerry Dunn" },
  { text: "A year from now you will wish you had started today.", author: "Karen Lamb" },
  { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun" },
  { text: "Health is not valued till sickness comes.", author: "Thomas Fuller" },
  { text: "You don't have to be extreme, just consistent.", author: "Unknown" },
  { text: "The pain you feel today will be the strength you feel tomorrow.", author: "Arnold Schwarzenegger" },
  { text: "Strive for progress, not perfection.", author: "Unknown" },
  { text: "Your health is an investment, not an expense.", author: "Unknown" },
  { text: "Small daily improvements are the key to long-term results.", author: "Unknown" },
];

interface WelcomeMotivationProps {
  userName: string;
  onDismiss: () => void;
}

const WelcomeMotivation: React.FC<WelcomeMotivationProps> = ({ userName, onDismiss }) => {
  const [quote] = useState(() => {
    const today = new Date().toISOString().split('T')[0];
    // Use date as seed for consistent daily quote
    const seed = today.split('-').reduce((a, b) => a + parseInt(b), 0);
    return MOTIVATIONAL_QUOTES[seed % MOTIVATIONAL_QUOTES.length];
  });

  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 500);
    }, 6000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 300);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-6"
          onClick={handleDismiss}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 150 }}
            className="w-full max-w-sm glass-panel rounded-3xl p-8 border border-luxury-neon/20 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glow effect */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-luxury-neon/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-luxury-neon/5 rounded-full blur-3xl" />

            {/* Close */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted transition-colors"
            >
              <X size={14} className="text-muted-foreground" />
            </button>

            {/* Content */}
            <div className="relative space-y-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-luxury-neon/10 flex items-center justify-center">
                  <Zap size={16} className="text-luxury-neon" />
                </div>
                <div>
                  <p className="text-[9px] font-extrabold text-luxury-neon/60 uppercase tracking-[0.3em]">Welcome back</p>
                  <p className="text-sm font-black text-foreground uppercase tracking-wider">{userName}</p>
                </div>
              </div>

              <div className="space-y-3">
                <Sparkles size={16} className="text-luxury-neon/40" />
                <p className="text-lg font-bold text-foreground leading-relaxed italic">
                  "{quote.text}"
                </p>
                <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-[0.2em]">
                  — {quote.author}
                </p>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleDismiss}
                className="w-full py-3.5 rounded-2xl bg-luxury-neon text-primary-foreground font-black text-[10px] uppercase tracking-[0.3em] shadow-[0_0_30px_rgba(204,255,0,0.15)]"
              >
                Let's Go 🔥
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WelcomeMotivation;
