import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OnboardingScreenProps {
  userId: string;
  userName: string;
  onComplete: () => void;
}

type Gender = '' | 'Male' | 'Female';
type Activity = '' | 'Sedentary' | 'Light' | 'Active' | 'Athlete';
type Goal = '' | 'Weight Loss' | 'Maintain' | 'Muscle Gain';

type FormData = {
  fullName: string;
  age: string;
  gender: Gender;
  heightCm: string;
  massKg: string;
  activityLevel: Activity;
  fitnessGoal: Goal;
  targetWeightKg: string;
};

const STEP_META = [
  { kicker: 'STEP 01', title: 'IDENTITY', sub: 'Tell us who you are.' },
  { kicker: 'STEP 02', title: 'BIOMETRICS', sub: 'Precision powers your protocol.' },
  { kicker: 'STEP 03', title: 'PROTOCOL & GOALS', sub: 'Define your mission.' },
];
const TOTAL = STEP_META.length;

// ─── Sleek glassmorphic input ────────────────────────────────
const NeonField: React.FC<{
  label: string;
  unit?: string;
  children: React.ReactNode;
}> = ({ label, unit, children }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <label className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em]">{label}</label>
      {unit && <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">{unit}</span>}
    </div>
    {children}
  </div>
);

const inputClass =
  'w-full bg-[#0F0F0F] border border-white/10 rounded-xl p-4 text-white text-base font-semibold outline-none transition-all placeholder:text-white/25 focus:border-[#CCFF00] focus:ring-1 focus:ring-[#CCFF00] focus:shadow-[0_0_20px_-6px_#CCFF00] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

// ─── Segmented pill selector ─────────────────────────────────
function Segmented<T extends string>({
  options, value, onChange,
}: { options: { label: string; value: T }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className={`grid gap-2 ${options.length <= 2 ? 'grid-cols-2' : options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <motion.button
            key={opt.value}
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => onChange(opt.value)}
            className={`relative rounded-xl py-3 px-2 text-xs font-black uppercase tracking-[0.15em] border transition-all ${
              active
                ? 'bg-[#CCFF00] text-black border-[#CCFF00] shadow-[0_0_22px_-4px_#CCFF00]'
                : 'bg-[#0F0F0F] text-white/70 border-white/10 hover:border-white/25'
            }`}
          >
            {opt.label}
            {active && (
              <span className="absolute top-1.5 right-1.5">
                <Check size={11} strokeWidth={3.5} />
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ userId, userName, onComplete }) => {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<FormData>({
    fullName: userName && userName !== 'Elite' ? userName : '',
    age: '',
    gender: '',
    heightCm: '',
    massKg: '',
    activityLevel: '',
    fitnessGoal: '',
    targetWeightKg: '',
  });

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setData(prev => ({ ...prev, [k]: v }));

  const canProceed = (): boolean => {
    if (step === 0) {
      return data.fullName.trim().length > 0 && Number(data.age) > 0 && data.gender !== '';
    }
    if (step === 1) {
      return Number(data.heightCm) > 50 && Number(data.massKg) > 20;
    }
    if (step === 2) {
      return data.activityLevel !== '' && data.fitnessGoal !== '' && Number(data.targetWeightKg) > 20;
    }
    return false;
  };

  const goNext = () => { setDirection(1); setStep(s => Math.min(TOTAL - 1, s + 1)); };
  const goBack = () => { setDirection(-1); setStep(s => Math.max(0, s - 1)); };

  const handleFinish = async () => {
    if (!canProceed()) return;
    setSaving(true);
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) throw authErr || new Error('Not authenticated');
      const uid = authData.user.id;

      const payload = {
        user_id: uid,
        display_name: data.fullName.trim(),
        age: Number(data.age),
        gender: data.gender,
        height: Number(data.heightCm),
        weight: Number(data.massKg),
        activity_level: data.activityLevel,
        fitness_goal: data.fitnessGoal,
        target_weight: Number(data.targetWeightKg),
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(payload as any, { onConflict: 'user_id' });
      if (error) throw error;

      toast.success('Elite plan initialized.');
      onComplete();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 60 : -60 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -60 : 60 }),
  };

  const progressPct = ((step + 1) / TOTAL) * 100;
  const meta = STEP_META[step];
  const isLast = step === TOTAL - 1;

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-[#0A0A0A] relative overflow-hidden">
      {/* Ambient glow */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-[60vw] h-[60vw] rounded-full bg-[#CCFF00]/[0.04] blur-3xl" />
        <div className="absolute bottom-0 -right-1/4 w-[50vw] h-[50vw] rounded-full bg-[#CCFF00]/[0.03] blur-3xl" />
      </div>

      {/* Progress */}
      <div className="relative z-10 px-6 pt-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#CCFF00]">{meta.kicker}</p>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Step {step + 1} of {TOTAL}</p>
        </div>
        <div className="relative h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[#CCFF00]"
            style={{ boxShadow: '0 0 18px #CCFF00, 0 0 32px rgba(204,255,0,0.5)' }}
            initial={false}
            animate={{ width: `${progressPct}%` }}
            transition={{ type: 'spring', stiffness: 180, damping: 22 }}
          />
        </div>
      </div>

      {/* Header text */}
      <div className="relative z-10 px-6 pt-8 pb-6">
        <h1 className="text-3xl font-black text-white tracking-tight uppercase">{meta.title}</h1>
        <p className="text-sm text-white/50 mt-1">{meta.sub}</p>
      </div>

      {/* Steps */}
      <div className="relative z-10 flex-1 px-6 overflow-y-auto pb-32">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'tween', duration: 0.28, ease: 'easeOut' }}
            className="space-y-6"
          >
            {step === 0 && (
              <>
                <NeonField label="Full Name">
                  <input
                    type="text"
                    value={data.fullName}
                    onChange={e => set('fullName', e.target.value)}
                    placeholder="e.g. Alex Carter"
                    className={inputClass}
                    autoFocus
                  />
                </NeonField>
                <NeonField label="Age" unit="years">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={data.age}
                    onChange={e => set('age', e.target.value)}
                    placeholder="28"
                    className={inputClass}
                  />
                </NeonField>
                <NeonField label="Gender">
                  <Segmented<Gender>
                    value={data.gender}
                    onChange={v => set('gender', v)}
                    options={[
                      { label: 'Male', value: 'Male' },
                      { label: 'Female', value: 'Female' },
                    ]}
                  />
                </NeonField>
              </>
            )}

            {step === 1 && (
              <>
                <NeonField label="Height" unit="cm">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={data.heightCm}
                    onChange={e => set('heightCm', e.target.value)}
                    placeholder="175"
                    className={inputClass}
                    autoFocus
                  />
                </NeonField>
                <NeonField label="Current Weight" unit="kg">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={data.massKg}
                    onChange={e => set('massKg', e.target.value)}
                    placeholder="72"
                    className={inputClass}
                  />
                </NeonField>
              </>
            )}

            {step === 2 && (
              <>
                <NeonField label="Activity Level">
                  <Segmented<Activity>
                    value={data.activityLevel}
                    onChange={v => set('activityLevel', v)}
                    options={[
                      { label: 'Sedentary', value: 'Sedentary' },
                      { label: 'Light', value: 'Light' },
                      { label: 'Active', value: 'Active' },
                      { label: 'Athlete', value: 'Athlete' },
                    ]}
                  />
                </NeonField>
                <NeonField label="Primary Goal">
                  <Segmented<Goal>
                    value={data.fitnessGoal}
                    onChange={v => set('fitnessGoal', v)}
                    options={[
                      { label: 'Weight Loss', value: 'Weight Loss' },
                      { label: 'Maintain', value: 'Maintain' },
                      { label: 'Muscle Gain', value: 'Muscle Gain' },
                    ]}
                  />
                </NeonField>
                <NeonField label="Target Weight" unit="kg">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={data.targetWeightKg}
                    onChange={e => set('targetWeightKg', e.target.value)}
                    placeholder="68"
                    className={inputClass}
                  />
                </NeonField>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer nav */}
      <div className="fixed bottom-0 inset-x-0 z-20 px-6 pt-4 pb-8 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/95 to-transparent">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0 || saving}
            className="flex-1 py-4 rounded-xl border border-white/10 bg-[#0F0F0F] text-white/70 font-black text-xs uppercase tracking-[0.25em] flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <button
            type="button"
            onClick={isLast ? handleFinish : goNext}
            disabled={!canProceed() || saving}
            className="flex-[1.4] py-4 rounded-xl bg-[#CCFF00] text-black font-black text-xs uppercase tracking-[0.25em] flex items-center justify-center gap-2 shadow-[0_0_30px_-4px_#CCFF00] disabled:bg-white/10 disabled:text-white/30 disabled:shadow-none disabled:cursor-not-allowed transition-all"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Saving...
              </>
            ) : isLast ? (
              <>Initialize Elite Plan</>
            ) : (
              <>
                Next <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingScreen;
