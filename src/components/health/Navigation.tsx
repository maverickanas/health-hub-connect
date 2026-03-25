import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Calculator, MessageSquare, Dumbbell, User } from 'lucide-react';
import { ViewState } from '@/types';

interface NavigationProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

const NAV_ITEMS = [
  { view: ViewState.DASHBOARD, icon: LayoutDashboard, label: 'Hub' },
  { view: ViewState.BMI_HUB, icon: Calculator, label: 'BMI' },
  { view: ViewState.CHAT, icon: MessageSquare, label: 'Coach' },
  { view: ViewState.ACTIVITY_LOG, icon: Dumbbell, label: 'Log' },
  { view: ViewState.PROFILE, icon: User, label: 'Profile' },
];

const Navigation: React.FC<NavigationProps> = ({ currentView, setView }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-4">
        {NAV_ITEMS.map(({ view, icon: Icon, label }) => {
          const isActive = currentView === view;
          return (
            <motion.button
              key={view}
              onClick={() => setView(view)}
              whileTap={{ scale: 0.9 }}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors ${
                isActive ? 'text-luxury-neon' : 'text-muted-foreground'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className={`text-[9px] font-black uppercase tracking-widest ${isActive ? 'text-luxury-neon' : ''}`}>
                {label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-luxury-neon rounded-full shadow-[0_0_10px_rgba(204,255,0,0.5)]"
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};

export default Navigation;
