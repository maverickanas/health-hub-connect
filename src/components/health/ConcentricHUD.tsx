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
        return { value: Math.floor(data.caloriesConsumed).toLocaleString(), label: "CALORIE INTAKE", goal: `OUT OF ${data.calorieGoal.toLocaleString()} GOAL`, color: '#3B82F6' };
      case 'steps':
        return { value: (data.steps || 0).toLocaleString(), label: "STEPS TRACKED", goal: `OUT OF ${data.stepGoal.toLocaleString()} GOAL`, color: '#F59E0B' };
      case 'burn':
        return { value: Math.floor(data.calories).toLocaleString(), label: "CALORIC BURN", goal: `OUT OF ${data.calorieGoal.toLocaleString()} GOAL`, color: '#CCFF00' };
    }
  };

  const { value, label, goal } = getMetricDetails();
  const size = 320;
  const center = size / 2;
  const strokeWidth = 12;

  const rings = [
    { id: 'intake', progress: intakeProgress, color: '#3B82F6', radius: 140 },
    { id: 'burn', progress: caloriesProgress, color: '#CCFF00', radius: 120 },
    { id: 'steps', progress: stepsProgress, color: '#F59E0B', radius: 100 },
  ];

  return (
    <motion.div
      onClick={handleCycle}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="relative flex items-center justify-center cursor-pointer group"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 overflow-visible">
        {rings.map((ring) => {
          const isActive = activeMetric === ring.id;
          const circumference = 2 * Math.PI * ring.radius;
          const offset = circumference - (Math.min(100, ring.progress) / 100) * circumference;
          return (
            <g key={ring.id}>
              <circle cx={center} cy={center} r={ring.radius} stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} fill="transparent" />
              <motion.circle
                cx={center} cy={center} r={ring.radius}
                stroke={ring.color}
                strokeWidth={isActive ? strokeWidth + 4 : strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset, opacity: isActive ? 1 : 0.3, strokeWidth: isActive ? strokeWidth + 4 : strokeWidth }}
                transition={{ duration: 1, ease: "easeInOut" }}
                strokeLinecap="round"
                style={{ filter: isActive ? `drop-shadow(0 0 12px ${ring.color}66)` : 'none' }}
              />
            </g>
          );
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeMetric}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center"
          >
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-1">{label}</span>
            <h2 className="text-6xl font-black text-foreground tracking-tighter leading-none">{value}</h2>
            <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest mt-3">{goal}</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ConcentricHUD;
