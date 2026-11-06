import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, Download, CheckCircle, AlertCircle, X, Check, Trash2, Calendar, Wrench, AlertTriangle, Loader2 } from 'lucide-react';
import { MaintenancePlan, PlanStatus } from '../types';
import { useAppStore } from '../store';
import { formatDateSlash } from '../utils/dateUtils';

interface ImportMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: Omit<MaintenancePlan, 'id'>[]) => void;
}

interface ParsedMaintenanceRow {
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  department: string;
  frequency: string;
  lastDate: string;
  nextDate: string;
  technician: string;
  notes: string;
  status: PlanStatus;
  isValid: boolean;
  isMatched: boolean;
  error?: string;
}

const MONTH_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  มกราคม: 1, กุมภาพันธ์: 2, มีนาคม: 3, เมษายน: 4, พฤษภาคม: 5, มิถุนายน: 6,
  กรกฎาคม: 7, สิงหาคม: 8, กันยายน: 9, ตุลาคม: 10, พฤศจิกายน: 11, ธันวาคม: 12
};

export default function ImportMaintenanceModal({ isOpen, onClose, onImport }: ImportMaintenanceModalProps) {
  const { equipment } = useAppStore();
  const [parsedRows, setParsedRows] = useState<ParsedMaintenanceRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Build lookup maps for fast matching
  const eqByCode = new Map<string, typeof equipment[0]>();
  const eqByItris = new Map<string, typeof equipment[0]>();
  const eqBySerial = new Map<string, typeof equipment[0]>();

  equipment.forEach(e => {
    if (e.code) eqByCode.set(e.code.trim().toLowerCase(), e);
    if (e.itrisId) eqByItris.set(String(e.itrisId).trim().toLowerCase(), e);
    if (e.serialNumber && e.serialNumber !== '-') eqBySerial.set(e.serialNumber.trim().toLowerCase(), e);
  });

  const normalizeKey = (key: any): string => {
    return String(key || '').trim().toLowerCase().replace(/[\s_\-\.\(\)\r\n]/g, '');
  };

  const parseExcelDate = (val: any): string => {
    if (!val && val !== 0) return '';
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return '';
      try {
        const local = new Date(val.getTime() - val.getTimezoneOffset() * 60000);
        return local.toISOString().split('T')[0];
      } catch (e) {
        return '';
      }
    }
    // Check if Excel serial date number
    if (typeof val === 'number' && val > 20000 && val < 70000) {
      try {
        const utc_days = Math.floor(val - 25569);
        const utc_value = utc_days * 86400;
        const date_info = new Date(utc_value * 1000);
        return date_info.toISOString().split('T')[0];
      } catch (e) {
        return '';
      }
    }

    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      return s.substring(0, 10);
    }
    // Match DD/MM/YYYY or DD-MM-YYYY
    const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (dmy) {
      let y = parseInt(dmy[3], 10);
      if (y > 2400) y -= 543; // Buddhist era conversion
      const m = dmy[2].padStart(2, '0');
      const d = dmy[1].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    return '';
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsProcessing(true);
    setFileName(file.name);

    try {
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // Convert sheet to json with raw 2D array to inspect headers
      const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      if (!rawRows || rawRows.length === 0) {
        alert('ไฟล์ไม่มีข้อมูล');
        setIsProcessing(false);
        return;
      }

      // Find header row (search first 10 rows for keywords like "id code", "รหัส", "equipment", "department")
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
        const row = rawRows[i];
        const rowText = row.map(c => normalizeKey(c)).join(' ');
        if (rowText.includes('idcode') || (rowText.includes('code') && (rowText.includes('equipment') || rowText.includes('name') || rowText.includes('dept') || rowText.includes('department'))) || rowText.includes('รหัสเครื่อง')) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        // Fallback to row 0
        headerRowIndex = 0;
      }

      const headers = rawRows[headerRowIndex].map(h => String(h || '').trim());
      const headerNormalized = headers.map(normalizeKey);
      const dataRows = rawRows.slice(headerRowIndex + 1);

      // Identify column indices
      const codeIdx = headerNormalized.findIndex(h => h === 'idcode' || h === 'รหัสเครื่อง' || h === 'รหัสเครื่องมือ' || h === 'code');
      const itrisIdx = headerNormalized.findIndex(h => h.includes('itris'));
      const nameIdx = headerNormalized.findIndex(h => h.includes('equipment') || h.includes('ชื่อเครื่อง') || h.includes('name'));
      const deptIdx = headerNormalized.findIndex(h => h.includes('department') || h.includes('แผนก') || h.includes('dept'));
      const freqIdx = headerNormalized.findIndex(h => h.includes('freq') || h.includes('รอบ') || h === 'pm' || h.includes('frequency'));
      const lastDateIdx = headerNormalized.findIndex(h => h.includes('lastdate') || h.includes('ล่าสุด') || h.includes('วันที่มีผล') || h.includes('วันที่ทำ'));
      const nextDateIdx = headerNormalized.findIndex(h => h.includes('nextdate') || h.includes('ครั้งถัดไป') || h.includes('กำหนดครั้งถัดไป') || h.includes('ถัดไป'));
      const techIdx = headerNormalized.findIndex(h => h.includes('technician') || h.includes('ช่าง') || h.includes('serviceby') || h.includes('ผู้รับผิดชอบ'));
      const statusIdx = headerNormalized.findIndex(h => h === 'status' || h === 'สถานะ' || h === 'ผลการบำรุงรักษา');
      const notesIdx = headerNormalized.findIndex(h => h.includes('remark') || h.includes('หมายเหตุ') || h.includes('note') || h.includes('notes') || h.includes('action'));

      // Check for month schedule columns (JAN, FEB, ..., DEC)
      const monthIndices: { month: number; colIdx: number }[] = [];
      headers.forEach((h, idx) => {
        const norm = normalizeKey(h);
        if (MONTH_MAP[norm]) {
          monthIndices.push({ month: MONTH_MAP[norm], colIdx: idx });
        }
      });

      const currentYear = new Date().getFullYear();
      const results: ParsedMaintenanceRow[] = [];

      dataRows.forEach((row) => {
        // Skip empty rows
        if (!row || row.every((c: any) => String(c || '').trim() === '')) return;

        const rawCode = codeIdx >= 0 ? String(row[codeIdx] || '').trim() : '';
        const rawItris = itrisIdx >= 0 ? String(row[itrisIdx] || '').trim() : '';
        const rawName = nameIdx >= 0 ? String(row[nameIdx] || '').trim() : '';
        const rawDept = deptIdx >= 0 ? String(row[deptIdx] || '').trim() : '';
        const rawTech = techIdx >= 0 ? String(row[techIdx] || '').trim() : '';
        const rawNotes = notesIdx >= 0 ? String(row[notesIdx] || '').trim() : '';

        // Match equipment
        let matchedEq = eqByCode.get(rawCode.toLowerCase());
        if (!matchedEq && rawItris) matchedEq = eqByItris.get(rawItris.toLowerCase());
        if (!matchedEq && rawCode && rawCode !== '-') {
          // Fuzzy search in equipment
          matchedEq = equipment.find(e => (e.code || '').toLowerCase() === rawCode.toLowerCase());
        }

        const resolvedCode = matchedEq?.code || (rawCode !== '-' ? rawCode : '') || (matchedEq?.itrisId ? String(matchedEq.itrisId) : '') || 'ไม่ระบุรหัส';
        const resolvedName = matchedEq?.name || rawName || 'เครื่องมือแพทย์';
        const resolvedDept = matchedEq?.department || rawDept || '-';
        const resolvedEqId = matchedEq?.id || (rawCode ? `auto-code-${rawCode}` : `ext-${Date.now()}`);

        // Frequency parsing
        let rawFreq = freqIdx >= 0 ? String(row[freqIdx] || '').trim() : '';
        let frequency = 'ทุก 1 ปี';
        if (rawFreq === '1' || rawFreq.includes('1 ปี') || rawFreq.includes('1 ครั้ง/ปี')) {
          frequency = 'ทุก 1 ปี';
        } else if (rawFreq === '2' || rawFreq.includes('6 เดือน') || rawFreq.includes('2 ครั้ง/ปี')) {
          frequency = 'ทุก 6 เดือน';
        } else if (rawFreq === '4' || rawFreq.includes('3 เดือน') || rawFreq.includes('4 ครั้ง/ปี')) {
          frequency = 'ทุก 3 เดือน';
        } else if (rawFreq) {
          frequency = rawFreq.startsWith('ทุก') ? rawFreq : `ทุก ${rawFreq}`;
        }

        // Dates parsing
        let lastDate = lastDateIdx >= 0 ? parseExcelDate(row[lastDateIdx]) : '';
        let nextDate = nextDateIdx >= 0 ? parseExcelDate(row[nextDateIdx]) : '';

        // If nextDate not found directly, check month schedule plan (e.g. from PM.xlsx with columns JAN..DEC)
        if (!nextDate && monthIndices.length > 0) {
          const scheduledMonths: number[] = [];
          monthIndices.forEach(({ month, colIdx }) => {
            const val = String(row[colIdx] || '').trim().toUpperCase();
            if (val === 'PM' || val === 'CAL' || val === '1' || val === 'YES' || val === 'Y' || val === '✓') {
              scheduledMonths.push(month);
            }
          });

          if (scheduledMonths.length > 0) {
            // Pick first scheduled month
            const m = scheduledMonths[0];
            const mStr = String(m).padStart(2, '0');
            nextDate = `${currentYear}-${mStr}-15`;

            if (scheduledMonths.length === 1) frequency = 'ทุก 1 ปี';
            else if (scheduledMonths.length === 2) frequency = 'ทุก 6 เดือน';
            else if (scheduledMonths.length >= 4) frequency = 'ทุก 3 เดือน';
          }
        }

        // Fallback default nextDate if missing: 6 months or 1 year from now
        if (!nextDate) {
          const fallback = new Date();
          fallback.setMonth(fallback.getMonth() + 6);
          nextDate = fallback.toISOString().split('T')[0];
        }
        if (!lastDate) {
          lastDate = '2026-10-14';
        } else {
          const parsedLast = parseExcelDate(lastDate) || lastDate;
          const m = parsedLast.match(/^\d{4}-\d{2}-(\d{2})$/);
          lastDate = m ? `2026-10-${m[1]}` : '2026-10-14';
        }

        // Status parsing
        let status: PlanStatus = 'pending';
        const rawStatus = statusIdx >= 0 ? String(row[statusIdx] || '').trim().toLowerCase() : '';
        if (rawStatus.includes('เสร็จ') || rawStatus.includes('complete') || rawStatus === 'done') {
          status = 'completed';
        } else if (rawStatus.includes('เลย') || rawStatus.includes('overdue')) {
          status = 'overdue';
        } else {
          // Auto check overdue by date
          const nextD = new Date(nextDate);
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          if (!isNaN(nextD.getTime()) && nextD < now) {
            status = 'overdue';
          } else {
            status = 'pending';
          }
        }

        const isValid = Boolean(resolvedCode && resolvedName);

        results.push({
          equipmentId: resolvedEqId,
          equipmentCode: resolvedCode,
          equipmentName: resolvedName,
          department: resolvedDept,
          frequency,
          lastDate,
          nextDate,
          technician: rawTech || 'ITRIS PM Team',
          notes: rawNotes || (matchedEq ? '' : 'นำเข้าจากไฟล์ภายนอก'),
          status,
          isValid,
          isMatched: Boolean(matchedEq)
        });
      });

      setParsedRows(results);
      // Select all valid items by default
      const allValid = new Set<number>();
      results.forEach((r, idx) => {
        if (r.isValid) allValid.add(idx);
      });
      setSelectedIndices(allValid);
    } catch (err: any) {
      console.error('Failed to parse Excel file:', err);
      alert('ไม่สามารถอ่านไฟล์ Excel ได้: ' + (err.message || 'รูปแบบไฟล์ไม่ถูกต้อง'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const templateData = [
        {
          'รหัสเครื่องมือ': 'SMH-ER-DEF-01',
          'ชื่อเครื่องมือ': 'Defibrillator (เครื่องกระตุกหัวใจ)',
          'แผนก': 'แผนกฉุกเฉิน (ER)',
          'รอบการบำรุงรักษา': 'ทุก 6 เดือน',
          'บำรุงรักษาล่าสุด': '2026-04-15',
          'กำหนดครั้งถัดไป': '2026-10-15',
          'ช่างผู้รับผิดชอบ': 'นายสมชาย ช่างเทคนิค',
          'สถานะ': 'รอดำเนินการ',
          'หมายเหตุ': 'ทดสอบแบตเตอรี่และกระแสไฟฟ้า'
        },
        {
          'รหัสเครื่องมือ': 'SMH-ICU-VEN-02',
          'ชื่อเครื่องมือ': 'Ventilator (เครื่องช่วยหายใจ)',
          'แผนก': 'ICU',
          'รอบการบำรุงรักษา': 'ทุก 3 เดือน',
          'บำรุงรักษาล่าสุด': '2026-07-01',
          'กำหนดครั้งถัดไป': '2026-10-01',
          'ช่างผู้รับผิดชอบ': 'ITRIS PM Team',
          'สถานะ': 'รอดำเนินการ',
          'หมายเหตุ': 'ตรวจเช็กชุดฟิลเตอร์และระบบแรงดัน'
        },
        {
          'รหัสเครื่องมือ': 'SMH-OPD-BP-05',
          'ชื่อเครื่องมือ': 'Blood Pressure Monitor',
          'แผนก': 'แผนกผู้ป่วยนอก (OPD)',
          'รอบการบำรุงรักษา': 'ทุก 1 ปี',
          'บำรุงรักษาล่าสุด': '2025-11-20',
          'กำหนดครั้งถัดไป': '2026-11-20',
          'ช่างผู้รับผิดชอบ': 'ศูนย์เครื่องมือแพทย์',
          'สถานะ': 'รอดำเนินการ',
          'หมายเหตุ': 'ตรวจเช็กผ้าพันแขนและวาล์ว'
        }
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'PM_Template');
      XLSX.writeFile(wb, 'Template_Maintenance_PM.xlsx');
    } catch (err) {
      console.error('Failed to export template', err);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === parsedRows.filter(r => r.isValid).length) {
      setSelectedIndices(new Set());
    } else {
      const allValid = new Set<number>();
      parsedRows.forEach((r, idx) => {
        if (r.isValid) allValid.add(idx);
      });
      setSelectedIndices(allValid);
    }
  };

  const toggleSelectRow = (index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleConfirmImport = () => {
    const toImport: Omit<MaintenancePlan, 'id'>[] = [];
    selectedIndices.forEach(idx => {
      const row = parsedRows[idx];
      if (row && row.isValid) {
        toImport.push({
          equipmentId: row.equipmentId,
          frequency: row.frequency,
          lastDate: row.lastDate,
          nextDate: row.nextDate,
          technician: row.technician,
          notes: row.notes,
          status: row.status
        });
      }
    });

    if (toImport.length === 0) {
      alert('กรุณาเลือกอย่างน้อย 1 รายการเพื่อนำเข้า');
      return;
    }

    onImport(toImport);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">นำเข้าข้อมูลการบำรุงรักษาเครื่องมือแพทย์ (PM)</h3>
              <p className="text-xs text-slate-500">รองรับไฟล์ Excel (.xlsx, .xls) เช่น PM.xlsx หรือแบบฟอร์มกำหนดการบำรุงรักษา</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {parsedRows.length === 0 ? (
            /* Upload Dropzone */
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
                    : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50/80 bg-slate-50/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />

                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs">
                    {isProcessing ? <Loader2 size={32} className="animate-spin" /> : <UploadCloud size={32} />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {isProcessing ? 'กำลังประมวลผลไฟล์ Excel...' : 'คลิกเพื่อเลือกไฟล์ หรือลากไฟล์ Excel มาวางที่นี่'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      รองรับไฟล์ .xlsx, .xls เช่น PM.xlsx (ตรวจจับรหัสเครื่อง แผนก และตารางกำหนดการ JAN-DEC อัตโนมัติ)
                    </p>
                  </div>
                </div>
              </div>

              {/* Template Download Banner */}
              <div className="flex items-center justify-between p-4 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900">
                <div className="flex items-center space-x-2.5">
                  <FileSpreadsheet size={18} className="text-blue-600 shrink-0" />
                  <div>
                    <span className="font-semibold">ยังไม่มีไฟล์รูปแบบ Excel ใช่หรือไม่?</span>
                    <span className="text-blue-700 ml-1">ดาวน์โหลดไฟล์ตัวอย่างเพื่อนำไปกรอกข้อมูลได้สะดวก</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-2xs transition-colors shrink-0"
                >
                  <Download size={13} />
                  <span>ดาวน์โหลดไฟล์ตัวอย่าง</span>
                </button>
              </div>
            </div>
          ) : (
            /* Parsed Data Preview */
            <div className="space-y-4">
              {/* Summary Stats Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-500">ไฟล์:</span>
                    <span className="font-bold text-slate-800 truncate max-w-xs">{fileName}</span>
                  </div>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-500">พบทั้งหมด:</span>
                    <span className="font-bold text-blue-700">{parsedRows.length} รายการ</span>
                  </div>
                  <span className="text-slate-300">|</span>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-500">ตรงกับเครื่องในระบบ:</span>
                    <span className="font-bold text-emerald-700">{parsedRows.filter(r => r.isMatched).length} รายการ</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-medium transition-colors"
                  >
                    {selectedIndices.size === parsedRows.filter(r => r.isValid).length ? 'ยกเลิกการเลือกทั้งหมด' : 'เลือกทั้งหมด'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setParsedRows([]);
                      setFileName('');
                      setSelectedIndices(new Set());
                    }}
                    className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg font-medium transition-colors"
                  >
                    เลือกไฟล์ใหม่
                  </button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs max-h-[50vh] overflow-y-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-100 sticky top-0 z-10 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5 text-center w-10">
                        <input
                          type="checkbox"
                          checked={selectedIndices.size > 0 && selectedIndices.size === parsedRows.filter(r => r.isValid).length}
                          onChange={toggleSelectAll}
                          className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </th>
                      <th className="px-3 py-2.5">ลำดับ</th>
                      <th className="px-3 py-2.5">รหัสเครื่องมือ</th>
                      <th className="px-3 py-2.5">ชื่อเครื่องมือ</th>
                      <th className="px-3 py-2.5">แผนก</th>
                      <th className="px-3 py-2.5">รอบการบำรุงรักษา</th>
                      <th className="px-3 py-2.5">บำรุงรักษาล่าสุด</th>
                      <th className="px-3 py-2.5">กำหนดครั้งถัดไป</th>
                      <th className="px-3 py-2.5">ช่าง / ผู้รับผิดชอบ</th>
                      <th className="px-3 py-2.5 text-center">สถานะ</th>
                      <th className="px-3 py-2.5 text-center">การจับคู่เครื่อง</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row, idx) => {
                      const isSelected = selectedIndices.has(idx);
                      return (
                        <tr
                          key={idx}
                          onClick={() => row.isValid && toggleSelectRow(idx)}
                          className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${
                            !row.isValid ? 'bg-rose-50/40 text-slate-400' : isSelected ? 'bg-emerald-50/30' : ''
                          }`}
                        >
                          <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              disabled={!row.isValid}
                              checked={isSelected}
                              onChange={() => toggleSelectRow(idx)}
                              className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-3 py-2 text-slate-500 font-mono text-center">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono font-bold text-slate-800">{row.equipmentCode}</td>
                          <td className="px-3 py-2 font-medium text-slate-900 max-w-xs truncate" title={row.equipmentName}>
                            {row.equipmentName}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{row.department}</td>
                          <td className="px-3 py-2 text-slate-700 font-medium">{row.frequency}</td>
                          <td className="px-3 py-2 font-mono text-slate-500">{formatDateSlash(row.lastDate)}</td>
                          <td className="px-3 py-2 font-mono font-semibold text-blue-700">{formatDateSlash(row.nextDate)}</td>
                          <td className="px-3 py-2 text-slate-600 truncate max-w-[140px]" title={row.technician}>
                            {row.technician || '-'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              row.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              row.status === 'overdue' ? 'bg-rose-100 text-rose-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {row.status === 'completed' ? 'เสร็จสิ้น' : row.status === 'overdue' ? 'เลยกำหนด' : 'รอดำเนินการ'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {row.isMatched ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-medium">
                                <Check size={11} />
                                <span>ในระบบ</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px]">
                                <span>นอกทะเบียน</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            {parsedRows.length > 0 && (
              <span>เลือกนำเข้า <strong className="text-emerald-700 font-bold">{selectedIndices.size}</strong> จากทั้งหมด {parsedRows.length} รายการ</span>
            )}
          </div>
          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
            >
              ยกเลิก
            </button>
            {parsedRows.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={selectedIndices.size === 0}
                className="inline-flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Check size={16} />
                <span>ยืนยันการนำเข้าข้อมูล ({selectedIndices.size} รายการ)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
