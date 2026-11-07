import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { ClipboardCheck, Pencil, Trash2, Plus, X, Check, AlertCircle, FileSpreadsheet, Search, Filter, Download, Printer, Calendar, ChevronDown, CalendarDays } from 'lucide-react';
import { Equipment, MaintenancePlan, PlanStatus } from '../types';
import { formatDateSlash, parseDateString, resolvePlanStatusByNextDate } from '../utils/dateUtils';
import { printElement } from '../utils/printUtils';
import EquipmentSearchSelect from '../components/EquipmentSearchSelect';
import ImportMaintenanceModal from '../components/ImportMaintenanceModal';

const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export default function MaintenanceView() {
  const { equipment, maintenances, addMaintenance, bulkAddMaintenance, updateMaintenance, deleteMaintenance, userRole, currentFacility } = useAppStore();
  const isAdmin = userRole === 'Super Admin' || userRole === 'Admin';
  const canEdit = isAdmin || userRole === 'PM/CAL';
  const [isAdding, setIsAdding] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPlanMenuOpen, setIsPlanMenuOpen] = useState(false);
  const [isAnnualPlanModalOpen, setIsAnnualPlanModalOpen] = useState(false);
  const [annualPlanYear, setAnnualPlanYear] = useState<number>(2026);
  const [annualPlanDept, setAnnualPlanDept] = useState<string>('all');
  const planMenuRef = useRef<HTMLDivElement>(null);
  const annualPrintRef = useRef<HTMLDivElement>(null);
  const [editingPlan, setEditingPlan] = useState<MaintenancePlan | null>(null);
  const [planToDelete, setPlanToDelete] = useState<MaintenancePlan | null>(null);
  const [printingPlan, setPrintingPlan] = useState<MaintenancePlan | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Close Plan Menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (planMenuRef.current && !planMenuRef.current.contains(event.target as Node)) {
        setIsPlanMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PlanStatus>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  // Extract all distinct departments
  const allDepartments = useMemo(() => {
    const set = new Set<string>();
    equipment.forEach(e => {
      if (e.department && e.department.trim()) set.add(e.department.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th'));
  }, [equipment]);

  // Equipment lookup map for fast O(1) matching
  const equipmentMap = useMemo(() => {
    const map = new Map<string, typeof equipment[0]>();
    equipment.forEach(e => map.set(e.id, e));
    return map;
  }, [equipment]);

  const [formData, setFormData] = useState({
    equipmentId: '',
    frequency: 'ทุก 6 เดือน',
    lastDate: new Date().toISOString().split('T')[0],
    nextDate: '',
    technician: '',
    notes: '',
    status: 'pending' as PlanStatus
  });

  const [editFormData, setEditFormData] = useState({
    equipmentId: '',
    frequency: 'ทุก 6 เดือน',
    lastDate: '',
    nextDate: '',
    technician: '',
    notes: '',
    status: 'pending' as PlanStatus
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipmentId) return;
    const resolvedStatus = resolvePlanStatusByNextDate(formData.nextDate, formData.status);
    addMaintenance({ ...formData, status: resolvedStatus });
    setFormData({
      equipmentId: '',
      frequency: 'ทุก 6 เดือน',
      lastDate: new Date().toISOString().split('T')[0],
      nextDate: '',
      technician: '',
      notes: '',
      status: 'pending'
    });
    setIsAdding(false);
    setSuccessMessage('เพิ่มแผนการบำรุงรักษาเรียบร้อยแล้ว');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleStartEdit = (plan: MaintenancePlan) => {
    setEditingPlan(plan);
    setEditFormData({
      equipmentId: plan.equipmentId,
      frequency: plan.frequency,
      lastDate: parseDateString(plan.lastDate) || plan.lastDate,
      nextDate: parseDateString(plan.nextDate) || plan.nextDate,
      technician: plan.technician || '',
      notes: plan.notes || '',
      status: resolvePlanStatusByNextDate(plan.nextDate, plan.status)
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    const resolvedStatus = resolvePlanStatusByNextDate(editFormData.nextDate, editFormData.status);
    updateMaintenance(editingPlan.id, { ...editFormData, status: resolvedStatus });
    setEditingPlan(null);
    setSuccessMessage('บันทึกการแก้ไขเรียบร้อยแล้ว');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Filtered maintenances
  const filteredMaintenances = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return maintenances.filter(m => {
      const eq = equipmentMap.get(m.equipmentId);
      const effectiveStatus = resolvePlanStatusByNextDate(m.nextDate, m.status);

      // Status Filter
      if (statusFilter !== 'all' && effectiveStatus !== statusFilter) {
        return false;
      }

      // Risk Level Filter
      if (riskFilter !== 'all') {
        const eqRisk = eq?.riskLevel || 'Low';
        if (eqRisk !== riskFilter) return false;
      }

      // Department Filter
      if (deptFilter !== 'all') {
        const eqDept = (eq?.department || '').trim();
        if (eqDept !== deptFilter) return false;
      }

      if (!q) return true;

      const code = (eq?.code || '').toLowerCase();
      const name = (eq?.name || '').toLowerCase();
      const dept = (eq?.department || '').toLowerCase();
      const tech = (m.technician || '').toLowerCase();
      const freq = (m.frequency || '').toLowerCase();
      const notes = (m.notes || '').toLowerCase();

      return code.includes(q) || name.includes(q) || dept.includes(q) || tech.includes(q) || freq.includes(q) || notes.includes(q);
    });
  }, [maintenances, equipmentMap, searchTerm, statusFilter, riskFilter, deptFilter]);

  // Pagination for high performance
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(50);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, riskFilter, deptFilter]);

  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredMaintenances.length / Number(pageSize)));

  const paginatedMaintenances = useMemo(() => {
    if (pageSize === 'all') return filteredMaintenances;
    const size = Number(pageSize);
    const start = (currentPage - 1) * size;
    return filteredMaintenances.slice(start, start + size);
  }, [filteredMaintenances, currentPage, pageSize]);

  const startIndex = pageSize === 'all' ? 0 : (currentPage - 1) * Number(pageSize);

  const getStatusBadge = (status: PlanStatus) => {
    switch (status) {
      case 'completed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 whitespace-nowrap inline-block">บำรุงรักษาแล้ว</span>;
      case 'overdue':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 whitespace-nowrap inline-block">เลยกำหนด</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 whitespace-nowrap inline-block">รอดำเนินการ</span>;
    }
  };

  const getStatusLabel = (status: PlanStatus) => {
    switch (status) {
      case 'completed':
        return 'บำรุงรักษาแล้ว';
      case 'overdue':
        return 'เลยกำหนด';
      default:
        return 'รอดำเนินการ';
    }
  };

  const handleDownloadPlan = async (plan: MaintenancePlan, eq?: Equipment) => {
    const XLSX = await import('xlsx');
    const code = eq?.code || (plan.equipmentId.startsWith('auto-code-') ? plan.equipmentId.replace('auto-code-', '') : 'Unknown');
    const resolvedStatus = resolvePlanStatusByNextDate(plan.nextDate, plan.status);
    const rows = [
      {
        'รหัสเครื่องมือ (ID CODE)': code,
        'ชื่อเครื่องมือ': eq?.name || 'เครื่องมือแพทย์',
        'แผนก': eq?.department || '-',
        'ผู้ผลิต': eq?.manufacturer || '-',
        'รุ่น (Model)': eq?.model || '-',
        'Serial Number': eq?.serialNumber || '-',
        'ระดับความเสี่ยง': eq?.riskLevel || 'Low',
        'รอบการบำรุงรักษา': plan.frequency || '-',
        'วันที่บำรุงรักษาล่าสุด': formatDateSlash(plan.lastDate),
        'วันที่บำรุงรักษาครั้งถัดไป': formatDateSlash(plan.nextDate),
        'สถานะ': getStatusLabel(resolvedStatus),
        'ช่างผู้รับผิดชอบ': plan.technician || '-',
        'หมายเหตุ': plan.notes || '-',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'แผนบำรุงรักษา_PM');
    const safeCode = code.replace(/[^a-zA-Z0-9_-]/g, '_');
    XLSX.writeFile(wb, `PM_${safeCode}.xlsx`);
  };

  const handleExecutePrint = () => {
    if (!printRef.current || !printingPlan) return;
    const eq = equipmentMap.get(printingPlan.equipmentId) || equipment.find(e => e.id === printingPlan.equipmentId);
    const code = eq?.code || printingPlan.equipmentId;
    printElement(printRef.current, {
      documentTitle: `PM_Report_${code}`,
      pageOrientation: 'portrait',
      pageMargin: '10mm 12mm',
    });
  };

  // Annual Plan Filtered List
  const annualPlanMaintenances = useMemo(() => {
    return maintenances.filter(m => {
      const eq = equipmentMap.get(m.equipmentId) || equipment.find(e => e.id === m.equipmentId);
      if (annualPlanDept !== 'all') {
        const eqDept = (eq?.department || '').trim();
        if (eqDept !== annualPlanDept) return false;
      }
      return true;
    });
  }, [maintenances, equipmentMap, equipment, annualPlanDept]);

  const handleExportAllMaintenances = async () => {
    try {
      const XLSX = await import('xlsx');
      const exportRows = filteredMaintenances.map((m, idx) => {
        const eq = equipmentMap.get(m.equipmentId) || equipment.find(e => e.id === m.equipmentId);
        const eqCode = eq?.code || (m.equipmentId.startsWith('auto-code-') ? m.equipmentId.replace('auto-code-', '') : m.equipmentId);
        const effectiveStatus = resolvePlanStatusByNextDate(m.nextDate, m.status);
        return {
          'ลำดับ': idx + 1,
          'รหัสเครื่องมือ': eqCode,
          'ชื่อเครื่องมือ': eq?.name || 'เครื่องมือแพทย์',
          'แผนก': eq?.department || '-',
          'ผู้ผลิต (Manufacturer)': eq?.manufacturer || '-',
          'รุ่น (Model)': eq?.model || '-',
          'หมายเลขเครื่อง (S/N)': eq?.serialNumber || '-',
          'ระดับความเสี่ยง': eq?.riskLevel || '-',
          'รอบการบำรุงรักษา': m.frequency || '-',
          'วันที่บำรุงรักษาล่าสุด': formatDateSlash(m.lastDate),
          'วันที่บำรุงรักษาครั้งถัดไป': formatDateSlash(m.nextDate),
          'สถานะ': getStatusLabel(effectiveStatus),
          'ช่างผู้รับผิดชอบ': m.technician || '-',
          'หมายเหตุ': m.notes || '-',
        };
      });
      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'แผนการบำรุงรักษาทั้งหมด');
      XLSX.writeFile(wb, `Maintenance_Plan_${new Date().toISOString().split('T')[0]}.xlsx`);
      setSuccessMessage('ส่งออกข้อมูลแผนการบำรุงรักษาทั้งหมดสำเร็จ');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Failed to export maintenances:', err);
    }
  };

  const handlePrintAnnualPlan = () => {
    if (!annualPrintRef.current) return;
    printElement(annualPrintRef.current, {
      documentTitle: `แผนการบำรุงรักษาเครื่องมือแพทย์ประจำปี_${annualPlanYear}`,
      pageOrientation: 'landscape',
      pageMargin: '8mm',
    });
  };

  const handleExportAnnualPlan = async () => {
    try {
      const XLSX = await import('xlsx');
      const rows = annualPlanMaintenances.map((m, idx) => {
        const eq = equipmentMap.get(m.equipmentId) || equipment.find(e => e.id === m.equipmentId);
        const eqCode = eq?.code || (m.equipmentId.startsWith('auto-code-') ? m.equipmentId.replace('auto-code-', '') : m.equipmentId);

        const row: Record<string, any> = {
          'ลำดับ': idx + 1,
          'รหัสเครื่องมือ': eqCode,
          'ชื่อเครื่องมือ': eq?.name || 'เครื่องมือแพทย์',
          'แผนก': eq?.department || '-',
          'ความเสี่ยง': eq?.riskLevel || '-',
          'รอบการบำรุงรักษา': m.frequency || '-',
          'บำรุงรักษาล่าสุด': formatDateSlash(m.lastDate),
          'กำหนดครั้งถัดไป': formatDateSlash(m.nextDate),
        };

        const nextDateStr = m.nextDate || '';
        const pmYear = nextDateStr ? parseInt(nextDateStr.substring(0, 4), 10) : null;
        const pmMonth = (pmYear === annualPlanYear && nextDateStr) ? parseInt(nextDateStr.substring(5, 7), 10) : null;
        const effectiveStatus = resolvePlanStatusByNextDate(m.nextDate, m.status);

        THAI_MONTHS_SHORT.forEach((mName, mIdx) => {
          if (pmMonth === mIdx + 1) {
            row[mName] = effectiveStatus === 'completed' ? 'บำรุงรักษาแล้ว' : (effectiveStatus === 'overdue' ? 'เลยกำหนด' : 'แผน');
          } else {
            row[mName] = '';
          }
        });

        row['ช่างผู้รับผิดชอบ'] = m.technician || '-';
        row['หมายเหตุ'] = m.notes || '-';
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `แผนบำรุงรักษา_${annualPlanYear}`);
      XLSX.writeFile(wb, `Maintenance_Annual_Plan_${annualPlanYear}.xlsx`);
      setSuccessMessage(`ดาวน์โหลดไฟล์ตารางแผนการบำรุงรักษาประจำปี ${annualPlanYear} สำเร็จ`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Failed to export annual maintenance plan:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Notification */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-in fade-in duration-200">
          <Check size={16} className="text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">การบำรุงรักษาเครื่องมือ</h2>
          <p className="text-sm text-slate-500 mt-1">
            จัดการและติดตามแผนการบำรุงรักษาเครื่องมือแพทย์ (PM) ({maintenances.length} รายการ)
          </p>
        </div>

        {/* เมนูแผนการบำรุงรักษา (แทนที่ 2 ปุ่มเดิม: นำเข้าข้อมูล และ เพิ่มแผนการบำรุงรักษา) */}
        <div className="relative" ref={planMenuRef}>
          <button
            type="button"
            onClick={() => setIsPlanMenuOpen(!isPlanMenuOpen)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2 shadow-2xs cursor-pointer"
            title="เปิดเมนูแผนการบำรุงรักษาเครื่องมือแพทย์"
          >
            <Calendar size={18} />
            <span>แผนการบำรุงรักษา</span>
            <ChevronDown size={16} className={`transition-transform duration-200 ${isPlanMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isPlanMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-40 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-1 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                เมนูแผนการบำรุงรักษา
              </div>

              {/* 1. เปิดดูตารางแผนการบำรุงรักษาประจำปี 12 เดือน */}
              <button
                type="button"
                onClick={() => {
                  setIsPlanMenuOpen(false);
                  setIsAnnualPlanModalOpen(true);
                }}
                className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center space-x-3 transition-colors cursor-pointer group"
              >
                <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                  <CalendarDays size={16} />
                </div>
                <div>
                  <div className="font-semibold text-slate-800 group-hover:text-blue-700">ตารางแผนการบำรุงรักษาประจำปี</div>
                  <div className="text-[11px] text-slate-400">ดูแผนรายเดือน 12 เดือน ม.ค. - ธ.ค. และสั่งพิมพ์ A4</div>
                </div>
              </button>

              <div className="border-t border-slate-100 my-1"></div>

              {canEdit && (
                <>
                  {/* 2. เพิ่มแผนการบำรุงรักษาใหม่ */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlanMenuOpen(false);
                      setIsAdding(!isAdding);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 transition-colors cursor-pointer"
                  >
                    <Plus size={16} className="text-blue-600 shrink-0" />
                    <span>{isAdding ? 'ปิดฟอร์มเพิ่มแผน' : 'เพิ่มแผนการบำรุงรักษาใหม่'}</span>
                  </button>

                  {/* 3. นำเข้าข้อมูล Excel */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlanMenuOpen(false);
                      setIsImportModalOpen(true);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet size={16} className="text-emerald-600 shrink-0" />
                    <span>นำเข้าข้อมูลแผนจาก Excel (.xlsx)</span>
                  </button>
                </>
              )}

              {/* 4. ส่งออกแผนทั้งหมดเป็น Excel */}
              <button
                type="button"
                onClick={() => {
                  setIsPlanMenuOpen(false);
                  handleExportAllMaintenances();
                }}
                className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 transition-colors cursor-pointer"
              >
                <Download size={16} className="text-slate-500 shrink-0" />
                <span>ส่งออกข้อมูลแผนการบำรุงรักษา (Excel)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search & Filter Bar with 1. Risk Filter and 2. Department Filter */}
      {maintenances.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 text-xs">
          {/* Search box */}
          <div className="relative w-full lg:w-64 shrink-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={14} />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหารหัส, ชื่อเครื่อง, แผนก, ช่าง..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          {/* Filters: Risk Level, Department, Status */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* 1. ตัวกรองประเภทความเสี่ยง */}
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500 shrink-0 font-medium">ความเสี่ยง:</span>
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">ทุกระดับความเสี่ยง</option>
                <option value="High">🔴 ความเสี่ยงสูง (High)</option>
                <option value="Medium">🟡 ความเสี่ยงปานกลาง (Medium)</option>
                <option value="Low">🟢 ความเสี่ยงต่ำ (Low)</option>
              </select>
            </div>

            {/* 2. ตัวกรองแผนก */}
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500 shrink-0 font-medium">แผนก:</span>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-[170px] truncate"
              >
                <option value="all">ทุกแผนก ({allDepartments.length})</option>
                {allDepartments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* 3. ตัวกรองสถานะ */}
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500 shrink-0 font-medium">สถานะ:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="all">ทั้งหมด</option>
                <option value="pending">รอดำเนินการ</option>
                <option value="completed">บำรุงรักษาแล้ว</option>
                <option value="overdue">เลยกำหนด</option>
              </select>
            </div>

            {(searchTerm || riskFilter !== 'all' || deptFilter !== 'all' || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setRiskFilter('all');
                  setDeptFilter('all');
                  setStatusFilter('all');
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium hover:underline px-2 py-1 cursor-pointer"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>
      )}

      {/* Add New Maintenance Form */}
      {isAdding && canEdit && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6 animate-in fade-in duration-200">
          <h3 className="text-lg font-medium text-slate-900 mb-4">เพิ่มแผนการบำรุงรักษา (PM) ใหม่</h3>
          <form onSubmit={handleAddSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                เลือกเครื่องมือแพทย์ (ค้นหารหัสเครื่อง / ชื่อเครื่อง) <span className="text-red-500">*</span>
              </label>
              <EquipmentSearchSelect
                equipment={equipment}
                selectedId={formData.equipmentId}
                onSelect={(eqId) => setFormData(prev => ({ ...prev, equipmentId: eqId }))}
                placeholder="พิมพ์ค้นหารหัสเครื่องมือ เช่น SMH- หรือชื่อเครื่อง..."
                required
                accentColor="blue"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">รอบการบำรุงรักษา</label>
              <select
                value={formData.frequency}
                onChange={e => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="ทุก 1 เดือน">ทุก 1 เดือน</option>
                <option value="ทุก 3 เดือน">ทุก 3 เดือน</option>
                <option value="ทุก 6 เดือน">ทุก 6 เดือน</option>
                <option value="ทุก 1 ปี">ทุก 1 ปี</option>
                <option value="ตามแผนกำหนด">ตามแผนกำหนด</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">บำรุงรักษาล่าสุด</label>
              <input
                type="date"
                required
                value={formData.lastDate}
                onChange={e => setFormData({ ...formData, lastDate: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">กำหนดครั้งถัดไป</label>
              <input
                type="date"
                required
                value={formData.nextDate}
                onChange={e => {
                  const nextVal = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    nextDate: nextVal,
                    status: resolvePlanStatusByNextDate(nextVal, prev.status),
                  }));
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">ช่าง/ผู้รับผิดชอบ</label>
              <input
                type="text"
                value={formData.technician}
                onChange={e => setFormData({ ...formData, technician: e.target.value })}
                placeholder="ชื่อช่าง หรือทีม เช่น ITRIS PM Team..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">หมายเหตุ</label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="รายละเอียดผลการบำรุงรักษา..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2 flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 cursor-pointer"
              >
                บันทึกแผน
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[72vh] overflow-y-auto">
          <table className="w-full text-left border-separate border-spacing-0 text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-xs">
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="px-6 py-4 font-medium bg-slate-50 border-b border-slate-200 whitespace-nowrap">รหัสเครื่องมือ</th>
                <th className="px-6 py-4 font-medium bg-slate-50 border-b border-slate-200 whitespace-nowrap">ชื่อเครื่องมือ</th>
                <th className="px-6 py-4 font-medium bg-slate-50 border-b border-slate-200 whitespace-nowrap">แผนก</th>
                <th className="px-6 py-4 font-medium bg-slate-50 border-b border-slate-200 whitespace-nowrap">รอบการบำรุงรักษา</th>
                <th className="px-6 py-4 font-medium bg-slate-50 border-b border-slate-200 whitespace-nowrap">ล่าสุด / ครั้งถัดไป</th>
                <th className="px-6 py-4 font-medium bg-slate-50 border-b border-slate-200 whitespace-nowrap min-w-[120px]">สถานะ</th>
                <th className="px-6 py-4 font-medium text-right bg-slate-50 border-b border-slate-200 sticky right-0 top-0 z-20 whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedMaintenances.map(m => {
                const eq = equipmentMap.get(m.equipmentId) || equipment.find(e => e.id === m.equipmentId);
                return (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5 whitespace-nowrap">
                        <span>{eq?.code || (m.equipmentId.startsWith('auto-code-') ? m.equipmentId.replace('auto-code-', '') : 'Unknown')}</span>
                        {eq?.riskLevel === 'High' && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-rose-100 text-rose-700 font-bold rounded font-sans">High</span>
                        )}
                        {eq?.riskLevel === 'Medium' && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 font-bold rounded font-sans">Med</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-800 font-medium whitespace-nowrap">
                      <div>{eq?.name || 'เครื่องมือแพทย์'}</div>
                      {m.technician && <div className="text-xs text-slate-400">ช่าง: {m.technician}</div>}
                    </td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{eq?.department || '-'}</td>
                    <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{m.frequency}</td>
                    <td className="px-6 py-4 text-xs font-mono whitespace-nowrap">
                      <div className="text-slate-600">ล่าสุด: {formatDateSlash(m.lastDate)}</div>
                      <div className="text-blue-600 font-semibold">ถัดไป: {formatDateSlash(m.nextDate)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(resolvePlanStatusByNextDate(m.nextDate, m.status))}</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleDownloadPlan(m, eq)}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          title="ดาวน์โหลดข้อมูลการบำรุงรักษา (Excel)"
                        >
                          <Download size={17} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintingPlan(m)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="พิมพ์ใบรายงานการบำรุงรักษา"
                        >
                          <Printer size={17} />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleStartEdit(m)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="แก้ไขแผนการบำรุงรักษา"
                            >
                              <Pencil size={17} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPlanToDelete(m)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="ลบแผนการบำรุงรักษา"
                            >
                              <Trash2 size={17} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Empty State: ตรงกรอบสีแดงตามที่ผู้ใช้ระบุ */}
              {maintenances.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                        <ClipboardCheck size={24} />
                      </div>
                      <p className="text-sm font-medium text-slate-700">ยังไม่มีข้อมูลการบำรุงรักษาในขณะนี้</p>
                      {canEdit && (
                        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                          <button
                            type="button"
                            onClick={() => setIsImportModalOpen(true)}
                            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                          >
                            <FileSpreadsheet size={15} />
                            <span>นำเข้าข้อมูลการบำรุงรักษาเครื่องมือ</span>
                          </button>

                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {maintenances.length > 0 && filteredMaintenances.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    ไม่พบข้อมูลที่ตรงกับคำค้นหา
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {filteredMaintenances.length > 0 && (
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
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value={25}>25 รายการ / หน้า</option>
              <option value={50}>50 รายการ / หน้า</option>
              <option value={100}>100 รายการ / หน้า</option>
              <option value="all">แสดงทั้งหมด ({filteredMaintenances.length})</option>
            </select>
            <span className="text-slate-400">|</span>
            <span>
              ลำดับที่ <strong className="text-slate-800">{filteredMaintenances.length === 0 ? 0 : startIndex + 1}</strong> ถึง <strong className="text-slate-800">{pageSize === 'all' ? filteredMaintenances.length : Math.min(startIndex + Number(pageSize), filteredMaintenances.length)}</strong> จากทั้งหมด <strong className="text-blue-700">{filteredMaintenances.length.toLocaleString()}</strong> รายการ
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

      {/* Edit Modal */}
      {editingPlan && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <h3 className="font-bold text-slate-900 text-sm">แก้ไขแผนการบำรุงรักษา</h3>
              <button onClick={() => setEditingPlan(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">รอบการบำรุงรักษา</label>
                <select
                  value={editFormData.frequency}
                  onChange={e => setEditFormData({ ...editFormData, frequency: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="ทุก 1 เดือน">ทุก 1 เดือน</option>
                  <option value="ทุก 3 เดือน">ทุก 3 เดือน</option>
                  <option value="ทุก 6 เดือน">ทุก 6 เดือน</option>
                  <option value="ทุก 1 ปี">ทุก 1 ปี</option>
                  <option value="ตามแผนกำหนด">ตามแผนกำหนด</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">วันที่ล่าสุด</label>
                  <input
                    type="date"
                    required
                    value={editFormData.lastDate}
                    onChange={e => setEditFormData({ ...editFormData, lastDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">วันที่ครั้งถัดไป</label>
                  <input
                    type="date"
                    required
                    value={editFormData.nextDate}
                    onChange={e => {
                      const nextVal = e.target.value;
                      setEditFormData(prev => ({
                        ...prev,
                        nextDate: nextVal,
                        status: resolvePlanStatusByNextDate(nextVal, prev.status),
                      }));
                    }}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">สถานะ</label>
                <select
                  value={editFormData.status}
                  onChange={e => setEditFormData({ ...editFormData, status: e.target.value as PlanStatus })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="pending">รอดำเนินการ</option>
                  <option value="completed">บำรุงรักษาแล้ว</option>
                  <option value="overdue">เลยกำหนด</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ช่างผู้รับผิดชอบ</label>
                <input
                  type="text"
                  value={editFormData.technician}
                  onChange={e => setEditFormData({ ...editFormData, technician: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center space-x-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 cursor-pointer"
                >
                  <Check size={15} />
                  <span>บันทึกการแก้ไข</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {planToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-rose-50 border-b border-rose-100">
              <h3 className="font-bold text-slate-900 text-sm">ยืนยันการลบแผนบำรุงรักษา</h3>
              <button onClick={() => setPlanToDelete(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 text-xs text-slate-600">
              คุณต้องการลบแผนบำรุงรักษานี้ออกจากระบบอย่างถาวรหรือไม่?
            </div>
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setPlanToDelete(null)}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteMaintenance(planToDelete.id);
                  setPlanToDelete(null);
                  setSuccessMessage('ลบแผนการบำรุงรักษาเรียบร้อยแล้ว');
                  setTimeout(() => setSuccessMessage(null), 3000);
                }}
                className="px-3.5 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 cursor-pointer"
              >
                ลบรายการ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Maintenance Report Modal */}
      {printingPlan && (() => {
        const eq = equipmentMap.get(printingPlan.equipmentId) || equipment.find(e => e.id === printingPlan.equipmentId);
        const code = eq?.code || (printingPlan.equipmentId.startsWith('auto-code-') ? printingPlan.equipmentId.replace('auto-code-', '') : 'Unknown');
        const resolvedStatus = resolvePlanStatusByNextDate(printingPlan.nextDate, printingPlan.status);
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white shrink-0">
                <div className="flex items-center space-x-2">
                  <Printer size={18} className="text-blue-400" />
                  <h3 className="font-bold text-sm">ใบรายงานการบำรุงรักษาเครื่องมือแพทย์ (PM) — {code}</h3>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadPlan(printingPlan, eq)}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Download size={14} />
                    <span>ดาวน์โหลด Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExecutePrint}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Printer size={14} />
                    <span>พิมพ์เอกสาร</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintingPlan(null)}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto bg-slate-100 flex-1">
                <div
                  ref={printRef}
                  className="bg-white p-8 rounded-xl border border-slate-200 shadow-xs text-slate-900 space-y-6 print-clean-page"
                >
                  <div className="border-b-2 border-slate-800 pb-4 flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">ใบรายงานการบำรุงรักษาเครื่องมือแพทย์ (Preventive Maintenance)</h2>
                      <p className="text-xs text-slate-600 mt-1">
                        สถานประกอบการ: {eq?.facility || currentFacility || 'โรงพยาบาลเซนต์เมรี่'}
                      </p>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                      <div className="font-mono font-bold text-sm text-slate-900">{code}</div>
                      <div>วันที่พิมพ์: {formatDateSlash(new Date().toISOString().split('T')[0])}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs border border-slate-200 rounded-lg p-4 bg-slate-50/50">
                    <div>
                      <span className="text-slate-500 block">รหัสเครื่องมือ (ID CODE)</span>
                      <span className="font-mono font-bold text-slate-900 text-sm">{code}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">ชื่อเครื่องมือแพทย์</span>
                      <span className="font-bold text-slate-900 text-sm">{eq?.name || 'เครื่องมือแพทย์'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">แผนก / หน่วยงาน</span>
                      <span className="font-semibold text-slate-800">{eq?.department || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">ระดับความเสี่ยง (Risk Level)</span>
                      <span className="font-semibold text-slate-800">{eq?.riskLevel || 'Low'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">ผู้ผลิต / รุ่น (Model)</span>
                      <span className="font-semibold text-slate-800">{[eq?.manufacturer, eq?.model].filter(Boolean).join(' / ') || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">หมายเลขเครื่อง (Serial Number)</span>
                      <span className="font-mono font-semibold text-slate-800">{eq?.serialNumber || '-'}</span>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2 text-xs font-bold text-slate-800 border-b border-slate-200">
                      ข้อมูลแผนและผลการบำรุงรักษา (PM Schedule & Status)
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500 block">รอบการบำรุงรักษา</span>
                        <span className="font-semibold text-slate-900">{printingPlan.frequency || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">สถานะการบำรุงรักษา</span>
                        <span className="font-bold text-slate-900">{getStatusLabel(resolvedStatus)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">วันที่บำรุงรักษาล่าสุด</span>
                        <span className="font-mono font-semibold text-slate-900">{formatDateSlash(printingPlan.lastDate)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">วันที่บำรุงรักษาครั้งถัดไป</span>
                        <span className="font-mono font-bold text-blue-700">{formatDateSlash(printingPlan.nextDate)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">ช่าง / ผู้รับผิดชอบ</span>
                        <span className="font-semibold text-slate-900">{printingPlan.technician || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">หมายเหตุ</span>
                        <span className="font-semibold text-slate-900">{printingPlan.notes || '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8 pt-8 text-xs text-center text-slate-700">
                    <div className="space-y-6">
                      <div className="border-b border-dotted border-slate-400 w-48 mx-auto h-6"></div>
                      <div>
                        <p className="font-semibold">ผู้ดำเนินการบำรุงรักษา</p>
                        <p className="text-slate-500 mt-0.5">({printingPlan.technician || '................................................'})</p>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="border-b border-dotted border-slate-400 w-48 mx-auto h-6"></div>
                      <div>
                        <p className="font-semibold">ผู้ตรวจสอบ / หัวหน้าหน่วยงาน</p>
                        <p className="text-slate-500 mt-0.5">(................................................)</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Import Maintenance Modal */}
      {isImportModalOpen && (
        <ImportMaintenanceModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={(items) => {
            const count = bulkAddMaintenance(items);
            setSuccessMessage(`นำเข้าข้อมูลแผนการบำรุงรักษาสำเร็จ ${count.toLocaleString()} รายการ`);
            setTimeout(() => setSuccessMessage(null), 4000);
          }}
        />
      )}

      {/* Annual Maintenance Master Plan Modal (ตารางแผนการบำรุงรักษาประจำปี 12 เดือน) */}
      {isAnnualPlanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 bg-slate-900 text-white gap-3 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                  <CalendarDays size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-base">แผนการบำรุงรักษาเครื่องมือแพทย์ประจำปี (PM Master Plan)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ตารางแผนการดำเนินงานรายเดือน (ม.ค. - ธ.ค. {annualPlanYear}) • ทั้งหมด {annualPlanMaintenances.length} รายการ
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleExportAnnualPlan}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                  title="ดาวน์โหลดตารางแผน 12 เดือนเป็นไฟล์ Excel"
                >
                  <Download size={14} />
                  <span>ดาวน์โหลด Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintAnnualPlan}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                  title="สั่งพิมพ์ตารางแผนการบำรุงรักษาประจำปี A4 แนวนอน"
                >
                  <Printer size={14} />
                  <span>พิมพ์แผน (Print A4)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAnnualPlanModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-4">
                {/* เลือกปี */}
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-700">ประจำปี:</span>
                  <select
                    value={annualPlanYear}
                    onChange={(e) => setAnnualPlanYear(parseInt(e.target.value, 10))}
                    className="border border-slate-300 bg-white rounded-lg px-2.5 py-1 text-xs font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map(y => (
                      <option key={y} value={y}>ปี ค.ศ. {y} (พ.ศ. {y + 543})</option>
                    ))}
                  </select>
                </div>

                {/* เลือกแผนก */}
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-700">แผนก:</span>
                  <select
                    value={annualPlanDept}
                    onChange={(e) => setAnnualPlanDept(e.target.value)}
                    className="border border-slate-300 bg-white rounded-lg px-2.5 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-[200px] truncate"
                  >
                    <option value="all">ทุกแผนก ({allDepartments.length})</option>
                    {allDepartments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Legend */}
              <div className="flex items-center space-x-3 text-[11px]">
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <span className="text-slate-600">บำรุงรักษาแล้ว</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  <span className="text-slate-600">เลยกำหนด</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  <span className="text-slate-600">วางแผนไว้</span>
                </span>
              </div>
            </div>

            {/* Modal Body / Scrollable Table */}
            <div className="p-6 overflow-y-auto bg-slate-100 flex-1">
              <div
                ref={annualPrintRef}
                className="bg-white p-6 rounded-xl shadow-xs border border-slate-200 text-slate-900"
              >
                {/* Print Header */}
                <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      แผนการบำรุงรักษาเครื่องมือแพทย์ประจำปี {annualPlanYear} (PM Master Plan)
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {currentFacility && currentFacility !== 'ส่วนกลาง (Super Admin)' && currentFacility !== 'ส่วนกลาง' ? currentFacility : 'โรงพยาบาล / ศูนย์การแพทย์'}
                      {annualPlanDept !== 'all' ? ` • แผนก: ${annualPlanDept}` : ' • ทุกแผนก'}
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-slate-500 font-mono">
                    <div>วันที่ออกเอกสาร: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    <div className="text-slate-400">เอกสารควบคุมคุณภาพเครื่องมือแพทย์</div>
                  </div>
                </div>

                {/* 12-Month Master Schedule Matrix */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-1.5 border-r border-slate-300 text-center w-10 whitespace-nowrap">#</th>
                        <th className="p-1.5 border-r border-slate-300 whitespace-nowrap">รหัสเครื่อง</th>
                        <th className="p-1.5 border-r border-slate-300 min-w-[140px] whitespace-nowrap">ชื่อเครื่องมือ</th>
                        <th className="p-1.5 border-r border-slate-300 whitespace-nowrap">แผนก</th>
                        <th className="p-1.5 border-r border-slate-300 text-center whitespace-nowrap">ความเสี่ยง</th>
                        <th className="p-1.5 border-r border-slate-300 text-center whitespace-nowrap">รอบ PM</th>
                        {THAI_MONTHS_SHORT.map((m, idx) => (
                          <th key={idx} className="p-1.5 border-r border-slate-300 text-center w-10 text-[10px] whitespace-nowrap">
                            {m}
                          </th>
                        ))}
                        <th className="p-1.5 whitespace-nowrap">ช่างผู้รับผิดชอบ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {annualPlanMaintenances.length === 0 ? (
                        <tr>
                          <td colSpan={19} className="p-8 text-center text-slate-400">
                            ไม่พบรายการแผนการบำรุงรักษาในแผนกที่เลือก
                          </td>
                        </tr>
                      ) : (
                        annualPlanMaintenances.map((m, idx) => {
                          const eq = equipmentMap.get(m.equipmentId) || equipment.find(e => e.id === m.equipmentId);
                          const eqCode = eq?.code || (m.equipmentId.startsWith('auto-code-') ? m.equipmentId.replace('auto-code-', '') : m.equipmentId);
                          const effectiveStatus = resolvePlanStatusByNextDate(m.nextDate, m.status);

                          const nextDateStr = m.nextDate || '';
                          const pmYear = nextDateStr ? parseInt(nextDateStr.substring(0, 4), 10) : null;
                          const pmMonth = (pmYear === annualPlanYear && nextDateStr) ? parseInt(nextDateStr.substring(5, 7), 10) : null;

                          return (
                            <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-2 py-1.5 text-center font-mono border-r border-slate-200 text-slate-500 whitespace-nowrap">{idx + 1}</td>
                              <td className="px-2.5 py-1.5 font-mono font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">{eqCode}</td>
                              <td className="px-2.5 py-1.5 font-medium text-slate-800 border-r border-slate-200 whitespace-nowrap">{eq?.name || 'เครื่องมือแพทย์'}</td>
                              <td className="px-2.5 py-1.5 text-slate-600 border-r border-slate-200 whitespace-nowrap">{eq?.department || '-'}</td>
                              <td className="px-2 py-1.5 text-center border-r border-slate-200 whitespace-nowrap">
                                <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold whitespace-nowrap ${
                                  eq?.riskLevel === 'High' ? 'bg-rose-100 text-rose-700' :
                                  eq?.riskLevel === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                  'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {eq?.riskLevel || 'Low'}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-center text-slate-600 border-r border-slate-200 text-[10px] whitespace-nowrap">{m.frequency || '1 ปี'}</td>
                              {THAI_MONTHS_SHORT.map((_, mIdx) => {
                                const isMonthActive = pmMonth === mIdx + 1;
                                return (
                                  <td key={mIdx} className="p-1 text-center border-r border-slate-200 whitespace-nowrap">
                                    {isMonthActive ? (
                                      <span
                                        className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                          effectiveStatus === 'completed'
                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                            : effectiveStatus === 'overdue'
                                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                            : 'bg-blue-100 text-blue-800 border border-blue-300'
                                        }`}
                                        title={`${effectiveStatus === 'completed' ? 'บำรุงรักษาแล้ว' : effectiveStatus === 'overdue' ? 'เลยกำหนด' : 'ตามแผน'}: ${formatDateSlash(m.nextDate)}`}
                                      >
                                        {effectiveStatus === 'completed' ? '✓' : effectiveStatus === 'overdue' ? '!' : 'P'}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">-</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-2.5 py-1.5 text-slate-600 whitespace-nowrap">{m.technician || '-'}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Print Signatures */}
                <div className="mt-8 pt-4 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-xs text-slate-600">
                  <div>
                    <div className="mb-6 border-b border-dashed border-slate-400 w-48 mx-auto h-6"></div>
                    <div className="font-semibold text-slate-800">วิศวกรชีวการแพทย์ / ผู้จัดทำแผน</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">วันที่ ........../........../..........</div>
                  </div>
                  <div>
                    <div className="mb-6 border-b border-dashed border-slate-400 w-48 mx-auto h-6"></div>
                    <div className="font-semibold text-slate-800">หัวหน้าฝ่ายเครื่องมือแพทย์ / ผู้อนุมัติ</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">วันที่ ........../........../..........</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
