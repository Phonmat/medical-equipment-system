import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { RepairJob, Equipment } from '../types';
import { PenLine, X, Check, AlertTriangle, Calendar, Clock, User, Trash2 } from 'lucide-react';
import SignaturePad from './SignaturePad';
import { formatDateSlash } from '../utils/dateUtils';

interface TechnicianSignatureModalProps {
  repair: RepairJob | null;
  equipment?: Equipment;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function TechnicianSignatureModal({
  repair,
  equipment,
  isOpen,
  onClose,
  onSuccess
}: TechnicianSignatureModalProps) {
  const { updateRepair, currentUser } = useAppStore();

  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const [technician, setTechnician] = useState('');
  const [technicianSignature, setTechnicianSignature] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (repair) {
      setTechnician(repair.technician || currentUser || '');
      setTechnicianSignature(repair.technicianSignature || '');
      setErrorMsg('');
      setIsSaved(false);
    }
  }, [repair, currentUser, isOpen]);

  if (!isOpen || !repair) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!technician.trim()) {
      setErrorMsg('กรุณาระบุชื่อช่างผู้รับงานซ่อม');
      return;
    }

    if (!technicianSignature) {
      setErrorMsg('กรุณาลงลายมือชื่อช่างในช่องเซ็น');
      return;
    }

    updateRepair(repair.id, {
      technician: technician.trim(),
      technicianSignature
    });

    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      if (onSuccess) onSuccess();
      onClose();
    }, 600);
  };

  const eqCode = equipment?.code || repair.equipmentCode || (repair.isNonRegistered ? 'นอกทะเบียน' : '-');
  const eqName = equipment?.name || repair.equipmentName || '-';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div 
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden my-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-xs text-white">
              <PenLine size={22} className="text-amber-200" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">ช่องเซ็นลายเซ็นช่างผู้รับงานซ่อม</h3>
              <p className="text-xs text-amber-100 font-normal">
                ITRIS Engineer Signature / ลายมือชื่อช่างผู้รับผิดชอบงาน
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {errorMsg && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3.5 py-2.5 rounded-xl flex items-center space-x-2">
              <AlertTriangle size={15} className="shrink-0 text-rose-500" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {isSaved && (
            <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-300 px-3.5 py-2.5 rounded-xl flex items-center space-x-2">
              <Check size={16} className="shrink-0 text-emerald-600 font-bold" />
              <span className="font-semibold">บันทึกลายเซ็นช่างเรียบร้อยแล้ว</span>
            </div>
          )}

          {/* Job Info Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-amber-700 font-mono text-sm">{eqCode}</span>
                <span className="text-slate-700 font-medium">{eqName}</span>
                {repair.isNonRegistered && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-medium">
                    นอกทะเบียน
                  </span>
                )}
              </div>
              <span className="text-slate-500">แผนก: <span className="font-medium text-slate-700">{repair.department || equipment?.department || '-'}</span></span>
            </div>
            <div className="text-slate-700">
              <span className="font-semibold text-slate-500">อาการเสีย: </span>
              <span className="text-slate-800">{repair.issue}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>วันที่แจ้งซ่อม: {formatDateSlash(repair.reportDate)} {repair.reportTime ? `(${repair.reportTime} น.)` : ''}</span>
              <span>ผู้แจ้งซ่อม: {repair.signerName || repair.reportedBy || '-'}</span>
            </div>
          </div>

          {/* Technician Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center space-x-1">
              <User size={14} className="text-amber-600" />
              <span>ชื่อช่างผู้รับงานซ่อม (Technician Name) <span className="text-rose-500">*</span></span>
            </label>
            <input
              type="text"
              required
              value={technician}
              onChange={(e) => setTechnician(e.target.value)}
              placeholder="ระบุชื่อช่างผู้รับงานซ่อม..."
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white font-medium"
            />
          </div>

          {/* SignaturePad - ช่องเซ็นลายเซ็นช่าง */}
          <div className="p-4 bg-amber-50/40 rounded-2xl border-2 border-amber-200/90 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-amber-100">
              <span className="text-xs font-bold text-amber-900 flex items-center space-x-1.5">
                <span>✍️</span>
                <span>ลงลายมือชื่อช่างผู้รับงานซ่อม (ITRIS Signature) <span className="text-rose-500">*</span></span>
              </span>
              {technicianSignature && (
                <span className="text-[10px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                  มีลายเซ็นแล้ว
                </span>
              )}
            </div>

            <SignaturePad
              value={technicianSignature}
              onChange={(sigUrl) => setTechnicianSignature(sigUrl)}
              signerName={technician}
              onSignerNameChange={setTechnician}
              namePlaceholder="ระบุชื่อช่าง..."
              label="ลายมือชื่อช่างผู้รับงานซ่อม"
              required={true}
              defaultExpanded={true}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSaved}
              className="inline-flex items-center space-x-1.5 px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 rounded-xl shadow-xs hover:shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Check size={14} />
              <span>บันทึกลายเซ็นช่าง</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
