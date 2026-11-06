import React, { useRef, useState, useEffect } from 'react';
import { 
  Printer, X, Loader2, ArrowDownRight, 
  ClipboardCheck, ArrowLeft, Tag, CheckCircle2,
  PenLine, RotateCcw, Trash2, Check
} from 'lucide-react';
import { Equipment } from '../types';
import { useAppStore } from '../store';
import { 
  formatDateSlash, formatPurchasePrice, formatWarrantyDisplay, 
  formatWarrantyDateRange 
} from '../utils/dateUtils';
import { printElement } from '../utils/printUtils';

interface EquipmentPrintModalProps {
  equipment: Equipment | null;
  equipmentList?: Equipment[];
  isOpen: boolean;
  onClose: () => void;
  initialDocType?: 'mutation_in' | 'inspection' | null;
}

interface SavedSignature {
  signature: string;
  name?: string;
  date?: string;
}

interface SignaturePadModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  defaultName: string;
  defaultDate: string;
  onSave: (data: { signature: string; name: string; date: string }) => void;
}

function SignaturePadModal({
  isOpen,
  onClose,
  title,
  defaultName,
  defaultDate,
  onSave,
}: SignaturePadModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [penColor, setPenColor] = useState<string>('#1e3a8a');
  const [name, setName] = useState(defaultName);
  const [date, setDate] = useState(defaultDate);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setDate(defaultDate);
      setHasDrawn(false);
      setIsDrawing(false);
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
      }, 60);
    }
  }, [isOpen, defaultName, defaultDate]);

  if (!isOpen) return null;

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if ('touches' in e) {
      e.stopPropagation();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if ('touches' in e) {
      e.preventDefault();
      e.stopPropagation();
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
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave({ signature: dataUrl, name: name.trim(), date });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <PenLine size={18} className="text-blue-400" />
            <h3 className="font-bold text-sm sm:text-base">เซ็นลายเซ็น: {title}</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Controls Bar above canvas */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500 font-medium">สีหมึก:</span>
              <button
                type="button"
                onClick={() => setPenColor('#1e3a8a')}
                className={`w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center cursor-pointer ${
                  penColor === '#1e3a8a' ? 'border-blue-600 scale-110 shadow-xs' : 'border-slate-300'
                }`}
                style={{ backgroundColor: '#1e3a8a' }}
                title="น้ำเงินทางการ"
              >
                {penColor === '#1e3a8a' && <Check size={12} className="text-white" />}
              </button>
              <button
                type="button"
                onClick={() => setPenColor('#0f172a')}
                className={`w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center cursor-pointer ${
                  penColor === '#0f172a' ? 'border-blue-600 scale-110 shadow-xs' : 'border-slate-300'
                }`}
                style={{ backgroundColor: '#0f172a' }}
                title="ดำมาตรฐาน"
              >
                {penColor === '#0f172a' && <Check size={12} className="text-white" />}
              </button>
            </div>

            <button
              type="button"
              onClick={clearCanvas}
              className="inline-flex items-center space-x-1 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition-colors font-medium cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>ล้างกระดาน</span>
            </button>
          </div>

          {/* Canvas Box */}
          <div className="relative border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-slate-50/50 flex flex-col items-center">
            <canvas
              ref={canvasRef}
              width={480}
              height={180}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-[180px] bg-white cursor-crosshair touch-none"
            />
            {!hasDrawn && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400">
                <PenLine size={24} className="mb-1 text-slate-300" />
                <span className="text-xs">ลากเมาส์หรือใช้นิ้วสัมผัสเพื่อเซ็นชื่อที่นี่</span>
              </div>
            )}
            <div className="w-full border-t border-slate-100 bg-slate-50 px-3 py-1 text-[10px] text-slate-400 text-center">
              ลายเซ็นอิเล็กทรอนิกส์สำหรับเอกสารควบคุมเครื่องมือแพทย์
            </div>
          </div>

          {/* Signer Info inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อ-นามสกุล / ตำแหน่งผู้ลงนาม
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="ระบุชื่อผู้ลงนาม..."
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                วันที่ลงนาม
              </label>
              <input
                type="text"
                value={date}
                onChange={e => setDate(e.target.value)}
                placeholder="วว/ดด/ปปปป"
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasDrawn}
            className="inline-flex items-center space-x-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl transition-colors shadow-xs cursor-pointer"
          >
            <Check size={14} />
            <span>บันทึกลายเซ็น</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Reusable Circular Radio (Exact Match to PDF FP-OP-005-001)
const RadioCircle = ({ 
  checked, 
  label, 
  onClick,
  className = '' 
}: { 
  checked?: boolean; 
  label: string; 
  onClick?: () => void;
  className?: string 
}) => (
  <span 
    onClick={onClick}
    className={`inline-flex items-center space-x-1.5 mr-2 text-[9.5px] leading-none select-none ${onClick ? 'cursor-pointer hover:opacity-75' : ''} ${className}`}
  >
    <span className="w-[15px] h-[15px] rounded-full border border-black flex items-center justify-center shrink-0 bg-white">
      {checked && <span className="w-2 h-2 rounded-full bg-black"></span>}
    </span>
    <span className="whitespace-nowrap">{label}</span>
  </span>
);

// Reusable Square Checkbox (Exact Match to PDF FP-OP-005-001)
const CheckSquare = ({ 
  checked, 
  label, 
  onClick,
  className = '' 
}: { 
  checked?: boolean; 
  label: string; 
  onClick?: () => void;
  className?: string 
}) => (
  <span 
    onClick={onClick}
    className={`inline-flex items-end space-x-1.5 text-[7.5px] leading-none select-none ${onClick ? 'cursor-pointer hover:opacity-75' : ''} ${className}`}
  >
    <span className="w-[17px] h-[17px] border border-black flex items-center justify-center shrink-0 bg-white">
      {checked && <span className="text-[11px] font-black leading-none text-black">✓</span>}
    </span>
    <span className="whitespace-nowrap font-normal pb-[1px]">{label}</span>
  </span>
);

export default function EquipmentPrintModal({
  equipment,
  equipmentList,
  isOpen,
  onClose,
  initialDocType = null,
}: EquipmentPrintModalProps) {
  const { currentUser } = useAppStore();
  const printContentRef = useRef<HTMLDivElement>(null);
  const [docType, setDocType] = useState<'mutation_in' | 'inspection' | null>(initialDocType);
  const [isPrinting, setIsPrinting] = useState(false);
  const [ownership, setOwnership] = useState<'hospital' | 'leased' | 'profit_sharing' | 'other' | null>('hospital');
  const [otherOwnershipText, setOtherOwnershipText] = useState('');
  const [riskLevelChoice, setRiskLevelChoice] = useState<'HIGH' | 'MEDUIM' | 'LOW' | null>('LOW');
  const [clinicalAlarmChoice, setClinicalAlarmChoice] = useState<'YES' | 'NO' | 'UNKNOWN' | null>('NO');
  const [classificationChoice, setClassificationChoice] = useState<string | null>('DIAGNOSTIC');
  const [commentLine1, setCommentLine1] = useState('');
  const [commentLine2, setCommentLine2] = useState('');

  // Mutation-In (FP-OP-005-001) interactive toggle states
  const [assetNoChoice, setAssetNoChoice] = useState<'NA' | null>(null);
  const [poNoChoice, setPoNoChoice] = useState<'NA' | null>(null);
  const [manufacturerChoice, setManufacturerChoice] = useState<'NA' | 'UNKNOWN' | null>(null);
  const [modelChoice, setModelChoice] = useState<'NA' | 'UNKNOWN' | null>(null);
  const [serialNoChoice, setSerialNoChoice] = useState<'NA' | 'UNKNOWN' | null>(null);
  const [accessoriesNon, setAccessoriesNon] = useState<boolean>(true);
  const [consumablesNon, setConsumablesNon] = useState<boolean>(true);
  const [installationDateChoice, setInstallationDateChoice] = useState<'NA' | 'UNKNOWN' | null>(null);
  const [vendorChoice, setVendorChoice] = useState<'NA' | 'UNKNOWN' | null>(null);
  const [locationChoice, setLocationChoice] = useState<'FIX' | 'MOVABLE' | null>('MOVABLE');
  const [inspectionFreqChoice, setInspectionFreqChoice] = useState<'1' | '2' | '3' | 'other' | null>('1');
  const [operationManualChoice, setOperationManualChoice] = useState<'yes' | 'no' | null>('yes');
  const [serviceManualChoice, setServiceManualChoice] = useState<'yes' | 'no' | null>('yes');
  const [warrantyChoice, setWarrantyChoice] = useState<'yes' | 'no' | null>(null);
  const [serviceAfterWarrantyChoice, setServiceAfterWarrantyChoice] = useState<'yes' | 'no' | null>('yes');
  const [stickersInPlace, setStickersInPlace] = useState<Record<string, boolean>>({
    code: true,
    inspection: true,
    pm: true,
    assetNo: true,
    calibration: true,
  });
  const [equipmentConditionChoice, setEquipmentConditionChoice] = useState<'NEW' | 'RE-INVENTORY' | null>('NEW');

  // Inspection Form (FP-OP-005-005) interactive states
  const [inspectionAnswers, setInspectionAnswers] = useState<Record<string, 'yes' | 'no' | null>>({});
  const [inventoryStickerOk, setInventoryStickerOk] = useState<boolean>(false);
  const [electricalSafetyPass, setElectricalSafetyPass] = useState<boolean>(false);
  const [ceValue, setCeValue] = useState('');
  const [mdValue, setMdValue] = useState('');
  const [lotValue, setLotValue] = useState('');
  const [groundResistanceValue, setGroundResistanceValue] = useState('');
  const [chassisLeakValue, setChassisLeakValue] = useState('');
  const [signatures, setSignatures] = useState<Record<string, SavedSignature>>({});
  const [isMutationLoaded, setIsMutationLoaded] = useState(false);
  const [isInspectionLoaded, setIsInspectionLoaded] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [signingModal, setSigningModal] = useState<{
    key: string;
    title: string;
    defaultName: string;
    defaultDate: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen && equipment) {
      setDocType(initialDocType || null);

      // 1. Try loading saved Mutation-In data from localStorage
      const savedMutation = localStorage.getItem(`eq_mutation_data_${equipment.id}`);
      let hasSavedMutation = false;
      if (savedMutation) {
        try {
          const parsed = JSON.parse(savedMutation);
          if (parsed && typeof parsed === 'object') {
            hasSavedMutation = true;
            setOwnership(parsed.ownership ?? 'hospital');
            setOtherOwnershipText(parsed.otherOwnershipText ?? '');
            setAssetNoChoice(parsed.assetNoChoice ?? (!equipment.assetNo ? 'NA' : null));
            setPoNoChoice(parsed.poNoChoice ?? (!equipment.poNo ? 'NA' : null));
            setClassificationChoice(parsed.classificationChoice ?? 'DIAGNOSTIC');
            setClinicalAlarmChoice(parsed.clinicalAlarmChoice ?? 'NO');
            setRiskLevelChoice(parsed.riskLevelChoice ?? 'LOW');
            setManufacturerChoice(parsed.manufacturerChoice ?? (!equipment.manufacturer ? 'UNKNOWN' : null));
            setModelChoice(parsed.modelChoice ?? (!equipment.model ? 'UNKNOWN' : null));
            setSerialNoChoice(parsed.serialNoChoice ?? ((!equipment.serialNumber || equipment.serialNumber === '-') ? 'UNKNOWN' : null));
            setAccessoriesNon(parsed.accessoriesNon ?? !equipment.accessories);
            setConsumablesNon(parsed.consumablesNon ?? !equipment.consumables);
            setInstallationDateChoice(parsed.installationDateChoice ?? (!equipment.installationDate ? 'UNKNOWN' : null));
            setVendorChoice(parsed.vendorChoice ?? (!equipment.vendorCompany ? 'UNKNOWN' : null));
            setLocationChoice(parsed.locationChoice ?? 'MOVABLE');
            setInspectionFreqChoice(parsed.inspectionFreqChoice ?? '1');
            setOperationManualChoice(parsed.operationManualChoice ?? 'yes');
            setServiceManualChoice(parsed.serviceManualChoice ?? 'yes');
            setWarrantyChoice(parsed.warrantyChoice ?? (Boolean(equipment.warrantyPeriod || equipment.warrantyYears) ? 'yes' : 'no'));
            setServiceAfterWarrantyChoice(parsed.serviceAfterWarrantyChoice ?? 'yes');
            setStickersInPlace(parsed.stickersInPlace ?? {
              code: true,
              inspection: true,
              pm: true,
              assetNo: true,
              calibration: true,
            });
            setEquipmentConditionChoice(parsed.equipmentConditionChoice ?? (equipment.status === 'active' ? 'NEW' : 'RE-INVENTORY'));
            setCommentLine1(parsed.commentLine1 ?? '');
            setCommentLine2(parsed.commentLine2 ?? '');
          }
        } catch (e) {
          console.error(e);
        }
      }

      if (!hasSavedMutation) {
        setOwnership('hospital');
        setOtherOwnershipText('');
        setCommentLine1('');
        setCommentLine2('');
        setAssetNoChoice(!equipment.assetNo ? 'NA' : null);
        setPoNoChoice(!equipment.poNo ? 'NA' : null);
        setManufacturerChoice(!equipment.manufacturer ? 'UNKNOWN' : null);
        setModelChoice(!equipment.model ? 'UNKNOWN' : null);
        setSerialNoChoice((!equipment.serialNumber || equipment.serialNumber === '-') ? 'UNKNOWN' : null);
        setAccessoriesNon(!equipment.accessories);
        setConsumablesNon(!equipment.consumables);
        setInstallationDateChoice(!equipment.installationDate ? 'UNKNOWN' : null);
        setVendorChoice(!equipment.vendorCompany ? 'UNKNOWN' : null);
        setLocationChoice('MOVABLE');
        setInspectionFreqChoice('1');
        setOperationManualChoice('yes');
        setServiceManualChoice('yes');
        setWarrantyChoice(Boolean(equipment.warrantyPeriod || equipment.warrantyYears) ? 'yes' : 'no');
        setServiceAfterWarrantyChoice('yes');
        setStickersInPlace({
          code: true,
          inspection: true,
          pm: true,
          assetNo: true,
          calibration: true,
        });
        setEquipmentConditionChoice(equipment.status === 'active' ? 'NEW' : 'RE-INVENTORY');

        const risk = (equipment.riskLevel || 'Low').toLowerCase();
        if (risk.includes('high') || risk.includes('critical')) {
          setRiskLevelChoice('HIGH');
        } else if (risk.includes('medium') || risk.includes('moderate') || risk.includes('meduim')) {
          setRiskLevelChoice('MEDUIM');
        } else {
          setRiskLevelChoice('LOW');
        }

        const nameLower = (equipment.name || '').toLowerCase();
        const isHigh = risk.includes('high') || risk.includes('critical');
        const isLifeSup = isHigh || nameLower.includes('ventilator') || nameLower.includes('defib') || nameLower.includes('anesthesia');
        const isDiag = !isLifeSup && (nameLower.includes('monitor') || nameLower.includes('ecg') || nameLower.includes('x-ray') || nameLower.includes('ultra') || nameLower.includes('scop'));
        const isCrit = !isLifeSup && !isDiag && nameLower.includes('monitor');
        const isTherap = !isLifeSup && !isDiag && (nameLower.includes('pump') || nameLower.includes('cautery') || nameLower.includes('laser'));
        const isEnergy = nameLower.includes('laser') || nameLower.includes('x-ray') || nameLower.includes('radio');

        if (isLifeSup) setClassificationChoice('LIFE SUPPORT OR RESC');
        else if (isDiag) setClassificationChoice('DIAGNOSTIC');
        else if (isCrit) setClassificationChoice('CRITICAL MONITORING');
        else if (isEnergy) setClassificationChoice('ENERGY-EMITTING');
        else if (isTherap) setClassificationChoice('THERAPEUTIC');
        else setClassificationChoice('MISC OTHER');

        setClinicalAlarmChoice((isHigh || isLifeSup || isDiag) ? 'YES' : 'NO');
      }
      setIsMutationLoaded(true);

      // 2. Try loading saved Inspection data from localStorage
      const savedInspection = localStorage.getItem(`eq_inspection_data_${equipment.id}`);
      let hasSavedInspection = false;
      if (savedInspection) {
        try {
          const parsed = JSON.parse(savedInspection);
          if (parsed && typeof parsed === 'object') {
            hasSavedInspection = true;
            setInspectionAnswers(parsed.inspectionAnswers ?? {});
            setInventoryStickerOk(Boolean(parsed.inventoryStickerOk));
            setElectricalSafetyPass(Boolean(parsed.electricalSafetyPass));
            setCeValue(parsed.ceValue ?? '');
            setMdValue(parsed.mdValue ?? '');
            setLotValue(parsed.lotValue ?? '');
            setGroundResistanceValue(parsed.groundResistanceValue ?? '');
            setChassisLeakValue(parsed.chassisLeakValue ?? '');
          }
        } catch (e) {
          console.error(e);
        }
      }

      if (!hasSavedInspection) {
        setInspectionAnswers({});
        setInventoryStickerOk(false);
        setElectricalSafetyPass(false);
        setCeValue('');
        setMdValue('');
        setLotValue('');
        setGroundResistanceValue('');
        setChassisLeakValue('');
      }
      setIsInspectionLoaded(true);
    } else if (!isOpen) {
      setIsMutationLoaded(false);
      setIsInspectionLoaded(false);
      setLastSavedTime(null);
    }
  }, [isOpen, equipment?.id, initialDocType]);

  // Auto-save Mutation-In data to localStorage whenever any button or input is changed
  useEffect(() => {
    if (!isOpen || !equipment || !isMutationLoaded || docType !== 'mutation_in') return;
    const dataToSave = {
      ownership,
      otherOwnershipText,
      assetNoChoice,
      poNoChoice,
      classificationChoice,
      clinicalAlarmChoice,
      riskLevelChoice,
      manufacturerChoice,
      modelChoice,
      serialNoChoice,
      accessoriesNon,
      consumablesNon,
      installationDateChoice,
      vendorChoice,
      locationChoice,
      inspectionFreqChoice,
      operationManualChoice,
      serviceManualChoice,
      warrantyChoice,
      serviceAfterWarrantyChoice,
      stickersInPlace,
      equipmentConditionChoice,
      commentLine1,
      commentLine2,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(`eq_mutation_data_${equipment.id}`, JSON.stringify(dataToSave));
      setLastSavedTime(new Date().toLocaleTimeString('th-TH'));
    } catch (e) {
      console.error('Failed to save mutation form data', e);
    }
  }, [
    isOpen, equipment?.id, isMutationLoaded, docType,
    ownership, otherOwnershipText, assetNoChoice, poNoChoice,
    classificationChoice, clinicalAlarmChoice, riskLevelChoice,
    manufacturerChoice, modelChoice, serialNoChoice,
    accessoriesNon, consumablesNon, installationDateChoice, vendorChoice,
    locationChoice, inspectionFreqChoice, operationManualChoice, serviceManualChoice,
    warrantyChoice, serviceAfterWarrantyChoice, stickersInPlace, equipmentConditionChoice,
    commentLine1, commentLine2
  ]);

  // Auto-save Inspection data to localStorage whenever any answer is changed
  useEffect(() => {
    if (!isOpen || !equipment || !isInspectionLoaded || docType !== 'inspection') return;
    const dataToSave = {
      inspectionAnswers,
      inventoryStickerOk,
      electricalSafetyPass,
      ceValue,
      mdValue,
      lotValue,
      groundResistanceValue,
      chassisLeakValue,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(`eq_inspection_data_${equipment.id}`, JSON.stringify(dataToSave));
      setLastSavedTime(new Date().toLocaleTimeString('th-TH'));
    } catch (e) {
      console.error('Failed to save inspection form data', e);
    }
  }, [
    isOpen, equipment?.id, isInspectionLoaded, docType,
    inspectionAnswers, inventoryStickerOk, electricalSafetyPass,
    ceValue, mdValue, lotValue, groundResistanceValue, chassisLeakValue
  ]);

  const today = new Date();
  const nextInspectionDate = new Date(today);
  nextInspectionDate.setFullYear(today.getFullYear() + 1);
  const formattedToday = formatDateSlash(today.toISOString().split('T')[0]);
  const formattedNextInspection = formatDateSlash(nextInspectionDate.toISOString().split('T')[0]);

  // Load signatures from localStorage
  useEffect(() => {
    if (equipment && docType) {
      const storageKey = `eq_doc_sig_${equipment.id}_${docType}`;
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          setSignatures(JSON.parse(saved));
        } else {
          setSignatures({});
        }
      } catch (e) {
        setSignatures({});
      }
    }
  }, [equipment?.id, docType]);

  const handleOpenSigning = (key: string, title: string, defaultName: string) => {
    const existing = signatures[key];
    setSigningModal({
      key,
      title,
      defaultName: existing?.name || defaultName || '',
      defaultDate: existing?.date || formattedToday || '',
    });
  };

  const handleSaveSignature = (data: { signature: string; name: string; date: string }) => {
    if (!signingModal || !equipment || !docType) return;
    const { key } = signingModal;
    const storageKey = `eq_doc_sig_${equipment.id}_${docType}`;
    setSignatures(prev => {
      const updated = { ...prev, [key]: data };
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleRemoveSignature = (key: string) => {
    if (!equipment || !docType) return;
    const storageKey = `eq_doc_sig_${equipment.id}_${docType}`;
    setSignatures(prev => {
      const updated = { ...prev };
      delete updated[key];
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  if (!isOpen) return null;

  const isListView = !equipment && equipmentList && equipmentList.length > 0;

  const warrantyRange = equipment ? formatWarrantyDateRange(equipment) : null;
  const warrantyExpiration = warrantyRange?.end || (equipment?.warrantyPeriod ? formatDateSlash(equipment.warrantyPeriod) : '');

  // Derived classification & risks for the selected device
  const risk = (equipment?.riskLevel || 'Low').toLowerCase();
  const isHighRisk = risk.includes('high') || risk.includes('critical');
  const isMedRisk = risk.includes('medium') || risk.includes('moderate');
  const isLowRisk = !isHighRisk && !isMedRisk;

  const nameLower = (equipment?.name || '').toLowerCase();
  const isLifeSupport = isHighRisk || nameLower.includes('ventilator') || nameLower.includes('defib') || nameLower.includes('anesthesia');
  const isDiagnostic = !isLifeSupport && (nameLower.includes('monitor') || nameLower.includes('ecg') || nameLower.includes('x-ray') || nameLower.includes('ultra') || nameLower.includes('scop'));
  const isCriticalMonitoring = !isLifeSupport && !isDiagnostic && nameLower.includes('monitor');
  const isTherapeutic = !isLifeSupport && !isDiagnostic && (nameLower.includes('pump') || nameLower.includes('cautery') || nameLower.includes('laser'));
  const isEnergyEmitting = nameLower.includes('laser') || nameLower.includes('x-ray') || nameLower.includes('radio');
  const isMiscOther = !isLifeSupport && !isDiagnostic && !isCriticalMonitoring && !isTherapeutic && !isEnergyEmitting;

  const hasClinicalAlarm = isHighRisk || isLifeSupport || isDiagnostic;

  const docTitle = isListView
    ? `Equipment_Register_List_${today.toISOString().split('T')[0]}`
    : docType === 'mutation_in'
    ? `Mutation_IN_${equipment?.code || 'Device'}`
    : docType === 'inspection'
    ? `Inspection_Report_${equipment?.code || 'Device'}`
    : `Equipment_${equipment?.code || 'Device'}`;

  const handlePrint = async () => {
    if (!printContentRef.current || isPrinting) return;
    setIsPrinting(true);
    try {
      await printElement(printContentRef.current, {
        documentTitle: docTitle,
        pageOrientation: isListView ? 'landscape' : 'portrait',
        pageMargin: '4mm 4mm'
      });
    } catch (err) {
      console.error('Print failed:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  // =========================================================================
  // 1. หน้าต่างเล็กๆ ให้เลือกเอกสาร (Small Choice Popup Dialog)
  // =========================================================================
  if (equipment && docType === null) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-scale-up">
          {/* Header */}
          <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-blue-600/30 text-blue-400 rounded-xl border border-blue-500/30">
                <Printer size={18} />
              </div>
              <div>
                <h3 className="font-bold text-sm">พิมพ์เอกสารเครื่องมือแพทย์</h3>
                <p className="text-xs text-slate-400">เลือกประเภทเอกสารที่ต้องการพิมพ์</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="ปิดหน้าต่าง"
            >
              <X size={18} />
            </button>
          </div>

          {/* Current Selected Equipment Badge */}
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <div className="text-[11px] text-slate-500 font-medium mb-1.5 flex items-center space-x-1">
              <Tag size={12} className="text-slate-400" />
              <span>เครื่องมือแพทย์ที่เลือก:</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-mono font-bold text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-200 shrink-0">
                {equipment.code}
              </span>
              <span className="text-xs font-semibold text-slate-800 truncate" title={equipment.name}>
                {equipment.name}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200/80">
              <div className="truncate">
                <span className="text-slate-400">แผนก: </span>
                <strong className="text-slate-700 font-medium">{equipment.department || '-'}</strong>
              </div>
              <div className="truncate">
                <span className="text-slate-400">S/N: </span>
                <strong className="text-slate-700 font-mono font-medium">{equipment.serialNumber || '-'}</strong>
              </div>
              <div className="truncate">
                <span className="text-slate-400">รุ่น: </span>
                <span className="text-slate-700 font-medium">{equipment.model || '-'}</span>
              </div>
              <div className="truncate">
                <span className="text-slate-400">Itris ID: </span>
                <span className="text-slate-700 font-mono">{equipment.itrisId || '-'}</span>
              </div>
            </div>
          </div>

          {/* Document Selection Buttons */}
          <div className="p-4 space-y-3">
            {/* Option 1: เอกสาร Mutation IN */}
            <button
              type="button"
              onClick={() => setDocType('mutation_in')}
              className="w-full text-left p-3.5 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50/60 transition-all flex items-start space-x-3 group cursor-pointer shadow-2xs hover:shadow-sm"
            >
              <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0 mt-0.5">
                <ArrowDownRight size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 group-hover:text-blue-700 transition-colors">
                    เอกสาร Mutation IN
                  </h4>
                  <span className="text-[10px] font-mono font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                    FP-OP-005-001
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  MUTATION-IN OF MEDICAL DEVICE FORM (แบบฟอร์มรับเครื่องมือแพทย์เข้าสู่ระบบ)
                </p>
              </div>
            </button>

            {/* Option 2: เอกสาร Inspection */}
            <button
              type="button"
              onClick={() => setDocType('inspection')}
              className="w-full text-left p-3.5 rounded-xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/60 transition-all flex items-start space-x-3 group cursor-pointer shadow-2xs hover:shadow-sm"
            >
              <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0 mt-0.5">
                <ClipboardCheck size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                    เอกสาร Inspection
                  </h4>
                  <span className="text-[10px] font-mono font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                    FP-OP-005-005
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Medical Equipment testing, installation and commissioning form (แบบตรวจรับและทดสอบสภาพเครื่อง)
                </p>
              </div>
            </button>
          </div>

          {/* Dialog Footer */}
          <div className="px-4 py-3 bg-slate-100 border-t border-slate-200 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors border border-slate-300 cursor-pointer"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. หน้าต่างแสดงผลเอกสารสำหรับสั่งพิมพ์ (Document Print Preview Modal)
  // =========================================================================
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden my-4 border border-slate-200 print-clean-page animate-fade-in flex flex-col max-h-[95vh]">
        {/* Modal Action Header (Hidden when printing) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-3 bg-slate-900 text-white gap-3 shrink-0 print:hidden">
          <div className="flex items-center space-x-3">
            {equipment && (
              <button
                type="button"
                onClick={() => setDocType(null)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700 cursor-pointer"
                title="ย้อนกลับไปเลือกเอกสาร (Mutation IN / Inspection)"
              >
                <ArrowLeft size={16} />
              </button>
            )}

            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm sm:text-base">
                  {docType === 'mutation_in'
                    ? 'MUTATION-IN OF MEDICAL DEVICE FORM'
                    : docType === 'inspection'
                    ? 'Medical Equipment testing, installation and commissioning form'
                    : 'รายงานทะเบียนเครื่องมือแพทย์'}
                </span>
                {equipment && (
                  <span className="bg-blue-600/40 text-blue-300 px-2 py-0.5 rounded text-xs font-mono font-semibold">
                    {equipment.code}
                  </span>
                )}
                {lastSavedTime && (
                  <span
                    className="flex items-center space-x-1 text-[11px] text-emerald-300 bg-emerald-950/70 border border-emerald-500/40 px-2.5 py-0.5 rounded-full animate-fade-in"
                    title={`บันทึกอัตโนมัติล่าสุดเมื่อ ${lastSavedTime}`}
                  >
                    <Check size={12} strokeWidth={2.5} className="text-emerald-400" />
                    <span>บันทึกอัตโนมัติแล้ว</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center space-x-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs cursor-pointer"
              title="สั่งพิมพ์ไปยังเครื่องพิมพ์"
            >
              {isPrinting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>กำลังส่ง...</span>
                </>
              ) : (
                <>
                  <Printer size={14} />
                  <span>สั่งพิมพ์ (Print)</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="ปิดหน้าต่าง"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet View Area */}
        <div className="flex-1 overflow-y-auto p-2 sm:p-4 bg-slate-200 flex justify-center">
          <div ref={printContentRef} className="w-full max-w-[794px] bg-white print:bg-white text-black font-sans leading-tight">
            
            {/* ========================================================================= */}
            {/* DOCUMENT A: MUTATION-IN OF MEDICAL DEVICE FORM (100% Exact to PDF Image) */}
            {/* ========================================================================= */}
            {docType === 'mutation_in' && equipment && (
              <div
                className="bg-white px-7 py-5 text-black print:p-2 mx-auto"
                style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
              >
                {/* Outer Double Border Frame (3px double black) */}
                <div className="border-[3px] border-double border-black">
                  {/* Top Header & Device Info Area (separated from body by 3px double bottom border) */}
                  <div className="px-2.5 pt-2 pb-3 border-b-[3px] border-double border-black">
                    {/* 1. Header with Title and iTRiS SVG Logo */}
                    <div className="flex items-start justify-between relative">
                      <div className="flex-1 text-center pt-4 pl-16">
                        <h1 className="text-[14.5px] font-bold uppercase tracking-normal text-black">
                          MUTATION-IN OF MEDICAL DEVICE FORM
                        </h1>
                      </div>
                      {/* Exact iTRiS SVG Logo */}
                      <div className="shrink-0 pr-5">
                        <svg
                          viewBox="0 0 185 52"
                          className="h-[38px] w-auto"
                          aria-label="iTRiS"
                        >
                          <polygon points="4,12 38,12 34,46 0,46" fill="#d32027" />
                          <polygon points="2,25 29,25 28,33 1,33" fill="#ffffff" />
                          <polygon points="15,17 23,17 20,41 12,41" fill="#ffffff" />
                          <polygon points="47,12 56,12 55,19 46,19" fill="#d32027" />
                          <polygon points="60,12 112,12 111,19 59,19" fill="#d32027" />
                          <polygon points="130,3 139,3 138,10 129,10" fill="#d32027" />
                          <polygon points="45,22 54,22 50,46 41,46" fill="#d32027" />
                          <polygon points="73,18 83,18 78,46 68,46" fill="#d32027" />
                          <path
                            d="M93,46 L98,18 L115,18 C122,18 125,21 124,26 C123,31 119,33 114,34 L121,46 L111,46 L105,35 L103,35 L101,46 Z M104,29 L111,29 C114,29 115,28 115,26 C116,24 114,23 111,23 L105,23 Z"
                            fill="#d32027"
                          />
                          <polygon points="128,14 137,14 132,46 123,46" fill="#d32027" />
                          <path
                            d="M140,37 L149,37 C149,40 151,41 156,41 C160,41 163,40 163,38 C163,36 161,35 155,34 C146,32 142,29 143,23 C144,16 151,12 161,12 C170,12 175,16 175,22 L166,22 C166,19 164,18 159,18 C155,18 153,19 152,21 C152,23 154,24 160,25 C169,27 173,30 172,36 C171,43 165,47 154,47 C144,47 139,43 140,37 Z"
                            fill="#d32027"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* 2. Top Device Information Row (DEVICE NAME* / UMNDS CODE* / DATE*) */}
                    <div className="flex items-baseline text-[9.5px] mt-4">
                      <div className="flex items-baseline w-[46%]">
                        <span className="font-bold whitespace-nowrap mr-1.5">DEVICE NAME*:</span>
                        <span className="border-b border-black w-[210px] font-semibold text-black px-1 truncate">
                          {equipment.name}
                        </span>
                      </div>
                      <div className="flex items-baseline w-[23%]">
                        <span className="font-bold whitespace-nowrap mr-1.5">UMNDS CODE*:</span>
                        <span className="border-b border-black w-[68px] font-mono font-medium text-black px-1 truncate">
                          {equipment.umdnsCode || equipment.itrisId || ''}
                        </span>
                      </div>
                      <div className="flex items-baseline flex-1">
                        <span className="font-bold whitespace-nowrap mr-1.5">DATE*:</span>
                        <span className="border-b border-black w-[115px] font-medium text-black px-1 text-center">
                          {equipment.registrationDate ? formatDateSlash(equipment.registrationDate) : formattedToday}
                        </span>
                      </div>
                    </div>

                    {/* 3. Ownership Checkboxes Row */}
                    <div className="flex items-end pt-4 pl-5 text-[7.5px]">
                      <div className="w-[24.5%]">
                        <CheckSquare
                          checked={ownership === 'hospital'}
                          onClick={() => setOwnership(prev => prev === 'hospital' ? null : 'hospital')}
                          label="HOSPITAL OWNED"
                        />
                      </div>
                      <div className="w-[23%]">
                        <CheckSquare
                          checked={ownership === 'leased'}
                          onClick={() => setOwnership(prev => prev === 'leased' ? null : 'leased')}
                          label="LEASED DEVICE"
                        />
                      </div>
                      <div className="w-[21%]">
                        <CheckSquare
                          checked={ownership === 'profit_sharing'}
                          onClick={() => setOwnership(prev => prev === 'profit_sharing' ? null : 'profit_sharing')}
                          label="PROFIT SHARING"
                        />
                      </div>
                      <div className="flex items-end flex-1">
                        <CheckSquare
                          checked={ownership === 'other'}
                          onClick={() => setOwnership(prev => prev === 'other' ? null : 'other')}
                          label="OTHER"
                        />
                        <span className="border-b border-black w-[110px] ml-1.5 px-1 min-h-[14px] flex items-center">
                          <input
                            type="text"
                            value={otherOwnershipText}
                            onChange={(e) => {
                              setOtherOwnershipText(e.target.value);
                              if (e.target.value.trim()) {
                                setOwnership('other');
                              }
                            }}
                            onFocus={() => setOwnership('other')}
                            className="w-full bg-transparent outline-none text-[8.5px] text-black font-medium p-0"
                          />
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4. Main 2-Column Body (Left 46.5% || Right 53.5% divided by 3px double vertical border) */}
                  <div className="flex text-[9.5px] text-black">
                    {/* ========================================= */}
                    {/* LEFT COLUMN (46.5%)                       */}
                    {/* ========================================= */}
                    <div className="w-[46.5%] border-r-[3px] border-double border-black flex flex-col">
                      {/* Box 1: CODE* / ASSET NO. / PO/CTX NO. (height 94px, matches DEPARTMENT*) */}
                      <div className="h-[94px] px-2 py-2 border-b border-black flex flex-col justify-between">
                        <div className="flex items-baseline">
                          <span className="w-[44px] shrink-0 font-bold whitespace-nowrap">CODE*:</span>
                          <span className="border-b border-black w-[155px] font-mono font-bold text-black px-1 truncate">
                            {equipment.code}
                          </span>
                        </div>

                        <div className="space-y-1.5 pt-2">
                          <div className="flex items-center">
                            <span className="w-[68px] shrink-0 font-bold whitespace-nowrap">ASSET NO.:</span>
                            <span className="border-b border-black w-[108px] font-mono px-1 truncate mr-4">
                              {equipment.assetNo || ''}
                            </span>
                            <RadioCircle
                              label="N/A"
                              checked={assetNoChoice === 'NA'}
                              onClick={() => setAssetNoChoice(prev => prev === 'NA' ? null : 'NA')}
                              className="mr-0"
                            />
                          </div>

                          <div className="flex items-center">
                            <span className="w-[68px] shrink-0 font-bold whitespace-nowrap">PO/CTX NO.:</span>
                            <span className="border-b border-black w-[108px] font-mono px-1 truncate mr-4">
                              {equipment.poNo || ''}
                            </span>
                            <RadioCircle
                              label="N/A"
                              checked={poNoChoice === 'NA'}
                              onClick={() => setPoNoChoice(prev => prev === 'NA' ? null : 'NA')}
                              className="mr-0"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Box 2: CLASSIFICATION* / CLINICAL ALARM / RISK LEVEL* (height 138px, matches LOCATION* + INSPECTION FREQUENCY) */}
                      <div className="h-[138px] px-2 py-1.5 border-b border-black flex flex-col justify-between">
                        <div>
                          <div className="font-bold mb-1.5">CLASSIFICATION*</div>
                          <div className="grid grid-cols-12 gap-y-1.5 pl-4">
                            <div className="col-span-7">
                              <RadioCircle
                                label="LIFE SUPPORT OR RESC"
                                checked={classificationChoice === 'LIFE SUPPORT OR RESC'}
                                onClick={() => setClassificationChoice(prev => prev === 'LIFE SUPPORT OR RESC' ? null : 'LIFE SUPPORT OR RESC')}
                              />
                            </div>
                            <div className="col-span-5">
                              <RadioCircle
                                label="DIAGNOSTIC"
                                checked={classificationChoice === 'DIAGNOSTIC'}
                                onClick={() => setClassificationChoice(prev => prev === 'DIAGNOSTIC' ? null : 'DIAGNOSTIC')}
                              />
                            </div>
                            <div className="col-span-7">
                              <RadioCircle
                                label="CRITICAL MONITORING"
                                checked={classificationChoice === 'CRITICAL MONITORING'}
                                onClick={() => setClassificationChoice(prev => prev === 'CRITICAL MONITORING' ? null : 'CRITICAL MONITORING')}
                              />
                            </div>
                            <div className="col-span-5">
                              <RadioCircle
                                label="ENERGY-EMITTING"
                                checked={classificationChoice === 'ENERGY-EMITTING'}
                                onClick={() => setClassificationChoice(prev => prev === 'ENERGY-EMITTING' ? null : 'ENERGY-EMITTING')}
                              />
                            </div>
                            <div className="col-span-7">
                              <RadioCircle
                                label="THERAPEUTIC"
                                checked={classificationChoice === 'THERAPEUTIC'}
                                onClick={() => setClassificationChoice(prev => prev === 'THERAPEUTIC' ? null : 'THERAPEUTIC')}
                              />
                            </div>
                            <div className="col-span-5">
                              <RadioCircle
                                label="MISC OTHER"
                                checked={classificationChoice === 'MISC OTHER'}
                                onClick={() => setClassificationChoice(prev => prev === 'MISC OTHER' ? null : 'MISC OTHER')}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="font-bold whitespace-nowrap">CLINICAL ALARM</span>
                          <div className="flex items-center space-x-3">
                            <RadioCircle
                              label="YES"
                              checked={clinicalAlarmChoice === 'YES'}
                              onClick={() => setClinicalAlarmChoice(prev => prev === 'YES' ? null : 'YES')}
                              className="mr-0"
                            />
                            <RadioCircle
                              label="NO"
                              checked={clinicalAlarmChoice === 'NO'}
                              onClick={() => setClinicalAlarmChoice(prev => prev === 'NO' ? null : 'NO')}
                              className="mr-0"
                            />
                            <RadioCircle
                              label="UNKNOWN"
                              checked={clinicalAlarmChoice === 'UNKNOWN'}
                              onClick={() => setClinicalAlarmChoice(prev => prev === 'UNKNOWN' ? null : 'UNKNOWN')}
                              className="mr-0"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="font-bold whitespace-nowrap">RISK LEVEL*</span>
                          <div className="flex items-center space-x-3 pr-2">
                            <RadioCircle
                              label="HIGH"
                              checked={riskLevelChoice === 'HIGH'}
                              onClick={() => setRiskLevelChoice(prev => prev === 'HIGH' ? null : 'HIGH')}
                              className="mr-0"
                            />
                            <RadioCircle
                              label="MEDUIM"
                              checked={riskLevelChoice === 'MEDUIM'}
                              onClick={() => setRiskLevelChoice(prev => prev === 'MEDUIM' ? null : 'MEDUIM')}
                              className="mr-0"
                            />
                            <RadioCircle
                              label="LOW"
                              checked={riskLevelChoice === 'LOW'}
                              onClick={() => setRiskLevelChoice(prev => prev === 'LOW' ? null : 'LOW')}
                              className="mr-0"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Box 3: MANUFACTURER / MODEL / SERIAL NO. (height 140px, matches OPERATION+SERVICE MANUAL + WARRANTY) */}
                      <div className="h-[140px] px-2 py-1.5 border-b border-black flex flex-col justify-between">
                        {/* MANUFACTURER */}
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold">MANUFACTURER</span>
                            <div className="flex items-center space-x-2">
                              <RadioCircle
                                label="N/A"
                                checked={manufacturerChoice === 'NA'}
                                onClick={() => setManufacturerChoice(prev => prev === 'NA' ? null : 'NA')}
                                className="mr-0"
                              />
                              <RadioCircle
                                label="UNKNOWN"
                                checked={manufacturerChoice === 'UNKNOWN'}
                                onClick={() => setManufacturerChoice(prev => prev === 'UNKNOWN' ? null : 'UNKNOWN')}
                                className="mr-0"
                              />
                            </div>
                          </div>
                          <div className="border-b border-black w-[62%] min-h-[15px] px-1 font-medium truncate">
                            {equipment.manufacturer || ''}
                          </div>
                        </div>

                        {/* MODEL */}
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold">MODEL</span>
                            <div className="flex items-center space-x-2">
                              <RadioCircle
                                label="N/A"
                                checked={modelChoice === 'NA'}
                                onClick={() => setModelChoice(prev => prev === 'NA' ? null : 'NA')}
                                className="mr-0"
                              />
                              <RadioCircle
                                label="UNKNOWN"
                                checked={modelChoice === 'UNKNOWN'}
                                onClick={() => setModelChoice(prev => prev === 'UNKNOWN' ? null : 'UNKNOWN')}
                                className="mr-0"
                              />
                            </div>
                          </div>
                          <div className="border-b border-black w-[62%] min-h-[15px] px-1 font-medium truncate">
                            {equipment.model || ''}
                          </div>
                        </div>

                        {/* SERIAL NO. */}
                        <div className="pb-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold">SERIAL NO.</span>
                            <div className="flex items-center space-x-2">
                              <RadioCircle
                                label="N/A"
                                checked={serialNoChoice === 'NA'}
                                onClick={() => setSerialNoChoice(prev => prev === 'NA' ? null : 'NA')}
                                className="mr-0"
                              />
                              <RadioCircle
                                label="UNKNOWN"
                                checked={serialNoChoice === 'UNKNOWN'}
                                onClick={() => setSerialNoChoice(prev => prev === 'UNKNOWN' ? null : 'UNKNOWN')}
                                className="mr-0"
                              />
                            </div>
                          </div>
                          <div className="border-b border-black w-[62%] min-h-[15px] px-1 font-mono font-medium truncate">
                            {equipment.serialNumber && equipment.serialNumber !== '-' ? equipment.serialNumber : ''}
                          </div>
                        </div>
                      </div>

                      {/* Box 4: SOFTWARE (height 68px, matches SERVICE AFTER WARRANTY) */}
                      <div className="h-[68px] px-2 py-1.5 border-b border-black flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="font-bold">SOFTWARE</span>
                          <div className="flex items-center space-x-5 pr-2 text-[9px]">
                            <span>N/A</span>
                            <span>UNKNOWN</span>
                          </div>
                        </div>
                        <div className="flex items-baseline pl-1.5">
                          <span className="w-[52px] shrink-0 text-[9px]">VERSION:</span>
                          <span className="border-b border-black w-[108px] px-1">&nbsp;</span>
                        </div>
                        <div className="flex items-baseline pl-1.5">
                          <span className="w-[52px] shrink-0 text-[9px]">REV. NO.:</span>
                          <span className="border-b border-black w-[108px] px-1">&nbsp;</span>
                        </div>
                      </div>

                      {/* Box 5: ASSOCIATED ACCESSORIES (height 94px, matches STICKERS IN PLACE*) */}
                      <div className="h-[94px] px-2 py-1.5 border-b border-black flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="font-bold">ASSOCIATED ACCESSORIES</span>
                          <div className="pr-16">
                            <RadioCircle
                              label="NON"
                              checked={accessoriesNon}
                              onClick={() => setAccessoriesNon(prev => !prev)}
                              className="mr-0"
                            />
                          </div>
                        </div>
                        <div className="border-b border-black min-h-[15px] px-1 truncate">
                          {equipment.accessories || ''}
                        </div>
                        <div className="border-b border-black min-h-[15px]">&nbsp;</div>
                        <div className="border-b border-black min-h-[15px] mb-1">&nbsp;</div>
                      </div>

                      {/* Box 6: CONSUMABLES USED (height 68px) */}
                      <div className="h-[68px] px-2 py-1.5 border-b border-black flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="font-bold">CONSUMABLES USED</span>
                          <div className="pr-16">
                            <RadioCircle
                              label="NON"
                              checked={consumablesNon}
                              onClick={() => setConsumablesNon(prev => !prev)}
                              className="mr-0"
                            />
                          </div>
                        </div>
                        <div className="border-b border-black min-h-[15px] px-1 truncate">
                          {equipment.consumables || ''}
                        </div>
                        <div className="min-h-[6px]"></div>
                      </div>

                      {/* Box 7: INSTALLATION DATE (height 66px) */}
                      <div className="h-[66px] px-2 py-1.5 border-b border-black flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="font-bold">INSTALLATION DATE</span>
                          <div className="flex items-center space-x-2">
                            <RadioCircle
                              label="N/A"
                              checked={installationDateChoice === 'NA'}
                              onClick={() => setInstallationDateChoice(prev => prev === 'NA' ? null : 'NA')}
                              className="mr-0"
                            />
                            <RadioCircle
                              label="UNKNOWN"
                              checked={installationDateChoice === 'UNKNOWN'}
                              onClick={() => setInstallationDateChoice(prev => prev === 'UNKNOWN' ? null : 'UNKNOWN')}
                              className="mr-0"
                            />
                          </div>
                        </div>
                        <div className="border-b border-black w-full min-h-[16px] px-1 font-mono text-center mb-1">
                          {equipment.installationDate ? formatDateSlash(equipment.installationDate) : ''}
                        </div>
                      </div>

                      {/* Box 8: PURCHASE DATE* (height 66px) */}
                      <div className="h-[66px] px-2 py-1.5 border-b border-black flex flex-col justify-between">
                        <div className="font-bold">PURCHASE DATE*</div>
                        <div className="border-b border-black w-full min-h-[16px] px-1 font-mono text-center mb-1">
                          {equipment.purchaseDate ? formatDateSlash(equipment.purchaseDate) : ''}
                        </div>
                      </div>

                      {/* Box 9: VENDOR NAME (height 48px) */}
                      <div className="h-[48px] px-2 py-1 border-b border-black flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="font-bold">VENDOR NAME</span>
                          <div className="flex items-center space-x-2">
                            <RadioCircle
                              label="N/A"
                              checked={vendorChoice === 'NA'}
                              onClick={() => setVendorChoice(prev => prev === 'NA' ? null : 'NA')}
                              className="mr-0"
                            />
                            <RadioCircle
                              label="UNKNOWN"
                              checked={vendorChoice === 'UNKNOWN'}
                              onClick={() => setVendorChoice(prev => prev === 'UNKNOWN' ? null : 'UNKNOWN')}
                              className="mr-0"
                            />
                          </div>
                        </div>
                        <div className="border-b border-black w-[72%] min-h-[15px] px-1 font-medium truncate mb-0.5">
                          {equipment.vendorCompany || ''}
                        </div>
                      </div>

                      {/* Box 10: PURCHASE PRICE* (height 48px) */}
                      <div className="h-[48px] px-2 py-1 flex flex-col justify-between">
                        <div className="font-bold">PURCHASE PRICE*</div>
                        <div className="border-b border-black w-[94%] min-h-[15px] px-1 font-mono font-semibold mb-1.5">
                          {equipment.purchase && formatPurchasePrice(equipment.purchase) !== '-' ? formatPurchasePrice(equipment.purchase) : ''}
                        </div>
                      </div>
                    </div>

                    {/* ========================================= */}
                    {/* RIGHT COLUMN (53.5%)                      */}
                    {/* ========================================= */}
                    <div className="w-[53.5%] flex flex-col">
                      {/* Right Box 1: DEPARTMENT* (height 94px, matches Left Box 1) */}
                      <div className="h-[94px] px-3 py-2 border-b border-black flex flex-col justify-between">
                        <div className="font-bold">DEPARTMENT*</div>
                        <div className="flex items-baseline pl-5 pr-4">
                          <span className="w-[125px] shrink-0">Full Name:</span>
                          <span className="border-b border-black flex-1 px-1 font-semibold truncate">
                            {equipment.department || ''}
                          </span>
                        </div>
                        <div className="flex items-baseline pl-5 pr-4">
                          <span className="w-[125px] shrink-0">Abbreviation:</span>
                          <span className="border-b border-black flex-1 px-1 font-mono truncate">
                            {equipment.deptAbbreviation || ''}
                          </span>
                        </div>
                        <div className="flex items-baseline pl-5 pr-4">
                          <span className="w-[125px] shrink-0">Cost Center/Dept. Code*:</span>
                          <span className="border-b border-black flex-1 px-1 font-mono truncate">
                            {equipment.costCenter || ''}
                          </span>
                        </div>
                      </div>

                      {/* Right Box 2A: LOCATION* (height 70px) */}
                      <div className="h-[70px] px-3 py-1.5 border-b border-black flex flex-col justify-between">
                        <div className="flex items-center">
                          <span className="font-bold w-[82px]">LOCATION*:</span>
                          <div className="w-[90px]">
                            <RadioCircle
                              label="FIX"
                              checked={locationChoice === 'FIX'}
                              onClick={() => setLocationChoice(prev => prev === 'FIX' ? null : 'FIX')}
                            />
                          </div>
                          <div>
                            <RadioCircle
                              label="MOVABLE"
                              checked={locationChoice === 'MOVABLE'}
                              onClick={() => setLocationChoice(prev => prev === 'MOVABLE' ? null : 'MOVABLE')}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 pl-9 pr-4">
                          <div className="flex items-baseline">
                            <span className="w-[46px] shrink-0">Building:</span>
                            <span className="border-b border-black flex-1 px-1 truncate">
                              {equipment.building || ''}
                            </span>
                          </div>
                          <div className="flex items-baseline">
                            <span className="w-[38px] shrink-0">Floor:</span>
                            <span className="border-b border-black flex-1 px-1 truncate">
                              {equipment.floor || ''}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 pl-9 pr-4 pb-0.5">
                          <div className="flex items-baseline">
                            <span className="w-[46px] shrink-0">Room:</span>
                            <span className="border-b border-black flex-1 px-1 truncate">
                              {equipment.room || ''}
                            </span>
                          </div>
                          <div className="flex items-baseline">
                            <span className="w-[38px] shrink-0">Station:</span>
                            <span className="border-b border-black flex-1 px-1 truncate">
                              {equipment.station || ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Box 2B: INSPECTION FREQUENCY (height 68px, total 70+68 = 138px matching Left Box 2) */}
                      <div className="h-[68px] px-3 py-1.5 border-b border-black flex flex-col justify-between">
                        <div>
                          <span className="font-bold mr-2">INSPECTION FREQUENCY</span>
                          <span className="font-normal">(times per year)</span>
                        </div>
                        <div className="flex items-center pl-4">
                          <div className="w-[100px]">
                            <RadioCircle
                              label="1 / Year"
                              checked={inspectionFreqChoice === '1'}
                              onClick={() => setInspectionFreqChoice(prev => prev === '1' ? null : '1')}
                            />
                          </div>
                          <div>
                            <RadioCircle
                              label="2 / Year"
                              checked={inspectionFreqChoice === '2'}
                              onClick={() => setInspectionFreqChoice(prev => prev === '2' ? null : '2')}
                            />
                          </div>
                        </div>
                        <div className="flex items-baseline pl-4 pr-2">
                          <div className="w-[100px] shrink-0">
                            <RadioCircle
                              label="3 / Year"
                              checked={inspectionFreqChoice === '3'}
                              onClick={() => setInspectionFreqChoice(prev => prev === '3' ? null : '3')}
                            />
                          </div>
                          <div className="flex items-baseline flex-1">
                            <RadioCircle
                              label="Other"
                              checked={inspectionFreqChoice === 'other'}
                              onClick={() => setInspectionFreqChoice(prev => prev === 'other' ? null : 'other')}
                            />
                            <span className="border-b border-black flex-1 ml-2">&nbsp;</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Box 3A: OPERATION MANUAL / SERVICE MANUAL (height 92px) */}
                      <div className="h-[92px] px-3 py-1.5 border-b border-black flex flex-col justify-between">
                        <div>
                          <div className="font-bold mb-1">OPERATION MANUAL</div>
                          <div className="flex items-center pl-4 space-x-4">
                            <RadioCircle
                              label="No"
                              checked={operationManualChoice === 'no'}
                              onClick={() => setOperationManualChoice(prev => prev === 'no' ? null : 'no')}
                            />
                            <RadioCircle
                              label="Yes"
                              checked={operationManualChoice === 'yes'}
                              onClick={() => setOperationManualChoice(prev => prev === 'yes' ? null : 'yes')}
                            />
                          </div>
                        </div>
                        <div className="pb-0.5">
                          <div className="font-bold mb-1">SERVICE MANUAL</div>
                          <div className="flex items-center pl-4 space-x-4">
                            <RadioCircle
                              label="No"
                              checked={serviceManualChoice === 'no'}
                              onClick={() => setServiceManualChoice(prev => prev === 'no' ? null : 'no')}
                            />
                            <RadioCircle
                              label="Yes"
                              checked={serviceManualChoice === 'yes'}
                              onClick={() => setServiceManualChoice(prev => prev === 'yes' ? null : 'yes')}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Right Box 3B: WARRANTY / EXPIRATION DATE (height 48px, total 92+48 = 140px matching Left Box 3) */}
                      <div className="h-[48px] px-3 py-1.5 border-b border-black flex flex-col justify-between">
                        <div className="flex items-center">
                          <span className="font-bold w-[115px]">WARRANTY</span>
                          <span className="font-bold">EXPIRATION DATE</span>
                        </div>
                        <div className="flex items-baseline pb-0.5">
                          <div className="w-[115px] pl-4 flex items-center space-x-3 shrink-0">
                            <RadioCircle
                              label="No"
                              checked={warrantyChoice === 'no'}
                              onClick={() => setWarrantyChoice(prev => prev === 'no' ? null : 'no')}
                              className="mr-0"
                            />
                            <RadioCircle
                              label="Yes"
                              checked={warrantyChoice === 'yes'}
                              onClick={() => setWarrantyChoice(prev => prev === 'yes' ? null : 'yes')}
                              className="mr-0"
                            />
                          </div>
                          <div className="flex-1 pl-[90px] pr-2">
                            <div className="border-b border-black w-full min-h-[14px] font-mono text-center text-[9px]">
                              {warrantyExpiration && warrantyExpiration !== '-' ? warrantyExpiration : ''}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Box 4: SERVICE AFTER WARRANTY (height 68px, matches Left Box 4 SOFTWARE) */}
                      <div className="h-[68px] px-3 py-1.5 border-b border-black flex flex-col justify-start space-y-2">
                        <div className="font-bold">SERVICE AFTER WARRANTY</div>
                        <div className="flex items-center pl-4 space-x-4">
                          <RadioCircle
                            label="No"
                            checked={serviceAfterWarrantyChoice === 'no'}
                            onClick={() => setServiceAfterWarrantyChoice(prev => prev === 'no' ? null : 'no')}
                          />
                          <RadioCircle
                            label="Yes"
                            checked={serviceAfterWarrantyChoice === 'yes'}
                            onClick={() => setServiceAfterWarrantyChoice(prev => prev === 'yes' ? null : 'yes')}
                          />
                        </div>
                      </div>

                      {/* Right Box 5: STICKERS IN PLACE* (height 94px, matches Left Box 5 ASSOCIATED ACCESSORIES) */}
                      <div className="h-[94px] px-3 py-1.5 border-b border-black flex flex-col justify-between">
                        <div className="font-bold">STICKERS IN PLACE*</div>
                        <div className="grid grid-cols-12 gap-y-1.5 pl-4 pb-1">
                          <div className="col-span-6">
                            <RadioCircle
                              label="Code"
                              checked={stickersInPlace.code}
                              onClick={() => setStickersInPlace(prev => ({ ...prev, code: !prev.code }))}
                            />
                          </div>
                          <div className="col-span-6">
                            <RadioCircle
                              label="Inspection"
                              checked={stickersInPlace.inspection}
                              onClick={() => setStickersInPlace(prev => ({ ...prev, inspection: !prev.inspection }))}
                            />
                          </div>
                          <div className="col-span-6">
                            <RadioCircle
                              label="Preventive Maintenance"
                              checked={stickersInPlace.pm}
                              onClick={() => setStickersInPlace(prev => ({ ...prev, pm: !prev.pm }))}
                            />
                          </div>
                          <div className="col-span-6">
                            <RadioCircle
                              label="Hospital Asset No."
                              checked={stickersInPlace.assetNo}
                              onClick={() => setStickersInPlace(prev => ({ ...prev, assetNo: !prev.assetNo }))}
                            />
                          </div>
                          <div className="col-span-6">
                            <RadioCircle
                              label="Calibration"
                              checked={stickersInPlace.calibration}
                              onClick={() => setStickersInPlace(prev => ({ ...prev, calibration: !prev.calibration }))}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Right Box 6: EQUIPMENT CONDITION (STATUS)* (height 50px) */}
                      <div className="h-[50px] px-3 py-1.5 border-b border-black flex flex-col justify-between">
                        <div className="font-bold">EQUIPMENT CONDITION (STATUS)*</div>
                        <div className="flex items-center pl-4 space-x-6 pb-0.5">
                          <RadioCircle
                            label="NEW"
                            checked={equipmentConditionChoice === 'NEW'}
                            onClick={() => setEquipmentConditionChoice(prev => prev === 'NEW' ? null : 'NEW')}
                          />
                          <RadioCircle
                            label="RE-INVENTORY"
                            checked={equipmentConditionChoice === 'RE-INVENTORY'}
                            onClick={() => setEquipmentConditionChoice(prev => prev === 'RE-INVENTORY' ? null : 'RE-INVENTORY')}
                          />
                        </div>
                      </div>

                      {/* Right Box 7: COMMENTS (height 82px, with 3 ruled lines) */}
                      <div className="h-[82px] px-3 py-1.5 border-b border-black flex flex-col justify-between">
                        <div className="font-bold">COMMENTS</div>
                        <div className="pl-7 pr-1 space-y-2 pb-1">
                          <div className="border-b border-black min-h-[14px] flex items-center">
                            <input
                              type="text"
                              value={commentLine1}
                              onChange={(e) => setCommentLine1(e.target.value)}
                              className="w-full bg-transparent outline-none text-[8.5px] text-black p-0"
                            />
                          </div>
                          <div className="border-b border-black min-h-[14px] flex items-center">
                            <input
                              type="text"
                              value={commentLine2}
                              onChange={(e) => setCommentLine2(e.target.value)}
                              className="w-full bg-transparent outline-none text-[8.5px] text-black p-0"
                            />
                          </div>
                          <div className="border-b border-black min-h-[14px]">&nbsp;</div>
                        </div>
                      </div>

                      {/* Right Box 8: SIGNATURES 2x3 Grid (remaining height = 164px to match bottom of PURCHASE PRICE*) */}
                      <div className="flex-1 flex flex-col">
                        {/* Row 1: SIGNATURES: (left 41%) | ITRIS ENGINEER* (right 59%) */}
                        <div className="flex border-b border-black h-[52px]">
                          <div className="w-[41%] px-2 py-1.5 border-r border-black flex items-center">
                            <span className="font-bold text-[10.5px] underline tracking-wide">SIGNATURES:</span>
                          </div>
                          <div className="w-[59%] px-2 py-1 flex flex-col justify-between relative">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[9px]">ITRIS ENGINEER*</span>
                              <div className="print:hidden flex items-center space-x-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenSigning('itris_engineer', 'ITRIS ENGINEER*', currentUser || 'ITRIS Biomedical Engineer')}
                                  className="text-[7.5px] bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white px-1 py-0.2 rounded border border-blue-200 transition-colors inline-flex items-center space-x-0.5 cursor-pointer"
                                >
                                  <PenLine size={8} />
                                  <span>{signatures['itris_engineer'] ? 'แก้ไข' : 'เซ็น'}</span>
                                </button>
                                {signatures['itris_engineer'] && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSignature('itris_engineer')}
                                    className="text-slate-400 hover:text-rose-600 p-0.5 rounded"
                                  >
                                    <Trash2 size={9} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                              {signatures['itris_engineer'] && (
                                <div className="flex items-center gap-1">
                                  <img
                                    src={signatures['itris_engineer'].signature}
                                    alt="ITRIS ENGINEER signature"
                                    className="max-h-[24px] max-w-[90px] object-contain"
                                  />
                                  <span className="text-[7.5px] font-medium">
                                    ({signatures['itris_engineer'].name})
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Row 2: MANAGER* (left 41%) | DEPARTMENT* (right 59%) */}
                        <div className="flex border-b border-black h-[56px]">
                          <div className="w-[41%] px-2 py-1 border-r border-black flex flex-col justify-between relative">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[9px]">MANAGER*</span>
                              <div className="print:hidden flex items-center space-x-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenSigning('manager', 'MANAGER*', 'ผู้จัดการ')}
                                  className="text-[7.5px] bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white px-1 py-0.2 rounded border border-blue-200 transition-colors inline-flex items-center space-x-0.5 cursor-pointer"
                                >
                                  <PenLine size={8} />
                                  <span>{signatures['manager'] ? 'แก้ไข' : 'เซ็น'}</span>
                                </button>
                                {signatures['manager'] && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSignature('manager')}
                                    className="text-slate-400 hover:text-rose-600 p-0.5 rounded"
                                  >
                                    <Trash2 size={9} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                              {signatures['manager'] && (
                                <div className="flex items-center gap-1">
                                  <img
                                    src={signatures['manager'].signature}
                                    alt="MANAGER signature"
                                    className="max-h-[24px] max-w-[90px] object-contain"
                                  />
                                  <span className="text-[7.5px] font-medium">
                                    ({signatures['manager'].name})
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="w-[59%] px-2 py-1 flex flex-col justify-between relative">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[9px]">DEPARTMENT*</span>
                              <div className="print:hidden flex items-center space-x-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenSigning('department', 'DEPARTMENT*', equipment.department || 'หัวหน้าแผนก')}
                                  className="text-[7.5px] bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white px-1 py-0.2 rounded border border-blue-200 transition-colors inline-flex items-center space-x-0.5 cursor-pointer"
                                >
                                  <PenLine size={8} />
                                  <span>{signatures['department'] ? 'แก้ไข' : 'เซ็น'}</span>
                                </button>
                                {signatures['department'] && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSignature('department')}
                                    className="text-slate-400 hover:text-rose-600 p-0.5 rounded"
                                  >
                                    <Trash2 size={9} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                              {signatures['department'] && (
                                <div className="flex items-center gap-1">
                                  <img
                                    src={signatures['department'].signature}
                                    alt="DEPARTMENT signature"
                                    className="max-h-[24px] max-w-[90px] object-contain"
                                  />
                                  <span className="text-[7.5px] font-medium">
                                    ({signatures['department'].name})
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Row 3: BME* (left 41%) | ADMIN* (right 59%) */}
                        <div className="flex flex-1 min-h-[56px]">
                          <div className="w-[41%] px-2 py-1 border-r border-black flex flex-col justify-between relative">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[9px]">BME*</span>
                              <div className="print:hidden flex items-center space-x-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenSigning('bme', 'BME*', 'วิศวกรชีวการแพทย์')}
                                  className="text-[7.5px] bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white px-1 py-0.2 rounded border border-blue-200 transition-colors inline-flex items-center space-x-0.5 cursor-pointer"
                                >
                                  <PenLine size={8} />
                                  <span>{signatures['bme'] ? 'แก้ไข' : 'เซ็น'}</span>
                                </button>
                                {signatures['bme'] && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSignature('bme')}
                                    className="text-slate-400 hover:text-rose-600 p-0.5 rounded"
                                  >
                                    <Trash2 size={9} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                              {signatures['bme'] && (
                                <div className="flex items-center gap-1">
                                  <img
                                    src={signatures['bme'].signature}
                                    alt="BME signature"
                                    className="max-h-[24px] max-w-[90px] object-contain"
                                  />
                                  <span className="text-[7.5px] font-medium">
                                    ({signatures['bme'].name})
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="w-[59%] px-2 py-1 flex flex-col justify-between relative">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[9px]">ADMIN*</span>
                              <div className="print:hidden flex items-center space-x-0.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenSigning('admin', 'ADMIN*', 'เจ้าหน้าที่แอดมิน')}
                                  className="text-[7.5px] bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white px-1 py-0.2 rounded border border-blue-200 transition-colors inline-flex items-center space-x-0.5 cursor-pointer"
                                >
                                  <PenLine size={8} />
                                  <span>{signatures['admin'] ? 'แก้ไข' : 'เซ็น'}</span>
                                </button>
                                {signatures['admin'] && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSignature('admin')}
                                    className="text-slate-400 hover:text-rose-600 p-0.5 rounded"
                                  >
                                    <Trash2 size={9} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                              {signatures['admin'] && (
                                <div className="flex items-center gap-1">
                                  <img
                                    src={signatures['admin'].signature}
                                    alt="ADMIN signature"
                                    className="max-h-[24px] max-w-[90px] object-contain"
                                  />
                                  <span className="text-[7.5px] font-medium">
                                    ({signatures['admin'].name})
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Document Footer Notice (OUTSIDE the rectangular frame) */}
                <div className="pt-2 px-3 flex items-center text-[8.5px] text-black">
                  <div className="w-[46.5%]">FP-OP-005-001</div>
                  <div>* mandatory field</div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* DOCUMENT B: INSPECTION REPORT (FP-OP-005-005) - 100% Exact to PDF Image    */}
            {/* Medical Equipment testing, installation and commissioning form             */}
            {/* ========================================================================= */}
            {docType === 'inspection' && equipment && (
              <div
                className="bg-white px-9 py-6 text-black print:px-5 print:py-3 mx-auto"
                style={{ fontFamily: 'Calibri, Arial, Helvetica, sans-serif' }}
              >
                {/* 1. Header with Exact İTRİS Vector Logo & MEDICAL (Thailand) Co., Ltd. */}
                <div className="pl-[16px] mb-2 flex items-end gap-x-2.5">
                  <svg
                    viewBox="0 0 138 48"
                    className="h-[43px] w-auto shrink-0"
                    aria-label="ITRIS"
                  >
                    {/* 1st 'I' dot & stem */}
                    <polygon points="10.8,9.5 12,2.5 21,2.5 19.8,9.5" fill="#c52828" />
                    <polygon points="4,46 10,13 19,13 13,46" fill="#c52828" />

                    {/* 'T' top bar & stem */}
                    <polygon points="22.5,19.5 23.7,13 50,13 48.8,19.5" fill="#c52828" />
                    <polygon points="29.5,46 34.5,18 43.5,18 38.5,46" fill="#c52828" />

                    {/* 'R' */}
                    <path
                      d="M49,46 L55,13 L72,13 C80,13 84,16.5 83,22.5 C82,27.5 78.5,30.5 73,31.5 L80,46 L70.5,46 L64.5,32.5 L60,32.5 L57.5,46 Z M61.2,26.5 L69,26.5 C72.5,26.5 74.2,25 74.6,22.5 C75,20 73.5,19 70,19 L62.5,19 Z"
                      fill="#c52828"
                    />

                    {/* 2nd 'I' dot & stem */}
                    <polygon points="92.8,9.5 94,2.5 103,2.5 101.8,9.5" fill="#c52828" />
                    <polygon points="86,46 92,13 101,13 95,46" fill="#c52828" />

                    {/* 'S' */}
                    <path
                      d="M102,36.5 L111,36.5 C111,39.5 113,41 117.5,41 C121.5,41 123.8,39.8 124,37.8 C124.2,35.8 122,34.8 116.5,33.5 C107.5,31.5 104,28.5 105,22.5 C106,16 112.5,12.5 122,12.5 C130.5,12.5 135,16 134.8,22 L126,22 C126,19.2 124.2,18 120,18 C116.2,18 114.2,19 113.8,21 C113.5,22.8 115.5,23.8 121,25 C129.8,27 133.5,30 132.5,36 C131.3,43 125.5,46.8 115.5,46.8 C105.8,46.8 101.2,42.5 102,36.5 Z"
                      fill="#c52828"
                    />
                  </svg>
                  <span className="text-[22px] italic font-bold text-[#7a7c7f] leading-none tracking-tight pb-[2px]">
                    MEDICAL (Thailand) Co., Ltd.
                  </span>
                </div>

                {/* 2. Main Title Banner */}
                <div className="w-full bg-[#595959] border border-black text-white text-center py-[3px] px-4 font-bold text-[14px] tracking-normal">
                  Medical Equipment testing, installation and commissioning form
                </div>

                {/* 3. Medical Equipment Information Table (Inset by 16px on left & right) */}
                <div className="mx-[16px] mt-[15px] mb-[15px] border border-black text-[10px] text-black">
                  {/* Row 1: Medical Equipment | Department */}
                  <div className="grid grid-cols-2 border-b border-black h-[31px]">
                    <div className="border-r border-black px-2 py-[2px] flex flex-col justify-between overflow-hidden">
                      <div className="leading-none">Medical Equipment</div>
                      <div className="font-semibold text-[10px] leading-none truncate">{equipment.name}</div>
                    </div>
                    <div className="px-2 py-[2px] flex flex-col justify-between overflow-hidden">
                      <div className="leading-none">Department</div>
                      <div className="font-semibold text-[10px] leading-none truncate">{equipment.department || ''}</div>
                    </div>
                  </div>

                  {/* Row 2: UMDNS Description | Date */}
                  <div className="grid grid-cols-2 border-b border-black h-[31px]">
                    <div className="border-r border-black px-2 py-[2px] flex flex-col justify-between overflow-hidden">
                      <div className="leading-none">UMDNS Description</div>
                      <div className="font-semibold text-[10px] leading-none truncate">
                        {equipment.umdnsCode || equipment.itrisId || ''}
                      </div>
                    </div>
                    <div className="px-2 py-[2px] flex flex-col justify-between overflow-hidden">
                      <div className="leading-none">Date</div>
                      <div className="font-semibold text-[10px] leading-none truncate">
                        {formatDateSlash(equipment.installationDate || equipment.registrationDate) || formattedToday}
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Manufacturer | Serial Number */}
                  <div className="grid grid-cols-2 border-b border-black h-[31px]">
                    <div className="border-r border-black px-2 py-[2px] flex flex-col justify-between overflow-hidden">
                      <div className="leading-none">Manufacturer</div>
                      <div className="font-semibold text-[10px] leading-none truncate">{equipment.manufacturer || ''}</div>
                    </div>
                    <div className="px-2 py-[2px] flex flex-col justify-between overflow-hidden">
                      <div className="leading-none">Serial Number</div>
                      <div className="font-semibold text-[10px] leading-none truncate">
                        {equipment.serialNumber && equipment.serialNumber !== '-' ? equipment.serialNumber : ''}
                      </div>
                    </div>
                  </div>

                  {/* Row 4: Type / Model | ID Number */}
                  <div className="grid grid-cols-2 border-b border-black h-[31px]">
                    <div className="border-r border-black px-2 py-[2px] flex flex-col justify-between overflow-hidden">
                      <div className="leading-none">Type / Model</div>
                      <div className="font-semibold text-[10px] leading-none truncate">{equipment.model || ''}</div>
                    </div>
                    <div className="px-2 py-[2px] flex flex-col justify-between overflow-hidden">
                      <div className="leading-none">ID Number</div>
                      <div className="font-semibold text-[10px] leading-none truncate">{equipment.code || ''}</div>
                    </div>
                  </div>

                  {/* Row 5: Risk Class | Asset Number */}
                  <div className="grid grid-cols-2 h-[31px]">
                    <div className="border-r border-black px-2 py-[2px] flex flex-col justify-between overflow-hidden">
                      <div className="leading-none">Risk Class</div>
                      <div className="font-semibold text-[10px] leading-none truncate">{equipment.riskLevel || ''}</div>
                    </div>
                    <div className="px-2 py-[2px] flex flex-col justify-between overflow-hidden">
                      <div className="leading-none">Asset Number</div>
                      <div className="font-semibold text-[10px] leading-none truncate">{equipment.assetNo || ''}</div>
                    </div>
                  </div>
                </div>

                {/* 4. Section A: Incoming Inspection Banner */}
                <div className="w-full bg-[#999999] border border-black text-white text-center py-[2.5px] px-4 font-bold text-[13.5px] tracking-normal">
                  A Incoming Inspection
                </div>

                {/* Section A Checklist */}
                <div className="mx-[16px] pt-[4px] pb-[10px] text-[11.5px] text-black">
                  {/* Part 1: 4 items */}
                  <div className="space-y-[8px]">
                    {[
                      { id: 'inc_1', label: 'Delivery note checks with order?' },
                      { id: 'inc_2', label: 'Outer packing undamaged?' },
                      { id: 'inc_3', label: 'Goods check with delivery note?' },
                      { id: 'inc_4', label: 'Goods clean, inner packing intact.' },
                    ].map((item) => {
                      const val = inspectionAnswers[item.id] ?? null;
                      return (
                        <div key={item.id} className="flex items-center leading-tight">
                          <div className="w-[59%] pl-[8px]">{item.label}</div>
                          <div className="w-[12.5%] flex items-center">
                            <span
                              onClick={() =>
                                setInspectionAnswers((prev) => ({
                                  ...prev,
                                  [item.id]: prev[item.id] === 'yes' ? null : 'yes',
                                }))
                              }
                              className="inline-flex items-center cursor-pointer select-none hover:opacity-75"
                            >
                              <span className="mr-[6px]">yes</span>
                              <span className="w-[11px] h-[11px] border border-black bg-white inline-flex items-center justify-center text-[9px] font-bold leading-none">
                                {val === 'yes' ? '✓' : ''}
                              </span>
                            </span>
                          </div>
                          <div className="w-[28.5%] flex items-center">
                            <span
                              onClick={() =>
                                setInspectionAnswers((prev) => ({
                                  ...prev,
                                  [item.id]: prev[item.id] === 'no' ? null : 'no',
                                }))
                              }
                              className="inline-flex items-center cursor-pointer select-none hover:opacity-75"
                            >
                              <span className="w-[11px] h-[11px] border border-black bg-white inline-flex items-center justify-center text-[9px] font-bold leading-none">
                                {val === 'no' ? '✓' : ''}
                              </span>
                              <span className="ml-[6px]">no</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* CE / MD / LOT Box Row */}
                  <div className="flex items-center pl-[8px] py-[7px]">
                    <div className="flex items-center">
                      <span className="mr-[12px]">CE</span>
                      <div className="w-[76px] h-[19px] border border-black shadow-[1.5px_1.5px_2px_rgba(0,0,0,0.3)] bg-white flex items-center px-1.5">
                        <input
                          type="text"
                          value={ceValue}
                          onChange={(e) => setCeValue(e.target.value)}
                          className="w-full bg-transparent outline-none text-[10px] text-black p-0 text-center"
                        />
                      </div>
                    </div>

                    <div className="flex items-center ml-[34px]">
                      <span className="mr-[12px]">MD</span>
                      <div className="w-[76px] h-[19px] border border-black shadow-[1.5px_1.5px_2px_rgba(0,0,0,0.3)] bg-white flex items-center px-1.5">
                        <input
                          type="text"
                          value={mdValue}
                          onChange={(e) => setMdValue(e.target.value)}
                          className="w-full bg-transparent outline-none text-[10px] text-black p-0 text-center"
                        />
                      </div>
                    </div>

                    <div className="flex items-center ml-[42px]">
                      <span className="mr-[12px]">LOT</span>
                      <div className="w-[242px] h-[19px] border border-black shadow-[1.5px_1.5px_2px_rgba(0,0,0,0.3)] bg-white flex items-center px-2">
                        <input
                          type="text"
                          value={lotValue}
                          onChange={(e) => setLotValue(e.target.value)}
                          className="w-full bg-transparent outline-none text-[10px] text-black p-0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Part 2: 5 items */}
                  <div className="space-y-[8px]">
                    {[
                      { id: 'inc_5', label: 'User manual supplied (Eng. /Thai)?' },
                      { id: 'inc_6', label: 'Instructions supplied (Eng. /Thai)?' },
                      { id: 'inc_7', label: 'Maintenance manual supplied?' },
                      { id: 'inc_8', label: 'Warranty document included?' },
                      { id: 'inc_9', label: 'Final test certificate supplied?' },
                    ].map((item) => {
                      const val = inspectionAnswers[item.id] ?? null;
                      return (
                        <div key={item.id} className="flex items-center leading-tight">
                          <div className="w-[59%] pl-[8px]">{item.label}</div>
                          <div className="w-[12.5%] flex items-center">
                            <span
                              onClick={() =>
                                setInspectionAnswers((prev) => ({
                                  ...prev,
                                  [item.id]: prev[item.id] === 'yes' ? null : 'yes',
                                }))
                              }
                              className="inline-flex items-center cursor-pointer select-none hover:opacity-75"
                            >
                              <span className="mr-[6px]">yes</span>
                              <span className="w-[11px] h-[11px] border border-black bg-white inline-flex items-center justify-center text-[9px] font-bold leading-none">
                                {val === 'yes' ? '✓' : ''}
                              </span>
                            </span>
                          </div>
                          <div className="w-[28.5%] flex items-center">
                            <span
                              onClick={() =>
                                setInspectionAnswers((prev) => ({
                                  ...prev,
                                  [item.id]: prev[item.id] === 'no' ? null : 'no',
                                }))
                              }
                              className="inline-flex items-center cursor-pointer select-none hover:opacity-75"
                            >
                              <span className="w-[11px] h-[11px] border border-black bg-white inline-flex items-center justify-center text-[9px] font-bold leading-none">
                                {val === 'no' ? '✓' : ''}
                              </span>
                              <span className="ml-[6px]">no</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 5. Section B: Function Test Banner */}
                <div className="w-full bg-[#999999] border border-black text-white text-center py-[2.5px] px-4 font-bold text-[13.5px] tracking-normal">
                  Function test
                </div>

                {/* Section B Function Test Table (Directly attached below Function test banner, inset 16px) */}
                <div className="mx-[16px] border-x border-b border-black divide-y divide-black text-[11.5px] text-black">
                  {[
                    { id: 'fn_1', label: 'Plug in turn on (following instruction manual)' },
                    { id: 'fn_2', label: 'Indicator lamps light up?' },
                    { id: 'fn_3', label: 'Display as described in manual?' },
                    { id: 'fn_4', label: 'Passes self-test routine?' },
                    { id: 'fn_5', label: 'Moving parts operate properly?' },
                    { id: 'fn_6', label: 'Knobs and switches act properly?' },
                    { id: 'fn_7', label: 'Check for more installing instructions in the manual' },
                    { id: 'fn_8', label: 'Last or next PM/CAL Sticker?' },
                  ].map((item) => {
                    const val = inspectionAnswers[item.id] ?? null;
                    return (
                      <div key={item.id} className="h-[21px] flex items-center">
                        <div className="w-[59%] pl-[30px] flex items-center">
                          <span className="mr-[18px] text-[12px] leading-none">•</span>
                          <span>{item.label}</span>
                        </div>
                        <div className="w-[12.5%] flex items-center">
                          <span
                            onClick={() =>
                              setInspectionAnswers((prev) => ({
                                ...prev,
                                [item.id]: prev[item.id] === 'yes' ? null : 'yes',
                              }))
                            }
                            className="inline-flex items-center cursor-pointer select-none hover:opacity-75"
                          >
                            <span className="mr-[6px]">yes</span>
                            <span className="w-[11px] h-[11px] border border-black bg-white inline-flex items-center justify-center text-[9px] font-bold leading-none">
                              {val === 'yes' ? '✓' : ''}
                            </span>
                          </span>
                        </div>
                        <div className="w-[28.5%] flex items-center">
                          <span
                            onClick={() =>
                              setInspectionAnswers((prev) => ({
                                ...prev,
                                [item.id]: prev[item.id] === 'no' ? null : 'no',
                              }))
                            }
                            className="inline-flex items-center cursor-pointer select-none hover:opacity-75"
                          >
                            <span className="w-[11px] h-[11px] border border-black bg-white inline-flex items-center justify-center text-[9px] font-bold leading-none">
                              {val === 'no' ? '✓' : ''}
                            </span>
                            <span className="ml-[6px]">no</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Row 9: ITRIS Inventory ID Sticker? | ok [ ] */}
                  <div className="h-[21px] flex items-center">
                    <div className="w-[59%] pl-[30px] flex items-center">
                      <span className="mr-[18px] text-[12px] leading-none">•</span>
                      <span>ITRIS Inventory ID Sticker?</span>
                    </div>
                    <div className="w-[41%] pl-[5.5%] flex items-center">
                      <span
                        onClick={() => setInventoryStickerOk((prev) => !prev)}
                        className="inline-flex items-center cursor-pointer select-none hover:opacity-75"
                      >
                        <span className="mr-[6px]">ok</span>
                        <span className="w-[11px] h-[11px] border border-black bg-white inline-flex items-center justify-center text-[9px] font-bold leading-none">
                          {inventoryStickerOk ? '✓' : ''}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* 6. Electrical Safety Section */}
                <div className="mx-[16px] pt-[3px] text-[11.5px] text-black">
                  <div className="font-bold leading-snug">Electrical Safety:</div>
                  <div className="pl-[30px] py-[2px] flex items-center">
                    <span className="mr-[18px] text-[12px] leading-none">•</span>
                    <span
                      onClick={() => setElectricalSafetyPass((prev) => !prev)}
                      className="inline-flex items-center cursor-pointer select-none hover:opacity-75"
                    >
                      <span className="mr-[6px]">Pass</span>
                      <span className="w-[11px] h-[11px] border border-black bg-white inline-flex items-center justify-center text-[9px] font-bold leading-none">
                        {electricalSafetyPass ? '✓' : ''}
                      </span>
                    </span>
                  </div>
                  <div className="pl-[48px] pt-[2px] flex items-center">
                    <div className="flex items-center">
                      <span>Ground Resistance (≤0.5Ohm):</span>
                      <div className="w-[66px] h-[19px] border-[1.5px] border-[#888888] ml-[10px] mr-[22px] bg-white flex items-center px-1.5">
                        <input
                          type="text"
                          value={groundResistanceValue}
                          onChange={(e) => setGroundResistanceValue(e.target.value)}
                          className="w-full bg-transparent outline-none text-[10px] text-black p-0 text-center"
                        />
                      </div>
                    </div>
                    <div className="flex items-center">
                      <span>Chassis Leak Current (≤300µA):</span>
                      <div className="w-[66px] h-[19px] border-[1.5px] border-[#888888] ml-[10px] bg-white flex items-center px-1.5">
                        <input
                          type="text"
                          value={chassisLeakValue}
                          onChange={(e) => setChassisLeakValue(e.target.value)}
                          className="w-full bg-transparent outline-none text-[10px] text-black p-0 text-center"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 7. Signatures Area */}
                <div className="mx-[16px] pt-[34px] pb-[28px] flex items-end justify-between text-[11.5px] text-black">
                  {/* Left: ITRIS Biomedical Engineer */}
                  <div className="ml-[6px] w-[155px] flex flex-col">
                    <div className="print:hidden flex items-center justify-center mb-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenSigning(
                            'itris_bme',
                            'ITRIS Biomedical Engineer',
                            currentUser || 'ITRIS Biomedical Engineer'
                          )
                        }
                        className="text-[9px] bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white px-2 py-0.5 rounded border border-blue-200 transition-colors inline-flex items-center space-x-1 cursor-pointer font-medium"
                      >
                        <PenLine size={9} />
                        <span>{signatures['itris_bme'] ? 'แก้ไขลายเซ็น' : 'กดเซ็นลายเซ็น'}</span>
                      </button>
                      {signatures['itris_bme'] && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSignature('itris_bme')}
                          className="ml-1 text-slate-400 hover:text-rose-600 p-0.5 rounded"
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>

                    <div className="border-b border-black w-full min-h-[36px] flex flex-col items-center justify-end pb-0.5">
                      {signatures['itris_bme'] ? (
                        <div className="flex flex-col items-center justify-center">
                          <img
                            src={signatures['itris_bme'].signature}
                            alt="ITRIS BME signature"
                            className="max-h-[30px] max-w-[140px] object-contain"
                          />
                          <div className="text-[8.5px] text-slate-800 font-medium leading-none mt-0.5">
                            ({signatures['itris_bme'].name || 'ITRIS Engineer'})
                          </div>
                        </div>
                      ) : (
                        <span>&nbsp;</span>
                      )}
                    </div>
                    <div className="pt-[2px] text-left whitespace-nowrap">ITRIS Biomedical Engineer</div>
                  </div>

                  {/* Right: Hospital / Department / Name */}
                  <div className="mr-[12px] w-[230px] flex flex-col">
                    <div className="print:hidden flex items-center justify-center mb-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenSigning(
                            'hospital_dept',
                            'Hospital / Department / Name',
                            equipment.department || 'ผู้รับมอบ'
                          )
                        }
                        className="text-[9px] bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white px-2 py-0.5 rounded border border-blue-200 transition-colors inline-flex items-center space-x-1 cursor-pointer font-medium"
                      >
                        <PenLine size={9} />
                        <span>{signatures['hospital_dept'] ? 'แก้ไขลายเซ็น' : 'กดเซ็นลายเซ็น'}</span>
                      </button>
                      {signatures['hospital_dept'] && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSignature('hospital_dept')}
                          className="ml-1 text-slate-400 hover:text-rose-600 p-0.5 rounded"
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>

                    <div className="border-b border-black w-full min-h-[36px] flex flex-col items-center justify-end pb-0.5">
                      {signatures['hospital_dept'] ? (
                        <div className="flex flex-col items-center justify-center">
                          <img
                            src={signatures['hospital_dept'].signature}
                            alt="Hospital signature"
                            className="max-h-[30px] max-w-[160px] object-contain"
                          />
                          <div className="text-[8.5px] text-slate-800 font-medium leading-none mt-0.5">
                            ({signatures['hospital_dept'].name || 'ผู้รับมอบ'})
                          </div>
                        </div>
                      ) : (
                        <span>&nbsp;</span>
                      )}
                    </div>
                    <div className="pt-[2px] flex items-center justify-between w-full">
                      <span>Hospital</span>
                      <span>/</span>
                      <span>Department</span>
                      <span>/</span>
                      <span>Name</span>
                    </div>
                  </div>
                </div>

                {/* 8. Footer */}
                <div className="mx-[16px] pl-[6px] text-[9.5px] text-black">
                  FP-OP-005-005
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* DOCUMENT C: LIST REGISTER VIEW                                            */}
            {/* ========================================================================= */}
            {isListView && (
              <div className="p-4 bg-white text-black font-sans text-[9px]">
                <div className="border-b-2 border-black pb-2 mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-black uppercase">
                      ITRIS Medical (Thailand) Co., Ltd. - Equipment Master Register
                    </h2>
                    <p className="text-[10px] text-slate-600">
                      Total Devices: {equipmentList?.length} items
                    </p>
                  </div>
                  <div className="text-right text-[9px] font-mono">
                    <div>Date: {formattedToday}</div>
                    <div className="text-slate-500">Controlled Document</div>
                  </div>
                </div>

                <table className="w-full text-left border-collapse border border-black text-[9px]">
                  <thead className="bg-slate-100 border-b border-black font-bold">
                    <tr>
                      <th className="p-1 border-r border-black text-center w-8">#</th>
                      <th className="p-1 border-r border-black w-24">ID CODE</th>
                      <th className="p-1 border-r border-black w-20">Itris ID</th>
                      <th className="p-1 border-r border-black">Equipment Name</th>
                      <th className="p-1 border-r border-black w-24">Department</th>
                      <th className="p-1 border-r border-black w-20">Model</th>
                      <th className="p-1 border-r border-black w-24">Serial No.</th>
                      <th className="p-1 border-r border-black w-14 text-center">Risk</th>
                      <th className="p-1 text-center w-14">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/30">
                    {equipmentList?.map((eq, idx) => (
                      <tr key={eq.id}>
                        <td className="p-1 text-center font-mono border-r border-black">{idx + 1}</td>
                        <td className="p-1 font-mono font-bold border-r border-black">{eq.code}</td>
                        <td className="p-1 font-mono border-r border-black">{eq.itrisId || '-'}</td>
                        <td className="p-1 font-medium border-r border-black">{eq.name}</td>
                        <td className="p-1 border-r border-black">{eq.department || '-'}</td>
                        <td className="p-1 border-r border-black">{eq.model || '-'}</td>
                        <td className="p-1 font-mono border-r border-black">{eq.serialNumber || '-'}</td>
                        <td className="p-1 text-center border-r border-black">{eq.riskLevel || '-'}</td>
                        <td className="p-1 text-center font-semibold">
                          {eq.status === 'active' ? 'Active' : eq.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Signature Capture Modal */}
      {signingModal && (
        <SignaturePadModal
          isOpen={Boolean(signingModal)}
          onClose={() => setSigningModal(null)}
          title={signingModal.title}
          defaultName={signingModal.defaultName}
          defaultDate={signingModal.defaultDate}
          onSave={handleSaveSignature}
        />
      )}
    </div>
  );
}
