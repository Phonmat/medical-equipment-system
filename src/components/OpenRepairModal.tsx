import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { RepairJob, Equipment } from '../types';
import { FileSignature, X, Check, AlertTriangle, Calendar, Clock, User, FileText } from 'lucide-react';
import SignaturePad from './SignaturePad';
import { formatDateSlash } from '../utils/dateUtils';

interface OpenRepairModalProps {
  repair: RepairJob | null;
  equipment?: Equipment;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function OpenRepairModal({
  repair,
  equipment,
  isOpen,
  onClose,
  onSuccess
}: OpenRepairModalProps) {
  const { updateRepair, currentUser } = useAppStore();

  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const [requesterSignature, setRequesterSignature] = useState('');
  const [reportedBy, setReportedBy] = useState('');
  const [signerName, setSignerName] = useState('');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportTime, setReportTime] = useState(getCurrentTime());
  const [issue, setIssue] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (repair) {
      setRequesterSignature(repair.requesterSignature || '');
      setReportedBy(repair.reportedBy || '');
      setSignerName(repair.signerName || '');
      setReportDate(repair.signatureDate || repair.reportDate || new Date().toISOString().split('T')[0]);
      setReportTime(repair.reportTime || getCurrentTime());
      setIssue(repair.issue || '');
      setErrorMsg('');
      setIsSaved(false);
    }
  }, [repair, currentUser, isOpen]);

  if (!isOpen || !repair) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!reportedBy.trim()) {
      setErrorMsg('กรุณาระบุชื่อผู้แจ้งเปิดงาน');
      return;
    }

    if (!requesterSignature) {
      setErrorMsg('กรุณาลงลายมือชื่อในช่องเซ็นเปิดงานซ่อม');
      return;
    }

    updateRepair(repair.id, {
      requesterSignature,
      signerName: signerName.trim(),
      reportedBy: reportedBy.trim(),
      signatureDate: reportDate || repair.reportDate,
      reportDate: reportDate || repair.reportDate,
      reportTime: reportTime || repair.reportTime,
      issue: issue.trim() || repair.issue
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
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-xs text-white">
              <FileSignature size={22} className="text-blue-200" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">ช่องเซ็นเปิดงานซ่อม / ผู้แจ้งซ่อม</h3>
              <p className="text-xs text-blue-100 font-normal">
                ลงลายมือชื่อและบันทึกผู้แจ้งเปิดคำขอซ่อมเครื่องมือแพทย์
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
              <span className="font-semibold">บันทึกช่องลายเซ็นเปิดงานซ่อมเรียบร้อยแล้ว</span>
            </div>
          )}

          {/* Equipment Info Card */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-1 pb-2 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-800 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                  {equipment?.code || 'รหัสไม่ระบุ'}
                </span>
                <span className="font-semibold text-slate-900">{equipment?.name || 'เครื่องมือแพทย์'}</span>
              </div>
              <span className="text-slate-500">
                แผนก: <span className="font-medium text-slate-700">{repair.department || equipment?.department || '-'}</span>
              </span>
            </div>
            <div className="text-slate-700">
              <span className="font-semibold text-slate-500">อาการเสียที่แจ้ง: </span>
              <span className="text-slate-800">{repair.issue}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>วันที่แจ้งซ่อม: {formatDateSlash(repair.reportDate)}</span>
              <span>ช่างผู้รับงาน: {repair.technician || '-'}</span>
            </div>
          </div>

          {/* Reported By Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
              <User size={13} className="text-blue-600" />
              <span>ชื่อผู้แจ้งเปิดงาน (Requester Name) <span className="text-rose-500">*</span></span>
            </label>
            <input
              type="text"
              required
              value={reportedBy}
              onChange={(e) => setReportedBy(e.target.value)}
              placeholder="ระบุชื่อผู้แจ้งเปิดงาน เช่น นพ.สมชาย, พว.สมหญิง..."
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* Issue notes (editable if user wants to update) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
              <FileText size={13} className="text-blue-600" />
              <span>อาการเสีย / รายละเอียดปัญหา</span>
            </label>
            <input
              type="text"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="ระบุอาการเสียหรือปัญหา..."
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          {/* SignaturePad - ช่องเซ็นเปิดงานซ่อม */}
          <div className="p-4 bg-blue-50/50 rounded-2xl border-2 border-blue-200/90 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-blue-100">
              <span className="text-xs font-bold text-blue-900 flex items-center space-x-1.5">
                <span>✍️</span>
                <span>ช่องเซ็นเปิดงานซ่อม / ผู้แจ้งซ่อม (Requester Signature)</span>
                <span className="text-rose-500">*</span>
              </span>
              {requesterSignature && (
                <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check size={12} />
                  <span>มีลายเซ็นแล้ว</span>
                </span>
              )}
            </div>

            <SignaturePad
              value={requesterSignature}
              onChange={(sigUrl) => setRequesterSignature(sigUrl)}
              signerName={signerName}
              onSignerNameChange={(name) => setSignerName(name)}
              namePlaceholder="พิมพ์ชื่อผู้ลงนามเซ็นชื่อ (แยกต่างหากจากผู้แจ้ง)..."
              label="วาดลายมือชื่อเปิดงานซ่อมในกรอบด้านล่าง"
              required
              defaultExpanded={true}
            />

            {/* 2 ช่องนี้: วันที่และเวลาแจ้งเปิดงาน ไว้ใต้ช่องเซ็นเปิดงาน */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-blue-100/80">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                  <Calendar size={13} className="text-blue-600" />
                  <span>วันที่แจ้งเปิดงาน <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="date"
                  required
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                  <Clock size={13} className="text-blue-600" />
                  <span>เวลาเปิดงาน <span className="text-rose-500">*</span></span>
                </label>
                <input
                  type="time"
                  required
                  value={reportTime}
                  onChange={(e) => setReportTime(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono"
                />
              </div>
            </div>
          </div>

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
              className="inline-flex items-center space-x-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow"
            >
              <Check size={16} />
              <span>ยืนยันการเซ็นเปิดงานซ่อม</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
