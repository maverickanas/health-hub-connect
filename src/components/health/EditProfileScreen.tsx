import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Camera, Trash2, Save, Loader2, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { UserMetrics, Gender, ActivityLevel, FitnessGoal } from '@/types';
import AvatarCropperModal from './AvatarCropperModal';

interface EditProfileScreenProps {
  open: boolean;
  onClose: () => void;
  initialDisplayName: string;
  initialMetrics: UserMetrics;
  avatarUrl: string | null;
  onSaved: (next: { displayName: string; metrics: UserMetrics }) => void;
}

const ACTIVITY_LEVELS: ActivityLevel[] = ['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active'];
const FITNESS_GOALS: FitnessGoal[] = ['Weight Loss', 'Maintain', 'Muscle Gain'];
const GENDERS: Gender[] = ['Male', 'Female', 'Other'];

const EditProfileScreen: React.FC<EditProfileScreenProps> = ({
  open, onClose, initialDisplayName, initialMetrics, avatarUrl, onSaved,
}) => {
  const { user, refetchProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [metrics, setMetrics] = useState<UserMetrics>(initialMetrics);
  const [localAvatar, setLocalAvatar] = useState<string | null>(avatarUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDisplayName(initialDisplayName);
      setMetrics(initialMetrics);
      setLocalAvatar(avatarUrl);
    }
  }, [open, initialDisplayName, initialMetrics, avatarUrl]);

  const handlePickPhoto = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image too large (max 8 MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPendingImageSrc(reader.result as string);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = async (blob: Blob, previewDataUrl: string) => {
    if (!user) { toast.error('Sign in to update your photo'); return; }
    setIsUploading(true);
    try {
      const path = `${user.id}/avatar-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, {
        upsert: true, contentType: 'image/jpeg',
      });
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: path })
        .eq('user_id', user.id);
      if (dbErr) throw dbErr;
      const { data: signed } = await supabase.storage.from('avatars').createSignedUrl(path, 60 * 60);
      setLocalAvatar(signed?.signedUrl ?? previewDataUrl);
      await refetchProfile();
      toast.success('Photo updated');
      setCropperOpen(false);
      setPendingImageSrc(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload photo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!user) return;
    setIsUploading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: '' })
        .eq('user_id', user.id);
      if (error) throw error;
      setLocalAvatar(null);
      await refetchProfile();
      toast.success('Photo removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove photo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) { toast.error('Sign in to save your profile'); return; }
    setIsSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        display_name: displayName,
        height: metrics.height,
        weight: metrics.weight,
        age: metrics.age,
        gender: metrics.gender,
        activity_level: metrics.activityLevel,
        fitness_goal: metrics.fitnessGoal,
      } as any).eq('user_id', user.id);
      if (error) throw error;
      await refetchProfile();
      toast.success('Profile saved');
      onSaved({ displayName, metrics });
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 28, stiffness: 220 }}
          className="fixed inset-0 z-[150] bg-[#0A0A0A] overflow-y-auto no-scrollbar"
        >
          {/* Header */}
          <header className="sticky top-0 z-10 px-5 pt-12 pb-4 flex items-center justify-between bg-gradient-to-b from-[#0A0A0A] via-[#0A0A0A]/95 to-transparent">
            <button
              onClick={onClose}
              aria-label="Back"
              className="w-10 h-10 rounded-2xl flex items-center justify-center border border-white/10 bg-white/5 backdrop-blur-xl active:scale-95 transition-transform"
            >
              <ArrowLeft size={18} className="text-foreground" />
            </button>
            <h1 className="text-sm font-black uppercase tracking-[0.3em] text-foreground">Edit Profile</h1>
            <div className="w-10 h-10" />
          </header>

          <div className="px-5 pb-32 space-y-7">
            {/* Avatar + media controls */}
            <section className="flex flex-col items-center gap-4 pt-2">
              <div
                className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-lime-400/60 flex items-center justify-center bg-white/5"
                style={{ boxShadow: '0 0 28px rgba(204,255,0,0.35), inset 0 0 12px rgba(204,255,0,0.1)' }}
              >
                {localAvatar ? (
                  <img src={localAvatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User size={48} className="text-lime-400/80" />
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="animate-spin text-lime-400" size={22} />
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleFileChange}
              />

              <div className="flex gap-2.5 w-full max-w-xs">
                <button
                  onClick={handlePickPhoto}
                  disabled={isUploading}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-lime-400/50 bg-white/5 text-lime-400 text-[10px] font-black uppercase tracking-[0.18em] backdrop-blur-xl active:scale-[0.97] transition-transform disabled:opacity-50"
                >
                  <Camera size={13} /> Update Photo
                </button>
                <button
                  onClick={handleDeletePhoto}
                  disabled={isUploading || !localAvatar}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-lime-400/50 bg-white/5 text-lime-400 text-[10px] font-black uppercase tracking-[0.18em] backdrop-blur-xl active:scale-[0.97] transition-transform disabled:opacity-40"
                >
                  <Trash2 size={13} /> Delete Photo
                </button>
              </div>
            </section>

            {/* Display name */}
            <section className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.22em]">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm font-medium text-foreground outline-none focus:border-lime-400/50 transition-colors"
              />
            </section>

            {/* Biometrics grid */}
            <section className="space-y-3">
              <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.22em]">
                Biometrics
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Height (cm)">
                  <NumberInput
                    value={metrics.height}
                    onChange={(n) => setMetrics(p => ({ ...p, height: n }))}
                  />
                </Field>
                <Field label="Weight (kg)">
                  <NumberInput
                    value={metrics.weight}
                    onChange={(n) => setMetrics(p => ({ ...p, weight: n }))}
                  />
                </Field>
                <Field label="Age">
                  <NumberInput
                    value={metrics.age ?? 0}
                    onChange={(n) => setMetrics(p => ({ ...p, age: n }))}
                  />
                </Field>
                <Field label="Gender">
                  <select
                    value={metrics.gender || 'Male'}
                    onChange={(e) => setMetrics(p => ({ ...p, gender: e.target.value as Gender }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-lime-400/50 appearance-none cursor-pointer"
                  >
                    {GENDERS.map(g => (
                      <option key={g} value={g} className="bg-[#0A0A0A]">{g}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>

            {/* Activity level — 2x2 */}
            <section className="space-y-3">
              <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.22em]">
                Activity Level
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {ACTIVITY_LEVELS.map(level => {
                  const active = metrics.activityLevel === level;
                  return (
                    <button
                      key={level}
                      onClick={() => setMetrics(p => ({ ...p, activityLevel: level }))}
                      className={`py-3 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                        active
                          ? 'bg-lime-400 text-black border-lime-400 shadow-[0_0_15px_rgba(204,255,0,0.35)]'
                          : 'bg-white/5 text-muted-foreground border-white/10 hover:text-foreground'
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Fitness goal — 1x3 */}
            <section className="space-y-3">
              <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.22em]">
                Fitness Goal
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {FITNESS_GOALS.map(goal => {
                  const active = metrics.fitnessGoal === goal;
                  return (
                    <button
                      key={goal}
                      onClick={() => setMetrics(p => ({ ...p, fitnessGoal: goal }))}
                      className={`py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                        active
                          ? 'bg-lime-400 text-black border-lime-400 shadow-[0_0_15px_rgba(204,255,0,0.35)]'
                          : 'bg-white/5 text-muted-foreground border-white/10 hover:text-foreground'
                      }`}
                    >
                      {goal}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Sticky save button */}
          <div className="fixed left-0 right-0 bottom-0 z-10 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/95 to-transparent">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-4 rounded-2xl bg-lime-400 text-black font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(204,255,0,0.4)] disabled:opacity-60"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isSaving ? 'Saving…' : 'Save Profile'}
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.22em]">{label}</label>
    {children}
  </div>
);

const NumberInput: React.FC<{ value: number; onChange: (n: number) => void }> = ({ value, onChange }) => (
  <input
    type="number"
    inputMode="numeric"
    value={value || ''}
    onChange={(e) => onChange(Number(e.target.value))}
    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-lime-400/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
  />
);

export default EditProfileScreen;
