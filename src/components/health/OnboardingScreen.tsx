import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Ruler, Weight, Calendar, ArrowRight, ArrowLeft, Loader2,
  Flame, Dumbbell, Sofa, Activity, Zap, Target, Heart, Check,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OnboardingScreenProps {
  userId: string;
  userName: string;
  onComplete: () => void;
}

type Gender = '' | 'Male' | 'Female' | 'Other';
type ActivityLevel = '' | 'Sedentary' | 'Light' | 'Moderate' | 'Active';
type FitnessGoal = '' | 'Weight Loss' | 'Maintain' | 'Muscle Gain';

type FormData = {
  name: string;
  gender: Gender;
  age: string;
  height: string;
  weight: string;
  activityLevel: ActivityLevel;
  goal: FitnessGoal;
};

const STEP_TITLES = [
  { kicker: 'STEP 01', title: 'IDENTITY',   sub: 'Tell us who you are.' },
  { kicker: 'STEP 02', title: 'BIOMETRICS', sub: 'Precision powers your protocol.' },
  { kicker: 'STEP 03', title: 'PROTOCOL',   sub: 'Define your primary mission.' },
];
const TOTAL = STEP_TITLES.length;

// ────────────────────────────────────────────────────────────
// Glassmorphic input
// ────────────────────────────────────────────────────────────
interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  unit?: string;
  label: string;
}
const GlassInput: React.FC<GlassInputProps> = ({ icon, unit, label, ...props }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">{label}</label>
    <div className="relative flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus-within:border-[#CCFF00] focus-within:ring-1 focus-within:ring-[#CCFF00] transition-all">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <input
        {...props}
        className="flex-1 bg-transparent outline-none text-white text-lg font-semibold placeholder:text-muted-foreground/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {unit && <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{unit}</span>}
    </div>
  </div>
);

// ────────────────────────────────────────────────────────────
// Selectable card
// ────────────────────────────────────────────────────────────
interface ChoiceCardProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}
const ChoiceCard: React.FC<ChoiceCardProps> = ({ active, onClick, icon, title, subtitle }) => (
  <motion.button
    type="button"
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className={`w-full text-left rounded-2xl border backdrop-blur-xl transition-all p-4 flex items-center gap-4 ${
      active
        ? 'bg-[#CCFF00]/10 border-[#CCFF00] shadow-[0_0_30px_rgba(204,255,0,0.25)]'
        : 'bg-white/[0.03] border-white/10 hover:border-white/20'
    }`}
  >
    <div className={`flex items-center justify-center rounded-xl w-12 h-12 shrink-0 ${
      active ? 'bg-[#CCFF00] text-black' : 'bg-white/5 text-foreground/70'
    }`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className={`font-black uppercase tracking-[0.2em] text-sm ${active ? 'text-[#CCFF00]' : 'text-white'}`}>{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    {active && (
      <div className="w-7 h-7 rounded-full bg-[#CCFF00] text-black flex items-center justify-center shrink-0">
        <Check size={14} strokeWidth={3} />
      </div>
    )}
  </motion.button>
);

// ────────────────────────────────────────────────────────────
// Gender pill
// ────────────────────────────────────────────────────────────
const GenderPill: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
  <motion.button
    type="button"
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`flex-1 py-3 rounded-xl border text-xs font-black uppercase tracking-[0.25em] transition-all ${
      active
        ? 'bg-[#CCFF00] border-[#CCFF00] text-black shadow-[0_0_20px_rgba(204,255,0,0.4)]'
        : 'bg-white/5 border-white/10 text-foreground/70 hover:border-white/20'
    }`}
  >
    {label}
  </motion.button>
);

// ────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────
const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ userId, userName, onComplete }) => {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: userName && userName !== 'Elite' && userName !== 'Guest' ? userName : '',
    gender: '',
    age: '',
    height: '',
    weight: '',
    activityLevel: '',
    goal: '',
  });

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  const canProceed = () => {
    if (step === 0) return formData.name.trim().length > 0 && formData.gender !== '';
    if (step === 1) return Number(formData.age) > 0 && Number(formData.height) > 50 && Number(formData.weight) > 20;
    if (step === 2) return formData.activityLevel !== '' && formData.goal !== '';
    return false;
  };

  const goNext = () => { setDirection(1); setStep(s => Math.min(TOTAL - 1, s + 1)); };
  const goBack = () => { setDirection(-1); setStep(s => Math.max(0, s - 1)); };

  const handleFinish = async () => {
    if (!canProceed() || saving) return;
    setSaving(true);
    try {
      // Always resolve the authenticated user fresh per spec.
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData.user) throw authErr || new Error('Not authenticated');
      const uid = authData.user.id;

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: formData.name.trim(),
          gender: formData.gender,
          age: Number(formData.age),
          height: Number(formData.height),
          weight: Number(formData.weight),
          activity_level: formData.activityLevel,
          fitness_goal: formData.goal,
        })
        .eq('user_id', uid);

      if (error) throw error;

      toast.success('Profile initialized. Welcome to HEALTHY.HUB.');
      onComplete();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 60 : -60 }),
    center: { opacity: 1, x: 0 },
    exit:  (dir: number) => ({ opacity: 0, x: dir > 0 ? -60 : 60 }),
  };

  const progressPct = ((step + 1) / TOTAL) * 100;
  const isLast = step === TOTAL - 1;

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-[#0A0A0A] relative overflow-hidden">
      {/* Ambient glow */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-[60vw] h-[60vw] rounded-full bg-[#CCFF00]/[0.04] blur-3xl" />
        <div className="absolute bottom-0 -right-1/4 w-[50vw] h-[50vw] rounded-full bg-[#CCFF00]/[0.03] blur-3xl" />
      </div>

      {/* Glowing progress */}
      <div className="relative z-10 px-6 pt-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#CCFF00]">{STEP_TITLES[step].kicker}</p>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">{step + 1} / {TOTAL}</p>
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

      {/* Step content */}
      <div className="relative z-10 flex-1 px-6 pt-8 pb-6 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-black uppercase tracking-wider text-white">{STEP_TITLES[step].title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{STEP_TITLES[step].sub}</p>
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
            className="space-y-5"
          >
            {/* STEP 1 — IDENTITY */}
            {step === 0 && (
              <>
                <GlassInput
                  label="Display Name"
                  icon={<User size={18} />}
                  placeholder="e.g. Anas"
                  value={formData.name}
                  onChange={(e) => update('name', e.target.value)}
                  maxLength={40}
                />
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Gender</label>
                  <div className="flex gap-2">
                    {(['Male', 'Female', 'Other'] as const).map(g => (
                      <GenderPill key={g} label={g} active={formData.gender === g} onClick={() => update('gender', g)} />
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* STEP 2 — BIOMETRICS */}
            {step === 1 && (
              <>
                <GlassInput
                  label="Age" unit="years" icon={<Calendar size={18} />}
                  type="number" inputMode="numeric" placeholder="25"
                  value={formData.age}
                  onChange={(e) => update('age', e.target.value)}
                />
                <GlassInput
                  label="Height" unit="cm" icon={<Ruler size={18} />}
                  type="number" inputMode="decimal" placeholder="170"
                  value={formData.height}
                  onChange={(e) => update('height', e.target.value)}
                />
                <GlassInput
                  label="Weight" unit="kg" icon={<Weight size={18} />}
                  type="number" inputMode="decimal" placeholder="70"
                  value={formData.weight}
                  onChange={(e) => update('weight', e.target.value)}
                />
              </>
            )}

            {/* STEP 3 — PROTOCOL */}
            {step === 2 && (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Activity Level</label>
                  <div className="space-y-2">
                    <ChoiceCard active={formData.activityLevel === 'Sedentary'} onClick={() => update('activityLevel', 'Sedentary')}
                      icon={<Sofa size={20} />} title="Sedentary" subtitle="Little to no exercise" />
                    <ChoiceCard active={formData.activityLevel === 'Light'} onClick={() => update('activityLevel', 'Light')}
                      icon={<Activity size={20} />} title="Light" subtitle="1–3 days / week" />
                    <ChoiceCard active={formData.activityLevel === 'Moderate'} onClick={() => update('activityLevel', 'Moderate')}
                      icon={<Zap size={20} />} title="Moderate" subtitle="3–5 days / week" />
                    <ChoiceCard active={formData.activityLevel === 'Active'} onClick={() => update('activityLevel', 'Active')}
                      icon={<Flame size={20} />} title="Active" subtitle="6–7 days / week" />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Fitness Goal</label>
                  <div className="space-y-2">
                    <ChoiceCard active={formData.goal === 'Weight Loss'} onClick={() => update('goal', 'Weight Loss')}
                      icon={<Target size={20} />} title="Weight Loss" subtitle="Shed fat, stay lean" />
                    <ChoiceCard active={formData.goal === 'Maintain'} onClick={() => update('goal', 'Maintain')}
                      icon={<Heart size={20} />} title="Maintain" subtitle="Stay where you are" />
                    <ChoiceCard active={formData.goal === 'Muscle Gain'} onClick={() => update('goal', 'Muscle Gain')}
                      icon={<Dumbbell size={20} />} title="Muscle Gain" subtitle="Build strength & mass" />
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Nav buttons */}
      <div className="relative z-10 px-6 pb-8 pt-4 flex items-center gap-3 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A] to-transparent">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0 || saving}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl text-muted-foreground hover:text-white text-[11px] font-black uppercase tracking-[0.25em] disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <button
          type="button"
          onClick={isLast ? handleFinish : goNext}
          disabled={!canProceed() || saving}
          className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#CCFF00] text-black font-black text-[12px] uppercase tracking-[0.25em] shadow-[0_0_30px_rgba(204,255,0,0.45)] disabled:opacity-30 disabled:shadow-none disabled:pointer-events-none transition-all"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Initializing…
            </>
          ) : isLast ? (
            <>Initialize Profile <ArrowRight size={14} /></>
          ) : (
            <>Next Step <ArrowRight size={14} /></>
          )}
        </button>
      </div>
    </div>
  );
};

export default OnboardingScreen;
