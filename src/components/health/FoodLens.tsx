import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Zap, ScanLine, X } from 'lucide-react';

const FoodLens: React.FC = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<null | { name: string; calories: number; protein: number; carbs: number; fat: number }>(null);

  const handleScan = () => {
    setIsScanning(true);
    // Simulate scan
    setTimeout(() => {
      setIsScanning(false);
      setScanResult({
        name: 'Grilled Chicken Salad',
        calories: 350,
        protein: 32,
        carbs: 18,
        fat: 14,
      });
    }, 2500);
  };

  return (
    <div className="h-full w-full relative bg-black overflow-hidden">
      {/* Camera Viewfinder Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80" />
      
      {/* Scanning grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(204,255,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(204,255,0,0.02)_1px,transparent_1px)] bg-[size:30px_30px]" />

      {/* Futuristic scanning brackets */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-64 h-64">
          {/* Top-left bracket */}
          <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-luxury-neon rounded-tl-lg" />
          {/* Top-right bracket */}
          <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-luxury-neon rounded-tr-lg" />
          {/* Bottom-left bracket */}
          <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-luxury-neon rounded-bl-lg" />
          {/* Bottom-right bracket */}
          <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-luxury-neon rounded-br-lg" />
          
          {/* Center reticle */}
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

          {/* Scan line */}
          {isScanning && (
            <motion.div
              animate={{ y: [0, 256, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
              className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-luxury-neon to-transparent shadow-[0_0_10px_rgba(204,255,0,0.5)]"
            />
          )}
        </div>
      </div>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 pt-14 px-6 text-center z-10">
        <p className="text-[9px] font-extrabold text-luxury-neon/60 uppercase tracking-[0.4em]">Biometric Scanner</p>
        <h1 className="text-lg font-black text-foreground uppercase tracking-wider mt-1">
          Food <span className="text-luxury-neon">Lens</span>
        </h1>
      </div>

      {/* Status text */}
      {isScanning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute top-32 left-0 right-0 text-center"
        >
          <p className="text-[10px] font-black text-luxury-neon uppercase tracking-[0.3em]">Analyzing Nutrients...</p>
        </motion.div>
      )}

      {/* Bottom Panel */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        {scanResult ? (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="glass-panel mx-4 mb-24 rounded-3xl p-6 space-y-4"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[9px] font-extrabold text-luxury-neon uppercase tracking-[0.2em]">Analysis Complete</p>
                <p className="text-lg font-black text-foreground mt-1">{scanResult.name}</p>
              </div>
              <button onClick={() => setScanResult(null)} className="p-1.5 rounded-lg hover:bg-muted">
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
          </motion.div>
        ) : (
          <div className="glass-panel mx-4 mb-24 rounded-3xl p-6 space-y-4">
            <p className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-[0.2em] text-center">
              Instant Biometric Meal Analysis
            </p>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleScan}
              disabled={isScanning}
              className="w-full py-4 rounded-2xl bg-luxury-neon text-primary-foreground font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,255,0,0.2)] disabled:opacity-50"
            >
              {isScanning ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                  <Zap size={16} />
                </motion.div>
              ) : (
                <Camera size={16} />
              )}
              {isScanning ? 'Scanning...' : 'Scan'}
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FoodLens;
