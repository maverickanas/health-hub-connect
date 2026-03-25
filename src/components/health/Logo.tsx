import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = 'h-12 w-auto' }) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        <div className="w-10 h-10 rounded-xl bg-luxury-neon flex items-center justify-center shadow-[0_0_20px_rgba(204,255,0,0.3)]">
          <span className="text-black font-black text-lg">H</span>
        </div>
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-white font-black text-lg tracking-tighter">HEALTH</span>
        <span className="text-luxury-neon font-black text-[10px] tracking-[0.4em] uppercase">HUB</span>
      </div>
    </div>
  );
};

export default Logo;
