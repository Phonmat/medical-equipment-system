import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { Package, Wrench, AlertTriangle, CheckCircle, BarChart3, ChevronRight, CheckCircle2, Clock, AlertCircle, Calendar, ArrowUpRight } from 'lucide-react';
import { formatDateSlash } from '../utils/dateUtils';

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export default function DashboardView({ onNavigate }: { onNavigate?: (view: any) => void }) {
  const { equipment, repairs, decommissions } = useAppStore();

  const activeCount = equipment.filter(e => e.status === 'active').length;
  const repairingCount = equipment.filter(e => e.status === 'repairing').length;
  const decomCount = equipment.filter(e => e.status === 'decommissioned').length;

  // Monthly summary state for dashboard
  const today = new Date();
  const [dashMonth, setDashMonth] = useState<number>(today.getMonth());
  const [dashYear, setDashYear] = useState<number>(today.getFullYear());
  const hasAutoSelected = useRef(false);

  // Auto-select latest month with data if current month has no repairs
  useEffect(() => {
    if (hasAutoSelected.current || repairs.length === 0) return;
    const hasCurrentMonth = repairs.some(r => {
      if (!r.reportDate) return false;
      const parts = r.reportDate.split(/[-/]/);
      if (parts.length >= 2) {
        return parseInt(parts[0], 10) === today.getFullYear() && (parseInt(parts[1], 10) - 1) === today.getMonth();
      }
      return false;
    });

    if (!hasCurrentMonth) {
      let latestDateStr = '';
      repairs.forEach(r => {
        if (r.reportDate && r.reportDate > latestDateStr) {
          latestDateStr = r.reportDate;
        }
      });
      if (latestDateStr) {
        const parts = latestDateStr.split(/[-/]/);
        if (parts.length >= 2) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          if (!isNaN(y) && !isNaN(m)) {
            setDashYear(y);
            setDashMonth(m);
          }
        }
      }
    }
    hasAutoSelected.current = true;
  }, [repairs, today]);

  const availableYears = useMemo(() => {
    const currentYear = today.getFullYear();
    const years = new Set<number>([currentYear, currentYear - 1]);
    repairs.forEach(r => {
      if (r.reportDate) {
        const parts = r.reportDate.split(/[-/]/);
        const y = parseInt(parts[0], 10);
        if (!isNaN(y)) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [repairs, today]);

  // Filter repairs strictly by selected month & year (กรอบสีแดงที่ 1)
  const currentMonthRepairs = useMemo(() => {
    return repairs.filter(r => {
      if (!r.reportDate) return false;
      const parts = r.reportDate.split(/[-/]/);
      if (parts.length >= 2) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        if (!isNaN(y) && !isNaN(m)) {
          return y === dashYear && m === dashMonth;
        }
      }
      const d = new Date(r.reportDate);
      if (isNaN(d.getTime())) return false;
      return d.getFullYear() === dashYear && d.getMonth() === dashMonth;
    }).sort((a, b) => {
      const dateA = a.reportDate || '';
      const dateB = b.reportDate || '';
      return dateB.localeCompare(dateA);
    });
  }, [repairs, dashYear, dashMonth]);

  // Statistics for กรอบสีแดงที่ 2
  const monthTotal = currentMonthRepairs.length;
  const monthCompleted = currentMonthRepairs.filter(r => r.status === 'completed').length;
  const monthInProgress = currentMonthRepairs.filter(r => r.status === 'in_progress').length;
  const monthPending = currentMonthRepairs.filter(r => r.status === 'pending').length;
  const monthRate = monthTotal > 0 ? Math.round((monthCompleted / monthTotal) * 100) : 0;

  // Top departments for the month
  const topDepts = useMemo(() => {
    const map: Record<string, number> = {};
    currentMonthRepairs.forEach(r => {
      const dept = r.department || 'ไม่ระบุแผนก';
      map[dept] = (map[dept] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [currentMonthRepairs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-2xl font-bold text-slate-900">ภาพรวมระบบ (Dashboard)</h2>
        <span className="text-xs text-slate-500 font-medium">อัปเดตข้อมูลล่าสุดแบบเรียลไทม์</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div 
          onClick={() => onNavigate && onNavigate('equipment')}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
        >
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Package size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">เครื่องมือทั้งหมด</p>
            <p className="text-2xl font-bold text-slate-900">{equipment.length}</p>
          </div>
        </div>
        
        <div 
          onClick={() => onNavigate && onNavigate('equipment')}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4 cursor-pointer hover:shadow-md hover:border-emerald-300 transition-all"
        >
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">พร้อมใช้งาน</p>
            <p className="text-2xl font-bold text-slate-900">{activeCount}</p>
          </div>
        </div>

        <div 
          onClick={() => onNavigate && onNavigate('repairs')}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4 cursor-pointer hover:shadow-md hover:border-amber-300 transition-all"
        >
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Wrench size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">กำลังซ่อมบำรุง</p>
            <p className="text-2xl font-bold text-slate-900">{repairingCount}</p>
          </div>
        </div>

        <div 
          onClick={() => onNavigate && onNavigate('decommission')}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4 cursor-pointer hover:shadow-md hover:border-red-300 transition-all"
        >
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">จำหน่ายแล้ว</p>
            <p className="text-2xl font-bold text-slate-900">{decomCount}</p>
          </div>
        </div>
      </div>

      {/* Monthly Repair Summary Card on Dashboard (กรอบสีแดงที่ 2 เชื่อมโยงกับกรอบที่ 1) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <BarChart3 size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                สรุปงานซ่อมประจำเดือน
                <span className="text-xs font-semibold px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                  {THAI_MONTHS[dashMonth]} {dashYear + 543}
                </span>
              </h3>
              <p className="text-xs text-slate-500">สถิติและผลการดำเนินงานซ่อมบำรุงประจำเดือน</p>
            </div>
          </div>

          {/* กรอบสีแดงที่ 1: ตัวเลือก เดือน / ปี */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
              <Calendar size={14} className="text-slate-400 mr-1.5" />
              <select
                value={dashMonth}
                onChange={(e) => setDashMonth(Number(e.target.value))}
                className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer pr-1"
              >
                {THAI_MONTHS.map((m, idx) => (
                  <option key={idx} value={idx}>{m}</option>
                ))}
              </select>
              <select
                value={dashYear}
                onChange={(e) => setDashYear(Number(e.target.value))}
                className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>พ.ศ. {y + 543}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => onNavigate && onNavigate('monthly-summary')}
                className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-medium transition-all border border-blue-200"
              >
                <span>รายงานประจำเดือน</span>
                <ArrowUpRight size={13} />
              </button>

              <button
                onClick={() => onNavigate && onNavigate('yearly-summary')}
                className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium transition-all shadow-xs"
              >
                <span>รายงานประจำปี</span>
                <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Monthly Quick Stats (กรอบสีแดงที่ 2) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <span className="text-xs font-medium text-slate-500">แจ้งซ่อมในเดือนนี้</span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-2xl font-bold text-slate-900">{monthTotal}</span>
              <span className="text-xs text-slate-500">งาน</span>
            </div>
          </div>

          <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-800">ซ่อมเสร็จสิ้น</span>
              <CheckCircle2 size={14} className="text-emerald-600" />
            </div>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-2xl font-bold text-emerald-700">{monthCompleted}</span>
              <span className="text-xs text-emerald-600" style={{ fontFamily: 'Arial, sans-serif' }}>({monthRate}%)</span>
            </div>
          </div>

          <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-800">กำลังดำเนินการ</span>
              <Clock size={14} className="text-amber-600" />
            </div>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-2xl font-bold text-amber-700">{monthInProgress}</span>
              <span className="text-xs text-amber-600">งาน</span>
            </div>
          </div>

          <div className="bg-slate-100/80 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">รอดำเนินการ</span>
              <AlertCircle size={14} className="text-slate-500" />
            </div>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-2xl font-bold text-slate-700">{monthPending}</span>
              <span className="text-xs text-slate-500">งาน</span>
            </div>
          </div>
        </div>

        {/* Progress & Top Department Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-4 border-t border-slate-100 text-xs">
          <div>
            <div className="flex justify-between text-slate-600 font-medium mb-1.5">
              <span>ความคืบหน้าการปิดงานซ่อมประจำเดือน</span>
              <span className="text-emerald-700 font-bold">{monthRate}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full"
                style={{ width: `${monthTotal > 0 ? (monthCompleted / monthTotal) * 100 : 0}%` }}
              />
              <div
                className="bg-amber-500 h-full"
                style={{ width: `${monthTotal > 0 ? (monthInProgress / monthTotal) * 100 : 0}%` }}
              />
              <div
                className="bg-slate-400 h-full"
                style={{ width: `${monthTotal > 0 ? (monthPending / monthTotal) * 100 : 0}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">แผนกที่มีการแจ้งซ่อมมากที่สุด:</span>
            <div className="flex items-center gap-1.5 font-medium">
              {topDepts.length > 0 ? (
                topDepts.map(([dept, cnt]) => (
                  <span key={dept} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                    {dept} ({cnt})
                  </span>
                ))
              ) : (
                <span className="text-slate-400">ไม่มีข้อมูล</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Repairs Table (กรอบสีแดงที่ 3 แสดงข้อมูลงานซ่อมของเดือนที่กรอบสีแดงที่ 1 เลือก) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900">รายการงานซ่อมประจำเดือน</h3>
            <span className="text-xs font-semibold px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">
              {THAI_MONTHS[dashMonth]} {dashYear + 543}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              ({currentMonthRepairs.length} รายการ)
            </span>
          </div>
          <button 
            onClick={() => onNavigate && onNavigate('repairs')}
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-1"
          >
            <span>ดูงานซ่อมทั้งหมด</span>
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white z-10 shadow-2xs">
              <tr className="border-b border-slate-200 text-slate-500 text-xs">
                <th className="pb-3 font-semibold">รหัสเครื่องมือ</th>
                <th className="pb-3 font-semibold">อาการเสีย</th>
                <th className="pb-3 font-semibold">ผู้แจ้งซ่อม / แผนก</th>
                <th className="pb-3 font-semibold">วันที่แจ้ง</th>
                <th className="pb-3 font-semibold">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentMonthRepairs.map(repair => {
                const eq = equipment.find(e => e.id === repair.equipmentId);
                const code = eq?.code || repair.equipmentCode || 'ไม่ระบุรหัส';
                const reporter = repair.reportedBy || repair.department || '-';
                return (
                  <tr key={repair.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 text-slate-900 font-semibold text-xs font-mono">{code}</td>
                    <td className="py-3 text-slate-700 text-xs max-w-xs">{repair.issue}</td>
                    <td className="py-3 text-slate-600 text-xs">{reporter}</td>
                    <td className="py-3 text-slate-600 text-xs font-mono">{formatDateSlash(repair.reportDate)}</td>
                    <td className="py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        repair.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        repair.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {repair.status === 'completed' ? 'เสร็จสิ้น' : repair.status === 'in_progress' ? 'กำลังดำเนินการ' : 'รอดำเนินการ'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {currentMonthRepairs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    ไม่มีข้อมูลงานซ่อมในเดือน {THAI_MONTHS[dashMonth]} {dashYear + 543}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
