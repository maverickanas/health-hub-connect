import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Zap, X, RotateCcw, ImageIcon, Star, AlertTriangle } from 'lucide-react';
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

const FOOD_ANALYSIS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/food-analysis`;

const FoodLens: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<FoodAnalysis | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.error('Camera access denied:', err);
      toast.error('Camera access denied. Please allow camera permissions.');
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(dataUrl);
    stopCamera();
  }, [stopCamera]);

  const analyzeFood = async () => {
    if (!capturedImage) return;
    setIsScanning(true);
    try {
      const resp = await fetch(FOOD_ANALYSIS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ image: capturedImage }),
      });

      if (resp.status === 429) {
        toast.error('Rate limit exceeded. Please try again shortly.');
        setIsScanning(false);
        return;
      }
      if (resp.status === 402) {
        toast.error('AI credits exhausted. Please add funds.');
        setIsScanning(false);
        return;
      }

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Analysis failed');
      }

      const { analysis } = await resp.json();
      setScanResult(analysis);
    } catch (err) {
      console.error('Food analysis error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to analyze food');
    } finally {
      setIsScanning(false);
    }
  };

  const resetAll = () => {
    setScanResult(null);
    setCapturedImage(null);
    stopCamera();
  };

  const flipCamera = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  useEffect(() => {
    if (cameraActive) {
      startCamera();
    }
  }, [facingMode]);

  const verdictColor = (v: string) => {
    switch (v) {
      case 'Excellent': return 'text-luxury-neon';
      case 'Good': return 'text-blue-400';
      case 'Fair': return 'text-amber-400';
      case 'Avoid': return 'text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="h-full w-full relative bg-black overflow-hidden">
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera Feed / Captured Image / Default State */}
      <div className="absolute inset-0">
        {cameraActive && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        )}
        {capturedImage && !cameraActive && (
          <img src={capturedImage} alt="Captured food" className="w-full h-full object-cover" />
        )}
        {!cameraActive && !capturedImage && (
          <div className="w-full h-full bg-gradient-to-b from-black/20 via-black/60 to-black/90 flex items-center justify-center">
            <ImageIcon size={64} className="text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80 pointer-events-none" />

      {/* Scanning grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(204,255,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(204,255,0,0.02)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none" />

      {/* Scanning brackets */}
      {(cameraActive || capturedImage) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-64 h-64">
            <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-luxury-neon rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-luxury-neon rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-luxury-neon rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-luxury-neon rounded-br-lg" />

            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={isScanning ? { scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] } : {}}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-8 h-8 rounded-full border border-luxury-neon/60"
              />
              <motion.div
                animate={isScanning ? { scale: [1, 0.8, 1], opacity: [1, 0.3, 1] } : {}}
                transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}
                className="absolute w-2 h-2 rounded-full bg-luxury-neon shadow-[0_0_12px_rgba(204,255,0,0.8)]"
              />
            </div>

            {isScanning && (
              <motion.div
                animate={{ y: [0, 256, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-luxury-neon to-transparent shadow-[0_0_10px_rgba(204,255,0,0.5)]"
              />
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 pt-14 px-6 text-center z-10">
        <p className="text-[9px] font-extrabold text-luxury-neon/60 uppercase tracking-[0.4em]">Biometric Scanner</p>
        <h1 className="text-lg font-black text-foreground uppercase tracking-wider mt-1">
          Food <span className="text-luxury-neon">Lens</span>
        </h1>
      </div>

      {/* Camera controls (top right) */}
      {cameraActive && (
        <div className="absolute top-14 right-4 z-20 flex flex-col gap-2">
          <button onClick={flipCamera} className="p-2.5 rounded-full glass-panel">
            <RotateCcw size={18} className="text-luxury-neon" />
          </button>
        </div>
      )}

      {/* Status text */}
      {isScanning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute top-32 left-0 right-0 text-center z-10"
        >
          <p className="text-[10px] font-black text-luxury-neon uppercase tracking-[0.3em]">Analyzing Nutrients...</p>
        </motion.div>
      )}

      {/* Bottom Panel */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <AnimatePresence mode="wait">
          {scanResult ? (
            <motion.div
              key="result"
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="glass-panel mx-4 mb-24 rounded-3xl p-5 space-y-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[9px] font-extrabold text-luxury-neon uppercase tracking-[0.2em]">Analysis Complete</p>
                  <p className="text-lg font-black text-foreground mt-1">{scanResult.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-bold ${verdictColor(scanResult.verdict)}`}>{scanResult.verdict}</span>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={10}
                          className={i < Math.round(scanResult.healthScore / 2) ? 'text-luxury-neon fill-luxury-neon' : 'text-muted-foreground/30'}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <button onClick={resetAll} className="p-1.5 rounded-lg hover:bg-muted">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'KCAL', value: scanResult.calories, color: 'text-luxury-neon' },
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
                  <AlertTriangle size={14} className="text-luxury-neon mt-0.5 shrink-0" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{scanResult.advice}</p>
                </div>
              )}

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={resetAll}
                className="w-full py-3 rounded-2xl border border-luxury-neon/30 text-luxury-neon font-black text-xs uppercase tracking-[0.3em]"
              >
                Scan Another
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="controls"
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="glass-panel mx-4 mb-24 rounded-3xl p-6 space-y-4"
            >
              <p className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-[0.2em] text-center">
                {capturedImage ? 'Photo Captured — Ready to Analyze' : 'Point Camera at Your Meal'}
              </p>

              {!cameraActive && !capturedImage && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={startCamera}
                  className="w-full py-4 rounded-2xl bg-luxury-neon text-primary-foreground font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,255,0,0.2)]"
                >
                  <Camera size={16} />
                  Open Camera
                </motion.button>
              )}

              {cameraActive && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={capturePhoto}
                  className="w-full py-4 rounded-2xl bg-luxury-neon text-primary-foreground font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,255,0,0.2)]"
                >
                  <Camera size={16} />
                  Capture
                </motion.button>
              )}

              {capturedImage && !isScanning && (
                <div className="flex gap-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setCapturedImage(null); startCamera(); }}
                    className="flex-1 py-4 rounded-2xl border border-muted-foreground/30 text-muted-foreground font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={14} />
                    Retake
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={analyzeFood}
                    className="flex-1 py-4 rounded-2xl bg-luxury-neon text-primary-foreground font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,255,0,0.2)]"
                  >
                    <Zap size={14} />
                    Analyze
                  </motion.button>
                </div>
              )}

              {isScanning && (
                <div className="flex items-center justify-center py-4 gap-3">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                    <Zap size={16} className="text-luxury-neon" />
                  </motion.div>
                  <p className="text-xs font-bold text-luxury-neon uppercase tracking-wider">Analyzing...</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FoodLens;
