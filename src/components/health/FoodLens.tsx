import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Zap, X, RotateCcw, ImageIcon, Star, AlertTriangle, PenLine, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface FoodAnalysis {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  healthScore: number;
  verdict: 'Excellent' | 'Good' | 'Fair' | 'Avoid';
  advice: string;
}

interface FoodLensProps {
  onFoodLogged?: (calories: number, name: string) => void;
}

import { supabase } from '@/integrations/supabase/client';

const FoodLens: React.FC<FoodLensProps> = ({ onFoodLogged }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<FoodAnalysis | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [showManualLog, setShowManualLog] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualCalories, setManualCalories] = useState('');
  const [manualWeight, setManualWeight] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const attachStream = useCallback((stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    const tryPlay = () => {
      video.play().catch(() => {
        // Autoplay may fail silently; onPlay handler will still fire once user gestures or metadata loads.
      });
    };
    if (video.readyState >= 1) tryPlay();
    else video.onloadedmetadata = () => tryPlay();
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setIsInitializing(true);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      streamRef.current = stream;
      setCameraActive(true);
      // Wait a tick for the <video> element to mount before attaching the stream.
      requestAnimationFrame(() => attachStream(stream));
    } catch {
      setIsInitializing(false);
      toast.error('Camera access denied. Please allow camera permissions.');
    }
  }, [facingMode, attachStream]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setIsInitializing(false);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setCapturedImage(canvas.toDataURL('image/jpeg', 0.8));
    stopCamera();
  }, [stopCamera]);

  const analyzeFood = async () => {
    if (!capturedImage) return;
    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('food-analysis', {
        body: { image: capturedImage },
      });
      if (error) {
        const ctx: any = (error as any).context;
        const status = ctx?.status;
        if (status === 401) { toast.error('Please sign in to use Food Lens.'); return; }
        if (status === 429) { toast.error('Rate limit exceeded.'); return; }
        if (status === 402) { toast.error('AI credits exhausted.'); return; }
        throw new Error(error.message || 'Analysis failed');
      }
      setScanResult(data.analysis);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to analyze food');
    } finally {
      setIsScanning(false);
    }
  };

  const handleLogScannedFood = () => {
    if (scanResult && onFoodLogged) {
      onFoodLogged(scanResult.calories, scanResult.name);
      toast.success(`${scanResult.name} logged — ${scanResult.calories} kcal`);
    }
    resetAll();
  };

  const handleManualLog = () => {
    if (!manualName.trim() || !manualCalories.trim()) {
      toast.error('Name and calories are required');
      return;
    }
    let cal = parseInt(manualCalories);
    // If weight is provided, estimate calories per 100g using the given kcal as a per-100g reference
    if (manualWeight && parseInt(manualWeight) > 0) {
      cal = Math.round((cal / 100) * parseInt(manualWeight));
    }
    if (onFoodLogged) onFoodLogged(cal, manualName.trim());
    toast.success(`${manualName.trim()} logged — ${cal} kcal`);
    setManualName(''); setManualCalories(''); setManualWeight('');
    setShowManualLog(false);
  };

  const resetAll = () => { setScanResult(null); setCapturedImage(null); stopCamera(); };
  const flipCamera = () => setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));

  useEffect(() => { if (cameraActive) startCamera(); }, [facingMode]);

  const verdictColor = (v: string) => {
    switch (v) { case 'Excellent': return 'text-primary'; case 'Good': return 'text-blue-400'; case 'Fair': return 'text-amber-400'; case 'Avoid': return 'text-red-400'; default: return 'text-muted-foreground'; }
  };

  return (
    <div className="h-full w-full relative bg-black overflow-hidden">
      <canvas ref={canvasRef} className="hidden" />

      {/* Layer 0 — camera / captured photo / animated placeholder */}
      <div className="absolute inset-0 z-0">
        {cameraActive && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
        )}
        {capturedImage && !cameraActive && (
          <img
            src={capturedImage}
            alt="Captured food"
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
        )}
        {!cameraActive && !capturedImage && (
          <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
            {/* Pre-camera gradient field so the screen never looks "broken / empty" */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(120% 80% at 50% 20%, rgba(204,255,0,0.08) 0%, rgba(10,10,10,1) 55%, #050505 100%)',
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-8">
              <motion.div
                animate={{ scale: [1, 1.06, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }}
                className="w-20 h-20 rounded-3xl bg-[#CCFF00]/10 border border-[#CCFF00]/30 flex items-center justify-center shadow-[0_0_40px_rgba(204,255,0,0.25)]"
              >
                <Camera size={32} className="text-[#CCFF00]" />
              </motion.div>
              <p className="text-[10px] font-extrabold text-white/40 uppercase tracking-[0.3em]">
                Camera Standing By
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80 pointer-events-none z-[1]" />

      {(cameraActive || capturedImage) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-64 h-64">
            <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-primary rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-primary rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-primary rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-primary rounded-br-lg" />
            {isScanning && (
              <motion.div
                animate={{ y: [0, 256, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_10px_rgba(204,255,0,0.5)]"
              />
            )}
          </div>
        </div>
      )}

      <div className="absolute top-0 left-0 right-0 pt-14 px-6 text-center z-10">
        <p className="text-[9px] font-extrabold text-primary/60 uppercase tracking-[0.4em]">Biometric Scanner</p>
        <h1 className="text-lg font-black text-foreground uppercase tracking-wider mt-1">
          Food <span className="text-primary">Lens</span>
        </h1>
      </div>

      {cameraActive && (
        <div className="absolute top-14 right-4 z-20 flex flex-col gap-2">
          <button onClick={flipCamera} className="p-2.5 rounded-full glass-panel">
            <RotateCcw size={18} className="text-primary" />
          </button>
        </div>
      )}

      {isScanning && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute top-32 left-0 right-0 text-center z-10">
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Analyzing Nutrients...</p>
        </motion.div>
      )}

      <div className="absolute bottom-0 left-0 right-0 z-10">
        <AnimatePresence mode="wait">
          {scanResult ? (
            <motion.div key="result" initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className="glass-panel mx-3 mb-2 rounded-3xl p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[9px] font-extrabold text-primary uppercase tracking-[0.2em]">Analysis Complete</p>
                  <p className="text-lg font-black text-foreground mt-1">{scanResult.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-bold ${verdictColor(scanResult.verdict)}`}>{scanResult.verdict}</span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={10} className={i < Math.round(scanResult.healthScore / 2) ? 'text-primary fill-primary' : 'text-muted-foreground/30'} />
                      ))}
                    </div>
                  </div>
                </div>
                <button onClick={resetAll} className="p-1.5 rounded-lg hover:bg-muted"><X size={16} className="text-muted-foreground" /></button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'KCAL', value: scanResult.calories, color: 'text-primary' },
                  { label: 'PROTEIN', value: `${scanResult.protein}g`, color: 'text-blue-400' },
                  { label: 'CARBS', value: `${scanResult.carbs}g`, color: 'text-amber-400' },
                  { label: 'FAT', value: `${scanResult.fat}g`, color: 'text-red-400' },
                ].map((item) => (
                  <div key={item.label} className="text-center p-3 rounded-2xl bg-muted/50">
                    <p className={`text-lg font-black ${item.color}`}>{item.value}</p>
                    <p className="text-[7px] font-extrabold text-muted-foreground uppercase tracking-wider mt-1">{item.label}</p>
                  </div>
                ))}
              </div>
              {scanResult.advice && (
                <div className="flex items-start gap-2 p-3 rounded-2xl bg-muted/30">
                  <AlertTriangle size={14} className="text-primary mt-0.5 shrink-0" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{scanResult.advice}</p>
                </div>
              )}
              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.95 }} onClick={resetAll}
                  className="flex-1 py-3 rounded-2xl border border-border text-muted-foreground font-black text-xs uppercase tracking-[0.2em]">
                  Scan Again
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleLogScannedFood}
                  className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(204,255,0,0.15)]">
                  <Plus size={14} className="inline mr-1" /> Log Intake
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="controls" initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              className="glass-panel mx-3 mb-2 rounded-3xl p-5 space-y-3">
              <p className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-[0.2em] text-center">
                {capturedImage ? 'Photo Captured — Ready to Analyze' : 'Point Camera at Your Meal'}
              </p>

              {!cameraActive && !capturedImage && (
                <>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={startCamera}
                    className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,255,0,0.2)]">
                    <Camera size={16} /> Open Camera
                  </motion.button>
                  <button onClick={() => setShowManualLog(true)}
                    className="w-full py-3 rounded-2xl border border-border text-muted-foreground text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:text-foreground transition-colors">
                    <PenLine size={14} /> Manual Log
                  </button>
                </>
              )}

              {cameraActive && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={capturePhoto}
                  className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,255,0,0.2)]">
                  <Camera size={16} /> Capture
                </motion.button>
              )}

              {capturedImage && !isScanning && (
                <div className="flex gap-3">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setCapturedImage(null); startCamera(); }}
                    className="flex-1 py-4 rounded-2xl border border-muted-foreground/30 text-muted-foreground font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                    <RotateCcw size={14} /> Retake
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={analyzeFood}
                    className="flex-1 py-4 rounded-2xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,255,0,0.2)]">
                    <Zap size={14} /> Analyze
                  </motion.button>
                </div>
              )}

              {isScanning && (
                <div className="flex items-center justify-center py-4 gap-3">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                    <Zap size={16} className="text-primary" />
                  </motion.div>
                  <p className="text-xs font-bold text-primary uppercase tracking-wider">Analyzing...</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Manual Log Modal */}
      <AnimatePresence>
        {showManualLog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center"
            onClick={(e) => e.target === e.currentTarget && setShowManualLog(false)}>
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-md bg-background rounded-t-[2rem] p-6 pb-10 border-t border-border space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Manual Food Log</h3>
                <button onClick={() => setShowManualLog(false)} className="p-2 rounded-xl hover:bg-muted">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Food Name *</label>
                  <input type="text" value={manualName} onChange={e => setManualName(e.target.value)} placeholder="e.g. Grilled Chicken"
                    className="w-full bg-muted border border-border rounded-2xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Calories (kcal) *</label>
                    <input type="number" value={manualCalories} onChange={e => setManualCalories(e.target.value)} placeholder="per 100g or total"
                      className="w-full bg-muted border border-border rounded-2xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Weight (g) <span className="text-muted-foreground/50">optional</span></label>
                    <input type="number" value={manualWeight} onChange={e => setManualWeight(e.target.value)} placeholder="grams"
                      className="w-full bg-muted border border-border rounded-2xl px-4 py-3.5 text-sm text-foreground outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                </div>
                {manualWeight && manualCalories && parseInt(manualWeight) > 0 && (
                  <p className="text-[10px] text-primary font-bold text-center">
                    Estimated: {Math.round((parseInt(manualCalories) / 100) * parseInt(manualWeight))} kcal for {manualWeight}g
                  </p>
                )}
              </div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleManualLog}
                className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,255,0,0.2)]">
                <Plus size={16} /> Log Food
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FoodLens;
