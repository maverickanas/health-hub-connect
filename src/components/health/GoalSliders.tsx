import React from 'react';
import { motion } from 'framer-motion';
import { Footprints, Flame, Droplets } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface GoalSlidersProps {
  stepGoal: number;
  calorieGoal: number;
  hydrationGoal: number;
  onUpdate: (updates: { stepGoal?: number; calorieGoal?: number; hydrationGoal?: number }) => void;
}

const GoalSliders: React.FC<GoalSlidersProps> = ({ stepGoal, calorieGoal, hydrationGoal, onUpdate }) => {
  const goals = [
    {
      icon: Footprints,
      label: 'Step Target',
      value: stepGoal,
      min: 1000,
      max: 30000,
      step: 500,
      unit: 'steps',
      color: 'text-amber-400',
      onChange: (v: number) => onUpdate({ stepGoal: v }),
    },
    {
      icon: Flame,
      label: 'Calorie Target',
      value: calorieGoal,
      min: 500,
      max: 5000,
      step: 100,
      unit: 'kcal',
      color: 'text-primary',
      onChange: (v: number) => onUpdate({ calorieGoal: v }),
    },
    {
      icon: Droplets,
      label: 'Water Target',
      value: hydrationGoal,
      min: 0.5,
      max: 6,
      step: 0.25,
      unit: 'L',
      color: 'text-cyan-400',
      onChange: (v: number) => onUpdate({ hydrationGoal: v }),
    },
  ];

  return (
    <div className="w-full max-w-sm space-y-4">
      <p className="text-[9px] font-extrabold text-primary/60 uppercase tracking-[0.4em] text-center">Adjust Protocol</p>
      {goals.map((g, i) => (
        <motion.div
          key={g.label}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 * i }}
          className="glass-panel p-4 rounded-2xl space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <g.icon size={14} className={g.color} />
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em]">{g.label}</span>
            </div>
            <span className="text-sm font-black text-foreground">
              {typeof g.value === 'number' && g.value % 1 !== 0 ? g.value.toFixed(1) : g.value.toLocaleString()} {g.unit}
            </span>
          </div>
          <Slider
            value={[g.value]}
            min={g.min}
            max={g.max}
            step={g.step}
            onValueChange={([v]) => g.onChange(v)}
            className="w-full"
          />
        </motion.div>
      ))}
    </div>
  );
};

export default GoalSliders;
