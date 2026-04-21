import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Footprints, Flame, Droplets, Save } from 'lucide-react';
import { toast } from 'sonner';

interface GoalSlidersProps {
  stepGoal: number;
  calorieGoal: number;
  hydrationGoal: number;
  onUpdate: (updates: { stepGoal?: number; calorieGoal?: number; hydrationGoal?: number }) => void;
}

const GoalSliders: React.FC<GoalSlidersProps> = ({ stepGoal, calorieGoal, hydrationGoal, onUpdate }) => {
  const [stepInput, setStepInput] = useState(String(stepGoal));
  const [calorieInput, setCalorieInput] = useState(String(calorieGoal));
  const [hydrationInput, setHydrationInput] = useState(String(hydrationGoal));
  const [saving, setSaving] = useState(false);

  // Sync local state if parent goals change externally (AI Accept Plan, realtime sync)
  useEffect(() => { setStepInput(String(stepGoal)); }, [stepGoal]);
  useEffect(() => { setCalorieInput(String(calorieGoal)); }, [calorieGoal]);
  useEffect(() => { setHydrationInput(String(hydrationGoal)); }, [hydrationGoal]);

  const fields = [
    {
      key: 'step' as const,
      icon: Footprints, label: 'Step Target', unit: 'steps',
      value: stepInput, setValue: setStepInput,
      color: 'text-amber-400', step: '1', min: 1000, max: 50000,
    },
    {
      key: 'calorie' as const,
      icon: Flame, label: 'Calorie Target', unit: 'kcal',
      value: calorieInput, setValue: setCalorieInput,
      color: 'text-primary', step: '1', min: 500, max: 8000,
    },
    {
      key: 'hydration' as const,
      icon: Droplets, label: 'Water Target', unit: 'L',
      value: hydrationInput, setValue: setHydrationInput,
      color: 'text-cyan-400', step: '0.1', min: 0.5, max: 10,
    },
  ];

  const dirty =
    Number(stepInput) !== stepGoal ||
    Number(calorieInput) !== calorieGoal ||
    Number(hydrationInput) !== hydrationGoal;

  const handleSave = async (overrides?: { step?: string; calorie?: string; hydration?: string }) => {
    const s = Number(overrides?.step ?? stepInput);
    const c = Number(overrides?.calorie ?? calorieInput);
    const h = Number(overrides?.hydration ?? hydrationInput);

    if (!Number.isFinite(s) || s < 1000 || s > 50000) {
      toast.error('Step target must be between 1,000 and 50,000');
      return false;
    }
    if (!Number.isFinite(c) || c < 500 || c > 8000) {
      toast.error('Calorie target must be between 500 and 8,000');
      return false;
    }
    if (!Number.isFinite(h) || h < 0.5 || h > 10) {
      toast.error('Water target must be between 0.5 and 10 L');
      return false;
    }

    const hRounded = Number(h.toFixed(2));

    // Detect which fields actually changed vs parent
    const changed: string[] = [];
    if (s !== stepGoal) changed.push(`Steps → ${s.toLocaleString()}`);
    if (c !== calorieGoal) changed.push(`Calories → ${c.toLocaleString()} kcal`);
    if (hRounded !== Number(hydrationGoal.toFixed(2))) changed.push(`Water → ${hRounded} L`);

    if (changed.length === 0) return true;

    setSaving(true);
    try {
      await onUpdate({ stepGoal: s, calorieGoal: c, hydrationGoal: hRounded });
      const isBlur = !!overrides;
      if (isBlur) {
        // Specific field-level toast on auto-save
        toast.success(changed.join(' · '), { description: 'Auto-saved' });
      } else {
        toast.success(`Saved ${changed.length} target${changed.length > 1 ? 's' : ''} & synced`);
      }
      return true;
    } finally {
      setSaving(false);
    }
  };

  const handleBlur = (key: 'step' | 'calorie' | 'hydration', raw: string) => {
    if (saving) return;
    handleSave({ [key]: raw });
  };

  return (
    <div className="w-full max-w-sm space-y-4">
      <p className="text-[9px] font-extrabold text-primary/60 uppercase tracking-[0.4em] text-center">Adjust Protocol</p>

      {fields.map((f, i) => (
        <motion.div
          key={f.label}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08 * i }}
          className="glass-panel p-4 rounded-2xl transition-all"
          style={saving ? { boxShadow: '0 0 24px rgba(204,255,0,0.25), inset 0 0 0 1px rgba(204,255,0,0.4)' } : {}}
        >
          <div className="flex items-center gap-2 mb-3">
            <f.icon size={14} className={f.color} />
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em]">{f.label}</span>
          </div>
          <div
            className={`flex items-end justify-end gap-2 border-b pb-2 transition-colors ${
              saving ? 'border-primary' : 'border-white/20 focus-within:border-primary'
            }`}
          >
            <input
              type="number"
              inputMode="decimal"
              value={f.value}
              onChange={(e) => f.setValue(e.target.value)}
              onBlur={(e) => handleBlur(f.key, e.target.value)}
              disabled={saving}
              readOnly={saving}
              step={f.step}
              min={f.min}
              max={f.max}
              className="goal-input flex-1 bg-transparent text-right text-2xl font-black text-foreground outline-none appearance-none w-full min-w-0 disabled:cursor-wait transition-opacity"
              style={saving ? { textShadow: '0 0 16px rgba(204,255,0,0.6)', opacity: 0.85 } : {}}
            />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider pb-1">{f.unit}</span>
          </div>
        </motion.div>
      ))}

      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => handleSave()}
        disabled={!dirty || saving}
        className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-black text-[10px] uppercase tracking-[0.3em] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        style={dirty && !saving ? { boxShadow: '0 0 30px rgba(204,255,0,0.35), 0 6px 20px rgba(204,255,0,0.15)' } : {}}
      >
        <Save size={14} /> {saving ? 'Saving…' : 'Save Targets'}
      </motion.button>

      <style>{`
        .goal-input::-webkit-outer-spin-button,
        .goal-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .goal-input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
};

export default GoalSliders;
