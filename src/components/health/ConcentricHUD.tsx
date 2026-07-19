import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivityData } from '@/types';

interface ConcentricHUDProps {
  stepsProgress: number;
  caloriesProgress: number;
  intakeProgress: number;
  data: ActivityData;
}

const ConcentricHUD: React.FC<ConcentricHUDProps> = ({ stepsProgress, caloriesProgress, intakeProgress, data }) => {
  const [activeMetric, setActiveMetric] = useState<'intake' | 'steps' | 'burn'>('intake');
  const metrics = ['intake', 'steps', 'burn'] as const;

  const handleCycle = () => {
    const currentIndex = metrics.indexOf(activeMetric);
    setActiveMetric(metrics[(currentIndex + 1) % metrics.length]);
  };

  const getMetricDetails = () => {
    switch (activeMetric) {
      case 'intake':
        return { value: Math.floor(data.caloriesConsumed).toLocaleString(), label: "CALORIE INTAKE", goal: `OUT OF ${data.calorieGoal.toLocaleString()} GOAL`, color: '#3B82F6', pct: Math.min(100, intakeProgress) };
      case 'steps':
        return { value: (data.steps || 0).toLocaleString(), label: "STEPS TRACKED", goal: `OUT OF ${data.stepGoal.toLocaleString()} GOAL`, color: '#F59E0B', pct: Math.min(100, stepsProgress) };
      case 'burn':
        return { value: Math.floor(data.calories).toLocaleString(), label: "CALORIC BURN", goal: `OUT OF ${data.calorieGoal.toLocaleString()} GOAL`, color: '#CCFF00', pct: Math.min(100, caloriesProgress) };
    }
  };

  const { value, label, goal, pct } = getMetricDetails();
  const size = 320;
  const center = size / 2;
  const strokeWidth = 12;

  const rings = [
    { id: 'intake' as const, progress: intakeProgress, color: '#3B82F6', radius: 140 },
    { id: 'burn' as const, progress: caloriesProgress, color: '#CCFF00', radius: 120 },
    { id: 'steps' as const, progress: stepsProgress, color: '#F59E0B', radius: 100 },
  ];

  return (
    <motion.div
      onClick={handleCycle}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="relative flex items-center justify-center cursor-pointer group"
      style={{ width: size, height: size }}
    >
      {/* Outer glow pulse for active ring */}
      <div
        className="absolute rounded-full pointer-events-none animate-pulse"
        style={{
          width: size + 20,
          height: size + 20,
          background: `radial-gradient(circle, ${rings.find(r => r.id === activeMetric)?.color}08 0%, transparent 70%)`,
        }}
      />

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 overflow-visible">
        {rings.map((ring) => {
          const isActive = activeMetric === ring.id;
          const circumference = 2 * Math.PI * ring.radius;
          const offset = circumference - (Math.min(100, ring.progress) / 100) * circumference;
          return (
            <g key={ring.id}>
              <circle
                cx={center} cy={center} r={ring.radius}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              <motion.circle
                cx={center} cy={center} r={ring.radius}
                stroke={ring.color}
                strokeWidth={isActive ? strokeWidth + 5 : strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{
                  strokeDashoffset: offset,
                  opacity: isActive ? 1 : 0.2,
                  strokeWidth: isActive ? strokeWidth + 5 : strokeWidth,
                }}
                transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                strokeLinecap="round"
                style={{
                  filter: isActive
                    ? `drop-shadow(0 0 14px ${ring.color}88) drop-shadow(0 0 4px ${ring.color}44)`
                    : 'none',
                }}
              />
            </g>
          );
        })}
      </svg>

      {/* Strictly bounded inner content — safe zone inside the smallest ring */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="flex flex-col items-center justify-center text-center w-[58%] max-w-[190px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeMetric}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              transition={{ duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex flex-col items-center space-y-1"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-400 leading-none truncate max-w-full">
                {label}
              </span>
              <h2 className="text-5xl md:text-6xl font-black text-foreground tracking-tighter leading-none">
                {value}
              </h2>
              <span className="text-[9px] font-medium text-zinc-500 uppercase tracking-widest leading-none truncate max-w-full">
                {goal}
              </span>

              {/* Tight progress cluster grouped with the value */}
              <div className="flex items-center gap-1.5 pt-1">
                <div className="w-14 h-1 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: rings.find(r => r.id === activeMetric)?.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6 }}
                  />
                </div>
                <span className="text-[9px] font-bold text-zinc-400 leading-none">{Math.round(pct)}%</span>
              </div>

              {/* Pagination dots — grouped tight to the number, not pushed to inner ring */}
              <div className="flex gap-1.5 pt-1.5">
                {metrics.map((m) => (
                  <div
                    key={m}
                    className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                    style={{
                      backgroundColor: activeMetric === m ? (rings.find(r => r.id === m)?.color || '#fff') : 'rgba(255,255,255,0.15)',
                      boxShadow: activeMetric === m ? `0 0 6px ${rings.find(r => r.id === m)?.color}88` : 'none',
                    }}
                  />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default ConcentricHUD;
