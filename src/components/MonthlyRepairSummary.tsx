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
  Loader2
} from 'lucide-react';
import { RepairJob } from '../types';
import EditRepairModal from './EditRepairModal';
import RepairReportModal from './RepairReportModal';
import { formatDateSlash } from '../utils/dateUtils';
import { printElement } from '../utils/printUtils';

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

interface MonthlyRepairSummaryProps {
  onAddRepairClick?: () => void;
  compact?: boolean;
}

export default function MonthlyRepairSummary({ onAddRepairClick, compact = false }: MonthlyRepairSummaryProps) {
  const { repairs, equipment, departments, userRole, updateRepairStatus, currentUser } = useAppStore();
  const isAdmin = userRole === 'Super Admin' || userRole === 'Admin';

  const today = new Date();
  const currentYearNum = today.getFullYear();
  const currentMonthNum = today.getMonth(); // 0 - 11

  const [selectedYear, setSelectedYear] = useState<number>(currentYearNum);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthNum);
  const hasAutoSelectedMonth = useRef(false);

  useEffect(() => {
    if (hasAutoSelectedMonth.current || repairs.length === 0) return;
    const hasCurrentMonthRepairs = repairs.some(r => {
      if (!r.reportDate) return false;
      const d = new Date(r.reportDate);
      return !isNaN(d.getTime()) && d.getFullYear() === currentYearNum && d.getMonth() === currentMonthNum;
    });
    if (!hasCurrentMonthRepairs) {
      const validDates = repairs
        .map(r => (r.reportDate ? new Date(r.reportDate) : null))
        .filter((d): d is Date => d !== null && !isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime());
      if (validDates.length > 0) {
        setSelectedYear(validDates[0].getFullYear());
        setSelectedMonth(validDates[0].getMonth());
      }
    }
    hasAutoSelectedMonth.current = true;
  }, [repairs, currentYearNum, currentMonthNum]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'in_progress' | 'pending'>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
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

  // Navigate months
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(prev => prev - 1);
    } else {
      setSelectedMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(prev => prev + 1);
    } else {
      setSelectedMonth(prev => prev + 1);
    }
  };

  const handleResetToCurrentMonth = () => {
    setSelectedYear(currentYearNum);
    setSelectedMonth(currentMonthNum);
  };

  // Filter repairs for the selected month and year
  const monthlyRepairs = useMemo(() => {
    return repairs.filter(r => {
      if (!r.reportDate) return false;
      const date = new Date(r.reportDate);
      if (isNaN(date.getTime())) return false;
      return date.getFullYear() === selectedYear && date.getMonth() === selectedMonth;
    });
  }, [repairs, selectedYear, selectedMonth]);

  // Previous month repairs for comparison
  const prevMonthRepairs = useMemo(() => {
    const prevM = selectedMonth === 0 ? 11 : selectedMonth - 1;
    const prevY = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
    return repairs.filter(r => {
      if (!r.reportDate) return false;
      const date = new Date(r.reportDate);
      if (isNaN(date.getTime())) return false;
      return date.getFullYear() === prevY && date.getMonth() === prevM;
    });
  }, [repairs, selectedYear, selectedMonth]);

  // Statistics
  const totalRepairs = monthlyRepairs.length;
  const completedRepairs = monthlyRepairs.filter(r => r.status === 'completed').length;
  const inProgressRepairs = monthlyRepairs.filter(r => r.status === 'in_progress').length;
  const pendingRepairs = monthlyRepairs.filter(r => r.status === 'pending').length;
  const completionRate = totalRepairs > 0 ? Math.round((completedRepairs / totalRepairs) * 100) : 0;

  // Comparison with previous month
  const prevTotal = prevMonthRepairs.length;
  const diffPercent = prevTotal > 0 ? Math.round(((totalRepairs - prevTotal) / prevTotal) * 100) : null;

  // Breakdown by Department
  const departmentBreakdown = useMemo(() => {
    const counts: Record<string, { total: number; completed: number }> = {};
    monthlyRepairs.forEach(r => {
      const dept = r.department?.trim() || 'ไม่ระบุแผนก';
      if (!counts[dept]) {
        counts[dept] = { total: 0, completed: 0 };
      }
      counts[dept].total += 1;
      if (r.status === 'completed') {
        counts[dept].completed += 1;
      }
    });

    return Object.entries(counts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [monthlyRepairs]);

  // All unique departments for filter dropdown
  const allDepartments = useMemo(() => {
    const depts = new Set<string>(departments || []);
    repairs.forEach(r => {
      if (r.department?.trim()) depts.add(r.department.trim());
    });
    return Array.from(depts).sort();
  }, [repairs, departments]);

  // Breakdown by Technician
  const technicianBreakdown = useMemo(() => {
    const counts: Record<string, { total: number; completed: number }> = {};
    monthlyRepairs.forEach(r => {
      const tech = r.technician?.trim() || 'ยังไม่ได้มอบหมาย';
      if (!counts[tech]) {
        counts[tech] = { total: 0, completed: 0 };
      }
      counts[tech].total += 1;
      if (r.status === 'completed') {
        counts[tech].completed += 1;
      }
    });

    return Object.entries(counts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [monthlyRepairs]);

  // Filtered repairs for table display
  const displayRepairs = useMemo(() => {
    return monthlyRepairs.filter(r => {
      const eq = equipment.find(e => e.id === r.equipmentId);
      const code = eq?.code || r.equipmentCode || (r.isNonRegistered ? 'นอกทะเบียน' : '');
      const name = eq?.name || r.equipmentName || '';
      const matchesSearch = 
        code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.issue || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.department || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.technician || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.reportedBy || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchesDept = departmentFilter === 'all' || (r.department || '').trim() === departmentFilter;

      return matchesSearch && matchesStatus && matchesDept;
    });
  }, [monthlyRepairs, equipment, searchTerm, statusFilter, departmentFilter]);

  // Export to CSV
  const handleExportCSV = () => {
    const thaiMonthName = THAI_MONTHS[selectedMonth];
    const thaiYear = selectedYear + 543;
    const filename = `สรุปงานซ่อมประจำเดือน_${thaiMonthName}_${thaiYear}.csv`;

    const headers = [
      'ลำดับ',
      'วันที่แจ้งซ่อม',
      'รหัสเครื่องมือ',
      'ชื่อเครื่องมือ',
      'อาการเสีย/ปัญหา',
      'แผนกที่ส่งซ่อม',
      'ผู้แจ้งซ่อม',
      'ช่างผู้รับผิดชอบ',
      'สถานะงานซ่อม'
    ];

    const rows = monthlyRepairs.map((r, idx) => {
      const eq = equipment.find(e => e.id === r.equipmentId);
      const eqCode = eq?.code || r.equipmentCode || (r.isNonRegistered ? 'นอกทะเบียน' : '-');
      const eqName = eq?.name || r.equipmentName || '-';
      const statusText = 
        r.status === 'completed' ? 'เสร็จสิ้น' :
        r.status === 'in_progress' ? 'กำลังดำเนินการ' : 'รอดำเนินการ';

      return [
        idx + 1,
        r.reportDate || '',
        `"${eqCode}"`,
        `"${eqName}"`,
        `"${(r.issue || '').replace(/"/g, '""')}"`,
        `"${r.department || '-'}"`,
        `"${r.reportedBy || '-'}"`,
        `"${r.technician || '-'}"`,
        `"${statusText}"`
      ];
    });

    const csvContent = '\uFEFF' + [
      [`"รายงานสรุปงานซ่อมบำรุงเครื่องมือแพทย์ ประจำเดือน ${thaiMonthName} พ.ศ. ${thaiYear}"`],
      [`"จำนวนงานแจ้งซ่อมทั้งหมด: ${totalRepairs} งาน", "ซ่อมเสร็จสิ้น: ${completedRepairs} งาน (${completionRate}%)", "กำลังดำเนินการ: ${inProgressRepairs} งาน", "รอดำเนินการ: ${pendingRepairs} งาน"`],
      [],
      headers,
      ...rows
    ].map(e => e.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printSectionRef = useRef<HTMLDivElement>(null);

  const handlePrint = async () => {
    if (!printSectionRef.current || isPrinting) return;
    setIsPrinting(true);
    try {
      await printElement(printSectionRef.current, {
        documentTitle: `รายงานสรุปงานซ่อมบำรุงประจำเดือน_${thaiMonthName}_${thaiYear}`,
        pageOrientation: 'portrait',
        pageMargin: '6mm 6mm'
      });
    } catch (err) {
      console.error('Print failed:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  const thaiMonthName = THAI_MONTHS[selectedMonth];
  const thaiYear = selectedYear + 543;

  return (
    <div className="space-y-6" id="monthly-repair-summary-container">
      {/* Header Bar with Month/Year Selection and Action Buttons */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <BarChart3 size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                สรุปงานซ่อมประจำเดือน
                <span className="text-xs font-semibold px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                  {thaiMonthName} {thaiYear}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                รายงานสถิติและประเมินผลการซ่อมบำรุงเครื่องมือแพทย์ประจำเดือน
              </p>
            </div>
          </div>
        </div>

        {/* Month Selector Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-inner">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-white hover:shadow-xs rounded-lg text-slate-600 transition-all"
              title="เดือนก่อนหน้า"
            >
              <ChevronLeft size={18} />
            </button>
            
            <div className="flex items-center space-x-1.5 px-2">
              <Calendar size={16} className="text-slate-400" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent font-medium text-sm text-slate-800 focus:outline-none cursor-pointer py-1"
              >
                {THAI_MONTHS.map((m, idx) => (
                  <option key={idx} value={idx}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent font-medium text-sm text-slate-800 focus:outline-none cursor-pointer py-1"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>
                    พ.ศ. {y + 543} ({y})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-white hover:shadow-xs rounded-lg text-slate-600 transition-all"
              title="เดือนถัดไป"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {(selectedMonth !== currentMonthNum || selectedYear !== currentYearNum) && (
            <button
              onClick={handleResetToCurrentMonth}
              className="text-xs font-medium px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
            >
              เดือนปัจจุบัน
            </button>
          )}

          <div className="flex items-center gap-1.5 ml-auto lg:ml-0">
            <button
              onClick={handleExportCSV}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-medium transition-all shadow-xs"
              title="ส่งออกรายงานเป็นไฟล์ CSV"
            >
              <Download size={15} />
              <span>ส่งออก CSV</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-600 text-white rounded-xl text-xs font-medium transition-all shadow-xs cursor-pointer"
              title="สั่งพิมพ์รายงานไปยังเครื่องพิมพ์"
            >
              {isPrinting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>กำลังส่งข้อมูล...</span>
                </>
              ) : (
                <>
                  <Printer size={15} />
                  <span>พิมพ์รายงาน</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Repairs in Month */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-blue-200 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">แจ้งซ่อมทั้งหมดในเดือน</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-1.5">{totalRepairs}</h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Wrench size={22} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>เดือนก่อนหน้า: {prevTotal} งาน</span>
            {diffPercent !== null && (
              <span className={`font-medium flex items-center ${diffPercent > 0 ? 'text-amber-600' : diffPercent < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                {diffPercent > 0 ? `+${diffPercent}%` : `${diffPercent}%`}
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Completed Repairs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-emerald-200 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">ซ่อมเสร็จสิ้น (สำเร็จ)</p>
              <h3 className="text-3xl font-bold text-emerald-600 mt-1.5">{completedRepairs}</h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 size={22} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-500">อัตราความสำเร็จ</span>
              <span className="font-semibold text-emerald-700">{completionRate}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: In Progress */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-amber-200 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">กำลังดำเนินการซ่อม</p>
              <h3 className="text-3xl font-bold text-amber-600 mt-1.5">{inProgressRepairs}</h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Clock size={22} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>สัดส่วนงานที่กำลังทำ</span>
            <span className="font-semibold text-amber-700">
              {totalRepairs > 0 ? Math.round((inProgressRepairs / totalRepairs) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Card 4: Pending */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">รอดำเนินการ / รอช่าง</p>
              <h3 className="text-3xl font-bold text-slate-700 mt-1.5">{pendingRepairs}</h3>
            </div>
            <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
              <AlertCircle size={22} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>สัดส่วนงานค้างรับ</span>
            <span className="font-semibold text-slate-700">
              {totalRepairs > 0 ? Math.round((pendingRepairs / totalRepairs) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Section: Department & Technician Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Building2 size={18} className="text-blue-600" />
              <h3 className="text-base font-semibold text-slate-900">
                สรุปงานซ่อมแยกตามแผนก
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {departmentBreakdown.length} แผนกที่ส่งซ่อม
            </span>
          </div>

          {departmentBreakdown.length > 0 ? (
            <div className="space-y-3.5">
              {departmentBreakdown.map((dept, idx) => {
                const percent = totalRepairs > 0 ? Math.round((dept.total / totalRepairs) * 100) : 0;
                return (
                  <div key={dept.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 font-medium text-slate-700">
                        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 text-[10px]">
                          {idx + 1}
                        </span>
                        <span>{dept.name}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-slate-500">
                        <span className="text-emerald-600 font-medium">เสร็จ {dept.completed}</span>
                        <span>/</span>
                        <span className="font-semibold text-slate-800">{dept.total} งาน ({percent}%)</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center text-slate-400 text-sm">
              ไม่มีข้อมูลงานซ่อมในเดือน {thaiMonthName} {thaiYear}
            </div>
          )}
        </div>

        {/* Technician Breakdown & Status Overview */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <UserCheck size={18} className="text-emerald-600" />
                <h3 className="text-base font-semibold text-slate-900">
                  สรุปงานซ่อมแยกตามช่างผู้รับผิดชอบ
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {technicianBreakdown.length} ช่างปฏิบัติงาน
              </span>
            </div>

            {technicianBreakdown.length > 0 ? (
              <div className="space-y-3.5">
                {technicianBreakdown.map((tech, idx) => {
                  const percent = totalRepairs > 0 ? Math.round((tech.total / totalRepairs) * 100) : 0;
                  const techCompletion = tech.total > 0 ? Math.round((tech.completed / tech.total) * 100) : 0;
                  return (
                    <div key={tech.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2 font-medium text-slate-700">
                          <span className="w-5 h-5 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-700 text-[10px]">
                            {idx + 1}
                          </span>
                          <span>{tech.name}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-slate-500">
                          <span className="text-emerald-600 font-medium">ปิดงาน {tech.completed}</span>
                          <span>/</span>
                          <span className="font-semibold text-slate-800">{tech.total} งาน ({techCompletion}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-slate-400 text-sm">
                ไม่มีข้อมูลงานซ่อมในเดือน {thaiMonthName} {thaiYear}
              </div>
            )}
          </div>

          {/* Quick Monthly Status Distribution Ribbon */}
          {totalRepairs > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="flex justify-between text-xs text-slate-500 mb-2">
                <span>สัดส่วนสถานะภาพรวม</span>
                <span className="text-slate-700 font-medium">ทั้งหมด {totalRepairs} รายการ</span>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-100">
                <div
                  style={{ width: `${(completedRepairs / totalRepairs) * 100}%` }}
                  className="bg-emerald-500 h-full"
                  title={`เสร็จสิ้น: ${completedRepairs} งาน`}
                />
                <div
                  style={{ width: `${(inProgressRepairs / totalRepairs) * 100}%` }}
                  className="bg-amber-500 h-full"
                  title={`กำลังดำเนินการ: ${inProgressRepairs} งาน`}
                />
                <div
                  style={{ width: `${(pendingRepairs / totalRepairs) * 100}%` }}
                  className="bg-slate-400 h-full"
                  title={`รอดำเนินการ: ${pendingRepairs} งาน`}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-1">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  เสร็จสิ้น ({completedRepairs})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  กำลังดำเนินการ ({inProgressRepairs})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                  รอดำเนินการ ({pendingRepairs})
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Monthly Repair Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Filters & Search Bar */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <FileText size={18} className="text-slate-700" />
            <h3 className="text-base font-semibold text-slate-900">
              ตารางรายละเอียดงานซ่อม ประจำเดือน {thaiMonthName} {thaiYear}
            </h3>
            <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full font-medium">
              {displayRepairs.length} รายการ
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหารหัส, ชื่อ, อาการ, แผนก..."
                className="pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 md:w-60"
              />
            </div>

            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="text-xs bg-white border border-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">ทุกแผนก</option>
              {allDepartments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {/* Status Filter Tabs */}
            <div className="flex items-center bg-white border border-slate-300 rounded-xl p-0.5 text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ทั้งหมด
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === 'completed' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                เสร็จสิ้น
              </button>
              <button
                onClick={() => setStatusFilter('in_progress')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === 'in_progress' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:text-amber-700'
                }`}
              >
                กำลังซ่อม
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  statusFilter === 'pending' ? 'bg-slate-500 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                รอดำเนินการ
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-xs">
              <tr>
                <th className="px-5 py-3.5 font-semibold text-center w-12">ลำดับ</th>
                <th className="px-5 py-3.5 font-semibold">วันที่แจ้ง</th>
                <th className="px-5 py-3.5 font-semibold">รหัสเครื่องมือ</th>
                <th className="px-5 py-3.5 font-semibold">ชื่อเครื่องมือ</th>
                <th className="px-5 py-3.5 font-semibold">อาการเสีย/ปัญหา</th>
                <th className="px-5 py-3.5 font-semibold">แผนก</th>
                <th className="px-5 py-3.5 font-semibold">ผู้แจ้ง / ลายเซ็นเปิดงาน</th>
                <th className="px-5 py-3.5 font-semibold">ผู้ตรวจสอบ/เซ็นปิดงาน</th>
                <th className="px-5 py-3.5 font-semibold">ช่าง</th>
                <th className="px-5 py-3.5 font-semibold">สถานะ</th>
                <th className="px-5 py-3.5 font-semibold text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayRepairs.map((repair, idx) => {
                const eq = equipment.find(e => e.id === repair.equipmentId);
                return (
                  <tr key={repair.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 text-center text-slate-400 font-mono text-xs">
                      {idx + 1}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap text-xs font-mono">
                      {formatDateSlash(repair.reportDate)}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono">{eq?.code || repair.equipmentCode || (repair.isNonRegistered ? 'นอกทะเบียน' : 'Unknown')}</span>
                        {repair.isNonRegistered && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-medium">
                            นอกทะเบียน
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-800">
                      <div>{eq?.name || repair.equipmentName || '-'}</div>
                      {(repair.model || eq?.model) && <div className="text-[11px] text-slate-400">{repair.model || eq?.model}</div>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 max-w-xs">
                      <p className="line-clamp-2 font-medium text-slate-800">{repair.issue}</p>
                      {repair.repairDetails && (
                        <div className="text-xs text-slate-500 mt-1 line-clamp-2 bg-slate-50 p-1.5 rounded border border-slate-100">
                          <span className="font-semibold text-amber-700">การดำเนินการ:</span> {repair.repairDetails}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap text-xs">
                      {repair.department || '-'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap text-xs">
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
                    <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap text-xs">
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
                    <td className="px-5 py-3.5 text-slate-700 whitespace-nowrap text-xs font-medium">
                      <span>{repair.technician || '-'}</span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
                        repair.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        repair.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {repair.status === 'completed' && <CheckCircle2 size={12} />}
                        {repair.status === 'in_progress' && <Clock size={12} />}
                        {repair.status === 'pending' && <AlertCircle size={12} />}
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
                      <p className="text-sm font-medium text-slate-700">
                        ไม่พบข้อมูลงานซ่อมในเดือน {thaiMonthName} {thaiYear} ตามเงื่อนไขที่เลือก
                      </p>
                      {onAddRepairClick && (
                        <button
                          onClick={onAddRepairClick}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium underline"
                        >
                          คลิกที่นี่เพื่อแจ้งซ่อมงานใหม่
                        </button>
                      )}
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
          <h1 className="text-2xl font-bold">รายงานสรุปงานซ่อมบำรุงเครื่องมือแพทย์ ประจำเดือน</h1>
          <p className="text-base font-medium mt-1">ประจำเดือน {thaiMonthName} พ.ศ. {thaiYear}</p>
          <p className="text-xs text-slate-500 mt-1">ระบบบริหารจัดการเครื่องมือแพทย์ โรงพยาบาล</p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6 border border-slate-300 p-4 rounded text-xs">
          <div><strong>งานแจ้งซ่อมทั้งหมด:</strong> {totalRepairs} งาน</div>
          <div><strong>ซ่อมเสร็จสิ้น:</strong> {completedRepairs} งาน ({completionRate}%)</div>
          <div><strong>กำลังดำเนินการ:</strong> {inProgressRepairs} งาน</div>
          <div><strong>รอดำเนินการ:</strong> {pendingRepairs} งาน</div>
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
            {monthlyRepairs.map((r, i) => {
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
                    {r.status === 'completed' ? 'เสร็จสิ้น' : r.status === 'in_progress' ? 'กำลังซ่อม' : 'รอดำเนินการ'}
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
