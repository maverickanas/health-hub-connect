import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Ruler, Weight, Calendar, ArrowRight, ArrowLeft, Check, Loader2,
  Flame, Dumbbell, Sofa, Activity, Zap, Camera, Upload, X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';

interface OnboardingScreenProps {
  userId: string;
  userName: string;
  onComplete: () => void;
}

type FormData = {
  name: string;
  age: string;
  height: string;
  weight: string;
  goal: '' | 'Weight Loss' | 'Muscle Gain';
  activityLevel: '' | 'Sedentary' | 'Moderately Active' | 'Highly Active';
  avatar: string | null; // dataURL of cropped image
};

const STEP_TITLES = [
  { kicker: 'STEP 01', title: 'IDENTIFY YOURSELF', sub: 'Let us know who you are.' },
  { kicker: 'STEP 02', title: 'CALIBRATE BIOMETRICS', sub: 'Precision powers your protocol.' },
  { kicker: 'STEP 03', title: 'SET YOUR PROTOCOL', sub: 'Define your primary mission.' },
  { kicker: 'STEP 04', title: 'ACTIVITY BASELINE', sub: 'How active is your daily life?' },
  { kicker: 'STEP 05', title: 'UPLOAD AVATAR', sub: 'Optional — make it yours.' },
];

const TOTAL = STEP_TITLES.length;

// ────────────────────────────────────────────────────────────
// Avatar Crop Editor (pure React, no external dep)
// ────────────────────────────────────────────────────────────
const CROP_SIZE = 240; // visible circle diameter in px

interface AvatarCropEditorProps {
  src: string;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}

const AvatarCropEditor: React.FC<AvatarCropEditorProps> = ({ src, onSave, onCancel }) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; baseX: number; baseY: number }>({
    active: false, startX: 0, startY: 0, baseX: 0, baseY: 0,
  });
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load image to know natural dims and compute initial scale to cover circle
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const minSide = Math.min(img.naturalWidth, img.naturalHeight);
      const baseScale = CROP_SIZE / minSide; // scale that makes shorter side fill circle
      setImgSize({ w: img.naturalWidth * baseScale, h: img.naturalHeight * baseScale });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.src = src;
  }, [src]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true, startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y,
    };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset({ x: dragRef.current.baseX + dx, y: dragRef.current.baseY + dy });
  };
  const onPointerUp = () => { dragRef.current.active = false; };

  const handleSave = useCallback(() => {
    if (!imgRef.current || !imgSize.w) return;
    const canvas = document.createElement('canvas');
    const out = 512;
    canvas.width = out; canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clip to circle
    ctx.beginPath();
    ctx.arc(out / 2, out / 2, out / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Compute drawn-image rect in editor space (centered + offset, scaled by zoom)
    const dispW = imgSize.w * zoom;
    const dispH = imgSize.h * zoom;
    const dispX = (CROP_SIZE - dispW) / 2 + offset.x; // top-left in editor
    const dispY = (CROP_SIZE - dispH) / 2 + offset.y;

    // Map editor-space (CROP_SIZE) → output-space (out)
    const k = out / CROP_SIZE;
    ctx.drawImage(imgRef.current, dispX * k, dispY * k, dispW * k, dispH * k);

    onSave(canvas.toDataURL('image/jpeg', 0.9));
  }, [imgSize, zoom, offset, onSave]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6"
    >
      <button
        onClick={onCancel}
        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-foreground/70 hover:text-foreground"
        aria-label="Cancel crop"
      >
        <X size={18} />
      </button>

      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#CCFF00] mb-2">POSITION & ZOOM</p>
      <h3 className="text-lg font-black uppercase tracking-wider text-foreground mb-6">Frame Your Avatar</h3>

      {/* Crop stage */}
      <div
        className="relative select-none touch-none cursor-grab active:cursor-grabbing"
        style={{ width: CROP_SIZE, height: CROP_SIZE }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Image layer */}
        <div
          className="absolute inset-0 overflow-hidden rounded-full"
          style={{ boxShadow: '0 0 40px rgba(204,255,0,0.25), inset 0 0 0 2px #CCFF00' }}
        >
          <img
            ref={imgRef}
            src={src}
            alt="Avatar source"
            draggable={false}
            style={{
              position: 'absolute',
              left: '50%', top: '50%',
              width: imgSize.w, height: imgSize.h,
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
              transformOrigin: 'center center',
              maxWidth: 'none', pointerEvents: 'none',
            }}
          />
        </div>

        {/* Grid hint */}
        <div className="absolute inset-0 rounded-full pointer-events-none border border-white/10" />
      </div>

      {/* Zoom slider */}
      <div className="w-full max-w-xs mt-8 space-y-3">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
          <span>ZOOM</span>
          <span className="text-[#CCFF00]">{zoom.toFixed(2)}×</span>
        </div>
        <Slider
          value={[zoom]}
          min={1} max={3} step={0.01}
          onValueChange={(v) => setZoom(v[0])}
        />
      </div>

      <div className="flex gap-3 mt-8 w-full max-w-xs">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-2xl border border-white/10 text-muted-foreground font-black text-[11px] uppercase tracking-[0.25em]"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex-1 py-3 rounded-2xl bg-[#CCFF00] text-black font-black text-[11px] uppercase tracking-[0.25em] shadow-[0_0_30px_rgba(204,255,0,0.45)]"
        >
          Save Avatar
        </button>
      </div>
    </motion.div>
  );
};

// ────────────────────────────────────────────────────────────
// Sleek bottom-border text input
// ────────────────────────────────────────────────────────────
interface NeonInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  unit?: string;
  label: string;
}
const NeonInput: React.FC<NeonInputProps> = ({ icon, unit, label, ...props }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">{label}</label>
      <div className={`relative flex items-center gap-3 pb-2 border-b transition-all ${focused ? 'border-[#CCFF00] shadow-[0_2px_20px_-8px_#CCFF00]' : 'border-white/10'}`}>
        {icon && <span className={`transition-colors ${focused ? 'text-[#CCFF00]' : 'text-muted-foreground'}`}>{icon}</span>}
        <input
          {...props}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
          className="flex-1 bg-transparent outline-none text-foreground text-base font-semibold placeholder:text-muted-foreground/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {unit && <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────
// Selectable card (goal / activity)
// ────────────────────────────────────────────────────────────
interface ChoiceCardProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  layout?: 'horizontal' | 'vertical';
}
const ChoiceCard: React.FC<ChoiceCardProps> = ({ active, onClick, icon, title, subtitle, layout = 'vertical' }) => (
  <motion.button
    type="button"
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className={`w-full text-left rounded-2xl border backdrop-blur-xl transition-all ${
      active
        ? 'bg-[#CCFF00]/10 border-[#CCFF00] shadow-[0_0_30px_rgba(204,255,0,0.25)]'
        : 'bg-white/[0.03] border-white/10 hover:border-white/20'
    } ${layout === 'horizontal' ? 'p-4 flex items-center gap-4' : 'p-5 flex flex-col items-center text-center gap-3'}`}
  >
    <div className={`flex items-center justify-center rounded-xl transition-colors ${
      layout === 'horizontal' ? 'w-12 h-12 shrink-0' : 'w-14 h-14'
    } ${active ? 'bg-[#CCFF00] text-black' : 'bg-white/5 text-foreground/70'}`}>
      {icon}
    </div>
    <div className={layout === 'horizontal' ? 'flex-1 min-w-0' : ''}>
      <p className={`font-black uppercase tracking-[0.2em] text-sm ${active ? 'text-[#CCFF00]' : 'text-foreground'}`}>{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
    {active && layout === 'horizontal' && (
      <div className="w-7 h-7 rounded-full bg-[#CCFF00] text-black flex items-center justify-center shrink-0">
        <Check size={14} strokeWidth={3} />
      </div>
    )}
  </motion.button>
);

// ────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────
const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ userId, userName, onComplete }) => {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = next, -1 = back
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null); // image awaiting crop

  const [formData, setFormData] = useState<FormData>({
    name: userName === 'Elite' ? '' : userName,
    age: '',
    height: '',
    weight: '',
    goal: '',
    activityLevel: '',
    avatar: null,
  });
  const update = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  const canProceed = () => {
    if (step === 0) return formData.name.trim().length > 0;
    if (step === 1) return Number(formData.age) > 0 && Number(formData.height) > 50 && Number(formData.weight) > 20;
    if (step === 2) return formData.goal !== '';
    if (step === 3) return formData.activityLevel !== '';
    return true; // avatar optional
  };

  const goNext = () => { setDirection(1); setStep(s => Math.min(TOTAL - 1, s + 1)); };
  const goBack = () => { setDirection(-1); setStep(s => Math.max(0, s - 1)); };

  const handleFilePick = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file'); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error('Image must be under 8MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setPendingImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const dataURLtoBlob = (dataURL: string): Blob => {
    const [meta, b64] = dataURL.split(',');
    const mime = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
    const binary = atob(b64);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!formData.avatar) return null;
    try {
      const blob = dataURLtoBlob(formData.avatar);
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('avatars').upload(path, blob, {
        contentType: 'image/jpeg', upsert: true,
      });
      if (error) throw error;
      // Bucket is private — store the storage path; signed URLs are resolved on read.
      return path;
    } catch (err: any) {
      toast.error('Avatar upload failed: ' + (err.message || 'unknown'));
      return null;
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const avatarUrl = await uploadAvatar();
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: formData.name.trim() || 'Elite',
          age: Number(formData.age) || 25,
          height: Number(formData.height) || 170,
          weight: Number(formData.weight) || 70,
          fitness_goal: formData.goal || 'Maintain',
          activity_level: formData.activityLevel || 'Moderately Active',
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        } as any)
        .eq('user_id', userId);
      if (error) throw error;
      toast.success('Profile calibrated. Welcome to HEALTHY.HUB.');
      onComplete();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSkipAvatar = () => {
    update('avatar', null);
    handleFinish();
  };

  const slideVariants = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 60 : -60 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -60 : 60 }),
  };

  const progressPct = ((step + 1) / TOTAL) * 100;

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-[#0A0A0A] relative overflow-hidden">
      {/* Ambient glow background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-[60vw] h-[60vw] rounded-full bg-[#CCFF00]/[0.04] blur-3xl" />
        <div className="absolute bottom-0 -right-1/4 w-[50vw] h-[50vw] rounded-full bg-[#CCFF00]/[0.03] blur-3xl" />
      </div>

      {/* Glowing progress bar */}
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

        {/* Required biometrics indicator — shows which core fields are still missing */}
        {(() => {
          const items = [
            { key: 'height', label: 'Height', filled: Number(formData.height) > 50, icon: <Ruler size={11} /> },
            { key: 'weight', label: 'Weight', filled: Number(formData.weight) > 20, icon: <Weight size={11} /> },
            { key: 'age',    label: 'Age',    filled: Number(formData.age) > 0,    icon: <Calendar size={11} /> },
          ];
          const filledCount = items.filter(i => i.filled).length;
          return (
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {items.map(it => (
                  <motion.div
                    key={it.key}
                    layout
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-[0.2em] transition-all ${
                      it.filled
                        ? 'bg-[#CCFF00]/10 border-[#CCFF00]/40 text-[#CCFF00] shadow-[0_0_12px_rgba(204,255,0,0.2)]'
                        : 'bg-white/[0.02] border-white/10 text-muted-foreground/60'
                    }`}
                  >
                    {it.filled ? <Check size={10} strokeWidth={3} /> : it.icon}
                    <span>{it.label}</span>
                  </motion.div>
                ))}
              </div>
              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/70 shrink-0">
                <span className={filledCount === items.length ? 'text-[#CCFF00]' : 'text-foreground/80'}>
                  {filledCount}
                </span>
                <span>/{items.length} Bio</span>
              </p>
            </div>
          );
        })()}
      </div>

      {/* Step content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="bg-white/[0.03] backdrop-blur-xl rounded-[28px] p-7 border border-white/10 space-y-6"
            >
              <div>
                <h2 className="text-2xl font-black text-foreground uppercase tracking-wider leading-tight">
                  {STEP_TITLES[step].title}
                </h2>
                <p className="text-xs text-muted-foreground mt-1.5">{STEP_TITLES[step].sub}</p>
              </div>

              {/* STEP 1: Name */}
              {step === 0 && (
                <div className="space-y-6 pt-2">
                  <NeonInput
                    label="Your Name"
                    icon={<User size={16} />}
                    type="text"
                    value={formData.name}
                    onChange={(e) => update('name', e.target.value)}
                    placeholder="What should we call you?"
                    autoFocus
                  />
                </div>
              )}

              {/* STEP 2: Biometrics */}
              {step === 1 && (
                <div className="space-y-5 pt-2">
                  <NeonInput
                    label="Age"
                    icon={<Calendar size={16} />}
                    type="number"
                    inputMode="numeric"
                    value={formData.age}
                    onChange={(e) => update('age', e.target.value)}
                    placeholder="28"
                    unit="YRS"
                  />
                  <div className="grid grid-cols-2 gap-5">
                    <NeonInput
                      label="Height"
                      icon={<Ruler size={16} />}
                      type="number"
                      inputMode="numeric"
                      value={formData.height}
                      onChange={(e) => update('height', e.target.value)}
                      placeholder="175"
                      unit="CM"
                    />
                    <NeonInput
                      label="Weight"
                      icon={<Weight size={16} />}
                      type="number"
                      inputMode="decimal"
                      value={formData.weight}
                      onChange={(e) => update('weight', e.target.value)}
                      placeholder="70"
                      unit="KG"
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: Goal */}
              {step === 2 && (
                <div className="grid grid-cols-1 gap-3 pt-2">
                  <ChoiceCard
                    active={formData.goal === 'Weight Loss'}
                    onClick={() => update('goal', 'Weight Loss')}
                    icon={<Flame size={26} strokeWidth={2.2} />}
                    title="Weight Loss"
                    subtitle="Burn fat and lean out."
                  />
                  <ChoiceCard
                    active={formData.goal === 'Muscle Gain'}
                    onClick={() => update('goal', 'Muscle Gain')}
                    icon={<Dumbbell size={26} strokeWidth={2.2} />}
                    title="Muscle & Mass"
                    subtitle="Build strength and increase mass."
                  />
                </div>
              )}

              {/* STEP 4: Activity Level */}
              {step === 3 && (
                <div className="space-y-3 pt-2">
                  <ChoiceCard
                    layout="horizontal"
                    active={formData.activityLevel === 'Sedentary'}
                    onClick={() => update('activityLevel', 'Sedentary')}
                    icon={<Sofa size={22} />}
                    title="Sedentary"
                    subtitle="Desk job, little movement."
                  />
                  <ChoiceCard
                    layout="horizontal"
                    active={formData.activityLevel === 'Moderately Active'}
                    onClick={() => update('activityLevel', 'Moderately Active')}
                    icon={<Activity size={22} />}
                    title="Moderately Active"
                    subtitle="On feet often, light workouts."
                  />
                  <ChoiceCard
                    layout="horizontal"
                    active={formData.activityLevel === 'Highly Active'}
                    onClick={() => update('activityLevel', 'Highly Active')}
                    icon={<Zap size={22} />}
                    title="Highly Active"
                    subtitle="Athlete, intense daily activity."
                  />
                </div>
              )}

              {/* STEP 5: Avatar */}
              {step === 4 && (
                <div className="flex flex-col items-center pt-2 space-y-5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="relative group"
                    aria-label="Upload avatar"
                  >
                    <div
                      className="w-32 h-32 rounded-full bg-white/[0.04] border-2 border-dashed border-white/15 flex items-center justify-center overflow-hidden transition-all group-hover:border-[#CCFF00]/60"
                      style={formData.avatar ? { boxShadow: '0 0 30px rgba(204,255,0,0.35)', borderStyle: 'solid', borderColor: '#CCFF00' } : undefined}
                    >
                      {formData.avatar ? (
                        <img src={formData.avatar} alt="Avatar preview" className="w-full h-full object-cover" />
                      ) : (
                        <Camera size={32} className="text-muted-foreground group-hover:text-[#CCFF00] transition-colors" />
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[#CCFF00] text-black flex items-center justify-center shadow-[0_0_20px_rgba(204,255,0,0.6)]">
                      <Upload size={14} strokeWidth={2.5} />
                    </div>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { handleFilePick(e.target.files?.[0] ?? null); e.target.value = ''; }}
                  />
                  <p className="text-xs text-muted-foreground text-center max-w-[18rem]">
                    {formData.avatar ? 'Looking good. Tap the photo to choose a different image.' : 'Tap the circle to upload an image. You can crop, zoom and reposition it.'}
                  </p>
                </div>
              )}

              {/* Navigation */}
              <div className="pt-2">
                {step < TOTAL - 1 ? (
                  <div className="flex gap-3">
                    {step > 0 && (
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={goBack}
                        className="px-5 py-4 rounded-2xl border border-white/10 text-muted-foreground font-black text-[11px] uppercase tracking-[0.25em] flex items-center justify-center gap-2"
                      >
                        <ArrowLeft size={14} />
                      </motion.button>
                    )}
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={goNext}
                      disabled={!canProceed()}
                      className="flex-1 py-4 rounded-2xl bg-[#CCFF00] text-black font-black text-[11px] uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,255,0,0.35)] disabled:opacity-30 disabled:shadow-none transition-all"
                    >
                      Next Step <ArrowRight size={14} />
                    </motion.button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleFinish}
                      disabled={saving}
                      className="w-full py-4 rounded-2xl bg-[#CCFF00] text-black font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-[0_0_40px_rgba(204,255,0,0.45)] disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
                      {saving ? 'Calibrating…' : 'Finish Setup'}
                    </motion.button>
                    <button
                      onClick={handleSkipAvatar}
                      disabled={saving}
                      className="w-full text-[11px] font-bold uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      Skip this step
                    </button>
                    {step > 0 && (
                      <button
                        onClick={goBack}
                        disabled={saving}
                        className="w-full text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/60 hover:text-muted-foreground transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <ArrowLeft size={11} /> Back
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Avatar crop modal */}
      <AnimatePresence>
        {pendingImage && (
          <AvatarCropEditor
            src={pendingImage}
            onCancel={() => setPendingImage(null)}
            onSave={(dataUrl) => {
              update('avatar', dataUrl);
              setPendingImage(null);
              toast.success('Avatar saved');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default OnboardingScreen;
