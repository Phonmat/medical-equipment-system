import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store';
import { Wrench, AlertTriangle, BarChart3, Building2, Plus, Settings2, Pencil, Trash2, X, Check, Calendar, Printer, FileText, Tag, PenLine, Search, Filter } from 'lucide-react';
import DecommissionView from './DecommissionView';
import MonthlyRepairSummary from '../components/MonthlyRepairSummary';
import YearlyRepairSummary from '../components/YearlyRepairSummary';
import AddDepartmentModal from '../components/AddDepartmentModal';
import EditRepairModal from '../components/EditRepairModal';
import RepairReportModal from '../components/RepairReportModal';
import CloseRepairModal from '../components/CloseRepairModal';
import OpenRepairModal from '../components/OpenRepairModal';
import TechnicianSignatureModal from '../components/TechnicianSignatureModal';
import SignatureCaptureModal from '../components/SignatureCaptureModal';
import SignaturePad from '../components/SignaturePad';
import { RepairJob } from '../types';
import { formatDateSlash } from '../utils/dateUtils';
import EquipmentSearchSelect from '../components/EquipmentSearchSelect';

export default function RepairView({ initialTab = 'repairs' }: { initialTab?: 'repairs' | 'monthly-summary' | 'yearly-summary' | 'decommission' }) {
  const { equipment, repairs, addRepair, updateRepair, deleteRepair, updateRepairStatus, currentUser, userRole, departments } = useAppStore();
  const [activeTab, setActiveTab] = useState<'repairs' | 'monthly-summary' | 'yearly-summary' | 'decommission'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  const [decomInitId, setDecomInitId] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingRepair, setEditingRepair] = useState<RepairJob | null>(null);
  const [closingRepair, setClosingRepair] = useState<RepairJob | null>(null);
  const [openingRepair, setOpeningRepair] = useState<RepairJob | null>(null);
  const [signingTechRepair, setSigningTechRepair] = useState<RepairJob | null>(null);
  const [isFormTechModalOpen, setIsFormTechModalOpen] = useState(false);
  const [viewingSignatureModal, setViewingSignatureModal] = useState<{
    title: string;
    signature: string;
    name: string;
    date?: string;
    time?: string;
    equipmentCode?: string;
    equipmentName?: string;
  } | null>(null);
  const [confirmEditRepair, setConfirmEditRepair] = useState<RepairJob | null>(null);
  const [confirmDeleteRepair, setConfirmDeleteRepair] = useState<RepairJob | null>(null);
  const [printingRepair, setPrintingRepair] = useState<RepairJob | null>(null);
  
  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

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
    reportDate: new Date().toISOString().split('T')[0],
    reportTime: getCurrentTime(),
    technician: '',
    technicianSignature: '',
    requesterSignature: '',
    signerName: currentUser || '',
    signatureDate: new Date().toISOString().split('T')[0]
  });
  const [editFormData, setEditFormData] = useState({
    equipmentId: '',
    issue: '',
    department: '',
    reportDate: '',
    reportTime: '',
    technician: '',
    status: 'pending' as RepairJob['status']
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Available equipment: allow finding and selecting all equipment with clear status badges
  const availableEquipment = equipment;
  
  const isAdmin = userRole === 'Super Admin' || userRole === 'Admin';
  const visibleRepairs = repairs;

  // Search and Filter states for repairs list
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  // Fast O(1) Equipment Lookup Map
  const equipmentMap = useMemo(() => {
    const map = new Map<string, typeof equipment[0]>();
    equipment.forEach(e => map.set(e.id, e));
    return map;
  }, [equipment]);

  const filteredRepairs = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return visibleRepairs.filter(repair => {
      // Status Filter
      if (statusFilter !== 'all' && repair.status !== statusFilter) {
        return false;
      }

      const eq = equipmentMap.get(repair.equipmentId);

      // Department Filter
      const repairDept = repair.department || eq?.department || '';
      if (deptFilter !== 'all' && repairDept !== deptFilter) {
        return false;
      }

      // Keyword Search Filter
      if (!q) return true;

      const code = (eq?.code || repair.equipmentCode || '').toLowerCase();
      const name = (eq?.name || repair.equipmentName || '').toLowerCase();
      const issue = (repair.issue || '').toLowerCase();
      const details = (repair.repairDetails || '').toLowerCase();
      const dept = repairDept.toLowerCase();
      const reporter = (repair.signerName || repair.reportedBy || '').toLowerCase();
      const tech = (repair.technician || '').toLowerCase();
      const sn = (eq?.serialNumber || repair.serialNumber || '').toLowerCase();
      const model = (eq?.model || repair.model || '').toLowerCase();

      return code.includes(q) || name.includes(q) || issue.includes(q) || details.includes(q) || dept.includes(q) || reporter.includes(q) || tech.includes(q) || sn.includes(q) || model.includes(q);
    });
  }, [visibleRepairs, equipmentMap, statusFilter, deptFilter, searchTerm]);

  // Pagination for high performance rendering (1,200+ repairs)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(30);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, deptFilter]);

  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredRepairs.length / Number(pageSize)));

  const paginatedRepairs = useMemo(() => {
    if (pageSize === 'all') return filteredRepairs;
    const size = Number(pageSize);
    const start = (currentPage - 1) * size;
    return filteredRepairs.slice(start, start + size);
  }, [filteredRepairs, currentPage, pageSize]);

  const startIndex = pageSize === 'all' ? 0 : (currentPage - 1) * Number(pageSize);

  const handleEquipmentSelect = (eqId: string) => {
    const selectedEq = equipment.find(e => e.id === eqId);
    setFormData(prev => ({
      ...prev,
      equipmentId: eqId,
      // Auto-populate department from equipment if available
      department: selectedEq?.department || prev.department
    }));
    if (formError) setFormError(null);
  };

  const handleDepartmentChange = (val: string) => {
    if (val === '__add_new__') {
      setIsDeptModalOpen(true);
      return;
    }
    setFormData(prev => ({
      ...prev,
      department: val
    }));
    if (formError) setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Explicit field validation with user-friendly messages
    if (isNonRegistered) {
      if (!formData.equipmentName?.trim()) {
        setFormError('กรุณาระบุชื่อเครื่องมือแพทย์นอกทะเบียน');
        return;
      }
    } else {
      if (!formData.equipmentId) {
        setFormError('กรุณาเลือกเครื่องมือแพทย์ที่ต้องการแจ้งซ่อม (ค้นหารหัสหรือชื่อเครื่องมือ หรือเลือกเครื่องมือนอกทะเบียน)');
        return;
      }
    }

    if (!formData.issue.trim()) {
      setFormError('กรุณาระบุอาการเสียหรือปัญหาของเครื่องมือ');
      return;
    }
    if (!formData.department) {
      setFormError('กรุณาเลือกแผนกที่แจ้งซ่อม');
      return;
    }
    if (!formData.reportDate) {
      setFormError('กรุณาระบุวันที่แจ้งซ่อม');
      return;
    }

    try {
      const assignedEquipmentId = isNonRegistered
        ? `non-reg-${Date.now()}`
        : formData.equipmentId;

      addRepair({
        ...formData,
        equipmentId: assignedEquipmentId,
        isNonRegistered,
        equipmentName: isNonRegistered ? formData.equipmentName.trim() : undefined,
        equipmentCode: isNonRegistered ? (formData.equipmentCode?.trim() || 'นอกทะเบียน') : undefined,
        serialNumber: isNonRegistered ? formData.serialNumber?.trim() : undefined,
        model: isNonRegistered ? formData.model?.trim() : undefined,
        manufacturer: isNonRegistered ? formData.manufacturer?.trim() : undefined,
        issue: formData.issue.trim(),
        repairDetails: formData.repairDetails?.trim() || '',
        status: 'pending'
      });

      setSuccessMessage('บันทึกการแจ้งซ่อมเรียบร้อยแล้ว');
      setTimeout(() => setSuccessMessage(null), 3500);

      // Reset form
      setFormData({ 
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
        reportDate: new Date().toISOString().split('T')[0], 
        reportTime: getCurrentTime(),
        technician: '',
        technicianSignature: '',
        requesterSignature: '',
        signerName: currentUser || '',
        signatureDate: new Date().toISOString().split('T')[0]
      });
      setIsNonRegistered(false);
      setFormError(null);
      setIsAdding(false);
    } catch (err) {
      console.error('Failed to add repair:', err);
      setFormError('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
    }
  };

  return (
    <div className="space-y-6">
      {userRole !== 'User' && userRole !== 'Pool' && (
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('repairs')}
            className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'repairs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Wrench size={16} />
            <span>งานซ่อม</span>
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('monthly-summary')}
                className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors flex items-center space-x-2 ${
                  activeTab === 'monthly-summary'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <BarChart3 size={16} />
                <span>สรุปงานซ่อมประจำเดือน</span>
              </button>
              <button
                onClick={() => setActiveTab('yearly-summary')}
                className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors flex items-center space-x-2 ${
                  activeTab === 'yearly-summary'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Calendar size={16} />
                <span>สรุปงานซ่อมประจำปี</span>
              </button>
            </>
          )}

          {isAdmin && (
            <button
              onClick={() => setActiveTab('decommission')}
              className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors flex items-center space-x-2 ${
                activeTab === 'decommission'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <AlertTriangle size={16} />
              <span>ยกเลิกการใช้งาน</span>
            </button>
          )}
        </div>
      )}

      {activeTab === 'monthly-summary' && isAdmin ? (
        <MonthlyRepairSummary 
          onAddRepairClick={() => {
            setActiveTab('repairs');
            setIsAdding(true);
          }} 
        />
      ) : activeTab === 'yearly-summary' && isAdmin ? (
        <YearlyRepairSummary 
          onAddRepairClick={() => {
            setActiveTab('repairs');
            setIsAdding(true);
          }} 
        />
      ) : activeTab === 'decommission' && isAdmin ? (
        <div className="pt-2">
          <DecommissionView initialEquipmentId={decomInitId} initialIsAdding={!!decomInitId} />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">จัดการงานซ่อม</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {searchTerm || statusFilter !== 'all' || deptFilter !== 'all'
                  ? `พบ ${filteredRepairs.length} รายการ (จากทั้งหมด ${visibleRepairs.length} รายการ)`
                  : `รวมทั้งหมด ${visibleRepairs.length} รายการในระบบ`}
              </p>
            </div>
            
            <div className="flex items-center flex-wrap gap-2.5">
              {/* Search Box on the Left of Action Buttons */}
              <div className="relative w-full sm:w-64 md:w-72">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search size={16} />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ค้นหางานซ่อม... (รหัส, ชื่อ, อาการ, แผนก, ผู้แจ้ง)"
                  className="w-full pl-9 pr-8 py-2 bg-white hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs transition-all"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="ล้างคำค้นหา"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs font-medium"
              >
                <option value="all">ทุกสถานะ</option>
                <option value="pending">รอดำเนินการ</option>
                <option value="in_progress">กำลังซ่อม</option>
                <option value="completed">ซ่อมเสร็จแล้ว</option>
              </select>

              {/* Department Filter */}
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs font-medium max-w-[140px] truncate"
              >
                <option value="all">ทุกแผนก</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>

              <button
                onClick={() => {
                  setIsAdding(!isAdding);
                  setFormError(null);
                }}
                className="flex items-center space-x-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-2xs shrink-0"
              >
                <Wrench size={16} />
                <span>{isAdding ? 'ปิดฟอร์ม' : 'แจ้งซ่อมใหม่'}</span>
              </button>
            </div>
          </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2.5 text-emerald-800 text-sm shadow-xs animate-in fade-in">
          <Check size={18} className="text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {isAdding && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-slate-900">ฟอร์มแจ้งซ่อม</h3>
            <span className="text-xs text-slate-500"><span className="text-red-500">*</span> จำเป็นต้องกรอก</span>
          </div>

          <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Error Message Banner */}
            {formError && (
              <div className="md:col-span-2 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2.5 text-red-700 text-sm">
                <AlertTriangle size={18} className="text-red-500 shrink-0" />
                <span className="font-semibold">{formError}</span>
              </div>
            )}

            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                  <span>เครื่องมือแพทย์ที่แจ้งซ่อม</span>
                  <span className="text-red-500">*</span>
                </label>
                
                {/* Switcher between Registered and Non-Registered Equipment */}
                <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setIsNonRegistered(false);
                      if (formError) setFormError(null);
                    }}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                      !isNonRegistered 
                        ? 'bg-white text-slate-900 shadow-xs font-semibold' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📋 เครื่องมือในทะเบียน
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNonRegistered(true);
                      if (formError) setFormError(null);
                    }}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                      isNonRegistered 
                        ? 'bg-amber-600 text-white shadow-xs font-semibold' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    🏷️ เครื่องมือนอกทะเบียน
                  </button>
                </div>
              </div>

              {!isNonRegistered ? (
                <div>
                  <EquipmentSearchSelect
                    equipment={availableEquipment}
                    selectedId={formData.equipmentId}
                    onSelect={(eqId) => handleEquipmentSelect(eqId)}
                    onSelectNonRegistered={(typedName) => {
                      setIsNonRegistered(true);
                      setFormData(prev => ({
                        ...prev,
                        equipmentId: '',
                        equipmentName: typedName || prev.equipmentName
                      }));
                      if (formError) setFormError(null);
                    }}
                    placeholder="พิมพ์ค้นหารหัสเครื่อง, ชื่อเครื่องมือ, แผนก หรือ S/N..."
                    required
                    hasError={!formData.equipmentId && !isNonRegistered && !!formError}
                    accentColor="amber"
                  />
                  {!formData.equipmentId && !isNonRegistered && formError && (
                    <p className="text-xs text-red-600 mt-1 font-medium">⚠️ กรุณาคลิกเลือกเครื่องมือจากรายการค้นหา หรือกดปุ่ม "เครื่องมือนอกทะเบียน"</p>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-200/80">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-amber-900">
                      <Tag size={15} className="text-amber-700" />
                      <span>เปิดงานซ่อมเครื่องมือนอกทะเบียน (ไม่ได้อยู่ในฐานข้อมูลครุภัณฑ์)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsNonRegistered(false)}
                      className="text-xs text-amber-800 hover:text-amber-950 underline font-medium cursor-pointer"
                    >
                      สลับกลับไปเลือกในทะเบียน
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        ชื่อเครื่องมือแพทย์ <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.equipmentName}
                        onChange={e => {
                          setFormData({...formData, equipmentName: e.target.value});
                          if (formError) setFormError(null);
                        }}
                        placeholder="ระบุชื่อเครื่องมือ เช่น เครื่องวัดความดันโลหิต, เครื่องกระตุกหัวใจ, เตียงไฟฟ้า..."
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white ${
                          !formData.equipmentName?.trim() && formError ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-300 focus:ring-amber-500'
                        }`}
                      />
                      {!formData.equipmentName?.trim() && formError && (
                        <p className="text-xs text-red-600 mt-1 font-medium">⚠️ กรุณาระบุชื่อเครื่องมือแพทย์</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        รหัสเครื่อง / หมายเลขเดิม (ถ้ามี)
                      </label>
                      <input
                        type="text"
                        value={formData.equipmentCode}
                        onChange={e => setFormData({...formData, equipmentCode: e.target.value})}
                        placeholder="เช่น MED-EXT-001 หรือเลขสินทรัพย์เดิม..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Serial Number (S/N)
                      </label>
                      <input
                        type="text"
                        value={formData.serialNumber}
                        onChange={e => setFormData({...formData, serialNumber: e.target.value})}
                        placeholder="หมายเลขเครื่อง S/N (ถ้ามี)..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        ยี่ห้อ / ผู้ผลิต (Manufacturer)
                      </label>
                      <input
                        type="text"
                        value={formData.manufacturer}
                        onChange={e => setFormData({...formData, manufacturer: e.target.value})}
                        placeholder="เช่น Philips, Mindray, Terumo, GE..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        รุ่น (Model)
                      </label>
                      <input
                        type="text"
                        value={formData.model}
                        onChange={e => setFormData({...formData, model: e.target.value})}
                        placeholder="เช่น BeneVision N12, IntelliVue MX..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                อาการเสีย/ปัญหา <span className="text-red-500">*</span>
              </label>
              <textarea 
                required 
                value={formData.issue} 
                onChange={e => {
                  setFormData({...formData, issue: e.target.value});
                  if (formError) setFormError(null);
                }} 
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white ${
                  !formData.issue.trim() && formError ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-300 focus:ring-amber-500'
                }`}
                rows={3} 
                placeholder="ระบุอาการเสียอย่างละเอียด..." 
              />
              {!formData.issue.trim() && formError && (
                <p className="text-xs text-red-600 mt-1 font-medium">⚠️ กรุณาระบุอาการเสีย</p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                แผนกที่แจ้งซ่อม <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select 
                  required 
                  value={formData.department} 
                  onChange={e => handleDepartmentChange(e.target.value)} 
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white ${
                    !formData.department && formError ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-300 focus:ring-amber-500'
                  }`}
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
                    className="p-2 border border-slate-200 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors shrink-0"
                  >
                    <Building2 size={18} />
                  </button>
                )}
              </div>
              {!formData.department && formError && (
                <p className="text-xs text-red-600 mt-1 font-medium">⚠️ กรุณาเลือกแผนก</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                วันที่และเวลาเปิดงาน <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <input 
                    required 
                    type="date" 
                    value={formData.reportDate} 
                    onChange={e => setFormData({...formData, reportDate: e.target.value})} 
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white" 
                  />
                </div>
                <div>
                  <input 
                    type="time" 
                    value={formData.reportTime} 
                    onChange={e => setFormData({...formData, reportTime: e.target.value})} 
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white" 
                  />
                </div>
              </div>
            </div>
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ช่างผู้รับงานซ่อม</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={formData.technician} 
                    onChange={e => setFormData({...formData, technician: e.target.value})} 
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white" 
                    placeholder="ระบุชื่อช่าง" 
                  />
                  <button
                    type="button"
                    onClick={() => setIsFormTechModalOpen(true)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                    title="คลิกเพื่อเซ็นลายเซ็นช่าง"
                  >
                    <PenLine size={16} />
                  </button>
                </div>
                {formData.technicianSignature && (
                  <div className="mt-1.5 flex items-center justify-between bg-amber-50/70 border border-amber-200 rounded-lg p-1.5 px-2.5">
                    <div className="flex items-center space-x-2">
                      <img src={formData.technicianSignature} alt="ลายเซ็นช่าง" className="h-6 max-w-[80px] object-contain bg-white rounded border border-amber-200 px-1" />
                      <span className="text-[11px] text-amber-800 font-medium truncate">
                        {formData.technician || 'ลงลายเซ็นแล้ว'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, technicianSignature: '' }))}
                      className="text-[11px] text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      title="ลบลายเซ็นช่าง"
                    >
                      ลบ
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ช่องเซ็นเปิดงานซ่อมและพิมพ์ชื่อ */}
            <div className="md:col-span-2 p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <SignaturePad
                value={formData.requesterSignature}
                onChange={(sigUrl) => setFormData(prev => ({ ...prev, requesterSignature: sigUrl }))}
                signerName={formData.signerName}
                onSignerNameChange={(name) => setFormData(prev => ({ ...prev, signerName: name }))}
                namePlaceholder="กรุณาพิมพ์หรือระบุชื่อผู้แจ้งเปิดงาน"
                label="ช่องเซ็นชื่อเปิดงานซ่อม / ผู้แจ้งซ่อม (Requester Signature)"
              />
            </div>

            {/* รายละเอียดการซ่อม / การดำเนินการ */}
            {isAdmin && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  รายละเอียดการซ่อม / การดำเนินการ (Repair Details / Action Taken)
                </label>
                <textarea 
                  value={formData.repairDetails} 
                  onChange={e => setFormData({...formData, repairDetails: e.target.value})} 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white" 
                  rows={3} 
                  placeholder="ระบุรายละเอียดการตรวจเช็ค ซ่อมแซม อะไหล่ที่เปลี่ยน หรือขั้นตอนการดำเนินการแก้ไข (ถ้ามี)..." 
                />
              </div>
            )}
            
            <div className="md:col-span-2 flex justify-end space-x-3 mt-2 pt-2 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => {
                  setIsAdding(false);
                  setFormError(null);
                }} 
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button 
                type="submit" 
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-sm font-medium transition-all shadow-xs flex items-center space-x-2 cursor-pointer"
              >
                <Check size={16} />
                <span>ยืนยันการแจ้งซ่อม</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[72vh] overflow-y-auto">
          <table className="w-full text-left text-sm border-separate border-spacing-0">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-xs">
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="px-6 py-4 font-medium bg-slate-50 border-b border-slate-200 whitespace-nowrap">รหัสเครื่องมือ</th>
                <th className="px-6 py-4 font-medium bg-slate-50 border-b border-slate-200">อาการเสีย</th>
                <th className="px-6 py-4 font-medium bg-slate-50 border-b border-slate-200">ผู้แจ้ง / ลายเซ็นเปิดงาน</th>
                <th className="px-6 py-4 font-medium bg-slate-50 border-b border-slate-200">แผนก</th>
                <th className="px-6 py-4 font-medium bg-slate-50 border-b border-slate-200">ผู้ตรวจสอบ/เซ็นปิดงาน</th>
                <th className="px-6 py-4 font-medium bg-slate-50 border-b border-slate-200">ช่าง</th>
                <th className="px-6 py-4 font-medium bg-slate-50 border-b border-slate-200 whitespace-nowrap">สถานะ</th>
                <th className="px-6 py-4 font-medium text-right bg-slate-50 border-b border-slate-200 sticky right-0 top-0 z-20 whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedRepairs.map((repair: RepairJob) => {
              const eq = equipmentMap.get(repair.equipmentId);
              return (
                <tr key={repair.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-slate-900 font-medium whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono font-bold text-slate-900">
                          {eq?.code || repair.equipmentCode || (repair.isNonRegistered ? 'นอกทะเบียน' : 'Unknown')}
                        </span>
                        {repair.isNonRegistered && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md font-medium">
                            นอกทะเบียน
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-600 font-normal truncate max-w-[200px]" title={eq?.name || repair.equipmentName}>
                        {eq?.name || repair.equipmentName || '-'}
                      </span>
                      {(repair.manufacturer || repair.model) && (
                        <span className="text-[11px] text-slate-400 font-normal truncate max-w-[200px]">
                          {[repair.manufacturer, repair.model].filter(Boolean).join(' ')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-700">
                    <div className="font-medium text-slate-800">{repair.issue}</div>
                    {repair.repairDetails && (
                      <div className="text-xs text-slate-500 mt-1 line-clamp-2 bg-slate-50 p-1.5 rounded border border-slate-100">
                        <span className="font-semibold text-amber-700">การดำเนินการ:</span> {repair.repairDetails}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                    <div className="flex flex-col items-start gap-1.5 min-w-[140px]">
                      <div className="flex items-center space-x-1.5 whitespace-nowrap">
                        <span className="font-medium text-slate-800 whitespace-nowrap">{repair.signerName || repair.reportedBy || '-'}</span>
                        {repair.requesterSignature && (
                          <span className="inline-flex items-center text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0" title="เซ็นเปิดงานแล้ว">
                            ✓ เปิดงาน
                          </span>
                        )}
                      </div>

                      {repair.requesterSignature ? (
                        <div className="flex items-center gap-1.5 flex-nowrap whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setViewingSignatureModal({
                              title: 'ลายเซ็นผู้แจ้งซ่อม / เปิดงาน',
                              signature: repair.requesterSignature!,
                              name: repair.signerName || repair.reportedBy || '-',
                              date: repair.signatureDate || repair.reportDate,
                              time: repair.reportTime,
                              equipmentCode: eq?.code,
                              equipmentName: eq?.name
                            })}
                            className="group relative bg-white border border-blue-300 hover:border-blue-500 rounded-lg p-1 shadow-2xs hover:shadow-xs transition-all inline-flex items-center flex-nowrap cursor-pointer whitespace-nowrap shrink-0"
                            title="คลิกเพื่อดูลายเซ็นผู้แจ้งเปิดงานขนาดใหญ่"
                          >
                            <img
                              src={repair.requesterSignature}
                              alt="ลายเซ็นเปิดงาน"
                              className="h-8 max-w-[95px] object-contain shrink-0"
                            />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setOpeningRepair(repair)}
                              className="p-1 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors shrink-0"
                              title="เซ็นหรือแก้ไขลายเซ็นเปิดงานใหม่"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setOpeningRepair(repair)}
                              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 border border-blue-300 px-2.5 py-1.5 rounded-lg transition-all shadow-2xs hover:shadow-xs group cursor-pointer whitespace-nowrap shrink-0"
                              title="เปิดช่องเซ็นเปิดงานซ่อม"
                            >
                              <span className="text-blue-600 group-hover:scale-110 transition-transform">✍️</span>
                              <span>ช่องเซ็นเปิดงาน</span>
                            </button>
                          )}
                        </>
                      )}
                      {/* 2 ช่องนี้: วันที่และเวลาแจ้งเปิดงาน ไว้ใต้ช่องเซ็นเปิดงาน */}
                      {repair.reportDate ? (
                        <div className="flex items-center gap-1.5 text-xs font-mono pt-0.5 whitespace-nowrap">
                          <span className="inline-flex items-center text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200/80 px-1.5 py-0.5 rounded font-medium shrink-0">
                            {formatDateSlash(repair.reportDate)}
                          </span>
                          {repair.reportTime && (
                            <span className="text-slate-400 text-[10px] font-normal whitespace-nowrap">{repair.reportTime} น.</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[10px] pl-0.5">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{repair.department || '-'}</td>
                  <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                    <div className="flex flex-col items-start gap-1 min-w-[140px]">
                      {repair.closerName && (
                        <span className="text-slate-800 font-medium whitespace-nowrap">{repair.closerName}</span>
                      )}
                      {repair.closingSignature ? (
                        <div className="flex items-center gap-1.5 flex-nowrap whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setViewingSignatureModal({
                              title: 'ลายเซ็นปิดงานซ่อม / ตรวจรับงาน',
                              signature: repair.closingSignature!,
                              name: repair.closerName || repair.technician || '-',
                              date: repair.closingDate,
                              time: repair.closingTime,
                              equipmentCode: eq?.code,
                              equipmentName: eq?.name
                            })}
                            className="group relative bg-white border border-emerald-300 hover:border-emerald-500 rounded-lg p-1 shadow-2xs hover:shadow-xs transition-all inline-flex items-center flex-nowrap cursor-pointer whitespace-nowrap shrink-0"
                            title="คลิกเพื่อดูลายเซ็นปิดงานซ่อมขนาดใหญ่"
                          >
                            <img
                              src={repair.closingSignature}
                              alt="ลายเซ็นปิดงาน"
                              className="h-8 max-w-[95px] object-contain shrink-0"
                            />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setClosingRepair(repair)}
                              className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors shrink-0"
                              title="เซ็นหรือแก้ไขลายเซ็นปิดงานซ่อมใหม่"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setClosingRepair(repair)}
                              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 px-2.5 py-1.5 rounded-lg transition-all shadow-2xs hover:shadow-xs group cursor-pointer whitespace-nowrap shrink-0"
                              title="เปิดช่องเซ็นปิดงานซ่อม"
                            >
                              <span className="text-emerald-600 group-hover:scale-110 transition-transform">✍️</span>
                              <span>ช่องเซ็นปิดงาน</span>
                            </button>
                          )}
                        </>

                      )}

                      {/* 2 ช่องนี้: วันที่และเวลาปิดงาน ไว้ใต้ช่องเซ็นปิดงาน */}
                      {repair.closingDate ? (
                        <div className="flex items-center gap-1.5 text-xs font-mono pt-0.5 whitespace-nowrap">
                          <span className="inline-flex items-center text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-1.5 py-0.5 rounded font-medium shrink-0">
                            {formatDateSlash(repair.closingDate)}
                          </span>
                          {repair.closingTime && (
                            <span className="text-slate-400 text-[10px] font-normal whitespace-nowrap">{repair.closingTime} น.</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[10px] pl-0.5">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-700 font-medium whitespace-nowrap">
                    <div className="flex flex-col text-xs space-y-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-slate-800 font-medium">{repair.technician || '-'}</span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setSigningTechRepair(repair)}
                            className={`p-1 rounded-md transition-colors border cursor-pointer ${
                              repair.technicianSignature
                                ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200'
                                : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 border-dashed border-slate-300'
                            }`}
                            title={repair.technicianSignature ? 'แก้ไขหรือดูการเซ็นลายเซ็นช่าง' : 'คลิกเพื่อเซ็นลายเซ็นช่าง'}
                          >
                            <PenLine size={13} />
                          </button>
                        )}
                      </div>

                      {/* Signature preview if signed - Only visible and editable by Admin & Super Admin */}
                      {isAdmin && (
                        <>
                          {repair.technicianSignature ? (
                            <div 
                              onClick={() => setViewingSignatureModal({
                                title: 'ลายเซ็นช่างผู้รับงานซ่อม (ITRIS Signature)',
                                signature: repair.technicianSignature!,
                                name: repair.technician || 'ช่างผู้รับงานซ่อม',
                                date: repair.reportDate,
                                time: repair.reportTime,
                                equipmentCode: eq?.code || repair.equipmentCode,
                                equipmentName: eq?.name || repair.equipmentName
                              })}
                              className="flex items-center space-x-1 cursor-pointer group"
                              title="คลิกเพื่อดูลายเซ็นช่างขนาดใหญ่"
                            >
                              <div className="bg-white border border-amber-200 rounded px-1 py-0.5 shadow-2xs group-hover:border-amber-400 transition-colors">
                                <img
                                  src={repair.technicianSignature}
                                  alt="ลายเซ็นช่าง"
                                  className="h-4 max-w-[65px] object-contain"
                                />
                              </div>
                              <span className="text-[10px] text-amber-700 font-medium group-hover:underline">
                                เซ็นแล้ว
                              </span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSigningTechRepair(repair)}
                              className="inline-flex items-center space-x-1 text-[10px] text-amber-600 hover:text-amber-700 hover:underline cursor-pointer"
                            >
                              <span>✍️ เซ็นชื่อช่าง</span>
                            </button>
                          )}
                        </>
                      )}

                      {isAdmin && repair.closingTechnician && (
                        <div className="flex flex-col items-start gap-1 text-[11px] text-emerald-700 pt-0.5">
                          <span>(ผู้ดำเนินการ: {repair.closingTechnician})</span>
                          {repair.closingTechnicianSignature && (
                            <button
                              type="button"
                              onClick={() => setViewingSignatureModal({
                                title: 'ลายเซ็นช่างผู้ดำเนินการซ่อม (Closing Technician Signature)',
                                signature: repair.closingTechnicianSignature!,
                                name: repair.closingTechnician || '',
                                date: repair.closingDate,
                                time: repair.closingTime,
                                equipmentCode: eq?.code || repair.equipmentCode,
                                equipmentName: eq?.name || repair.equipmentName
                              })}
                              className="inline-flex items-center space-x-0.5 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 cursor-pointer text-[9px] text-emerald-800 transition-colors shadow-2xs"
                              title="คลิกเพื่อดูลายเซ็นช่างผู้ดำเนินการซ่อม"
                            >
                              <span>✓ ลายเซ็นปิดงาน</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center justify-center whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-medium leading-none ${
                      repair.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      repair.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {repair.status === 'completed' ? 'เสร็จสิ้น' : repair.status === 'in_progress' ? 'กำลังดำเนินการ' : 'รอดำเนินการ'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-2">
                      {/* Edit Button */}
                      {isAdmin && (
                        <button
                          onClick={() => setConfirmEditRepair(repair)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-100 shadow-2xs"
                          title="แก้ไขข้อมูลงานซ่อม / เปลี่ยนสถานะ"
                        >
                          <Pencil size={15} />
                        </button>
                      )}

                      {/* Print Report Button */}
                      <button
                        onClick={() => setPrintingRepair(repair)}
                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200 shadow-2xs"
                        title="พิมพ์ใบงาน / รายงานผลการซ่อมบำรุง"
                      >
                        <Printer size={15} />
                      </button>

                      {/* Delete Button */}
                      {isAdmin && (
                        <button
                          onClick={() => setConfirmDeleteRepair(repair)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100"
                          title="ลบรายการแจ้งซ่อม"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}

                      {isAdmin && (
                        <button
                          onClick={() => {
                            setDecomInitId(repair.equipmentId);
                            setActiveTab('decommission');
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="ยกเลิกการใช้งาน"
                        >
                          <AlertTriangle size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredRepairs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Search size={32} className="text-slate-300 stroke-[1.5]" />
                    <p className="text-sm font-medium text-slate-700">
                      {searchTerm || statusFilter !== 'all' || deptFilter !== 'all'
                        ? 'ไม่พบข้อมูลงานซ่อมที่ตรงกับเงื่อนไขการค้นหา'
                        : 'ยังไม่มีประวัติงานซ่อมในระบบ'}
                    </p>
                    {(searchTerm || statusFilter !== 'all' || deptFilter !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm('');
                          setStatusFilter('all');
                          setDeptFilter('all');
                        }}
                        className="text-xs text-amber-600 hover:text-amber-800 font-semibold hover:underline mt-1 cursor-pointer"
                      >
                        ล้างตัวกรองทั้งหมด
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls for RepairView */}
      {filteredRepairs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 mt-3">
          <div className="flex items-center space-x-2">
            <span>แสดง</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                setPageSize(val);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value={20}>20 รายการ / หน้า</option>
              <option value={30}>30 รายการ / หน้า</option>
              <option value={50}>50 รายการ / หน้า</option>
              <option value={100}>100 รายการ / หน้า</option>
              <option value="all">แสดงทั้งหมด ({filteredRepairs.length})</option>
            </select>
            <span className="text-slate-400">|</span>
            <span>
              รายการที่ <strong className="text-slate-800">{filteredRepairs.length === 0 ? 0 : startIndex + 1}</strong> ถึง <strong className="text-slate-800">{pageSize === 'all' ? filteredRepairs.length : Math.min(startIndex + Number(pageSize), filteredRepairs.length)}</strong> จากทั้งหมด <strong className="text-amber-700">{filteredRepairs.length.toLocaleString()}</strong> งาน
            </span>
          </div>

          {pageSize !== 'all' && totalPages > 1 && (
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 transition-colors cursor-pointer"
                title="หน้าแรก"
              >
                « หน้าแรก
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 transition-colors cursor-pointer"
                title="หน้าก่อนหน้า"
              >
                ‹ ก่อนหน้า
              </button>

              <div className="flex items-center px-2 font-semibold text-slate-800">
                <span>หน้า {currentPage} จาก {totalPages}</span>
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 transition-colors cursor-pointer"
                title="หน้าถัดไป"
              >
                ถัดไป ›
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 transition-colors cursor-pointer"
                title="หน้าสุดท้าย"
              >
                หน้าสุดท้าย »
              </button>
            </div>
          )}
        </div>
      )}
      </div>
      </div>
      )}

      {/* Confirm Entering Edit Mode Modal */}
      {confirmEditRepair && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                  <Pencil size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">ยืนยันการแก้ไขข้อมูลงานซ่อม</h3>
                  <p className="text-xs text-blue-700 font-medium">เปิดหน้าต่างแก้ไขรายการแจ้งซ่อม</p>
                </div>
              </div>
              <button
                onClick={() => setConfirmEditRepair(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-600">
                คุณต้องการเปิดแก้ไขข้อมูลรายการแจ้งซ่อมนี้ใช่หรือไม่?
              </p>
              {(() => {
                const eq = equipment.find(e => e.id === confirmEditRepair.equipmentId);
                const eqCode = eq?.code || confirmEditRepair.equipmentCode || (confirmEditRepair.isNonRegistered ? 'เครื่องมือนอกทะเบียน' : 'N/A');
                const eqName = eq?.name || confirmEditRepair.equipmentName || 'ไม่ระบุชื่อเครื่องมือ';
                return (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">รหัสเครื่องมือ:</span>
                      <span className="font-mono font-bold text-slate-900">{eqCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ชื่อเครื่องมือ:</span>
                      <span className="font-bold text-slate-900">{eqName}</span>
                    </div>
                    {confirmEditRepair.isNonRegistered && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">ประเภท:</span>
                        <span className="text-amber-700 font-semibold">เครื่องมือนอกทะเบียน</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">อาการเสีย:</span>
                      <span className="text-slate-800 line-clamp-1">{confirmEditRepair.issue}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ผู้แจ้งซ่อม:</span>
                      <span className="text-slate-700">{confirmEditRepair.reportedBy || '-'}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setConfirmEditRepair(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingRepair(confirmEditRepair);
                  setConfirmEditRepair(null);
                }}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                <Pencil size={15} />
                <span>ยืนยันแก้ไขงานซ่อม</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Repair Modal */}
      {confirmDeleteRepair && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">ยืนยันการลบรายการแจ้งซ่อม</h3>
                  <p className="text-xs text-rose-700 font-medium">ลบรายการนี้ออกจากระบบงานซ่อม</p>
                </div>
              </div>
              <button
                onClick={() => setConfirmDeleteRepair(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-rose-100/50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-700">
                คุณแน่ใจหรือไม่ว่าต้องการลบรายการแจ้งซ่อมนี้?
              </p>
              {(() => {
                const eq = equipment.find(e => e.id === confirmDeleteRepair.equipmentId);
                const eqCode = eq?.code || confirmDeleteRepair.equipmentCode || (confirmDeleteRepair.isNonRegistered ? 'เครื่องมือนอกทะเบียน' : 'N/A');
                const eqName = eq?.name || confirmDeleteRepair.equipmentName || 'ไม่ระบุชื่อเครื่องมือ';
                return (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">รหัสเครื่องมือ:</span>
                      <span className="font-mono font-bold text-slate-900">{eqCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ชื่อเครื่องมือ:</span>
                      <span className="font-bold text-slate-900">{eqName}</span>
                    </div>
                    {confirmDeleteRepair.isNonRegistered && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">ประเภท:</span>
                        <span className="text-rose-700 font-semibold">เครื่องมือนอกทะเบียน</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">แผนก:</span>
                      <span className="text-slate-700">{confirmDeleteRepair.department || eq?.department || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">อาการเสีย:</span>
                      <span className="text-slate-800 line-clamp-2">{confirmDeleteRepair.issue}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">วันที่แจ้งซ่อม:</span>
                      <span className="text-slate-700">{confirmDeleteRepair.reportDate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">สถานะ:</span>
                      <span className="font-semibold text-slate-700">
                        {confirmDeleteRepair.status === 'completed' ? 'เสร็จสิ้น' : confirmDeleteRepair.status === 'in_progress' ? 'กำลังดำเนินการ' : 'รอดำเนินการ'}
                      </span>
                    </div>
                  </div>
                );
              })()}
              <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-[11px] text-rose-700 flex items-center space-x-1.5">
                <AlertTriangle size={14} className="shrink-0 text-rose-500" />
                <span>การลบนี้จะไม่สามารถย้อนกลับได้ และสถานะเครื่องมือจะถูกรีเซ็ตให้กลับมาใช้งานได้</span>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteRepair(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteRepair(confirmDeleteRepair.id);
                  setConfirmDeleteRepair(null);
                }}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                <Trash2 size={15} />
                <span>ยืนยันลบรายการ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Repair Modal */}
      <EditRepairModal
        repair={editingRepair}
        isOpen={!!editingRepair}
        onClose={() => setEditingRepair(null)}
      />

      {/* Repair Report Printable Modal */}
      <RepairReportModal
        repair={printingRepair}
        equipment={equipment.find(e => e.id === printingRepair?.equipmentId)}
        isOpen={!!printingRepair}
        onClose={() => setPrintingRepair(null)}
      />

      {/* Dedicated Close Repair & Signature Modal (ช่องเซ็นปิดงานซ่อม) */}
      <CloseRepairModal
        repair={closingRepair}
        equipment={equipment.find(e => e.id === closingRepair?.equipmentId)}
        isOpen={!!closingRepair}
        onClose={() => setClosingRepair(null)}
      />

      {/* Dedicated Open Repair & Signature Modal (ช่องเซ็นเปิดงานซ่อม) */}
      <OpenRepairModal
        repair={openingRepair}
        equipment={equipment.find(e => e.id === openingRepair?.equipmentId)}
        isOpen={!!openingRepair}
        onClose={() => setOpeningRepair(null)}
      />

      {/* Dedicated Technician Signature Modal (เซ็นลายเซ็นช่างผู้รับงานซ่อมในรายการ) */}
      <TechnicianSignatureModal
        repair={signingTechRepair}
        equipment={equipment.find(e => e.id === signingTechRepair?.equipmentId)}
        isOpen={!!signingTechRepair}
        onClose={() => setSigningTechRepair(null)}
      />

      {/* Signature Capture Modal for Add Repair Form (เซ็นลายเซ็นช่างตอนเปิดงานใหม่) */}
      <SignatureCaptureModal
        isOpen={isFormTechModalOpen}
        onClose={() => setIsFormTechModalOpen(false)}
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
        subtitle="บันทึกและแนบลายเซ็นช่างในใบแจ้งซ่อม"
      />

      {/* Signature Viewer Lightbox Modal */}
      {viewingSignatureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-base">✍️</span>
                <div>
                  <h3 className="text-sm font-bold text-white">{viewingSignatureModal.title}</h3>
                  {viewingSignatureModal.equipmentCode && (
                    <p className="text-[11px] text-slate-300">
                      เครื่อง: {viewingSignatureModal.equipmentCode} {viewingSignatureModal.equipmentName ? `(${viewingSignatureModal.equipmentName})` : ''}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setViewingSignatureModal(null)}
                className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Signature display container with subtle drafting grid */}
              <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 flex items-center justify-center min-h-[160px] relative overflow-hidden shadow-inner">
                <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:12px_12px] opacity-40 pointer-events-none" />
                <img
                  src={viewingSignatureModal.signature}
                  alt={viewingSignatureModal.title}
                  className="max-h-36 max-w-full object-contain relative z-10 filter drop-shadow-xs"
                />
              </div>

              {/* Signer information */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">ผู้ลงนาม:</span>
                  <span className="font-bold text-slate-900">{viewingSignatureModal.name}</span>
                </div>
                {viewingSignatureModal.date && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">วันที่ลงนาม:</span>
                    <span className="font-medium text-slate-700 font-mono">
                      {formatDateSlash(viewingSignatureModal.date)} {viewingSignatureModal.time ? `${viewingSignatureModal.time} น.` : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setViewingSignatureModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Department Modal for Admin / Super Admin */}
      <AddDepartmentModal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        onDepartmentAdded={(newDept) => {
          setFormData(prev => ({ ...prev, department: newDept }));
        }}
      />
    </div>
  );
}
