import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Ruler, Weight, Calendar, Activity, Target, ArrowRight, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OnboardingScreenProps {
  userId: string;
  userName: string;
  onComplete: () => void;
}

const ACTIVITY_LEVELS = ['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active'];
const FITNESS_GOALS = ['Weight Loss', 'Maintain', 'Muscle Gain'];
const GENDERS = ['Male', 'Female', 'Other'];

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ userId, userName, onComplete }) => {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState(userName === 'Elite' ? '' : userName);
  const [height, setHeight] = useState<number | ''>('');
  const [weight, setWeight] = useState<number | ''>('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState('Male');
  const [activityLevel, setActivityLevel] = useState('Lightly Active');
  const [fitnessGoal, setFitnessGoal] = useState('Maintain');

  const steps = [
    { title: 'Your Identity', subtitle: 'Tell us about yourself' },
    { title: 'Body Metrics', subtitle: 'For accurate tracking' },
    { title: 'Your Goals', subtitle: 'We\'ll personalize your experience' },
  ];

  const canProceed = () => {
    if (step === 0) return displayName.trim().length > 0 && age !== '';
    if (step === 1) return height !== '' && weight !== '' && Number(height) > 50 && Number(weight) > 20;
    return true;
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || 'Elite',
          height: Number(height) || 170,
          weight: Number(weight) || 70,
          age: Number(age) || 25,
          gender,
          activity_level: activityLevel,
          fitness_goal: fitnessGoal,
        } as any)
        .eq('user_id', userId);
      if (error) throw error;
      toast.success('Profile set up! Let\'s go 🚀');
      onComplete();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background relative overflow-hidden">
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_center,_hsl(0_0%_10%)_0%,_hsl(0_0%_0%)_100%)] pointer-events-none" />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i <= step ? 'w-10 bg-luxury-neon' : 'w-6 bg-muted'}`} />
          ))}
        </div>

        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="glass-panel rounded-[24px] p-8 border border-border space-y-6"
            >
              <div className="text-center">
                <p className="text-[9px] font-extrabold text-luxury-neon/60 uppercase tracking-[0.4em]">Step {step + 1} of {steps.length}</p>
                <h2 className="text-xl font-black text-foreground uppercase tracking-wider mt-2">{steps[step].title}</h2>
                <p className="text-xs text-muted-foreground mt-1">{steps[step].subtitle}</p>
              </div>

              {step === 0 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Display Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="What should we call you?"
                        className="w-full bg-muted border border-border rounded-2xl pl-11 pr-4 py-4 text-sm text-foreground outline-none focus:border-luxury-neon/50 transition-all placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Age</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          type="number"
                          value={age}
                          onChange={(e) => setAge(e.target.value ? Number(e.target.value) : '')}
                          placeholder="Age"
                          className="w-full bg-muted border border-border rounded-2xl pl-11 pr-4 py-4 text-sm text-foreground outline-none focus:border-luxury-neon/50 transition-all placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Gender</label>
                      <div className="grid grid-cols-1 gap-1.5">
                        {GENDERS.map(g => (
                          <button
                            key={g}
                            onClick={() => setGender(g)}
                            className={`py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${gender === g ? 'bg-luxury-neon text-primary-foreground border-luxury-neon/50' : 'bg-muted text-muted-foreground border-transparent'}`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Height (CM)</label>
                    <div className="relative">
                      <Ruler className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="number"
                        value={height}
                        onChange={(e) => setHeight(e.target.value ? Number(e.target.value) : '')}
                        placeholder="e.g. 175"
                        className="w-full bg-muted border border-border rounded-2xl pl-11 pr-4 py-4 text-sm text-foreground outline-none focus:border-luxury-neon/50 transition-all placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Weight (KG)</label>
                    <div className="relative">
                      <Weight className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="number"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value ? Number(e.target.value) : '')}
                        placeholder="e.g. 70"
                        className="w-full bg-muted border border-border rounded-2xl pl-11 pr-4 py-4 text-sm text-foreground outline-none focus:border-luxury-neon/50 transition-all placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Activity Level</label>
                    <div className="grid grid-cols-2 gap-2">
                      {ACTIVITY_LEVELS.map(level => (
                        <button
                          key={level}
                          onClick={() => setActivityLevel(level)}
                          className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${activityLevel === level ? 'bg-luxury-neon text-primary-foreground border-luxury-neon/50' : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'}`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">What's your fitness goal?</label>
                    {FITNESS_GOALS.map(goal => (
                      <button
                        key={goal}
                        onClick={() => setFitnessGoal(goal)}
                        className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all border flex items-center justify-center gap-2 ${fitnessGoal === goal ? 'bg-luxury-neon text-primary-foreground border-luxury-neon/50 shadow-[0_0_20px_rgba(204,255,0,0.15)]' : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'}`}
                      >
                        {fitnessGoal === goal && <Check size={14} />}
                        {goal}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3 pt-2">
                {step > 0 && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setStep(s => s - 1)}
                    className="flex-1 py-4 rounded-2xl border border-border text-muted-foreground font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={14} /> Back
                  </motion.button>
                )}
                {step < 2 ? (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setStep(s => s + 1)}
                    disabled={!canProceed()}
                    className="flex-1 py-4 rounded-2xl bg-luxury-neon text-primary-foreground font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,255,0,0.2)] disabled:opacity-40"
                  >
                    Next <ArrowRight size={14} />
                  </motion.button>
                ) : (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleFinish}
                    disabled={saving}
                    className="flex-1 py-4 rounded-2xl bg-luxury-neon text-primary-foreground font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,255,0,0.2)] disabled:opacity-40"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    {saving ? 'Setting up...' : 'Let\'s Go!'}
                  </motion.button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default OnboardingScreen;
