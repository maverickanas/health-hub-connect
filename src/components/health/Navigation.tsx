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
      className="fixed bottom-0 left-0 w-full z-50 bg-[#0A0A0A]/85 backdrop-blur-xl border-t border-white/5"
      aria-label="Primary"
    >
      <div
        className="flex justify-around items-center px-2 pt-3 pb-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {NAV_ITEMS.map(({ view, icon: Icon, label }) => {
          const isActive = currentView === view;
          return (
            <motion.button
              key={view}
              onClick={() => setView(view)}
              whileTap={{ scale: 0.9 }}
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
              className="flex flex-col items-center gap-1 flex-1"
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.25 : 1.75}
                fill={isActive ? 'currentColor' : 'none'}
                className={`transition-colors duration-200 ${
                  isActive ? 'text-[#CCFF00]' : 'text-zinc-500 hover:text-zinc-400'
                }`}
              />
              <span
                className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 ${
                  isActive ? 'text-[#CCFF00]' : 'text-zinc-500 hover:text-zinc-400'
                }`}
              >
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};

export default Navigation;
