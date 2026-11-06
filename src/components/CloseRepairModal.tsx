import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { RepairJob, Equipment } from '../types';
import { CheckCircle2, X, Check, AlertTriangle, Clock, Calendar, User, FileText, Wrench, PenLine } from 'lucide-react';
import SignaturePad from './SignaturePad';
import SignatureCaptureModal from './SignatureCaptureModal';
import { formatDateSlash } from '../utils/dateUtils';

interface CloseRepairModalProps {
  repair: RepairJob | null;
  equipment?: Equipment;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CloseRepairModal({
  repair,
  equipment,
  isOpen,
  onClose,
  onSuccess
}: CloseRepairModalProps) {
  const { updateRepair, currentUser } = useAppStore();

  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const [closingSignature, setClosingSignature] = useState('');
  const [technician, setTechnician] = useState('');
  const [techSignature, setTechSignature] = useState('');
  const [isTechSignatureModalOpen, setIsTechSignatureModalOpen] = useState(false);
  const [closerName, setCloserName] = useState('');
  const [closingSignerName, setClosingSignerName] = useState('');
  const [closingDate, setClosingDate] = useState(new Date().toISOString().split('T')[0]);
  const [closingTime, setClosingTime] = useState(getCurrentTime());
  const [repairDetails, setRepairDetails] = useState('');
  const [closingNotes, setClosingNotes] = useState('ทดสอบระบบการทำงานเรียบร้อย เครื่องมือพร้อมใช้งานปกติ');
  const [markAsCompleted, setMarkAsCompleted] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (repair) {
      setClosingSignature(repair.closingSignature || '');
      setTechnician(repair.closingTechnician || '');
      setTechSignature(repair.closingTechnicianSignature || '');
      setCloserName(repair.closerName || '');
      setClosingSignerName(repair.closingSignerName || '');
      setClosingDate(repair.closingDate || new Date().toISOString().split('T')[0]);
      setClosingTime(repair.closingTime || getCurrentTime());
      setRepairDetails(repair.repairDetails || '');
      setClosingNotes(repair.closingNotes || 'ทดสอบระบบการทำงานเรียบร้อย เครื่องมือพร้อมใช้งานปกติ');
      setMarkAsCompleted(true);
      setErrorMsg('');
      setIsSaved(false);
    }
  }, [repair, currentUser, isOpen]);

  if (!isOpen || !repair) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!closerName.trim()) {
      setErrorMsg('กรุณาระบุชื่อผู้ตรวจสอบ / ผู้ปิดงาน');
      return;
    }

    if (!closingSignature) {
      setErrorMsg('กรุณาลงลายมือชื่อในช่องเซ็นปิดงานซ่อม');
      return;
    }

    updateRepair(repair.id, {
      closingSignature,
      closerName: closerName.trim(),
      closingSignerName: closingSignerName.trim(),
      closingDate: closingDate || new Date().toISOString().split('T')[0],
      closingTime: closingTime || getCurrentTime(),
      repairDetails: repairDetails.trim(),
      closingNotes: closingNotes.trim(),
      status: markAsCompleted ? 'completed' : repair.status,
      technician: repair.technician || '',
      closingTechnician: technician.trim(),
      closingTechnicianSignature: techSignature,
      technicianSignature: repair.technicianSignature || ''
    });

    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      if (onSuccess) onSuccess();
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div 
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden my-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-700 to-teal-800 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-xs text-white">
              <CheckCircle2 size={22} className="text-emerald-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">ช่องเซ็นปิดงานซ่อม / ตรวจรับงาน</h3>
              <p className="text-xs text-emerald-100 font-normal">
                ลงลายมือชื่อยืนยันการตรวจซ่อมและส่งมอบอุปกรณ์ใช้งาน
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
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
              <span className="font-semibold">บันทึกช่องลายเซ็นและปิดงานซ่อมเรียบร้อยแล้ว</span>
            </div>
          )}

          {/* Equipment & Job Info Card */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-1 pb-2 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-800 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                  {equipment?.code || repair.equipmentCode || (repair.isNonRegistered ? 'นอกทะเบียน' : 'รหัสไม่ระบุ')}
                </span>
                <span className="font-semibold text-slate-900">{equipment?.name || repair.equipmentName || 'เครื่องมือแพทย์'}</span>
                {repair.isNonRegistered && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-medium">
                    นอกทะเบียน
                  </span>
                )}
              </div>
              <span className="text-slate-500">แผนก: <span className="font-medium text-slate-700">{repair.department || equipment?.department || '-'}</span></span>
            </div>
            <div className="text-slate-700">
              <span className="font-semibold text-slate-500">อาการเสียที่แจ้ง: </span>
              <span className="text-slate-800">{repair.issue}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>วันที่แจ้งซ่อม: {formatDateSlash(repair.reportDate)} {repair.reportTime ? `(${repair.reportTime} น.)` : ''}</span>
              <span>ผู้แจ้งซ่อม: {repair.signerName || repair.reportedBy || '-'}</span>
            </div>
          </div>

          {/* Technician & Closer Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span className="flex items-center space-x-1">
                  <User size={13} className="text-emerald-600" />
                  <span>ช่างผู้ดำเนินการซ่อม</span>
                </span>
                {techSignature && (
                  <span className="text-[10px] text-emerald-700 font-medium">
                    ✓ เซ็นแล้ว
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={technician}
                  onChange={(e) => setTechnician(e.target.value)}
                  placeholder="ระบุชื่อช่างผู้ดำเนินการ..."
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 pr-9 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setIsTechSignatureModalOpen(true)}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors cursor-pointer ${
                    techSignature
                      ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                  }`}
                  title="คลิกเพื่อเซ็นลายเซ็นช่าง"
                >
                  <PenLine size={14} />
                </button>
              </div>

              {techSignature && (
                <div className="mt-1.5 flex items-center justify-between bg-emerald-50/70 border border-emerald-200 rounded-lg p-1.5 px-2">
                  <div className="flex items-center space-x-1.5">
                    <img 
                      src={techSignature} 
                      alt="ลายเซ็นช่าง" 
                      className="h-5 max-w-[70px] object-contain bg-white rounded border border-emerald-200 px-1" 
                    />
                    <span className="text-[11px] text-emerald-900 font-medium truncate max-w-[120px]">
                      {technician || 'ลงลายเซ็นแล้ว'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTechSignature('')}
                    className="text-[10px] text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                    title="ลบลายเซ็นช่าง"
                  >
                    ลบ
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                <User size={13} className="text-emerald-600" />
                <span>ชื่อผู้ตรวจสอบ / ผู้ปิดงาน <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="text"
                required
                value={closerName}
                onChange={(e) => setCloserName(e.target.value)}
                placeholder="ระบุชื่อผู้ตรวจสอบ / ผู้ปิดงาน..."
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>
          </div>

          {/* Action Taken / Repair details */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
              <Wrench size={13} className="text-emerald-600" />
              <span>รายละเอียดการตรวจเช็ค / การซ่อมแซม (Action Taken)</span>
            </label>
            <textarea
              rows={2}
              value={repairDetails}
              onChange={(e) => setRepairDetails(e.target.value)}
              placeholder="ระบุรายละเอียดการตรวจสอบ แก้ไข หรือเปลี่ยนอะไหล่..."
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
          </div>

          {/* Closing Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
              <FileText size={13} className="text-emerald-600" />
              <span>ผลการตรวจรับ / สรุปการส่งมอบ</span>
            </label>
            <input
              type="text"
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              placeholder="เช่น ทดสอบระบบเรียบร้อย พร้อมใช้งานปกติ"
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
          </div>

          {/* SignaturePad - ช่องเซ็นปิดงานซ่อม */}
          <div className="p-4 bg-emerald-50/40 rounded-2xl border-2 border-emerald-200/90 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-emerald-100">
              <span className="text-xs font-bold text-emerald-900 flex items-center space-x-1.5">
                <span>✍️</span>
                <span>ช่องเซ็นปิดงานซ่อม / ตรวจรับส่งมอบ (Closing Signature)</span>
                <span className="text-rose-500">*</span>
              </span>
              {closingSignature && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check size={12} />
                  <span>มีลายเซ็นแล้ว</span>
                </span>
              )}
            </div>

            <SignaturePad
              value={closingSignature}
              onChange={(sigUrl) => setClosingSignature(sigUrl)}
              signerName={closingSignerName}
              onSignerNameChange={(name) => setClosingSignerName(name)}
              namePlaceholder="พิมพ์หรือระบุชื่อผู้ลงนามปิดงานซ่อม..."
              label="วาดลายมือชื่อปิดงานซ่อมในกรอบด้านล่าง"
              required
              defaultExpanded={true}
            />

            {/* วันที่และเวลาปิดงาน (ไว้ใต้ช่องเซ็นปิดงาน) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-100/80">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                  <Calendar size={13} className="text-emerald-600" />
                  <span>วันที่ปิดงาน <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="date"
                  required
                  value={closingDate}
                  onChange={(e) => setClosingDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                  <Clock size={13} className="text-emerald-600" />
                  <span>เวลาปิดงาน <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="time"
                  required
                  value={closingTime}
                  onChange={(e) => setClosingTime(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* Mark as completed checkbox */}
          <label className="flex items-center space-x-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
            <input
              type="checkbox"
              checked={markAsCompleted}
              onChange={(e) => setMarkAsCompleted(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300"
            />
            <div className="text-xs">
              <span className="font-semibold text-slate-800">เปลี่ยนสถานะงานซ่อมเป็น "เสร็จสิ้น (ใช้งานได้)" อัตโนมัติ</span>
              <p className="text-[11px] text-slate-500">สถานะเครื่องมือแพทย์จะถูกเปลี่ยนกลับเป็น "พร้อมใช้งาน (Active)" โดยอัตโนมัติ</p>
            </div>
          </label>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="inline-flex items-center space-x-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow"
            >
              <Check size={16} />
              <span>ยืนยันการเซ็นปิดงานซ่อม</span>
            </button>
          </div>
        </form>
      </div>

      {/* Dedicated Technician Signature Modal */}
      <SignatureCaptureModal
        isOpen={isTechSignatureModalOpen}
        onClose={() => setIsTechSignatureModalOpen(false)}
        onSave={({ signature, name }) => {
          setTechSignature(signature);
          if (name) setTechnician(name);
        }}
        initialSignature={techSignature}
        initialName={technician}
        title="เซ็นลายเซ็นช่างผู้ดำเนินการซ่อม (Technician Signature)"
        nameLabel="ชื่อช่างผู้ดำเนินการซ่อม"
        namePlaceholder="ระบุชื่อช่าง..."
        subtitle="บันทึกและแนบลายเซ็นช่างในการปิดงานซ่อมนี้"
      />
    </div>
  );
}
