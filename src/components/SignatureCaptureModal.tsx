import React, { useState, useRef, useEffect } from 'react';
import { PenLine, RotateCcw, Check, X, User } from 'lucide-react';

interface SignatureCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { signature: string; name: string }) => void;
  title?: string;
  subtitle?: string;
  initialName?: string;
  nameLabel?: string;
  namePlaceholder?: string;
  initialSignature?: string;
}

export default function SignatureCaptureModal({
  isOpen,
  onClose,
  onSave,
  title = 'ลงลายมือชื่อช่าง',
  subtitle,
  initialName = '',
  nameLabel = 'ชื่อช่างผู้ลงนาม',
  namePlaceholder = 'ระบุชื่อผู้ลงนาม...',
  initialSignature = ''
}: SignatureCaptureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [name, setName] = useState(initialName);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#1e3a8a'); // dark blue
  const [strokeWidth, setStrokeWidth] = useState(2.5);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setHasDrawn(!!initialSignature);
      setTimeout(() => {
        initCanvas();
      }, 100);
    }
  }, [isOpen, initialName, initialSignature]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = initialSignature;
    }
  };

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) {
      if (!hasDrawn && initialSignature) {
        onSave({ signature: initialSignature, name: name.trim() });
        onClose();
      }
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    onSave({ signature: dataUrl, name: name.trim() });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-white/15 rounded-lg">
              <PenLine size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{title}</h3>
              <p className="text-[11px] text-amber-100">{subtitle || 'เซ็นลายเซ็นช่างผู้รับผิดชอบงานด้วยเมาส์หรือระบบสัมผัส'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Name Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
              <User size={13} className="text-amber-600" />
              <span>{nameLabel}</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={namePlaceholder}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
            />
          </div>

          {/* Canvas Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700">วาดลายเซ็นในกรอบด้านล่าง</span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="inline-flex items-center space-x-1 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>ล้างลายเซ็น</span>
                </button>
              </div>
            </div>

            <div className="relative border-2 border-dashed border-amber-300 rounded-xl overflow-hidden bg-white shadow-inner">
              <canvas
                ref={canvasRef}
                className="w-full h-44 touch-none cursor-crosshair block"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              {!hasDrawn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400">
                  <PenLine size={24} className="opacity-40 mb-1" />
                  <span className="text-xs">เซ็นลายมือชื่อที่นี่</span>
                </div>
              )}
            </div>
          </div>

          {/* Controls: Ink Color and Width */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <div className="flex items-center space-x-2">
              <span className="text-[11px]">สีหมึก:</span>
              <button
                type="button"
                onClick={() => setStrokeColor('#1e3a8a')}
                className={`w-5 h-5 rounded-full bg-blue-900 border-2 cursor-pointer ${strokeColor === '#1e3a8a' ? 'border-amber-500 scale-110' : 'border-white'}`}
                title="หมึกน้ำเงิน"
              />
              <button
                type="button"
                onClick={() => setStrokeColor('#0f172a')}
                className={`w-5 h-5 rounded-full bg-slate-900 border-2 cursor-pointer ${strokeColor === '#0f172a' ? 'border-amber-500 scale-110' : 'border-white'}`}
                title="หมึกดำ"
              />
            </div>
            <span className="text-[11px] text-slate-400">รองรับระบบสัมผัสและเมาส์</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!hasDrawn && !initialSignature}
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Check size={14} />
              <span>ยืนยันลายเซ็น</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
