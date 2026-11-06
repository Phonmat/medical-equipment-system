import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppStore } from '../store';
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Filter, 
  Search, 
  Printer, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  BarChart3, 
  Building2, 
  UserCheck, 
  Wrench,
  TrendingUp,
  FileText,
  AlertTriangle,
  Pencil,
  PieChart,
  Loader2
} from 'lucide-react';
import { RepairJob } from '../types';
import EditRepairModal from './EditRepairModal';
import RepairReportModal from './RepairReportModal';
import { formatDateSlash } from '../utils/dateUtils';
import { printElement } from '../utils/printUtils';

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

interface YearlyRepairSummaryProps {
  onAddRepairClick?: () => void;
}

export default function YearlyRepairSummary({ onAddRepairClick }: YearlyRepairSummaryProps) {
  const { repairs, equipment, departments, userRole, updateRepairStatus, currentUser } = useAppStore();
  const isAdmin = userRole === 'Super Admin' || userRole === 'Admin';

  const today = new Date();
  const currentYearNum = today.getFullYear();

  const [selectedYear, setSelectedYear] = useState<number>(currentYearNum);
  const hasAutoSelectedYear = useRef(false);

  useEffect(() => {
    if (hasAutoSelectedYear.current || repairs.length === 0) return;
    const hasYear = (y: number) => repairs.some(r => r.reportDate && new Date(r.reportDate).getFullYear() === y);
    const preferred = [currentYearNum, 2025, 2024, 2023, 2022].find(hasYear);
    setSelectedYear(preferred ?? currentYearNum);
    hasAutoSelectedYear.current = true;
  }, [repairs, currentYearNum]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'in_progress' | 'pending'>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [breakdownView, setBreakdownView] = useState<'equipment' | 'technician'>('equipment');
  const [isPrinting, setIsPrinting] = useState(false);
  const [editingRepair, setEditingRepair] = useState<RepairJob | null>(null);
  const [printingRepair, setPrintingRepair] = useState<RepairJob | null>(null);

  // Available years from repair data + current year
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYearNum, currentYearNum - 1, currentYearNum - 2]);
    repairs.forEach(r => {
      if (r.reportDate) {
        const y = new Date(r.reportDate).getFullYear();
        if (!isNaN(y)) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [repairs, currentYearNum]);

  // Repairs in the selected year
  const yearlyRepairs = useMemo(() => {
    return repairs.filter(r => {
      if (!r.reportDate) return false;
      const date = new Date(r.reportDate);
      if (isNaN(date.getTime())) return false;
      return date.getFullYear() === selectedYear;
    });
  }, [repairs, selectedYear]);

  // Previous year repairs for annual comparison
  const prevYearRepairs = useMemo(() => {
    return repairs.filter(r => {
      if (!r.reportDate) return false;
      const date = new Date(r.reportDate);
      if (isNaN(date.getTime())) return false;
      return date.getFullYear() === selectedYear - 1;
    });
  }, [repairs, selectedYear]);

  // Statistics calculation for the year
  const stats = useMemo(() => {
    const total = yearlyRepairs.length;
    const completed = yearlyRepairs.filter(r => r.status === 'completed').length;
    const inProgress = yearlyRepairs.filter(r => r.status === 'in_progress').length;
    const pending = yearlyRepairs.filter(r => r.status === 'pending').length;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const prevTotal = prevYearRepairs.length;
    const totalDiff = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : (total > 0 ? 100 : 0);

    return {
      total,
      completed,
      inProgress,
      pending,
      successRate,
      prevTotal,
      totalDiff
    };
  }, [yearlyRepairs, prevYearRepairs]);

  // Monthly breakdown for all 12 months
  const monthlyBreakdown = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const monthRepairs = yearlyRepairs.filter(r => {
        if (!r.reportDate) return false;
        const d = new Date(r.reportDate);
        if (isNaN(d.getTime())) return false;
        return d.getMonth() === i;
      });
      const total = monthRepairs.length;
      const completed = monthRepairs.filter(r => r.status === 'completed').length;
      const inProgress = monthRepairs.filter(r => r.status === 'in_progress').length;
      const pending = monthRepairs.filter(r => r.status === 'pending').length;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        monthIndex: i,
        monthName: THAI_MONTHS[i],
        monthFullName: THAI_MONTHS_FULL[i],
        total,
        completed,
        inProgress,
        pending,
        rate
      };
    });

    const maxMonthlyTotal = Math.max(...months.map(m => m.total), 1);
    return { months, maxMonthlyTotal };
  }, [yearlyRepairs]);

  // Department breakdown for the whole year
  const departmentBreakdown = useMemo(() => {
    const map: Record<string, { total: number; completed: number; inProgress: number; pending: number }> = {};

    yearlyRepairs.forEach(r => {
      const dept = r.department?.trim() || 'ไม่ระบุแผนก';
      if (!map[dept]) {
        map[dept] = { total: 0, completed: 0, inProgress: 0, pending: 0 };
      }
      map[dept].total += 1;
      if (r.status === 'completed') map[dept].completed += 1;
      else if (r.status === 'in_progress') map[dept].inProgress += 1;
      else map[dept].pending += 1;
    });

    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        ...data,
        successRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [yearlyRepairs]);

  // Equipment breakdown for the whole year
  const equipmentBreakdown = useMemo(() => {
    const map: Record<string, { equipmentId: string; code: string; name: string; department: string; total: number; completed: number; inProgress: number; pending: number }> = {};

    yearlyRepairs.forEach(r => {
      const eqId = r.equipmentId || 'unknown';
      const eq = equipment.find(e => e.id === eqId);
      const code = eq?.code || r.equipmentCode || (r.isNonRegistered ? 'นอกทะเบียน' : 'Unknown');
      const name = eq?.name || r.equipmentName || 'ไม่ระบุชื่อเครื่องมือ';
      const department = r.department || eq?.department || '-';

      if (!map[eqId]) {
        map[eqId] = {
          equipmentId: eqId,
          code,
          name,
          department,
          total: 0,
          completed: 0,
          inProgress: 0,
          pending: 0
        };
      }
      map[eqId].total += 1;
      if (r.status === 'completed') map[eqId].completed += 1;
      else if (r.status === 'in_progress') map[eqId].inProgress += 1;
      else map[eqId].pending += 1;
    });

    return Object.values(map)
      .map(data => ({
        ...data,
        successRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [yearlyRepairs, equipment]);

  // Technician breakdown for the whole year
  const technicianBreakdown = useMemo(() => {
    const map: Record<string, { total: number; completed: number; inProgress: number; pending: number }> = {};

    yearlyRepairs.forEach(r => {
      const tech = r.technician?.trim() || 'ยังไม่ระบุช่าง';
      if (!map[tech]) {
        map[tech] = { total: 0, completed: 0, inProgress: 0, pending: 0 };
      }
      map[tech].total += 1;
      if (r.status === 'completed') map[tech].completed += 1;
      else if (r.status === 'in_progress') map[tech].inProgress += 1;
      else map[tech].pending += 1;
    });

    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        ...data,
        successRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [yearlyRepairs]);

  // All unique departments for filter dropdown
  const allDepartments = useMemo(() => {
    const depts = new Set<string>(departments || []);
    yearlyRepairs.forEach(r => {
      if (r.department?.trim()) depts.add(r.department.trim());
    });
    return Array.from(depts).sort();
  }, [yearlyRepairs, departments]);

  // Filtered repair list based on user search & filters
  const displayRepairs = useMemo(() => {
    return yearlyRepairs.filter(repair => {
      // Month filter
      if (monthFilter !== 'all') {
        if (!repair.reportDate) return false;
        const d = new Date(repair.reportDate);
        if (isNaN(d.getTime()) || d.getMonth() !== parseInt(monthFilter, 10)) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && repair.status !== statusFilter) {
        return false;
      }

      // Department filter
      if (departmentFilter !== 'all' && repair.department !== departmentFilter) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const eq = equipment.find(e => e.id === repair.equipmentId);
        const code = eq?.code || repair.equipmentCode || (repair.isNonRegistered ? 'นอกทะเบียน' : '');
        const name = eq?.name || repair.equipmentName || '';
        const matchCode = code.toLowerCase().includes(term);
        const matchName = name.toLowerCase().includes(term);
        const matchDept = repair.department?.toLowerCase().includes(term) || false;
        const matchIssue = repair.issue?.toLowerCase().includes(term) || false;
        const matchTech = repair.technician?.toLowerCase().includes(term) || false;
        const matchReporter = repair.reportedBy?.toLowerCase().includes(term) || false;

        return matchCode || matchName || matchDept || matchIssue || matchTech || matchReporter;
      }

      return true;
    });
  }, [yearlyRepairs, monthFilter, statusFilter, departmentFilter, searchTerm, equipment]);

  const printSectionRef = useRef<HTMLDivElement>(null);

  // Print function
  const handlePrint = async () => {
    if (!printSectionRef.current || isPrinting) return;
    setIsPrinting(true);
    try {
      await printElement(printSectionRef.current, {
        documentTitle: `รายงานสรุปงานซ่อมบำรุงประจำปี_${selectedYear + 543}`,
        pageOrientation: 'portrait',
        pageMargin: '6mm 6mm'
      });
    } catch (err) {
      console.error('Print failed:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['ลำดับ', 'วันที่แจ้ง', 'รหัสเครื่องมือ', 'ชื่อเครื่องมือ', 'แผนก', 'อาการเสีย/ปัญหา', 'ผู้แจ้ง', 'ช่างผู้รับผิดชอบ', 'สถานะ'];
    const rows = displayRepairs.map((r, index) => {
      const eq = equipment.find(e => e.id === r.equipmentId);
      const code = eq?.code || r.equipmentCode || (r.isNonRegistered ? 'นอกทะเบียน' : '-');
      const name = eq?.name || r.equipmentName || '-';
      const statusText = r.status === 'completed' ? 'เสร็จสิ้น' : r.status === 'in_progress' ? 'กำลังดำเนินการ' : 'รอดำเนินการ';
      return [
        index + 1,
        r.reportDate || '-',
        `"${code}"`,
        `"${name}"`,
        `"${r.department || '-'}"`,
        `"${(r.issue || '').replace(/"/g, '""')}"`,
        `"${r.reportedBy || '-'}"`,
        `"${r.technician || '-'}"`,
        statusText
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `รายงานสรุปงานซ่อมประจำปี_${selectedYear + 543}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="yearly-repair-summary-container">
      {/* Header & Year Selector Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md w-fit mb-1.5 border border-blue-100">
            <BarChart3 size={13} />
            <span>Annual Maintenance Performance Report</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <span>สรุปงานซ่อมบำรุงประจำปี พ.ศ. {selectedYear + 543}</span>
            <span className="text-sm font-normal text-slate-500">(ค.ศ. {selectedYear})</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ภาพรวมผลการปฏิบัติงานซ่อมบำรุง สถิติรายเดือน และแนวโน้มประสิทธิภาพประจำปี
          </p>
        </div>

        {/* Year Select & Export Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Year Selector */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
            <button
              onClick={() => setSelectedYear(prev => prev - 1)}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
              title="ปีก่อนหน้า"
            >
              <ChevronLeft size={16} />
            </button>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="bg-transparent text-sm font-bold text-slate-800 px-2 py-1 focus:outline-none cursor-pointer"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>พ.ศ. {y + 543} ({y})</option>
              ))}
            </select>
            <button
              onClick={() => setSelectedYear(prev => prev + 1)}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
              title="ปีถัดไป"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {selectedYear !== currentYearNum && (
            <button
              onClick={() => setSelectedYear(currentYearNum)}
              className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border border-blue-200"
            >
              ปีปัจจุบัน
            </button>
          )}

          {/* Print & Export */}
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex items-center space-x-1.5 px-3.5 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:bg-slate-100 rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
            title="สั่งพิมพ์รายงานสรุปประจำปีไปยังเครื่องพิมพ์"
          >
            {isPrinting ? (
              <>
                <Loader2 size={14} className="animate-spin text-slate-500" />
                <span className="hidden sm:inline">กำลังส่งข้อมูล...</span>
              </>
            ) : (
              <>
                <Printer size={14} />
                <span className="hidden sm:inline">พิมพ์รายงาน</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-2xs"
          >
            <Download size={14} />
            <span>ส่งออก CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards for the Year */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Repairs in Year */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">ยอดแจ้งซ่อมทั้งปี</span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Wrench size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900">{stats.total}</span>
            <span className="text-xs font-medium text-slate-500">รายการ</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center space-x-1">
            <span>ปีก่อนหน้า: {stats.prevTotal} รายการ</span>
            {stats.prevTotal > 0 && (
              <span className={`font-semibold ml-1 ${stats.totalDiff >= 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                ({stats.totalDiff >= 0 ? `+${stats.totalDiff}%` : `${stats.totalDiff}%`})
              </span>
            )}
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">ซ่อมเสร็จสิ้น (สำเร็จ)</span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-emerald-600">{stats.completed}</span>
            <span className="text-xs font-medium text-slate-500">รายการ</span>
          </div>
          <div className="mt-2 flex items-center space-x-1.5">
            <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${stats.successRate}%` }} 
              />
            </div>
            <span className="text-xs font-bold text-emerald-700">{stats.successRate}% สำเร็จ</span>
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">กำลังดำเนินการซ่อม</span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-amber-600">{stats.inProgress}</span>
            <span className="text-xs font-medium text-slate-500">รายการ</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}% ของงานทั้งหมดในปีนี้
          </div>
        </div>

        {/* Pending */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">รอดำเนินการ (ค้างรับงาน)</span>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-rose-600">{stats.pending}</span>
            <span className="text-xs font-medium text-slate-500">รายการ</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {stats.pending > 0 ? 'จำเป็นต้องติดตามช่างรับผิดชอบ' : 'ไม่มีงานตกค้าง'}
          </div>
        </div>
      </div>

      {/* Monthly Chart Breakdown (12 Months) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <BarChart3 size={18} className="text-blue-600" />
              <span>สถิติงานซ่อมบำรุงรายเดือน (มกราคม - ธันวาคม พ.ศ. {selectedYear + 543})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">กราฟแสดงจำนวนงานซ่อมที่เกิดขึ้นในแต่ละเดือน พร้อมสัดส่วนงานที่ซ่อมเสร็จ</p>
          </div>
          <div className="flex items-center space-x-3 text-xs">
            <div className="flex items-center space-x-1.5">
              <div className="w-3 h-3 bg-emerald-500 rounded-xs" />
              <span className="text-slate-600 font-medium">เสร็จสิ้น</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-3 h-3 bg-amber-400 rounded-xs" />
              <span className="text-slate-600 font-medium">กำลังทำ</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="w-3 h-3 bg-rose-400 rounded-xs" />
              <span className="text-slate-600 font-medium">รอทำ</span>
            </div>
          </div>
        </div>

        {/* 12-Month Bar Visualizer */}
        <div className="pt-6">
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 sm:gap-3 items-end h-56 pt-6 pb-2 border-b border-slate-200">
            {monthlyBreakdown.months.map((m) => {
              const heightPercent = m.total > 0 ? Math.max((m.total / monthlyBreakdown.maxMonthlyTotal) * 100, 8) : 4;
              const completedHeight = m.total > 0 ? (m.completed / m.total) * 100 : 0;
              const inProgressHeight = m.total > 0 ? (m.inProgress / m.total) * 100 : 0;
              const pendingHeight = m.total > 0 ? (m.pending / m.total) * 100 : 0;

              return (
                <div 
                  key={m.monthIndex} 
                  className="flex flex-col items-center h-full justify-end group relative cursor-pointer"
                  onClick={() => setMonthFilter(monthFilter === m.monthIndex.toString() ? 'all' : m.monthIndex.toString())}
                >
                  {/* Tooltip on hover */}
                  <div className="absolute -top-14 bg-slate-900 text-white text-[10px] py-1.5 px-2.5 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap">
                    <p className="font-bold">{m.monthFullName}: {m.total} งาน</p>
                    <p className="text-emerald-400">เสร็จ {m.completed} ({m.rate}%)</p>
                    <p className="text-amber-300">ค้าง/รอ {m.inProgress + m.pending}</p>
                  </div>

                  {/* Value on top */}
                  <span className={`text-[11px] font-bold mb-1 transition-colors ${
                    monthFilter === m.monthIndex.toString() ? 'text-blue-600 scale-110' : 'text-slate-700'
                  }`}>
                    {m.total}
                  </span>

                  {/* Stacked Bar */}
                  <div 
                    className={`w-full max-w-[28px] rounded-t-lg overflow-hidden flex flex-col justify-end transition-all ${
                      monthFilter === m.monthIndex.toString() 
                        ? 'ring-2 ring-blue-600 ring-offset-2' 
                        : 'group-hover:opacity-90'
                    } ${m.total === 0 ? 'bg-slate-100' : ''}`}
                    style={{ height: `${heightPercent}%` }}
                  >
                    {m.total > 0 ? (
                      <>
                        {pendingHeight > 0 && <div className="bg-rose-400" style={{ height: `${pendingHeight}%` }} />}
                        {inProgressHeight > 0 && <div className="bg-amber-400" style={{ height: `${inProgressHeight}%` }} />}
                        {completedHeight > 0 && <div className="bg-emerald-500" style={{ height: `${completedHeight}%` }} />}
                      </>
                    ) : (
                      <div className="h-full bg-slate-100" />
                    )}
                  </div>

                  {/* Label */}
                  <span className={`text-[11px] mt-2 font-medium truncate w-full text-center ${
                    monthFilter === m.monthIndex.toString() 
                      ? 'text-blue-700 font-bold' 
                      : 'text-slate-600'
                  }`}>
                    {m.monthName}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-3">
            <span>* คลิกที่แท่งเดือนเพื่อกรองดูรายการเฉพาะเดือนนั้นๆ ได้</span>
            {monthFilter !== 'all' && (
              <button
                onClick={() => setMonthFilter('all')}
                className="text-blue-600 hover:underline font-semibold"
              >
                ล้างการกรองเดือน (แสดงทั้งหมด 12 เดือน)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Department & Technician Annual Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Annual Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Building2 size={18} className="text-indigo-600" />
              <span>สถิติงานซ่อมแยกตามแผนก (ประจำปี)</span>
            </h3>
            <span className="text-xs font-semibold text-slate-500">{departmentBreakdown.length} แผนก</span>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {departmentBreakdown.map((dept) => {
              const share = stats.total > 0 ? Math.round((dept.total / stats.total) * 100) : 0;
              return (
                <div key={dept.name} className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-800 truncate pr-2">{dept.name}</span>
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className="text-xs font-bold text-slate-900">{dept.total} งาน</span>
                      <span className="text-[11px] text-slate-500 font-medium">({share}%)</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden flex">
                      <div className="bg-emerald-500 h-full" style={{ width: `${(dept.completed / dept.total) * 100}%` }} title={`เสร็จ: ${dept.completed}`} />
                      <div className="bg-amber-400 h-full" style={{ width: `${(dept.inProgress / dept.total) * 100}%` }} title={`กำลังทำ: ${dept.inProgress}`} />
                      <div className="bg-rose-400 h-full" style={{ width: `${(dept.pending / dept.total) * 100}%` }} title={`รอทำ: ${dept.pending}`} />
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-700 w-12 text-right">
                      {dept.successRate}%
                    </span>
                  </div>
                </div>
              );
            })}

            {departmentBreakdown.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">ไม่มีข้อมูลงานซ่อมในปีนี้</div>
            )}
          </div>
        </div>

        {/* Equipment / Technician Annual Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Wrench size={18} className="text-amber-600" />
                <span>สถิติงานซ่อมแยกตามเครื่องมือ (ประจำปี)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {breakdownView === 'equipment' 
                  ? `เครื่องมือที่มีประวัติการแจ้งซ่อม ${equipmentBreakdown.length} รายการ`
                  : `สรุปผลงานช่างผู้รับผิดชอบ ${technicianBreakdown.length} ท่าน`}
              </p>
            </div>

            {/* Toggle View */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setBreakdownView('equipment')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  breakdownView === 'equipment'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                เครื่องมือ ({equipmentBreakdown.length})
              </button>
              <button
                type="button"
                onClick={() => setBreakdownView('technician')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  breakdownView === 'technician'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                ช่าง ({technicianBreakdown.length})
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {breakdownView === 'equipment' ? (
              <>
                {equipmentBreakdown.map((item) => {
                  const share = stats.total > 0 ? Math.round((item.total / stats.total) * 100) : 0;
                  return (
                    <div key={item.equipmentId} className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="min-w-0 pr-2">
                          <span className="text-xs font-bold text-slate-800 truncate block">{item.name}</span>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                          <span className="text-xs font-bold text-slate-900">{item.total} ครั้ง</span>
                          <span className="text-[11px] text-slate-500 font-medium">({share}%)</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden flex">
                          <div className="bg-emerald-500 h-full" style={{ width: `${(item.completed / item.total) * 100}%` }} title={`เสร็จ: ${item.completed}`} />
                          <div className="bg-amber-400 h-full" style={{ width: `${(item.inProgress / item.total) * 100}%` }} title={`กำลังทำ: ${item.inProgress}`} />
                          <div className="bg-rose-400 h-full" style={{ width: `${(item.pending / item.total) * 100}%` }} title={`รอทำ: ${item.pending}`} />
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-700 w-12 text-right">
                          {item.successRate}%
                        </span>
                      </div>
                    </div>
                  );
                })}

                {equipmentBreakdown.length === 0 && (
                  <div className="py-8 text-center text-xs text-slate-400">ไม่มีข้อมูลงานซ่อมในปีนี้</div>
                )}
              </>
            ) : (
              <>
                {technicianBreakdown.map((tech) => {
                  const share = stats.total > 0 ? Math.round((tech.total / stats.total) * 100) : 0;
                  return (
                    <div key={tech.name} className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-800 truncate pr-2">{tech.name}</span>
                        <div className="flex items-center space-x-2 shrink-0">
                          <span className="text-xs font-bold text-slate-900">{tech.total} งาน</span>
                          <span className="text-[11px] text-slate-500 font-medium">({share}%)</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden flex">
                          <div className="bg-emerald-500 h-full" style={{ width: `${(tech.completed / tech.total) * 100}%` }} title={`เสร็จ: ${tech.completed}`} />
                          <div className="bg-amber-400 h-full" style={{ width: `${(tech.inProgress / tech.total) * 100}%` }} title={`กำลังทำ: ${tech.inProgress}`} />
                          <div className="bg-rose-400 h-full" style={{ width: `${(tech.pending / tech.total) * 100}%` }} title={`รอทำ: ${tech.pending}`} />
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-700 w-12 text-right">
                          {tech.successRate}%
                        </span>
                      </div>
                    </div>
                  );
                })}

                {technicianBreakdown.length === 0 && (
                  <div className="py-8 text-center text-xs text-slate-400">ไม่มีข้อมูลงานซ่อมในปีนี้</div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filter & Detailed Table of the Year */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Filter Controls */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/70 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <FileText size={18} className="text-blue-600" />
                <span>ตารางรายละเอียดงานซ่อมประจำปี พ.ศ. {selectedYear + 543}</span>
              </h3>
              <p className="text-xs text-slate-500">
                แสดงผล {displayRepairs.length} จากทั้งหมด {yearlyRepairs.length} รายการในปีนี้
              </p>
            </div>

            {/* Quick search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหารหัส, ชื่อ, แผนก, ช่าง..."
                className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-slate-500 font-medium flex items-center space-x-1">
              <Filter size={13} />
              <span>ตัวกรอง:</span>
            </span>

            {/* Month Filter Dropdown */}
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">-- ทุกเดือน (12 เดือน) --</option>
              {THAI_MONTHS_FULL.map((m, idx) => (
                <option key={idx} value={idx.toString()}>{m}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">-- ทุกสถานะ --</option>
              <option value="completed">เสร็จสิ้น (Completed)</option>
              <option value="in_progress">กำลังดำเนินการ (In Progress)</option>
              <option value="pending">รอดำเนินการ (Pending)</option>
            </select>

            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">-- ทุกแผนก --</option>
              {allDepartments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {(monthFilter !== 'all' || statusFilter !== 'all' || departmentFilter !== 'all' || searchTerm) && (
              <button
                onClick={() => {
                  setMonthFilter('all');
                  setStatusFilter('all');
                  setDepartmentFilter('all');
                  setSearchTerm('');
                }}
                className="text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 hover:bg-blue-50 rounded-md transition-colors"
              >
                ล้างตัวกรองทั้งหมด
              </button>
            )}
          </div>
        </div>

        {/* Repair Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5 font-semibold">#</th>
                <th className="px-5 py-3.5 font-semibold">วันที่แจ้ง</th>
                <th className="px-5 py-3.5 font-semibold">รหัสเครื่องมือ</th>
                <th className="px-5 py-3.5 font-semibold">ชื่อเครื่องมือ</th>
                <th className="px-5 py-3.5 font-semibold">แผนก</th>
                <th className="px-5 py-3.5 font-semibold">อาการเสีย/ปัญหา</th>
                <th className="px-5 py-3.5 font-semibold">ผู้แจ้ง / ลายเซ็นเปิดงาน</th>
                <th className="px-5 py-3.5 font-semibold">ผู้ตรวจสอบ/เซ็นปิดงาน</th>
                <th className="px-5 py-3.5 font-semibold">ช่าง</th>
                <th className="px-5 py-3.5 font-semibold">สถานะ</th>
                <th className="px-5 py-3.5 font-semibold text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayRepairs.map((repair, index) => {
                const eq = equipment.find(e => e.id === repair.equipmentId);
                return (
                  <tr key={repair.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 text-slate-500 font-mono">{index + 1}</td>
                    <td className="px-5 py-3.5 text-slate-700 whitespace-nowrap font-medium font-mono">{formatDateSlash(repair.reportDate)}</td>
                    <td className="px-5 py-3.5 font-mono font-bold text-blue-700">
                      <div className="flex items-center space-x-1.5">
                        <span>{eq?.code || repair.equipmentCode || (repair.isNonRegistered ? 'นอกทะเบียน' : '-')}</span>
                        {repair.isNonRegistered && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-medium font-sans">
                            นอกทะเบียน
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-900 font-medium max-w-xs truncate">{eq?.name || repair.equipmentName || '-'}</td>
                    <td className="px-5 py-3.5 text-slate-700">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-medium">
                        {repair.department || eq?.department || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 max-w-sm">
                      <div className="font-medium text-slate-800">{repair.issue}</div>
                      {repair.repairDetails && (
                        <div className="text-[11px] text-slate-500 mt-1 line-clamp-2 bg-slate-50 p-1.5 rounded border border-slate-100">
                          <span className="font-semibold text-amber-700">การดำเนินการ:</span> {repair.repairDetails}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700">
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-medium text-slate-800">{repair.signerName || repair.reportedBy || '-'}</span>
                          {repair.requesterSignature && (
                            <span className="inline-flex items-center text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full" title="เซ็นเปิดงานแล้ว">
                              ✓ เปิดงาน
                            </span>
                          )}
                        </div>
                        {repair.requesterSignature ? (
                          <img
                            src={repair.requesterSignature}
                            alt="ลายเซ็นเปิดงาน"
                            className="h-7 max-w-[85px] object-contain bg-white rounded border border-blue-200 p-0.5 shadow-2xs"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingRepair(repair)}
                            className="text-[11px] text-blue-700 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                          >
                            <span>✍️ ช่องเซ็นเปิดงาน</span>
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
                        {repair.closerName && (
                          <span className="text-slate-800 font-medium">{repair.closerName}</span>
                        )}
                        {repair.closingSignature ? (
                          <img
                            src={repair.closingSignature}
                            alt="ลายเซ็นปิดงาน"
                            className="h-7 max-w-[85px] object-contain bg-white rounded border border-emerald-200 p-0.5 shadow-2xs"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingRepair(repair)}
                            className="text-[11px] text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                          >
                            <span>✍️ ช่องเซ็นปิดงาน</span>
                          </button>
                        )}
                        {repair.closingDate ? (
                          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-1.5 py-0.5 rounded font-medium">
                              {formatDateSlash(repair.closingDate)}
                            </span>
                            {repair.closingTime && <span>{repair.closingTime} น.</span>}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 font-medium whitespace-nowrap">
                      <span>{repair.technician || '-'}</span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        repair.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : repair.status === 'in_progress'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {repair.status === 'completed' ? 'เสร็จสิ้น' : repair.status === 'in_progress' ? 'กำลังดำเนินการ' : 'รอดำเนินการ'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-2">
                        {(isAdmin || repair.reportedBy === currentUser) && (
                          <button
                            onClick={() => setEditingRepair(repair)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-100 text-xs font-medium"
                            title="แก้ไขข้อมูลงานซ่อม / เปลี่ยนสถานะ"
                          >
                            <Pencil size={13} />
                            <span>แก้ไข</span>
                          </button>
                        )}
                        <button
                          onClick={() => setPrintingRepair(repair)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 text-slate-700 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200 text-xs font-medium"
                          title="พิมพ์ใบงาน / รายงานผลการซ่อมบำรุง"
                        >
                          <Printer size={13} className="text-blue-600" />
                          <span>ปริ้น Report</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {displayRepairs.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                        <Wrench size={24} />
                      </div>
                      <p className="text-sm font-medium text-slate-700">ไม่พบรายการงานซ่อมในปี พ.ศ. {selectedYear + 543} ที่ตรงตามเงื่อนไข</p>
                      <p className="text-xs text-slate-400">ลองเปลี่ยนปี หรือปรับเงื่อนไขการค้นหา/ตัวกรอง</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Report Section (Rendered when printing) */}
      <div ref={printSectionRef} className="hidden print:block fixed inset-0 bg-white p-8 z-50 text-slate-900">
        <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
          <h1 className="text-2xl font-bold">รายงานสรุปผลการปฏิบัติงานซ่อมบำรุงเครื่องมือแพทย์ ประจำปี</h1>
          <p className="text-base font-medium mt-1">ประจำปี พ.ศ. {selectedYear + 543} (ค.ศ. {selectedYear})</p>
          <p className="text-xs text-slate-500 mt-1">ระบบบริหารจัดการเครื่องมือแพทย์ โรงพยาบาล</p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6 border border-slate-300 p-4 rounded text-xs">
          <div><strong>ยอดแจ้งซ่อมทั้งปี:</strong> {stats.total} งาน</div>
          <div><strong>ซ่อมเสร็จสิ้น:</strong> {stats.completed} งาน ({stats.successRate}%)</div>
          <div><strong>กำลังดำเนินการ:</strong> {stats.inProgress} งาน</div>
          <div><strong>รอดำเนินการ:</strong> {stats.pending} งาน</div>
        </div>

        <table className="w-full text-left text-xs border-collapse border border-slate-300 mb-8">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300">
              <th className="border border-slate-300 p-2 text-center">ลำดับ</th>
              <th className="border border-slate-300 p-2">วันที่แจ้ง</th>
              <th className="border border-slate-300 p-2">รหัสเครื่องมือ</th>
              <th className="border border-slate-300 p-2">ชื่อเครื่องมือ</th>
              <th className="border border-slate-300 p-2">อาการเสีย</th>
              <th className="border border-slate-300 p-2">แผนก</th>
              <th className="border border-slate-300 p-2">ช่างผู้รับผิดชอบ</th>
              <th className="border border-slate-300 p-2 text-center">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {displayRepairs.map((r, i) => {
              const eq = equipment.find(e => e.id === r.equipmentId);
              const code = eq?.code || r.equipmentCode || (r.isNonRegistered ? 'นอกทะเบียน' : '-');
              const name = eq?.name || r.equipmentName || '-';
              return (
                <tr key={r.id}>
                  <td className="border border-slate-300 p-2 text-center">{i + 1}</td>
                  <td className="border border-slate-300 p-2 font-mono">{formatDateSlash(r.reportDate)}</td>
                  <td className="border border-slate-300 p-2">{code}</td>
                  <td className="border border-slate-300 p-2">{name}</td>
                  <td className="border border-slate-300 p-2">{r.issue}</td>
                  <td className="border border-slate-300 p-2">{r.department || '-'}</td>
                  <td className="border border-slate-300 p-2">{r.technician || '-'}</td>
                  <td className="border border-slate-300 p-2 text-center">
                    {r.status === 'completed' ? 'เสร็จสิ้น' : r.status === 'in_progress' ? 'กำลังดำเนินการ' : 'รอดำเนินการ'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Signature Box */}
        <div className="grid grid-cols-3 gap-8 mt-12 text-center text-xs">
          <div>
            <div className="border-b border-slate-400 w-48 mx-auto mb-2" />
            <p className="font-medium">( ............................................................ )</p>
            <p className="text-slate-600 mt-1">ผู้จัดทำรายงาน / ช่างผู้รับผิดชอบ</p>
          </div>
          <div>
            <div className="border-b border-slate-400 w-48 mx-auto mb-2" />
            <p className="font-medium">( ............................................................ )</p>
            <p className="text-slate-600 mt-1">หัวหน้างานบริหารเครื่องมือแพทย์</p>
          </div>
          <div>
            <div className="border-b border-slate-400 w-48 mx-auto mb-2" />
            <p className="font-medium">( ............................................................ )</p>
            <p className="text-slate-600 mt-1">ผู้อำนวยการ / ผู้มีอำนาจอนุมัติ</p>
          </div>
        </div>
      </div>

      {/* Edit Repair Modal */}
      <EditRepairModal
        repair={editingRepair}
        isOpen={!!editingRepair}
        onClose={() => setEditingRepair(null)}
      />

      {/* Repair Report Modal */}
      <RepairReportModal
        repair={printingRepair}
        equipment={equipment.find(e => e.id === printingRepair?.equipmentId)}
        isOpen={!!printingRepair}
        onClose={() => setPrintingRepair(null)}
      />
    </div>
  );
}
