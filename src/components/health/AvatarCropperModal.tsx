import React, { useCallback, useRef, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCw, RotateCcw, ZoomIn, ZoomOut, Check, Loader2, ImageIcon, Trash2 } from 'lucide-react';

interface AvatarCropperModalProps {
  open: boolean;
  imageSrc: string | null;          // dataURL or object URL of the picked image
  onCancel: () => void;
  onConfirm: (blob: Blob, previewDataUrl: string) => void | Promise<void>;
  onPickAnother?: () => void;
  busy?: boolean;
}

const OUTPUT_SIZE = 512; // px, square avatar

async function cropToBlob(
  imageSrc: string,
  cropPixels: Area,
  rotation: number,
): Promise<{ blob: Blob; dataUrl: string }> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // For rotation, draw rotated source onto an offscreen canvas, then crop.
  const safeArea = Math.max(image.width, image.height) * 2;
  const off = document.createElement('canvas');
  off.width = safeArea;
  off.height = safeArea;
  const offCtx = off.getContext('2d')!;
  offCtx.translate(safeArea / 2, safeArea / 2);
  offCtx.rotate((rotation * Math.PI) / 180);
  offCtx.translate(-image.width / 2, -image.height / 2);
  offCtx.drawImage(image, 0, 0);

  const data = offCtx.getImageData(0, 0, safeArea, safeArea);
  const sx = safeArea / 2 - image.width / 2 + cropPixels.x;
  const sy = safeArea / 2 - image.height / 2 + cropPixels.y;

  off.width = cropPixels.width;
  off.height = cropPixels.height;
  offCtx.putImageData(data, -sx, -sy);

  ctx.drawImage(off, 0, 0, cropPixels.width, cropPixels.height, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.9),
  );
  return { blob, dataUrl };
}

const AvatarCropperModal: React.FC<AvatarCropperModalProps> = ({
  open, imageSrc, onCancel, onConfirm, onPickAnother, busy,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [processing, setProcessing] = useState(false);
  const croppedAreaRef = useRef<Area | null>(null);

  const onCropComplete = useCallback((_: Area, areaPx: Area) => {
    croppedAreaRef.current = areaPx;
  }, []);

  const reset = () => { setCrop({ x: 0, y: 0 }); setZoom(1); setRotation(0); };

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaRef.current) return;
    setProcessing(true);
    try {
      const { blob, dataUrl } = await cropToBlob(imageSrc, croppedAreaRef.current, rotation);
      await onConfirm(blob, dataUrl);
      reset();
    } finally {
      setProcessing(false);
    }
  };

  const disabled = processing || !!busy;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-[#050505]/95 backdrop-blur-2xl flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Edit profile photo"
        >
          {/* Header */}
          <header className="flex items-center justify-between px-5 pt-12 pb-3">
            <button
              onClick={onCancel}
              disabled={disabled}
              aria-label="Cancel"
              className="w-10 h-10 rounded-2xl flex items-center justify-center border border-white/10 bg-white/5 backdrop-blur-xl active:scale-95 transition-transform disabled:opacity-50"
            >
              <X size={18} className="text-foreground" />
            </button>
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-foreground">Edit Photo</h2>
            <div className="w-10 h-10" />
          </header>

          {/* Cropper area */}
          <div className="relative flex-1 mx-4 my-2 rounded-3xl overflow-hidden border border-white/10 bg-black">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={onCropComplete}
                objectFit="contain"
                style={{
                  containerStyle: { background: '#000' },
                  cropAreaStyle: {
                    border: '2px solid #CCFF00',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.6), 0 0 30px rgba(204,255,0,0.4)',
                    color: 'transparent',
                  },
                }}
              />
            )}
            {/* Hint chip */}
            <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/70 border border-white/10 text-[9px] font-black uppercase tracking-[0.25em] text-lime-400/90">
              Drag · Pinch to Zoom
            </div>
          </div>

          {/* Controls */}
          <div className="px-5 pt-3 space-y-4">
            {/* Zoom slider */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setZoom(z => Math.max(1, +(z - 0.2).toFixed(2)))}
                disabled={disabled}
                aria-label="Zoom out"
                className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
              >
                <ZoomOut size={15} className="text-lime-400" />
              </button>
              <input
                type="range"
                min={1}
                max={4}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                disabled={disabled}
                aria-label="Zoom"
                className="flex-1 accent-lime-400"
              />
              <button
                onClick={() => setZoom(z => Math.min(4, +(z + 0.2).toFixed(2)))}
                disabled={disabled}
                aria-label="Zoom in"
                className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
              >
                <ZoomIn size={15} className="text-lime-400" />
              </button>
            </div>

            {/* Rotation + actions */}
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setRotation(r => r - 90)}
                disabled={disabled}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-[0.18em] text-foreground active:scale-95 transition-transform disabled:opacity-50"
                aria-label="Rotate left"
              >
                <RotateCcw size={13} /> Left
              </button>
              <button
                onClick={() => setRotation(r => r + 90)}
                disabled={disabled}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-[0.18em] text-foreground active:scale-95 transition-transform disabled:opacity-50"
                aria-label="Rotate right"
              >
                <RotateCw size={13} /> Right
              </button>
              {onPickAnother && (
                <button
                  onClick={onPickAnother}
                  disabled={disabled}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-[0.18em] text-foreground active:scale-95 transition-transform disabled:opacity-50"
                  aria-label="Pick another photo"
                >
                  <ImageIcon size={13} /> Replace
                </button>
              )}
              <button
                onClick={reset}
                disabled={disabled}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-[0.18em] text-foreground active:scale-95 transition-transform disabled:opacity-50"
                aria-label="Reset adjustments"
              >
                <Trash2 size={13} /> Reset
              </button>
            </div>
          </div>

          {/* Confirm */}
          <div className="px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleConfirm}
              disabled={disabled || !imageSrc}
              className="w-full py-4 rounded-2xl bg-lime-400 text-black font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(204,255,0,0.4)] disabled:opacity-60"
            >
              {processing || busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {processing || busy ? 'Uploading…' : 'Apply Photo'}
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AvatarCropperModal;
