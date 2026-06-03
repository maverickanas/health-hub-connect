import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Camera, Navigation as NavIcon, MessageCircle, UserCircle } from 'lucide-react';
import { ViewState } from '@/types';

interface NavigationProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

const NAV_ITEMS = [
  { view: ViewState.HOME,  icon: BarChart3,     label: 'Home'  },
  { view: ViewState.LENS,  icon: Camera,        label: 'Lens'  },
  { view: ViewState.TRACK, icon: NavIcon,       label: 'Track' },
  { view: ViewState.COACH, icon: MessageCircle, label: 'Coach' },
  { view: ViewState.ME,    icon: UserCircle,    label: 'Me'    },
];

const Navigation: React.FC<NavigationProps> = ({ currentView, setView }) => {
  return (
    <nav
      className="fixed bottom-0 left-0 w-full z-[100] bg-[#0A0A0A]/90 backdrop-blur-lg border-t border-white/5"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Primary"
    >
      <div className="flex justify-around items-center h-16 px-2">
        {NAV_ITEMS.map(({ view, icon: Icon, label }) => {
          const isActive = currentView === view;
          return (
            <motion.button
              key={view}
              onClick={() => setView(view)}
              whileTap={{ scale: 0.88 }}
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
              className="relative flex flex-col items-center gap-1 flex-1 py-2"
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.75}
                className={`transition-colors duration-200 ${isActive ? 'text-[#CCFF00]' : 'text-zinc-500'}`}
                style={isActive ? { filter: 'drop-shadow(0 0 6px rgba(204,255,0,0.55))' } : undefined}
              />
              <span
                className={`text-[8px] font-extrabold uppercase tracking-[0.18em] transition-colors duration-200 ${
                  isActive ? 'text-[#CCFF00]' : 'text-zinc-500'
                }`}
              >
                {label}
              </span>
              {isActive && (
                <motion.span
                  layoutId="nav-active-dot"
                  className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-[#CCFF00] shadow-[0_0_8px_#CCFF00]"
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
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
