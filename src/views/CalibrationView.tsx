import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { Gauge, Pencil, Trash2, X, Check, Download, Printer, Plus, FileSpreadsheet, Search, Filter, Calendar, ChevronDown, CalendarDays, CheckCircle2 } from 'lucide-react';
import { CalibrationPlan, PlanStatus, Equipment } from '../types';
import { formatDateSlash, parseDateString, resolvePlanStatusByNextDate } from '../utils/dateUtils';
import { printElement } from '../utils/printUtils';
import EquipmentSearchSelect from '../components/EquipmentSearchSelect';
import ImportCalibrationModal from '../components/ImportCalibrationModal';

const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export default function CalibrationView() {
  const { equipment, calibrations, addCalibration, bulkAddCalibration, updateCalibration, deleteCalibration, updateEquipment, userRole, currentFacility } = useAppStore();
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
  const [editingPlan, setEditingPlan] = useState<CalibrationPlan | null>(null);
  const [planToDelete, setPlanToDelete] = useState<CalibrationPlan | null>(null);
  const [printingPlan, setPrintingPlan] = useState<CalibrationPlan | null>(null);
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
    frequency: 'ทุก 1 ปี',
    lastDate: new Date().toISOString().split('T')[0],
    nextDate: '',
    agency: 'ITRIS PM Team',
    certNumber: '',
    status: 'pending' as PlanStatus
  });

  const [editFormData, setEditFormData] = useState({
    equipmentId: '',
    frequency: 'ทุก 1 ปี',
    lastDate: '',
    nextDate: '',
    agency: '',
    certNumber: '',
    status: 'pending' as PlanStatus
  });

  const [editEqData, setEditEqData] = useState({
    name: '',
    itrisId: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    riskLevel: 'Low' as Equipment['riskLevel']
  });

  const handleImportHighRisk = () => {
    const existingEqIds = new Set(calibrations.map(c => c.equipmentId));
    const highRiskEq = equipment.filter(e => e.riskLevel === 'High' && !existingEqIds.has(e.id) && e.status === 'active');
    if (highRiskEq.length === 0) {
      alert('ไม่มีเครื่องมือ High Risk ใหม่ที่ยังไม่ถูกเพิ่มในแผนการสอบเทียบ');
      return;
    }
    const confirmImport = window.confirm(`พบเครื่องมือ High Risk (สถานะพร้อมใช้งาน) จำนวน ${highRiskEq.length} รายการที่ยังไม่มีแผนการสอบเทียบ\n\nต้องการนำเข้าสู่แผนการสอบเทียบหรือไม่?`);
    if (confirmImport) {
      const plansToImport = highRiskEq.map(eq => ({
        equipmentId: eq.id,
        frequency: 'ทุก 1 ปี',
        lastDate: new Date().toISOString().split('T')[0],
        nextDate: '',
        agency: 'ITRIS PM Team',
        certNumber: '',
        status: 'pending' as PlanStatus
      }));
      bulkAddCalibration(plansToImport);
      setSuccessMessage(`นำเข้าเครื่องมือ High Risk สำเร็จ ${highRiskEq.length} รายการ`);
      setTimeout(() => setSuccessMessage(null), 3500);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipmentId) return;
    const resolvedStatus = resolvePlanStatusByNextDate(formData.nextDate, formData.status);
    addCalibration({ ...formData, status: resolvedStatus });
    setFormData({
      equipmentId: '',
      frequency: 'ทุก 1 ปี',
      lastDate: new Date().toISOString().split('T')[0],
      nextDate: '',
      agency: 'ITRIS PM Team',
      certNumber: '',
      status: 'pending'
    });
    setIsAdding(false);
    setSuccessMessage('เพิ่มแผนการสอบเทียบเรียบร้อยแล้ว');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleStartEdit = (plan: CalibrationPlan) => {
    setEditingPlan(plan);
    const eq = equipmentMap.get(plan.equipmentId) || equipment.find(e => e.id === plan.equipmentId);
    setEditEqData({
      name: eq?.name || '',
      itrisId: eq?.itrisId || '',
      manufacturer: eq?.manufacturer || '',
      model: eq?.model || '',
      serialNumber: eq?.serialNumber || '',
      riskLevel: eq?.riskLevel || 'Low'
    });
    setEditFormData({
      equipmentId: plan.equipmentId,
      frequency: plan.frequency,
      lastDate: parseDateString(plan.lastDate) || plan.lastDate,
      nextDate: parseDateString(plan.nextDate) || plan.nextDate,
      agency: plan.agency || '',
      certNumber: plan.certNumber || '',
      status: resolvePlanStatusByNextDate(plan.nextDate, plan.status)
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    const resolvedStatus = resolvePlanStatusByNextDate(editFormData.nextDate, editFormData.status);
    updateCalibration(editingPlan.id, { ...editFormData, status: resolvedStatus });
    if (editingPlan.equipmentId) {
      updateEquipment(editingPlan.equipmentId, editEqData);
    }
    setEditingPlan(null);
    setSuccessMessage('บันทึกการแก้ไขเรียบร้อยแล้ว');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Filtered calibrations
  const filteredCalibrations = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return calibrations.filter(c => {
      const eq = equipmentMap.get(c.equipmentId);
      const effectiveStatus = resolvePlanStatusByNextDate(c.nextDate, c.status);

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
      const agency = (c.agency || '').toLowerCase();
      const cert = (c.certNumber || '').toLowerCase();
      const freq = (c.frequency || '').toLowerCase();

      return code.includes(q) || name.includes(q) || dept.includes(q) || agency.includes(q) || cert.includes(q) || freq.includes(q);
    });
  }, [calibrations, equipmentMap, searchTerm, statusFilter, riskFilter, deptFilter]);

  // Pagination for high performance
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(50);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, riskFilter, deptFilter]);

  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredCalibrations.length / Number(pageSize)));

  const paginatedCalibrations = useMemo(() => {
    if (pageSize === 'all') return filteredCalibrations;
    const size = Number(pageSize);
    const start = (currentPage - 1) * size;
    return filteredCalibrations.slice(start, start + size);
  }, [filteredCalibrations, currentPage, pageSize]);

  const startIndex = pageSize === 'all' ? 0 : (currentPage - 1) * Number(pageSize);

  const getStatusBadge = (status: PlanStatus) => {
    switch (status) {
      case 'completed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 whitespace-nowrap inline-block">สอบเทียบแล้ว</span>;
      case 'overdue':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 whitespace-nowrap inline-block">เลยกำหนด</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 whitespace-nowrap inline-block">รอดำเนินการ</span>;
    }
  };

  const getStatusLabel = (status: PlanStatus) => {
    switch (status) {
      case 'completed':
        return 'สอบเทียบแล้ว';
      case 'overdue':
        return 'เลยกำหนด';
      default:
        return 'รอดำเนินการ';
    }
  };

  const handleDownloadPlan = async (plan: CalibrationPlan, eq?: Equipment) => {
    try {
      const XLSX = await import('xlsx');
      const eqCode = eq?.code || (plan.equipmentId.startsWith('auto-cal-') ? plan.equipmentId.replace('auto-cal-', '') : plan.equipmentId);
      const effectiveStatus = resolvePlanStatusByNextDate(plan.nextDate, plan.status);
      const rowData = [{
        'รหัสเครื่องมือ': eqCode,
        'ชื่อเครื่องมือ': eq?.name || 'เครื่องมือแพทย์',
        'แผนก': eq?.department || '-',
        'ผู้ผลิต (Brand)': eq?.manufacturer || '-',
        'รุ่น (Model)': eq?.model || '-',
        'หมายเลขเครื่อง (Serial Number)': eq?.serialNumber || '-',
        'ระดับความเสี่ยง': eq?.riskLevel || '-',
        'รอบการสอบเทียบ': plan.frequency || '-',
        'วันที่สอบเทียบล่าสุด': formatDateSlash(plan.lastDate),
        'วันที่สอบเทียบครั้งถัดไป': formatDateSlash(plan.nextDate),
        'สถานะ': getStatusLabel(effectiveStatus),
        'หน่วยงานสอบเทียบ': plan.agency || '-',
        'เลขที่ใบรับรอง (Cert No.)': plan.certNumber || '-',
      }];
      const ws = XLSX.utils.json_to_sheet(rowData);
      ws['!cols'] = [
        { wch: 18 }, { wch: 28 }, { wch: 24 }, { wch: 18 }, { wch: 18 },
        { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 20 },
        { wch: 16 }, { wch: 24 }, { wch: 22 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'แผนการสอบเทียบ');
      const safeCode = String(eqCode).replace(/[^a-zA-Z0-9_-]/g, '_');
      XLSX.writeFile(wb, `CAL_${safeCode}.xlsx`);
    } catch (error) {
      console.error('Failed to download calibration plan:', error);
    }
  };

  const handleExecutePrint = () => {
    if (!printingPlan || !printRef.current) return;
    const eq = equipmentMap.get(printingPlan.equipmentId) || equipment.find(e => e.id === printingPlan.equipmentId);
    const eqCode = eq?.code || (printingPlan.equipmentId.startsWith('auto-cal-') ? printingPlan.equipmentId.replace('auto-cal-', '') : printingPlan.equipmentId);
    printElement(printRef.current, {
      documentTitle: `ใบรายงานแผนการสอบเทียบ_${eqCode}`,
      pageOrientation: 'portrait',
      pageMargin: '12mm',
    });
  };

  // Annual Plan Filtered List
  const annualPlanCalibrations = useMemo(() => {
    return calibrations.filter(c => {
      const eq = equipmentMap.get(c.equipmentId) || equipment.find(e => e.id === c.equipmentId);
      if (annualPlanDept !== 'all') {
        const eqDept = (eq?.department || '').trim();
        if (eqDept !== annualPlanDept) return false;
      }
      return true;
    });
  }, [calibrations, equipmentMap, equipment, annualPlanDept]);

  const handleExportAllCalibrations = async () => {
    try {
      const XLSX = await import('xlsx');
      const exportRows = filteredCalibrations.map((c, idx) => {
        const eq = equipmentMap.get(c.equipmentId) || equipment.find(e => e.id === c.equipmentId);
        const eqCode = eq?.code || (c.equipmentId.startsWith('auto-cal-') ? c.equipmentId.replace('auto-cal-', '') : c.equipmentId);
        const effectiveStatus = resolvePlanStatusByNextDate(c.nextDate, c.status);
        return {
          'ลำดับ': idx + 1,
          'รหัสเครื่องมือ': eqCode,
          'ชื่อเครื่องมือ': eq?.name || 'เครื่องมือแพทย์',
          'แผนก': eq?.department || '-',
          'ผู้ผลิต (Brand)': eq?.manufacturer || '-',
          'รุ่น (Model)': eq?.model || '-',
          'หมายเลขเครื่อง (S/N)': eq?.serialNumber || '-',
          'ระดับความเสี่ยง': eq?.riskLevel || '-',
          'รอบการสอบเทียบ': c.frequency || '-',
          'วันที่สอบเทียบล่าสุด': formatDateSlash(c.lastDate),
          'วันที่สอบเทียบครั้งถัดไป': formatDateSlash(c.nextDate),
          'สถานะ': getStatusLabel(effectiveStatus),
          'หน่วยงานสอบเทียบ': c.agency || '-',
          'เลขที่ใบรับรอง': c.certNumber || '-',
        };
      });
      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'แผนการสอบเทียบทั้งหมด');
      XLSX.writeFile(wb, `Calibration_Plan_${new Date().toISOString().split('T')[0]}.xlsx`);
      setSuccessMessage('ส่งออกข้อมูลแผนการสอบเทียบทั้งหมดสำเร็จ');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Failed to export calibrations:', err);
    }
  };

  const handlePrintAnnualPlan = () => {
    if (!annualPrintRef.current) return;
    printElement(annualPrintRef.current, {
      documentTitle: `แผนการสอบเทียบเครื่องมือแพทย์ประจำปี_${annualPlanYear}`,
      pageOrientation: 'landscape',
      pageMargin: '8mm',
    });
  };

  const handleExportAnnualPlan = async () => {
    try {
      const XLSX = await import('xlsx');
      const rows = annualPlanCalibrations.map((c, idx) => {
        const eq = equipmentMap.get(c.equipmentId) || equipment.find(e => e.id === c.equipmentId);
        const eqCode = eq?.code || (c.equipmentId.startsWith('auto-cal-') ? c.equipmentId.replace('auto-cal-', '') : c.equipmentId);
        
        const row: Record<string, any> = {
          'ลำดับ': idx + 1,
          'รหัสเครื่องมือ': eqCode,
          'Itris ID': eq?.itrisId || '-',
          'ชื่อเครื่องมือ': eq?.name || 'เครื่องมือแพทย์',
          'แผนก': eq?.department || '-',
          'Manufacturer': eq?.manufacturer || '-',
          'Model': eq?.model || '-',
          'Serial number': eq?.serialNumber || '-',
          'Risk Levels': (eq?.riskLevel || 'Low').toUpperCase(),
          'รอบการสอบเทียบ': c.frequency || '-',
          'สอบเทียบล่าสุด': formatDateSlash(c.lastDate),
          'กำหนดครั้งถัดไป': formatDateSlash(c.nextDate),
        };

        const parsedLast = parseDateString(c.lastDate);
        const lastYear = parsedLast ? parseInt(parsedLast.substring(0, 4), 10) : null;
        const lastMonth = (lastYear === annualPlanYear && parsedLast) ? parseInt(parsedLast.substring(5, 7), 10) : null;

        const parsedNext = parseDateString(c.nextDate);
        const nextYear = parsedNext ? parseInt(parsedNext.substring(0, 4), 10) : null;
        const nextMonth = (nextYear === annualPlanYear && parsedNext) ? parseInt(parsedNext.substring(5, 7), 10) : null;

        THAI_MONTHS_SHORT.forEach((mName, mIdx) => {
          const currentMonthNum = mIdx + 1;
          const isCalibratedThisMonth = lastMonth === currentMonthNum;
          const isPendingThisMonth = !isCalibratedThisMonth && nextMonth === currentMonthNum;

          if (isCalibratedThisMonth) {
            row[mName] = 'สอบเทียบแล้ว';
          } else if (isPendingThisMonth) {
            row[mName] = 'ยังไม่ได้ทำการสอบเทียบ';
          } else {
            row[mName] = '';
          }
        });

        row['หน่วยงานสอบเทียบ'] = c.agency || '-';
        row['เลขที่ใบรับรอง'] = c.certNumber || '-';
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `แผนสอบเทียบ_${annualPlanYear}`);
      XLSX.writeFile(wb, `Calibration_Annual_Plan_${annualPlanYear}.xlsx`);
      setSuccessMessage(`ดาวน์โหลดไฟล์ตารางแผนการสอบเทียบประจำปี ${annualPlanYear} สำเร็จ`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Failed to export annual plan:', err);
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
          <h2 className="text-2xl font-semibold text-slate-900">การสอบเทียบเครื่องมือ</h2>
          <p className="text-sm text-slate-500 mt-1">
            จัดการและติดตามแผนการสอบเทียบเครื่องมือแพทย์ (Calibration) ({calibrations.length} รายการ)
          </p>
        </div>

        {/* เมนูแผนการสอบเทียบ (แทนที่ 2 ปุ่มเดิม: นำเข้าข้อมูล Excel และ เพิ่มแผนการสอบเทียบ) */}
        <div className="relative" ref={planMenuRef}>
          <button
            type="button"
            onClick={() => setIsPlanMenuOpen(!isPlanMenuOpen)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2 shadow-2xs cursor-pointer"
            title="เปิดเมนูแผนการสอบเทียบเครื่องมือแพทย์"
          >
            <Calendar size={18} />
            <span>แผนการสอบเทียบ</span>
            <ChevronDown size={16} className={`transition-transform duration-200 ${isPlanMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isPlanMenuOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-40 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-1 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                เมนูแผนการสอบเทียบ
              </div>

              {/* 1. เปิดดูตารางแผนการสอบเทียบประจำปี 12 เดือน */}
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
                  <div className="font-semibold text-slate-800 group-hover:text-blue-700">ตารางแผนการสอบเทียบประจำปี</div>
                  <div className="text-[11px] text-slate-400">ดูแผนรายเดือน 12 เดือน ม.ค. - ธ.ค. และสั่งพิมพ์ A4</div>
                </div>
              </button>

              <div className="border-t border-slate-100 my-1"></div>

              {canEdit && (
                <>
                  {/* 2. เพิ่มแผนการสอบเทียบใหม่ */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlanMenuOpen(false);
                      setIsAdding(!isAdding);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 transition-colors cursor-pointer"
                  >
                    <Plus size={16} className="text-blue-600 shrink-0" />
                    <span>{isAdding ? 'ปิดฟอร์มเพิ่มแผน' : 'เพิ่มแผนการสอบเทียบใหม่'}</span>
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
                  handleExportAllCalibrations();
                }}
                className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 transition-colors cursor-pointer"
              >
                <Download size={16} className="text-slate-500 shrink-0" />
                <span>ส่งออกข้อมูลแผนการสอบเทียบ (Excel)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search & Filter Bar with Risk & Department Filters */}
      {calibrations.length > 0 && (
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
              placeholder="ค้นหารหัส, ชื่อเครื่อง, แผนก, หน่วยงานสอบเทียบ..."
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
                <option value="completed">สอบเทียบแล้ว</option>
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

      {/* Add New Calibration Form */}
      {isAdding && canEdit && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6 animate-in fade-in duration-200">
          <h3 className="text-lg font-medium text-slate-900 mb-4">เพิ่มแผนการสอบเทียบ (Calibration) ใหม่</h3>
          <form onSubmit={handleAddSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                เลือกเครื่องมือแพทย์ (ค้นหารหัสเครื่อง / ชื่อเครื่อง) <span className="text-red-500">*</span>
              </label>
              <EquipmentSearchSelect
                equipment={equipment}
                selectedId={formData.equipmentId}
                onSelect={(eqId) => setFormData(prev => ({ ...prev, equipmentId: eqId }))}
                placeholder="พิมพ์ค้นหารหัสเครื่อง, ชื่อเครื่องมือ หรือแผนก..."
                required
                accentColor="blue"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">รอบการสอบเทียบ</label>
              <select
                value={formData.frequency}
                onChange={e => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="ทุก 6 เดือน">ทุก 6 เดือน</option>
                <option value="ทุก 1 ปี">ทุก 1 ปี</option>
                <option value="ทุก 2 ปี">ทุก 2 ปี</option>
                <option value="ตามแผนกำหนด">ตามแผนกำหนด</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">วันที่สอบเทียบล่าสุด</label>
              <input
                type="date"
                required
                value={formData.lastDate}
                onChange={e => setFormData({ ...formData, lastDate: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">กำหนดสอบเทียบครั้งถัดไป (เดือน/ปี)</label>
              <input
                type="month"
                required
                value={(parseDateString(formData.nextDate) || formData.nextDate || '').substring(0, 7)}
                onChange={e => {
                  const nextVal = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    nextDate: nextVal,
                    status: resolvePlanStatusByNextDate(nextVal, prev.status),
                  }));
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">หน่วยงานสอบเทียบ</label>
              <input
                type="text"
                value={formData.agency}
                onChange={e => setFormData({ ...formData, agency: e.target.value })}
                placeholder="เช่น สถาบันมาตรวิทยาแห่งชาติ (NIMT), บริษัทภายนอก..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">เลขที่ใบรับรอง (Cert No.)</label>
              <input
                type="text"
                value={formData.certNumber}
                onChange={e => setFormData({ ...formData, certNumber: e.target.value })}
                placeholder="เช่น CAL-2026-001..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 font-mono"
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
                <th className="px-6 py-4 font-medium bg-slate-50 border-b border-slate-200 whitespace-nowrap">หน่วยงานสอบเทียบ / เลขใบรับรอง</th>
                <th className="px-6 py-4 font-medium bg-slate-50 border-b border-slate-200 whitespace-nowrap">รอบการสอบเทียบ</th>
                <th className="px-6 py-4 font-medium bg-slate-50 border-b border-slate-200 whitespace-nowrap">ล่าสุด / ครั้งถัดไป</th>
                <th className="px-6 py-4 font-medium bg-slate-50 border-b border-slate-200 whitespace-nowrap min-w-[120px]">สถานะ</th>
                <th className="px-6 py-4 font-medium text-right bg-slate-50 border-b border-slate-200 sticky right-0 top-0 z-20 whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedCalibrations.map(c => {
                const eq = equipmentMap.get(c.equipmentId) || equipment.find(e => e.id === c.equipmentId);
                return (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {eq?.code || (c.equipmentId.startsWith('auto-cal-') ? c.equipmentId.replace('auto-cal-', '') : 'Unknown')}
                    </td>
                    <td className="px-6 py-4 text-slate-800 font-medium whitespace-nowrap">
                      <div>{eq?.name || 'เครื่องมือแพทย์'}</div>
                      <div className="text-xs text-slate-400">{eq?.department || '-'}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-700 text-xs whitespace-nowrap">
                      <div>{c.agency || 'ไม่ระบุหน่วยงาน'}</div>
                      {c.certNumber && <div className="font-mono text-blue-600 font-semibold">Cert: {c.certNumber}</div>}
                    </td>
                    <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{c.frequency}</td>
                    <td className="px-6 py-4 text-xs font-mono whitespace-nowrap">
                      <div className="text-slate-600">ล่าสุด: {formatDateSlash(c.lastDate)}</div>
                      <div className="text-blue-600 font-semibold">ถัดไป: {formatDateSlash(c.nextDate)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(resolvePlanStatusByNextDate(c.nextDate, c.status))}</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handleDownloadPlan(c, eq)}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          title="ดาวน์โหลดข้อมูลการสอบเทียบ (Excel)"
                        >
                          <Download size={17} />
                        </button>
                        <button
                          onClick={() => setPrintingPlan(c)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title="พิมพ์ใบรายงานการสอบเทียบ"
                        >
                          <Printer size={17} />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              onClick={() => handleStartEdit(c)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="แก้ไขแผนการสอบเทียบ"
                            >
                              <Pencil size={17} />
                            </button>
                            <button
                              onClick={() => setPlanToDelete(c)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="ลบแผนการสอบเทียบ"
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
              {calibrations.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                        <Gauge size={24} />
                      </div>
                      <p className="text-sm font-medium text-slate-700">ยังไม่มีข้อมูลการสอบเทียบในขณะนี้</p>
                      {canEdit && (
                        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                          <button
                            type="button"
                            onClick={() => setIsImportModalOpen(true)}
                            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                          >
                            <FileSpreadsheet size={15} />
                            <span>นำเข้าข้อมูลการสอบเทียบเครื่องมือ</span>
                          </button>

                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {calibrations.length > 0 && filteredCalibrations.length === 0 && (
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
      {filteredCalibrations.length > 0 && (
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
              <option value="all">แสดงทั้งหมด ({filteredCalibrations.length})</option>
            </select>
            <span className="text-slate-400">|</span>
            <span>
              ลำดับที่ <strong className="text-slate-800">{filteredCalibrations.length === 0 ? 0 : startIndex + 1}</strong> ถึง <strong className="text-slate-800">{pageSize === 'all' ? filteredCalibrations.length : Math.min(startIndex + Number(pageSize), filteredCalibrations.length)}</strong> จากทั้งหมด <strong className="text-blue-700">{filteredCalibrations.length.toLocaleString()}</strong> รายการ
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
      {editingPlan && (() => {
        const eq = equipmentMap.get(editingPlan.equipmentId) || equipment.find(e => e.id === editingPlan.equipmentId);
        const eqCode = eq?.code || (editingPlan.equipmentId.startsWith('auto-cal-') ? editingPlan.equipmentId.replace('auto-cal-', '') : editingPlan.equipmentId);
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200 shrink-0">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">แก้ไขข้อมูลแผนการสอบเทียบ</h3>
                  <p className="text-xs text-slate-500 mt-0.5">รหัสเครื่อง: <span className="font-mono font-bold text-blue-700">{eqCode}</span> • {editEqData.name || 'เครื่องมือแพทย์'}</p>
                </div>
                <button onClick={() => setEditingPlan(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-sm overflow-y-auto flex-1">
                {/* Equipment Information Section */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>ข้อมูลเครื่องมือแพทย์</span>
                    <span className="text-[11px] font-normal text-slate-500">อัปเดตข้อมูลเครื่องมือ</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">ชื่อเครื่องมือ</label>
                      <input
                        type="text"
                        value={editEqData.name}
                        onChange={e => setEditEqData({ ...editEqData, name: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Itris ID</label>
                      <input
                        type="text"
                        value={editEqData.itrisId}
                        onChange={e => setEditEqData({ ...editEqData, itrisId: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Manufacturer (ผู้ผลิต)</label>
                      <input
                        type="text"
                        value={editEqData.manufacturer}
                        onChange={e => setEditEqData({ ...editEqData, manufacturer: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Model (รุ่น)</label>
                      <input
                        type="text"
                        value={editEqData.model}
                        onChange={e => setEditEqData({ ...editEqData, model: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Serial number (หมายเลขเครื่อง)</label>
                      <input
                        type="text"
                        value={editEqData.serialNumber}
                        onChange={e => setEditEqData({ ...editEqData, serialNumber: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Risk Levels (ความเสี่ยง)</label>
                      <select
                        value={editEqData.riskLevel}
                        onChange={e => setEditEqData({ ...editEqData, riskLevel: e.target.value as any })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="High">HIGH (ความเสี่ยงสูง)</option>
                        <option value="Medium">MEDIUM (ความเสี่ยงปานกลาง)</option>
                        <option value="Low">LOW (ความเสี่ยงต่ำ)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Calibration Plan Section */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                  <div className="text-xs font-bold text-slate-700">ข้อมูลแผนการสอบเทียบ</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">รอบการสอบเทียบ</label>
                      <select
                        value={editFormData.frequency}
                        onChange={e => setEditFormData({ ...editFormData, frequency: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="ทุก 6 เดือน">ทุก 6 เดือน</option>
                        <option value="ทุก 1 ปี">ทุก 1 ปี</option>
                        <option value="ทุก 2 ปี">ทุก 2 ปี</option>
                        <option value="ตามแผนกำหนด">ตามแผนกำหนด</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">สถานะ</label>
                      <select
                        value={editFormData.status}
                        onChange={e => setEditFormData({ ...editFormData, status: e.target.value as PlanStatus })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="pending">รอดำเนินการ</option>
                        <option value="completed">สอบเทียบแล้ว</option>
                        <option value="overdue">เลยกำหนด</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">วันที่สอบเทียบล่าสุด</label>
                      <input
                        type="date"
                        required
                        value={editFormData.lastDate}
                        onChange={e => setEditFormData({ ...editFormData, lastDate: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">กำหนดสอบเทียบครั้งถัดไป (เดือน/ปี)</label>
                      <input
                        type="month"
                        required
                        value={(parseDateString(editFormData.nextDate) || editFormData.nextDate || '').substring(0, 7)}
                        onChange={e => {
                          const nextVal = e.target.value;
                          setEditFormData(prev => ({
                            ...prev,
                            nextDate: nextVal,
                            status: resolvePlanStatusByNextDate(nextVal, prev.status),
                          }));
                        }}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">หน่วยงานสอบเทียบ</label>
                      <input
                        type="text"
                        value={editFormData.agency}
                        onChange={e => setEditFormData({ ...editFormData, agency: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                        placeholder="เช่น ITRIS PM Team..."
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">เลขที่ใบรับรอง (Cert No.)</label>
                      <input
                        type="text"
                        value={editFormData.certNumber}
                        onChange={e => setEditFormData({ ...editFormData, certNumber: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 font-mono bg-white"
                      />
                    </div>
                  </div>
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
                    className="inline-flex items-center space-x-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 cursor-pointer shadow-xs"
                  >
                    <Check size={15} />
                    <span>บันทึกการแก้ไข</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Delete Confirmation Modal */}
      {planToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-rose-50 border-b border-rose-100">
              <h3 className="font-bold text-slate-900 text-sm">ยืนยันการลบแผนสอบเทียบ</h3>
              <button onClick={() => setPlanToDelete(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 text-xs text-slate-600">
              คุณต้องการลบแผนสอบเทียบนี้ออกจากระบบอย่างถาวรหรือไม่?
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
                  deleteCalibration(planToDelete.id);
                  setPlanToDelete(null);
                  setSuccessMessage('ลบแผนการสอบเทียบเรียบร้อยแล้ว');
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

      {/* Print Preview Modal */}
      {printingPlan && (() => {
        const printEq = equipmentMap.get(printingPlan.equipmentId) || equipment.find(e => e.id === printingPlan.equipmentId);
        const eqCode = printEq?.code || (printingPlan.equipmentId.startsWith('auto-cal-') ? printingPlan.equipmentId.replace('auto-cal-', '') : printingPlan.equipmentId);
        const effectiveStatus = resolvePlanStatusByNextDate(printingPlan.nextDate, printingPlan.status);
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200 shrink-0">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <Printer size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">พิมพ์ใบรายงานแผนการสอบเทียบเครื่องมือแพทย์ (Calibration)</h3>
                    <p className="text-xs text-slate-500">รหัสเครื่องมือ: {eqCode}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadPlan(printingPlan, printEq)}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Download size={15} />
                    <span>ดาวน์โหลด Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExecutePrint}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                  >
                    <Printer size={15} />
                    <span>สั่งพิมพ์ / บันทึก PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintingPlan(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto bg-slate-100 flex-1">
                <div
                  ref={printRef}
                  className="bg-white p-8 rounded-xl shadow-xs border border-slate-200 mx-auto max-w-[210mm] text-slate-900"
                >
                  <div className="border-b-2 border-slate-800 pb-4 mb-6 flex items-start justify-between">
                    <div>
                      <h1 className="text-xl font-bold text-slate-900">ใบรายงานแผนการสอบเทียบเครื่องมือแพทย์ (Calibration Report)</h1>
                      <p className="text-sm text-slate-600 mt-1">สถานพยาบาล: {currentFacility || 'โรงพยาบาล / สถานพยาบาล'}</p>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <div className="font-semibold text-slate-800">เอกสารระบบบริหารจัดการเครื่องมือแพทย์</div>
                      <div>วันที่พิมพ์: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h2 className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-2 rounded-md mb-3 border-l-4 border-indigo-600">
                      1. ข้อมูลเครื่องมือแพทย์ (Equipment Information)
                    </h2>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-2.5 border border-slate-200 rounded-lg">
                        <div className="text-xs text-slate-500">รหัสเครื่องมือ (Equipment Code)</div>
                        <div className="font-mono font-bold text-slate-900 mt-0.5">{eqCode}</div>
                      </div>
                      <div className="p-2.5 border border-slate-200 rounded-lg">
                        <div className="text-xs text-slate-500">ชื่อเครื่องมือ (Equipment Name)</div>
                        <div className="font-bold text-slate-900 mt-0.5">{printEq?.name || 'เครื่องมือแพทย์'}</div>
                      </div>
                      <div className="p-2.5 border border-slate-200 rounded-lg">
                        <div className="text-xs text-slate-500">แผนก / หน่วยงานที่ใช้งาน (Department)</div>
                        <div className="font-semibold text-slate-800 mt-0.5">{printEq?.department || '-'}</div>
                      </div>
                      <div className="p-2.5 border border-slate-200 rounded-lg">
                        <div className="text-xs text-slate-500">ระดับความเสี่ยง (Risk Level)</div>
                        <div className="font-semibold text-slate-800 mt-0.5">{printEq?.riskLevel || '-'}</div>
                      </div>
                      <div className="p-2.5 border border-slate-200 rounded-lg">
                        <div className="text-xs text-slate-500">ยี่ห้อ / รุ่น (Brand / Model)</div>
                        <div className="font-semibold text-slate-800 mt-0.5">{[printEq?.manufacturer, printEq?.model].filter(Boolean).join(' / ') || '-'}</div>
                      </div>
                      <div className="p-2.5 border border-slate-200 rounded-lg">
                        <div className="text-xs text-slate-500">หมายเลขเครื่อง (Serial Number)</div>
                        <div className="font-mono font-semibold text-slate-800 mt-0.5">{printEq?.serialNumber || '-'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h2 className="text-sm font-bold text-slate-800 bg-slate-100 px-3 py-2 rounded-md mb-3 border-l-4 border-emerald-600">
                      2. ข้อมูลแผนการสอบเทียบ (Calibration Details)
                    </h2>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-2.5 border border-slate-200 rounded-lg">
                        <div className="text-xs text-slate-500">รอบการสอบเทียบ (Frequency)</div>
                        <div className="font-semibold text-slate-900 mt-0.5">{printingPlan.frequency || '-'}</div>
                      </div>
                      <div className="p-2.5 border border-slate-200 rounded-lg">
                        <div className="text-xs text-slate-500">สถานะปัจจุบัน (Status)</div>
                        <div className={`font-bold mt-0.5 ${effectiveStatus === 'completed' ? 'text-emerald-700' : effectiveStatus === 'overdue' ? 'text-red-700' : 'text-amber-700'}`}>
                          {getStatusLabel(effectiveStatus)}
                        </div>
                      </div>
                      <div className="p-2.5 border border-slate-200 rounded-lg">
                        <div className="text-xs text-slate-500">วันที่สอบเทียบล่าสุด (Last Calibration Date)</div>
                        <div className="font-mono font-semibold text-slate-900 mt-0.5">{formatDateSlash(printingPlan.lastDate)}</div>
                      </div>
                      <div className="p-2.5 border border-slate-200 rounded-lg">
                        <div className="text-xs text-slate-500">วันที่สอบเทียบครั้งถัดไป (Next Calibration Date)</div>
                        <div className="font-mono font-bold text-blue-700 mt-0.5">{formatDateSlash(printingPlan.nextDate)}</div>
                      </div>
                      <div className="p-2.5 border border-slate-200 rounded-lg">
                        <div className="text-xs text-slate-500">หน่วยงานสอบเทียบ (Calibration Agency)</div>
                        <div className="font-semibold text-slate-800 mt-0.5">{printingPlan.agency || '-'}</div>
                      </div>
                      <div className="p-2.5 border border-slate-200 rounded-lg">
                        <div className="text-xs text-slate-500">เลขที่ใบรับรอง (Certificate Number)</div>
                        <div className="font-mono font-semibold text-blue-700 mt-0.5">{printingPlan.certNumber || '-'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-12 pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs text-slate-600">
                    <div>
                      <div className="mb-8 border-b border-dashed border-slate-400 w-48 mx-auto h-8"></div>
                      <div className="font-semibold text-slate-800">ผู้ดำเนินการสอบเทียบ / ผู้บันทึก</div>
                      <div>วันที่ ........../........../..........</div>
                    </div>
                    <div>
                      <div className="mb-8 border-b border-dashed border-slate-400 w-48 mx-auto h-8"></div>
                      <div className="font-semibold text-slate-800">ผู้ตรวจสอบ / หัวหน้าหน่วยงาน</div>
                      <div>วันที่ ........../........../..........</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Import Calibration Modal */}
      {isImportModalOpen && (
        <ImportCalibrationModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={(items) => {
            const count = bulkAddCalibration(items);
            setSuccessMessage(`นำเข้าข้อมูลแผนการสอบเทียบสำเร็จ ${count.toLocaleString()} รายการ`);
            setTimeout(() => setSuccessMessage(null), 4000);
          }}
        />
      )}

      {/* Annual Calibration Master Plan Modal (ตารางแผนการสอบเทียบประจำปี 12 เดือน) */}
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
                  <h3 className="font-bold text-base">แผนการสอบเทียบเครื่องมือแพทย์ประจำปี (Calibration Master Plan)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ตารางแผนการดำเนินงานรายเดือน (ม.ค. - ธ.ค. {annualPlanYear}) • ทั้งหมด {annualPlanCalibrations.length} รายการ
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
                  title="สั่งพิมพ์ตารางแผนการสอบเทียบประจำปี A4 แนวนอน"
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
                  <span className="text-slate-600">สอบเทียบแล้ว</span>
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
                      แผนการสอบเทียบเครื่องมือแพทย์ประจำปี {annualPlanYear} (Calibration Master Plan)
                    </h2>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {currentFacility && currentFacility !== 'ส่วนกลาง (Super Admin)' ? currentFacility : 'โรงพยาบาล / ศูนย์การแพทย์'}
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
                        <th className="p-1.5 border-r border-slate-300 text-center whitespace-nowrap">Itris ID</th>
                        <th className="p-1.5 border-r border-slate-300 min-w-[140px] whitespace-nowrap">ชื่อเครื่องมือ</th>
                        <th className="p-1.5 border-r border-slate-300 whitespace-nowrap">แผนก</th>
                        <th className="p-1.5 border-r border-slate-300 whitespace-nowrap">Manufacturer</th>
                        <th className="p-1.5 border-r border-slate-300 whitespace-nowrap">Model</th>
                        <th className="p-1.5 border-r border-slate-300 whitespace-nowrap">Serial number</th>
                        <th className="p-1.5 border-r border-slate-300 text-center whitespace-nowrap">Risk Levels</th>
                        <th className="p-1.5 border-r border-slate-300 text-center whitespace-nowrap">รอบสอบเทียบ</th>
                        {THAI_MONTHS_SHORT.map((m, idx) => (
                          <th key={idx} className="p-1.5 border-r border-slate-300 text-center w-10 text-[10px] whitespace-nowrap">
                            {m}
                          </th>
                        ))}
                        <th className="p-1.5 border-r border-slate-300 whitespace-nowrap">หน่วยงานสอบเทียบ</th>
                        <th className="p-1.5 text-center whitespace-nowrap print:hidden">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {annualPlanCalibrations.length === 0 ? (
                        <tr>
                          <td colSpan={24} className="p-8 text-center text-slate-400">
                            ไม่พบรายการแผนการสอบเทียบในแผนกที่เลือก
                          </td>
                        </tr>
                      ) : (
                        annualPlanCalibrations.map((c, idx) => {
                          const eq = equipmentMap.get(c.equipmentId) || equipment.find(e => e.id === c.equipmentId);
                          const eqCode = eq?.code || (c.equipmentId.startsWith('auto-cal-') ? c.equipmentId.replace('auto-cal-', '') : c.equipmentId);

                          // ตรวจสอบเดือนและปีที่สอบเทียบแล้ว (lastDate - กรอบแดงที่ 1)
                          const parsedLast = parseDateString(c.lastDate);
                          const lastYear = parsedLast ? parseInt(parsedLast.substring(0, 4), 10) : null;
                          const lastMonth = (lastYear === annualPlanYear && parsedLast) ? parseInt(parsedLast.substring(5, 7), 10) : null;

                          // ตรวจสอบเดือนและปีที่กำหนดสอบเทียบครั้งถัดไป (nextDate - กรอบแดงที่ 2)
                          const parsedNext = parseDateString(c.nextDate);
                          const nextYear = parsedNext ? parseInt(parsedNext.substring(0, 4), 10) : null;
                          const nextMonth = (nextYear === annualPlanYear && parsedNext) ? parseInt(parsedNext.substring(5, 7), 10) : null;

                          return (
                            <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-2 py-1.5 text-center font-mono border-r border-slate-200 text-slate-500 whitespace-nowrap">{idx + 1}</td>
                              <td className="px-2.5 py-1.5 font-mono font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">{eqCode}</td>
                              <td className="px-2.5 py-1.5 text-center font-mono text-slate-700 border-r border-slate-200 whitespace-nowrap">{eq?.itrisId || '-'}</td>
                              <td className="px-2.5 py-1.5 font-medium text-slate-800 border-r border-slate-200 whitespace-nowrap">{eq?.name || 'เครื่องมือแพทย์'}</td>
                              <td className="px-2.5 py-1.5 text-slate-600 border-r border-slate-200 whitespace-nowrap">{eq?.department || '-'}</td>
                              <td className="px-2.5 py-1.5 text-slate-700 border-r border-slate-200 whitespace-nowrap">{eq?.manufacturer || '-'}</td>
                              <td className="px-2.5 py-1.5 text-slate-700 border-r border-slate-200 whitespace-nowrap">{eq?.model || '-'}</td>
                              <td className="px-2.5 py-1.5 font-mono text-slate-700 border-r border-slate-200 whitespace-nowrap">{eq?.serialNumber || '-'}</td>
                              <td className="px-2.5 py-1.5 text-center border-r border-slate-200 whitespace-nowrap">
                                <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold whitespace-nowrap ${
                                  eq?.riskLevel === 'High' ? 'bg-rose-100 text-rose-700' :
                                  eq?.riskLevel === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                  'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {(eq?.riskLevel || 'Low').toUpperCase()}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-center text-slate-600 border-r border-slate-200 text-[10px] whitespace-nowrap">{c.frequency || '1 ปี'}</td>
                              {THAI_MONTHS_SHORT.map((_, mIdx) => {
                                const currentMonthNum = mIdx + 1;
                                const isCalibratedThisMonth = lastMonth === currentMonthNum;
                                const isPendingThisMonth = !isCalibratedThisMonth && nextMonth === currentMonthNum;

                                return (
                                  <td key={mIdx} className="p-1 text-center border-r border-slate-200 whitespace-nowrap">
                                    {isCalibratedThisMonth ? (
                                      <span
                                        className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300"
                                        title={`สอบเทียบแล้ว: ${formatDateSlash(c.lastDate)}`}
                                      >
                                        ✓
                                      </span>
                                    ) : isPendingThisMonth ? (
                                      <span
                                        className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-300"
                                        title={`ยังไม่ได้ทำการสอบเทียบ (กำหนด: ${formatDateSlash(c.nextDate)})`}
                                      >
                                        !
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">-</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-2.5 py-1.5 text-slate-600 whitespace-nowrap border-r border-slate-200">{c.agency || '-'}</td>
                              <td className="px-2 py-1 text-center whitespace-nowrap print:hidden">
                                {canEdit ? (
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(c)}
                                    className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center shadow-2xs"
                                    title="แก้ไขข้อมูล"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
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
