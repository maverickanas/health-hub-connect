import React from 'react';
import logoImg from '@/assets/logo.png';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = 'h-12 w-auto' }) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img src={logoImg} alt="Health Hub Logo" className="h-10 w-10 object-contain" />
      <div className="flex flex-col leading-none">
        <span className="text-white font-black text-lg tracking-tighter">HEALTH</span>
        <span className="text-luxury-neon font-black text-[10px] tracking-[0.4em] uppercase">HUB</span>
      </div>
    </div>
  );
};

export default Logo;
