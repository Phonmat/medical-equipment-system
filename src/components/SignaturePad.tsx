import React, { useRef, useState, useEffect, useMemo, useId } from 'react';
import { PenLine, RotateCcw, X, User, Trash2, ChevronUp, Check, Edit3, Minimize2 } from 'lucide-react';
import { useAppStore } from '../store';

interface SignaturePadProps {
  value?: string;
  onChange: (signatureDataUrl: string) => void;
  signerName?: string;
  onSignerNameChange?: (name: string) => void;
  namePlaceholder?: string;
  label?: string;
  required?: boolean;
  defaultExpanded?: boolean;
}

export default function SignaturePad({
  value,
  onChange,
  signerName = '',
  onSignerNameChange,
  namePlaceholder = 'พิมพ์ชื่อ-นามสกุล หรือตำแหน่งผู้ลงนาม...',
  label = 'ช่องเซ็นชื่อเปิดงาน (Requester Signature)',
  required = false,
  defaultExpanded
}: SignaturePadProps) {
  const { users } = useAppStore();
  const datalistId = useId();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [penColor, setPenColor] = useState<string>('#1e3a8a'); // Navy blue default for official signature
  
  // Collapsed / Expanded state (collapsed by default unless explicitly specified or already has signature)
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (defaultExpanded !== undefined) return defaultExpanded;
    return Boolean(value);
  });

  // Combined list of signer options for datalist
  const allSignerOptions = useMemo(() => {
    const userNames = users.map(u => u.username).filter(Boolean);
    return Array.from(new Set(userNames));
  }, [users]);

  // Initialize canvas with existing value whenever expanded or value changes
  useEffect(() => {
    if (!isExpanded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasDrawn(true);
      };
      img.src = value;
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
    }
  }, [value, isExpanded]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if ('touches' in e) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setHasDrawn(false);
    onChange('');
  };

  // If collapsed, display compact icon/button preview
  if (!isExpanded) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
            <PenLine size={14} className="text-blue-600" />
            <span>{label}</span>
            {required && <span className="text-rose-500">*</span>}
          </label>
        </div>

        {value ? (
          // Collapsed state WITH existing signature
          <div className="flex items-center justify-between p-2.5 bg-white border border-blue-200 hover:border-blue-300 rounded-xl shadow-2xs transition-all">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-1 w-24 h-11 flex items-center justify-center shrink-0">
                <img src={value} alt="ลายเซ็น" className="max-h-9 max-w-[85px] object-contain" />
              </div>
              <div className="truncate">
                <span className="inline-flex items-center text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/80">
                  ✓ ลงลายมือชื่อแล้ว
                </span>
                {signerName ? (
                  <p className="text-xs font-semibold text-slate-800 mt-0.5 truncate">{signerName}</p>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-0.5 italic">ไม่ได้ระบุชื่อ</p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-1.5 shrink-0 pl-2">
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 shadow-2xs transition-colors cursor-pointer"
                title="คลิกเพื่อแก้ไขหรือเซ็นใหม่"
              >
                <Edit3 size={13} />
                <span>แก้ไข/เซ็นใหม่</span>
              </button>
              <button
                type="button"
                onClick={clearCanvas}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="ลบลายเซ็น"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ) : (
          // Collapsed state WITHOUT signature: Compact Icon Button
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white border border-dashed border-slate-300 hover:border-blue-400 rounded-xl shadow-2xs transition-all">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-2xs shrink-0">
                <PenLine size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  {signerName ? `ผู้ลงนาม: ${signerName}` : 'ยังไม่ได้ลงลายมือชื่อ'}
                </p>
                <p className="text-[11px] text-slate-500">
                  กดปุ่มเพื่อเปิดกระดานลงลายมือชื่อด้วยเมาส์หรือระบบสัมผัส
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer whitespace-nowrap active:scale-98"
            >
              <span className="text-sm">✍️</span>
              <span>คลิกเพื่อลงลายมือชื่อ</span>
            </button>
          </div>
        )}

        {/* Signer Name Input when collapsed */}
        {onSignerNameChange && (
          <div className="pt-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                <User size={13} />
              </div>
              <input
                type="text"
                list={datalistId}
                value={signerName}
                onChange={(e) => onSignerNameChange(e.target.value)}
                placeholder={namePlaceholder || "พิมพ์ชื่อ-นามสกุล หรือตำแหน่งผู้ลงนาม..."}
                className="w-full text-xs pl-7 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium placeholder:text-slate-400 hover:border-slate-400 transition-colors shadow-2xs"
              />
              {signerName && (
                <button
                  type="button"
                  onClick={() => onSignerNameChange('')}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title="ล้างข้อความ"
                >
                  <X size={12} />
                </button>
              )}
              <datalist id={datalistId}>
                {allSignerOptions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Expanded View (Full Canvas Pad)
  return (
    <div className="space-y-2 animate-in fade-in zoom-in-95 duration-150">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
          <PenLine size={14} className="text-blue-600" />
          <span>{label}</span>
          {required && <span className="text-rose-500">*</span>}
        </label>

        <div className="flex items-center space-x-2">
          {/* Pen Color Switcher */}
          <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-md text-[10px]">
            <button
              type="button"
              onClick={() => setPenColor('#1e3a8a')}
              className={`w-4 h-4 rounded-full bg-blue-900 border cursor-pointer ${penColor === '#1e3a8a' ? 'ring-2 ring-blue-500' : 'opacity-70'}`}
              title="หมึกสีน้ำเงิน"
            />
            <button
              type="button"
              onClick={() => setPenColor('#0f172a')}
              className={`w-4 h-4 rounded-full bg-slate-900 border cursor-pointer ${penColor === '#0f172a' ? 'ring-2 ring-slate-500' : 'opacity-70'}`}
              title="หมึกสีดำ"
            />
          </div>

          <button
            type="button"
            onClick={clearCanvas}
            className="flex items-center space-x-1 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 px-2 py-0.5 rounded transition-colors cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>ล้างลายเซ็น</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="flex items-center space-x-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md border border-blue-200 transition-colors cursor-pointer"
            title="ย่อกระดานลายเซ็น"
          >
            <Minimize2 size={12} />
            <span>ย่อเก็บ</span>
          </button>
        </div>
      </div>

      {/* Signature Canvas Container */}
      <div className="relative border-2 border-dashed border-slate-300 hover:border-blue-400 focus-within:border-blue-500 rounded-xl bg-slate-50/50 overflow-hidden transition-colors shadow-2xs">
        <canvas
          ref={canvasRef}
          width={450}
          height={140}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-32 touch-none cursor-crosshair bg-white"
        />

        {/* Baseline guideline */}
        <div className="absolute bottom-6 left-6 right-6 border-b border-slate-200 pointer-events-none flex justify-between text-[10px] text-slate-300">
          <span>✕ จุดเริ่มต้นลงลายมือชื่อ</span>
          <span>ลงนาม</span>
        </div>

        {!hasDrawn && !value && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs">
            <span className="bg-white/90 px-3 py-1 rounded-full border border-slate-200 shadow-2xs font-medium">
              วาดลายมือชื่อด้วยเมาส์หรือระบบสัมผัสที่นี่
            </span>
          </div>
        )}
      </div>

      {/* Signer Name Direct Input Section */}
      {onSignerNameChange && (
        <div className="pt-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-slate-700 flex items-center space-x-1.5">
              <User size={13} className="text-blue-600" />
              <span>ชื่อผู้ลงนาม / ผู้แจ้งเปิดงาน:</span>
            </label>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <User size={14} />
            </div>
            <input
              type="text"
              list={datalistId}
              value={signerName}
              onChange={(e) => onSignerNameChange(e.target.value)}
              placeholder={namePlaceholder || "พิมพ์ชื่อ-นามสกุล หรือตำแหน่งผู้ลงนาม..."}
              className="w-full text-xs pl-8 pr-8 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium placeholder:text-slate-400 hover:border-slate-400 transition-colors shadow-2xs"
            />
            {signerName && (
              <button
                type="button"
                onClick={() => onSignerNameChange('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="ล้างข้อความ"
              >
                <X size={13} />
              </button>
            )}

            {/* Datalist for native browser suggestions */}
            <datalist id={datalistId}>
              {allSignerOptions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
        </div>
      )}

      {/* Confirm & Collapse Button */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          <Check size={13} className="text-blue-600" />
          <span>{hasDrawn || value ? 'เสร็จสิ้นการเซ็น (ย่อเก็บ)' : 'ย่อเก็บกระดาน'}</span>
        </button>
      </div>
    </div>
  );
}

