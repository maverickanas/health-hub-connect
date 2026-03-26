import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Camera, Navigation as NavIcon, MessageCircle, UserCircle } from 'lucide-react';
import { ViewState } from '@/types';

interface NavigationProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

const NAV_ITEMS = [
  { view: ViewState.HOME, icon: BarChart3, label: 'Home' },
  { view: ViewState.LENS, icon: Camera, label: 'Lens' },
  { view: ViewState.TRACK, icon: NavIcon, label: 'Track' },
  { view: ViewState.COACH, icon: MessageCircle, label: 'Coach' },
  { view: ViewState.ME, icon: UserCircle, label: 'Me' },
];

const Navigation: React.FC<NavigationProps> = ({ currentView, setView }) => {
  return (
    <nav className="fixed bottom-4 left-4 right-4 z-50">
      <div className="glass-panel mx-auto max-w-md rounded-[2rem] px-2 py-1">
        <div className="flex justify-around items-center h-16">
          {NAV_ITEMS.map(({ view, icon: Icon, label }) => {
            const isActive = currentView === view;
            return (
              <motion.button
                key={view}
                onClick={() => setView(view)}
                whileTap={{ scale: 0.85 }}
                className="relative flex flex-col items-center gap-1 py-2 px-3"
              >
                <div className={`relative transition-all duration-300 ${isActive ? 'text-luxury-neon' : 'text-muted-foreground'}`}>
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
                  {isActive && (
                    <motion.div
                      layoutId="nav-glow"
                      className="absolute -inset-2 rounded-full bg-luxury-neon/10 blur-md"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </div>
                <span className={`text-[8px] font-extrabold uppercase tracking-[0.15em] transition-colors duration-300 ${
                  isActive ? 'text-luxury-neon neon-text-glow' : 'text-muted-foreground'
                }`}>
                  {label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="nav-dot"
                    className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-luxury-neon shadow-[0_0_6px_rgba(204,255,0,0.8)]"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
