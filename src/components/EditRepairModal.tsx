import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { RepairJob } from '../types';
import { Wrench, X, Check, Building2, AlertTriangle, Calendar, User, Trash2, Tag, PenLine } from 'lucide-react';
import AddDepartmentModal from './AddDepartmentModal';
import SignaturePad from './SignaturePad';
import SignatureCaptureModal from './SignatureCaptureModal';
import EquipmentSearchSelect from './EquipmentSearchSelect';

interface EditRepairModalProps {
  repair: RepairJob | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function EditRepairModal({ repair, isOpen, onClose }: EditRepairModalProps) {
  const { equipment, departments, updateRepair, deleteRepair, userRole, currentUser } = useAppStore();
  const isAdmin = userRole === 'Super Admin' || userRole === 'Admin';
  
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isTechSignatureModalOpen, setIsTechSignatureModalOpen] = useState(false);
  const [isClosingTechSignatureModalOpen, setIsClosingTechSignatureModalOpen] = useState(false);
  const [isNonRegistered, setIsNonRegistered] = useState(false);
  const [formData, setFormData] = useState({
    equipmentId: '',
    isNonRegistered: false,
    equipmentName: '',
    equipmentCode: '',
    serialNumber: '',
    model: '',
    manufacturer: '',
    issue: '',
    repairDetails: '',
    department: '',
    reportDate: '',
    reportTime: '',
    technician: '',
    technicianSignature: '',
    closingTechnician: '',
    closingTechnicianSignature: '',
    status: 'pending' as RepairJob['status'],
    requesterSignature: '',
    signerName: '',
    signatureDate: '',
    closingSignature: '',
    closerName: '',
    closingDate: '',
    closingTime: '',
    closingNotes: ''
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showConfirmSaveModal, setShowConfirmSaveModal] = useState(false);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);

  useEffect(() => {
    if (repair) {
      setIsNonRegistered(!!repair.isNonRegistered);
      setFormData({
        equipmentId: repair.equipmentId || '',
        isNonRegistered: !!repair.isNonRegistered,
        equipmentName: repair.equipmentName || '',
        equipmentCode: repair.equipmentCode || '',
        serialNumber: repair.serialNumber || '',
        model: repair.model || '',
        manufacturer: repair.manufacturer || '',
        issue: repair.issue || '',
        repairDetails: repair.repairDetails || '',
        department: repair.department || '',
        reportDate: repair.reportDate || '',
        reportTime: repair.reportTime || '',
        technician: repair.technician || '',
        technicianSignature: repair.technicianSignature || '',
        closingTechnician: repair.closingTechnician || '',
        closingTechnicianSignature: repair.closingTechnicianSignature || '',
        status: repair.status || 'pending',
        requesterSignature: repair.requesterSignature || '',
        signerName: repair.signerName || repair.reportedBy || '',
        signatureDate: repair.signatureDate || repair.reportDate || '',
        closingSignature: repair.closingSignature || '',
        closerName: repair.closerName || currentUser || '',
        closingDate: repair.closingDate || (repair.status === 'completed' ? new Date().toISOString().split('T')[0] : ''),
        closingTime: repair.closingTime || '',
        closingNotes: repair.closingNotes || ''
      });
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [repair, currentUser]);

  if (!isOpen || !repair) return null;

  const currentEquipment = equipment.find(e => e.id === formData.equipmentId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (isNonRegistered) {
      if (!formData.equipmentName.trim()) {
        setErrorMsg('กรุณาระบุชื่อเครื่องมือแพทย์นอกทะเบียน');
        return;
      }
    } else {
      if (!formData.equipmentId) {
        setErrorMsg('กรุณาเลือกเครื่องมือแพทย์');
        return;
      }
    }

    if (!formData.issue.trim()) {
      setErrorMsg('กรุณาระบุอาการเสีย/ปัญหา');
      return;
    }

    setShowConfirmSaveModal(true);
  };

  const executeSave = () => {
    setShowConfirmSaveModal(false);

    const finalStatus = formData.status;
    const finalEqId = isNonRegistered 
      ? (formData.equipmentId?.startsWith('non-reg-') ? formData.equipmentId : `non-reg-${Date.now()}`)
      : formData.equipmentId;

    updateRepair(repair.id, {
      equipmentId: finalEqId,
      isNonRegistered,
      equipmentName: isNonRegistered ? formData.equipmentName.trim() : undefined,
      equipmentCode: isNonRegistered ? (formData.equipmentCode.trim() || 'นอกทะเบียน') : undefined,
      serialNumber: isNonRegistered ? formData.serialNumber.trim() : undefined,
      model: isNonRegistered ? formData.model.trim() : undefined,
      manufacturer: isNonRegistered ? formData.manufacturer.trim() : undefined,
      issue: formData.issue.trim(),
      repairDetails: formData.repairDetails.trim(),
      department: formData.department,
      reportDate: formData.reportDate,
      reportTime: formData.reportTime,
      technician: formData.technician.trim(),
      technicianSignature: formData.technicianSignature,
      closingTechnician: formData.closingTechnician.trim(),
      closingTechnicianSignature: formData.closingTechnicianSignature,
      status: finalStatus,
      requesterSignature: formData.requesterSignature,
      signerName: formData.signerName.trim(),
      signatureDate: formData.signatureDate || formData.reportDate,
      closingSignature: formData.closingSignature,
      closerName: formData.closerName.trim(),
      closingDate: formData.closingDate || (formData.closingSignature ? new Date().toISOString().split('T')[0] : ''),
      closingTime: formData.closingTime || '',
      closingNotes: formData.closingNotes.trim()
    });

    setSuccessMsg('บันทึกการแก้ไขข้อมูลเรียบร้อยแล้ว');
    setTimeout(() => {
      setSuccessMsg('');
      onClose();
    }, 700);
  };

  const handleDelete = () => {
    setShowConfirmDeleteModal(true);
  };

  const executeDelete = () => {
    deleteRepair(repair.id);
    setShowConfirmDeleteModal(false);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
        <div 
          className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                <Wrench size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">แก้ไขข้อมูลรายการแจ้งซ่อม</h3>
                <p className="text-xs text-slate-500">
                  รหัสเครื่องมือ: <span className="font-semibold text-slate-700">{currentEquipment?.code || 'Unknown'}</span> | ผู้แจ้ง: {repair.reportedBy || '-'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {errorMsg && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl flex items-center space-x-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl flex items-center space-x-2">
                <Check size={14} className="shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Equipment select */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    ข้อมูลเครื่องมือแพทย์ <span className="text-red-500">*</span>
                  </label>
                  <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setIsNonRegistered(false)}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                        !isNonRegistered 
                          ? 'bg-white text-slate-900 shadow-xs font-semibold' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      📋 ในทะเบียน
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsNonRegistered(true)}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                        isNonRegistered 
                          ? 'bg-amber-600 text-white shadow-xs font-semibold' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🏷️ นอกทะเบียน
                    </button>
                  </div>
                </div>

                {!isNonRegistered ? (
                  <EquipmentSearchSelect
                    equipment={equipment}
                    selectedId={formData.equipmentId}
                    onSelect={(eqId, eq) => {
                      setFormData(prev => ({
                        ...prev,
                        equipmentId: eqId,
                        department: eq?.department || prev.department
                      }));
                    }}
                    onSelectNonRegistered={(typedName) => {
                      setIsNonRegistered(true);
                      setFormData(prev => ({
                        ...prev,
                        equipmentName: typedName || prev.equipmentName
                      }));
                    }}
                    placeholder="พิมพ์ค้นหารหัสเครื่อง, ชื่อเครื่องมือ, แผนก หรือ S/N..."
                    required
                    accentColor="amber"
                  />
                ) : (
                  <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3.5 space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between pb-1.5 border-b border-amber-200/70 text-xs">
                      <span className="font-semibold text-amber-900 flex items-center gap-1.5">
                        <Tag size={13} className="text-amber-700" />
                        <span>เครื่องมือนอกทะเบียน</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsNonRegistered(false)}
                        className="text-amber-800 hover:underline font-medium cursor-pointer"
                      >
                        สลับไปเลือกในทะเบียน
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          ชื่อเครื่องมือแพทย์ <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.equipmentName}
                          onChange={e => setFormData(prev => ({ ...prev, equipmentName: e.target.value }))}
                          placeholder="เช่น เครื่องวัดความดันโลหิต, Syringe Pump..."
                          className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          รหัสเครื่อง / เลขครุภัณฑ์เดิม (ถ้ามี)
                        </label>
                        <input
                          type="text"
                          value={formData.equipmentCode}
                          onChange={e => setFormData(prev => ({ ...prev, equipmentCode: e.target.value }))}
                          placeholder="เช่น MED-EXT-001..."
                          className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Serial Number (S/N)
                        </label>
                        <input
                          type="text"
                          value={formData.serialNumber}
                          onChange={e => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                          placeholder="หมายเลขเครื่อง S/N..."
                          className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          ยี่ห้อ / ผู้ผลิต (Manufacturer)
                        </label>
                        <input
                          type="text"
                          value={formData.manufacturer}
                          onChange={e => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))}
                          placeholder="เช่น Philips, Mindray..."
                          className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          รุ่น (Model)
                        </label>
                        <input
                          type="text"
                          value={formData.model}
                          onChange={e => setFormData(prev => ({ ...prev, model: e.target.value }))}
                          placeholder="เช่น BeneVision N12..."
                          className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Issue description */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  อาการเสีย / รายละเอียดปัญหา <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={formData.issue}
                  onChange={(e) => setFormData(prev => ({ ...prev, issue: e.target.value }))}
                  placeholder="ระบุอาการเสียอย่างละเอียด..."
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                />
              </div>

              {/* Department */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  แผนกที่แจ้งซ่อม <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    required
                    value={formData.department}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setIsDeptModalOpen(true);
                        return;
                      }
                      setFormData(prev => ({ ...prev, department: e.target.value }));
                    }}
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  >
                    <option value="">-- กรุณาเลือกแผนก --</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                    {isAdmin && (
                      <option value="__add_new__" className="text-amber-600 font-semibold bg-amber-50/50">
                        + เพิ่มแผนกใหม่ (Admin)...
                      </option>
                    )}
                  </select>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setIsDeptModalOpen(true)}
                      title="จัดการรายชื่อแผนก"
                      className="p-2.5 border border-slate-200 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-colors shrink-0"
                    >
                      <Building2 size={18} />
                    </button>
                  )}
                </div>
              </div>

              {/* Report Date & Time */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  วันที่และเวลาเปิดงาน (แจ้งซ่อม) <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="date"
                    required
                    value={formData.reportDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, reportDate: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                  <input
                    type="time"
                    value={formData.reportTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, reportTime: e.target.value }))}
                    placeholder="HH:mm"
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                </div>
              </div>

              {/* Technician */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ช่างผู้รับงานซ่อม
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.technician}
                    onChange={(e) => setFormData(prev => ({ ...prev, technician: e.target.value }))}
                    placeholder="ระบุชื่อช่าง..."
                    className={`w-full border border-slate-300 rounded-xl px-3.5 py-2.5 ${isAdmin ? 'pr-10' : ''} text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white`}
                  />
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setIsTechSignatureModalOpen(true)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                      title="คลิกเพื่อเซ็นลายเซ็นช่าง"
                    >
                      <PenLine size={16} />
                    </button>
                  )}
                </div>
                {isAdmin && formData.technicianSignature && (
                  <div className="mt-2 flex items-center justify-between bg-amber-50/80 border border-amber-200 rounded-xl p-2 px-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="bg-white border border-amber-200 rounded-lg px-2 py-1 shadow-2xs">
                        <img 
                          src={formData.technicianSignature} 
                          alt="ลายเซ็นช่าง" 
                          className="h-6 max-w-[90px] object-contain" 
                        />
                      </div>
                      <span className="text-xs text-amber-900 font-medium truncate">
                        {formData.technician || 'ลงลายมือชื่อช่างแล้ว'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, technicianSignature: '' }))}
                      className="text-xs text-slate-400 hover:text-rose-600 px-2 py-1 rounded hover:bg-white cursor-pointer"
                      title="ลบลายเซ็นช่าง"
                    >
                      ลบ
                    </button>
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  สถานะงานซ่อม
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as RepairJob['status'] }))}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white font-medium"
                >
                  <option value="pending">⏳ รอดำเนินการ (Pending)</option>
                  <option value="in_progress">🔧 กำลังดำเนินการ (In Progress)</option>
                  <option value="completed">✅ เสร็จสิ้น / ใช้งานได้ปกติ (Completed)</option>
                </select>
              </div>

              {/* ช่องเซ็นเปิดงาน */}
              <div className="md:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <SignaturePad
                  value={formData.requesterSignature}
                  onChange={(sigUrl) => setFormData(prev => ({ ...prev, requesterSignature: sigUrl }))}
                  signerName={formData.signerName}
                  onSignerNameChange={(name) => setFormData(prev => ({ ...prev, signerName: name }))}
                  namePlaceholder="กรุณาพิมพ์ชื่อ"
                  label="ช่องเซ็นเปิดงาน / ลายมือชื่อผู้แจ้งซ่อม (Requester Signature)"
                />
              </div>

              {/* Repair details */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  รายละเอียดการซ่อม / การดำเนินการแก้ไข (Action Taken / Repair Details)
                </label>
                <textarea
                  rows={3}
                  value={formData.repairDetails}
                  onChange={(e) => setFormData(prev => ({ ...prev, repairDetails: e.target.value }))}
                  placeholder="ระบุรายละเอียดการตรวจเช็ค ซ่อมแซม อะไหล่ที่เปลี่ยน หรือขั้นตอนการดำเนินการของช่าง..."
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                />
              </div>

              {/* ข้อมูลและการเซ็นปิดงาน / ส่งมอบงาน */}
              <div className="md:col-span-2 p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-900">
                    <Check size={16} className="text-emerald-600" />
                    <span>ช่องเซ็นปิดงานซ่อม / ตรวจรับงาน (Job Closing & Handover)</span>
                  </div>
                  {formData.closingSignature && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                      ✓ มีลายเซ็นปิดงานแล้ว
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      วันที่ปิดงาน / ส่งมอบงาน
                    </label>
                    <input
                      type="date"
                      value={formData.closingDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, closingDate: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      เวลาปิดงานซ่อม
                    </label>
                    <input
                      type="time"
                      value={formData.closingTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, closingTime: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center justify-between">
                      <span>ช่างผู้ดำเนินการซ่อม</span>
                      {formData.closingTechnicianSignature && (
                        <span className="text-[10px] text-emerald-700 font-medium">
                          ✓ เซ็นแล้ว
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.closingTechnician}
                        onChange={(e) => setFormData(prev => ({ ...prev, closingTechnician: e.target.value }))}
                        placeholder="ระบุชื่อช่างผู้ดำเนินการ..."
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 pr-8 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setIsClosingTechSignatureModalOpen(true)}
                        className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors cursor-pointer ${
                          formData.closingTechnicianSignature
                            ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800'
                            : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                        }`}
                        title="คลิกเพื่อเซ็นลายเซ็นช่าง"
                      >
                        <PenLine size={14} />
                      </button>
                    </div>

                    {formData.closingTechnicianSignature && (
                      <div className="mt-1.5 flex items-center justify-between bg-emerald-50/70 border border-emerald-200 rounded-lg p-1.5 px-2">
                        <div className="flex items-center space-x-1.5">
                          <img 
                            src={formData.closingTechnicianSignature} 
                            alt="ลายเซ็นช่างผู้ดำเนินการ" 
                            className="h-5 max-w-[70px] object-contain bg-white rounded border border-emerald-200 px-1" 
                          />
                          <span className="text-[11px] text-emerald-900 font-medium truncate max-w-[120px]">
                            {formData.closingTechnician || 'ลงลายเซ็นแล้ว'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, closingTechnicianSignature: '' }))}
                          className="text-[10px] text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                          title="ลบลายเซ็นช่าง"
                        >
                          ลบ
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ช่องเซ็นปิดงานซ่อม */}
                <SignaturePad
                  value={formData.closingSignature}
                  onChange={(sigUrl) => {
                    const now = new Date();
                    const currentTime = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
                    setFormData(prev => ({
                      ...prev,
                      closingSignature: sigUrl,
                      status: sigUrl ? 'completed' : prev.status,
                      closingDate: prev.closingDate || now.toISOString().split('T')[0],
                      closingTime: prev.closingTime || currentTime,
                      closerName: prev.closerName || currentUser || ''
                    }));
                  }}
                  signerName={formData.closerName}
                  onSignerNameChange={(name) => setFormData(prev => ({ ...prev, closerName: name }))}
                  namePlaceholder="กรุณาระบุชื่อผู้ปิดงาน / ผู้ตรวจรับงาน"
                  label="ช่องเซ็นปิดงานซ่อม / ผู้ตรวจรับงาน (จะเปลี่ยนสถานะเป็นเสร็จสิ้น/ใช้งานได้ปกติอัตโนมัติ)"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-red-600 hover:bg-red-50 text-xs font-medium rounded-xl transition-colors border border-red-200"
                >
                  <Trash2 size={14} />
                  <span>ลบรายการนี้</span>
                </button>
              ) : <div />}

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center space-x-1.5 px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-xl transition-colors shadow-xs"
                >
                  <Check size={14} />
                  <span>บันทึกการแก้ไข</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmation Modal Before Saving */}
      {showConfirmSaveModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                  <Wrench size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">ยืนยันการแก้ไขข้อมูลงานซ่อม</h3>
                  <p className="text-xs text-amber-700 font-medium">บันทึกการเปลี่ยนแปลงรายการแจ้งซ่อม</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfirmSaveModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-600">
                คุณต้องการบันทึกการแก้ไขข้อมูลงานซ่อมเครื่องมือแพทย์นี้ใช่หรือไม่?
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">รหัสเครื่องมือ:</span>
                  <span className="font-mono font-bold text-slate-900">{currentEquipment?.code || formData.equipmentId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ชื่อเครื่องมือ:</span>
                  <span className="font-bold text-slate-900">{currentEquipment?.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">อาการเสีย:</span>
                  <span className="text-slate-800 line-clamp-1">{formData.issue}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">สถานะงานซ่อม:</span>
                  <span className="font-semibold text-amber-700">
                    {formData.status === 'pending' ? 'รอดำเนินการ' :
                     formData.status === 'in_progress' ? 'กำลังซ่อม' :
                     formData.status === 'completed' ? 'ซ่อมเสร็จสิ้น' : 'ยกเลิกการซ่อม'}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowConfirmSaveModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={executeSave}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                <Check size={15} />
                <span>ยืนยันบันทึกการแก้ไข</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Before Deleting */}
      {showConfirmDeleteModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">ยืนยันการลบรายการแจ้งซ่อม</h3>
                  <p className="text-xs text-rose-700 font-medium">ลบรายการนี้ออกจากระบบ</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfirmDeleteModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-rose-100/50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-700">
                คุณแน่ใจหรือไม่ว่าต้องการลบรายการแจ้งซ่อมนี้?
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">รหัสเครื่องมือ:</span>
                  <span className="font-mono font-bold text-slate-900">{currentEquipment?.code || formData.equipmentId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ชื่อเครื่องมือ:</span>
                  <span className="font-bold text-slate-900">{currentEquipment?.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">อาการเสีย:</span>
                  <span className="text-slate-800 line-clamp-1">{formData.issue}</span>
                </div>
              </div>
              <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-[11px] text-rose-700 flex items-center space-x-1.5">
                <AlertTriangle size={14} className="shrink-0 text-rose-500" />
                <span>การลบนี้จะไม่สามารถย้อนกลับได้</span>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowConfirmDeleteModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                <Trash2 size={15} />
                <span>ยืนยันลบรายการ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nested Add Department Modal */}
      <AddDepartmentModal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        onDepartmentAdded={(newDept) => {
          setFormData(prev => ({ ...prev, department: newDept }));
        }}
      />

      {/* Technician Signature Capture Modal */}
      <SignatureCaptureModal
        isOpen={isTechSignatureModalOpen}
        onClose={() => setIsTechSignatureModalOpen(false)}
        onSave={({ signature, name }) => {
          setFormData(prev => ({
            ...prev,
            technicianSignature: signature,
            technician: name || prev.technician
          }));
        }}
        initialSignature={formData.technicianSignature}
        initialName={formData.technician}
        title="เซ็นลายเซ็นช่างผู้รับงานซ่อม (ITRIS Signature)"
        nameLabel="ชื่อช่างผู้รับงานซ่อม"
        namePlaceholder="ระบุชื่อช่าง..."
        subtitle="บันทึกและแก้ไขลายเซ็นช่างในรายการแจ้งซ่อมนี้"
      />

      {/* Closing Technician Signature Capture Modal */}
      <SignatureCaptureModal
        isOpen={isClosingTechSignatureModalOpen}
        onClose={() => setIsClosingTechSignatureModalOpen(false)}
        onSave={({ signature, name }) => {
          setFormData(prev => ({
            ...prev,
            closingTechnicianSignature: signature,
            closingTechnician: name || prev.closingTechnician
          }));
        }}
        initialSignature={formData.closingTechnicianSignature}
        initialName={formData.closingTechnician}
        title="เซ็นลายเซ็นช่างผู้ดำเนินการซ่อม (Closing Technician Signature)"
        nameLabel="ชื่อช่างผู้ดำเนินการซ่อม"
        namePlaceholder="ระบุชื่อช่างผู้ดำเนินการ..."
        subtitle="บันทึกและแนบลายเซ็นช่างในการปิดงานซ่อมนี้"
      />
    </>
  );
}
