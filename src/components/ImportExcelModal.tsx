import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, Download, CheckCircle, AlertCircle, X, Check, Trash2 } from 'lucide-react';
import { Equipment } from '../types';
import { extractWarrantyYears, formatWarrantyDisplay, formatWarrantyDateRange, formatDateSlash, formatPurchasePrice, formatCellText, isNumericPrice, parseDateString, splitWarrantyDateRange } from '../utils/dateUtils';

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (items: Omit<Equipment, 'id'>[]) => void;
}

interface ParsedRow {
  itemNo?: number | string;
  department: string;
  code: string;
  itrisId: string;
  name: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  riskLevel: 'High' | 'Medium' | 'Low';
  purchaseDate: string;
  installationDate?: string;
  registrationDate?: string;
  warrantyPeriod?: string;
  warrantyYears?: string;
  purchase: string;
  vendorCompany?: string;
  isValid: boolean;
  error?: string;
}

export default function ImportExcelModal({ isOpen, onClose, onImport }: ImportExcelModalProps) {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const normalizeKey = (key: string): string => {
    return key.toString().trim().toLowerCase().replace(/[\s_\-\.\(\)]/g, '');
  };

  const parseRiskLevel = (val: any): 'High' | 'Medium' | 'Low' => {
    if (!val) return 'Low';
    const s = String(val).trim().toLowerCase();
    if (s.includes('high') || s.includes('สูง') || s.includes('3') || s === 'h') return 'High';
    if (s.includes('med') || s.includes('กลาง') || s.includes('2') || s === 'm') return 'Medium';
    return 'Low';
  };

  const formatDate = (val: any): string => {
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
    
    // Check if Excel serial date number (e.g., 44500 to 55000 is years ~2021 to 2050)
    if (typeof val === 'number' && val > 20000 && val < 70000) {
      try {
        const utc_days = Math.floor(val - 25569);
        const utc_value = utc_days * 86400;
        const date_info = new Date(utc_value * 1000);
        if (!isNaN(date_info.getTime())) {
          return date_info.toISOString().split('T')[0];
        }
      } catch (e) {
        // fallback
      }
    }

    const str = String(val).trim();
    if (!str || str === '-' || str === '/' || str === '//' || !/\d/.test(str) || /^[0\/\-\.\s#]+$/.test(str)) return '';

    const parsed = parseDateString(str);
    if (parsed && /^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
      return parsed;
    }

    return str;
  };

  const formatRawWarrantyField = (val: any): string => {
    if (val === undefined || val === null) return '';
    if (val instanceof Date) {
      return formatDate(val);
    }
    if (typeof val === 'number' && val > 20000 && val < 70000) {
      return formatDate(val);
    }
    const str = String(val).trim();
    if (!str || str === '-' || str === '/' || str === '//' || /^[0\/\-\.\s#]+$/.test(str)) return '';
    return str;
  };

  const handleFile = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert('กรุณาเลือกไฟล์เอกสาร Excel (.xlsx, .xls หรือ .csv) เท่านั้น');
      return;
    }

    setIsProcessing(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const buffer = e.target?.result as ArrayBuffer;
        let workbook: any;
        if (file.name.toLowerCase().endsWith('.csv')) {
          const text = new TextDecoder('utf-8').decode(buffer);
          workbook = XLSX.read(text, { type: 'string', raw: true });
        } else {
          const data = new Uint8Array(buffer);
          workbook = XLSX.read(data, { type: 'array', cellDates: true });
        }
        
        // Find best sheet (sheet with highest row count or first non-empty)
        let chosenSheet: any = null;
        let maxRows = 0;

        for (const sName of workbook.SheetNames) {
          const s = workbook.Sheets[sName];
          if (s && s['!ref']) {
            const raw = XLSX.utils.sheet_to_json<any[]>(s, { header: 1, blankrows: false });
            if (raw.length > maxRows) {
              maxRows = raw.length;
              chosenSheet = s;
            }
          }
        }

        if (!chosenSheet) {
          chosenSheet = workbook.Sheets[workbook.SheetNames[0]];
        }

        if (!chosenSheet) {
          alert('ไม่พบข้อมูลแผ่นงานในไฟล์ Excel ที่เลือก');
          setIsProcessing(false);
          return;
        }

        // Get 2D rows
        const rawGrid: any[][] = XLSX.utils.sheet_to_json(chosenSheet, { header: 1, blankrows: false, defval: '' });

        if (!rawGrid || rawGrid.length === 0) {
          alert('ไม่พบแถวข้อมูลในไฟล์ Excel ที่เลือก');
          setIsProcessing(false);
          return;
        }

        // Auto-detect header row (scan up to first 12 rows)
        let headerRowIndex = -1;
        let headerColMap: { [key: string]: number } = {};
        let highestHeaderScore = 0;

        const knownHeaderKeywords = [
          'itemno', 'item', 'no', 'department', 'dept', 'idcode', 'code', 'eqcode', 'itrisid', 'itnsid', 'itris', 'itns',
          'equipmentenglish', 'equipment', 'name', 'manufacturer', 'brand', 'model', 'serialnumber',
          'serial', 'sn', 'risklevels', 'risklevel', 'risk', 'purchasedate', 'installationdate', 'installdate',
          'inventorydate', 'warrantyrange', 'warrantyyears', 'warranty', 'purchase', 'price', 'cost',
          'equipmentvendor', 'vendor', 'ลำดับ', 'แผนก', 'รหัส', 'ชื่อ', 'ผู้ผลิต', 'รุ่น', 'ความเสี่ยง',
          'ราคา', 'ราคาซื้อ', 'ราคาซื้อเครื่อง', 'ผู้แทนจำหน่าย', 'ตัวแทนจำหน่าย', 'ผู้จัดจำหน่าย', 'บริษัท'
        ];

        for (let r = 0; r < Math.min(rawGrid.length, 12); r++) {
          const rowCells = rawGrid[r] || [];
          let score = 0;
          const currentMap: { [key: string]: number } = {};

          rowCells.forEach((cellVal, colIdx) => {
            const norm = normalizeKey(String(cellVal || ''));
            if (!norm) return;
            for (const kw of knownHeaderKeywords) {
              if (norm.includes(kw) || kw.includes(norm)) {
                score++;
                currentMap[norm] = colIdx;
                break;
              }
            }
          });

          if (score >= 2 && score > highestHeaderScore) {
            highestHeaderScore = score;
            headerRowIndex = r;
            headerColMap = currentMap;
          }
        }

        // Build parsed rows
        const startDataRow = headerRowIndex >= 0 ? headerRowIndex + 1 : 0;
        const parsedResults: ParsedRow[] = [];

        // Helper to find column index from header map with exact-first priority and column exclusions
        const findCol = (excludeCols: number[], ...keywords: string[]): number => {
          for (const kw of keywords) {
            for (const [normHeader, colIdx] of Object.entries(headerColMap)) {
              if (excludeCols.includes(colIdx)) continue;
              if (normHeader === kw) {
                return colIdx;
              }
            }
          }
          for (const kw of keywords) {
            for (const [normHeader, colIdx] of Object.entries(headerColMap)) {
              if (excludeCols.includes(colIdx)) continue;
              if (normHeader.includes(kw)) {
                return colIdx;
              }
            }
          }
          return -1;
        };

        const colItemNo = findCol([], 'itemno', 'item', 'ลำดับ', 'no', 'ที่');
        const colDept = findCol([colItemNo], 'department', 'dept', 'แผนก', 'หน่วยงาน', 'ฝ่าย');
        const colCode = findCol([colItemNo, colDept], 'idcode', 'eqcode', 'รหัสเครื่องมือ', 'รหัสเครื่อง', 'รหัสครุภัณฑ์', 'เลขครุภัณฑ์', 'code', 'รหัส');
        const colItris = findCol([colItemNo, colDept, colCode], 'itrisid', 'itnsid', 'itris', 'itns', 'itrid');
        const colVendor = findCol([colItemNo, colDept, colCode, colItris], 'equipmentvendor', 'vendorcompany', 'ผู้แทนจำหน่าย', 'ตัวแทนจำหน่าย', 'ผู้จัดจำหน่าย', 'ผู้ขาย', 'vendor', 'บริษัท');
        const colEquip = findCol([colItemNo, colDept, colCode, colItris, colVendor], 'equipmentenglish', 'equipmentชื่อเครื่องมือ', 'equipmentname', 'ชื่อเครื่องมือ', 'ชื่ออุปกรณ์', 'equipment', 'รายการ', 'name', 'ชื่อ');
        const colManuf = findCol([colItemNo, colDept, colCode, colItris, colVendor, colEquip], 'manufacturer', 'brand', 'make', 'ผู้ผลิต', 'ยี่ห้อ', 'แบรนด์');
        const colModel = findCol([colItemNo, colDept, colCode, colItris, colVendor, colEquip, colManuf], 'model', 'type', 'รุ่น');
        const colSN = findCol([colItemNo, colDept, colCode, colItris, colVendor, colEquip, colManuf, colModel], 'serialnumber', 'serial', 'sn', 'หมายเลขเครื่อง', 'ซีเรียล', 'เลขเครื่อง');
        const colRisk = findCol([], 'risklevels', 'risklevel', 'ระดับความเสี่ยง', 'ความเสี่ยง', 'risk', 'ระดับ');
        const colPurchaseDate = findCol([], 'purchasedate', 'วันที่จัดซื้อ', 'วันที่ซื้อ');
        const colInstallDate = findCol([colPurchaseDate], 'installationdate', 'installdate', 'วันที่ติดตั้ง', 'install', 'ติดตั้ง');
        const colInventoryDate = findCol([colPurchaseDate, colInstallDate], 'inventorydate', 'registrationdate', 'วันขึ้นทะเบียน', 'ขึ้นทะเบียน', 'ตรวจรับ', 'inventory');
        const colWarrantyYears = findCol([colPurchaseDate, colInstallDate, colInventoryDate], 'warrantyyears', 'warrantyปีการรับประกัน', 'ปีการรับประกัน', 'ปีรับประกัน', 'warrantyปี');
        const colWarrantyRange = findCol([colPurchaseDate, colInstallDate, colInventoryDate, colWarrantyYears], 'warrantyrange', 'warrantyวันที่รับประกัน', 'วันที่รับประกัน', 'ระยะเวลารับประกัน');
        const colWarranty = colWarrantyRange >= 0 ? colWarrantyRange : findCol([colPurchaseDate, colInstallDate, colInventoryDate, colWarrantyYears], 'warranty', 'warrantyperiod', 'ประกัน', 'รับประกัน');
        const colPurchase = findCol([colPurchaseDate, colInstallDate, colInventoryDate, colWarranty, colWarrantyYears, colVendor], 'purchaseราคา', 'ราคาซื้อเครื่อง', 'ราคาซื้อ', 'ราคา', 'purchase', 'price', 'cost', 'มูลค่า');

        for (let r = startDataRow; r < rawGrid.length; r++) {
          const row = rawGrid[r];
          if (!row || row.length === 0) continue;

          // Check if row is completely empty
          const hasAnyValue = row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== '');
          if (!hasAnyValue) continue;

          // Check if row is a total/summary row
          const firstCellStr = String(row[0] || '').trim().toLowerCase();
          if (firstCellStr.includes('รวม') || firstCellStr.includes('total') || firstCellStr.includes('summary')) {
            continue;
          }

          const getCellVal = (explicitCol: number, fallbackCol: number): any => {
            if (explicitCol >= 0 && row[explicitCol] !== undefined) {
              return row[explicitCol];
            }
            if (fallbackCol >= 0 && row[fallbackCol] !== undefined) {
              return row[fallbackCol];
            }
            return '';
          };

          const rawItemNo = getCellVal(colItemNo, 0);
          const rawDept = getCellVal(colDept, 1);
          const rawCode = getCellVal(colCode, 2);
          const rawItris = getCellVal(colItris, 3);
          const rawEquip = getCellVal(colEquip, 4);
          const rawManuf = getCellVal(colManuf, 5);
          const rawModel = getCellVal(colModel, 6);
          const rawSN = getCellVal(colSN, 7);
          const rawRisk = getCellVal(colRisk, 8);
          const rawPurchaseDate = getCellVal(colPurchaseDate, 9);
          const rawInstallDate = getCellVal(colInstallDate, 10);
          const rawInventoryDate = getCellVal(colInventoryDate, 11);
          const rawWarranty = getCellVal(colWarranty, 12);
          const rawWarrantyYears = colWarrantyYears >= 0 ? getCellVal(colWarrantyYears, 13) : '';
          const rawPurchase = getCellVal(colPurchase, colWarrantyYears >= 0 ? 14 : 13);
          const rawVendor = getCellVal(colVendor, colWarrantyYears >= 0 ? 15 : 14);

          const itemNo = rawItemNo ? String(rawItemNo).trim() : parsedResults.length + 1;
          const department = String(rawDept || '').trim();
          let code = String(rawCode || '').trim();
          const itrisId = String(rawItris || '').trim();
          let name = String(rawEquip || '').trim();
          const manufacturer = String(rawManuf || '').trim();
          const model = String(rawModel || '').trim();
          const serialNumber = String(rawSN || '').trim();
          const riskLevel = parseRiskLevel(rawRisk);
          const purchaseDate = formatDate(rawPurchaseDate);
          const installationDate = formatDate(rawInstallDate);
          const registrationDate = formatDate(rawInventoryDate);
          const warrantyPeriod = formatRawWarrantyField(rawWarranty);
          const rawYearsStr = String(rawWarrantyYears ?? '').trim();
          const warrantyYears = (rawYearsStr && rawYearsStr !== '-')
            ? (extractWarrantyYears(rawYearsStr) || rawYearsStr)
            : extractWarrantyYears(warrantyPeriod);
          
          let purchase = rawPurchase instanceof Date ? '' : String(rawPurchase ?? '').trim();
          let vendorCompany = String(rawVendor || '').trim();

          // Auto-swap if vendorCompany has numeric price and purchase is empty or company name
          if (isNumericPrice(vendorCompany) && (!purchase || !isNumericPrice(purchase) || /^(?:บริษัท|บจก|หจก|บมจ)/.test(purchase))) {
            const temp = purchase;
            purchase = vendorCompany;
            vendorCompany = temp && !isNumericPrice(temp) ? temp : '';
          }

          if (purchase) {
            const formatted = formatPurchasePrice(purchase);
            purchase = formatted === '-' ? '' : formatted;
          }

          // Preserve '-' if code is missing in file when name exists
          if (!code && name) {
            code = '-';
          }

          const isValid = !!(code && name);
          const error = !code ? 'ไม่พบ ID CODE (รหัสเครื่องมือ)' : (!name ? 'ไม่พบ Equipment (ชื่อเครื่องมือ)' : undefined);

          parsedResults.push({
            itemNo,
            department,
            code,
            itrisId,
            name,
            manufacturer,
            model,
            serialNumber,
            riskLevel,
            purchaseDate,
            installationDate,
            registrationDate,
            warrantyPeriod,
            warrantyYears,
            purchase,
            vendorCompany,
            isValid,
            error
          });
        }

        if (parsedResults.length === 0) {
          alert('ไม่พบแถวข้อมูลที่สามารถนำเข้าได้ในไฟล์ที่เลือก');
          setIsProcessing(false);
          return;
        }

        setParsedRows(parsedResults);
        // Select all valid rows by default
        const validIndices = new Set<number>();
        parsedResults.forEach((r, idx) => {
          if (r.isValid) validIndices.add(idx);
        });
        setSelectedIndices(validIndices);
      } catch (err) {
        console.error('Failed to parse Excel file:', err);
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์ Excel กรุณาตรวจสอบรูปแบบไฟล์');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const templateData = [
      {
        'Item No.': 1,
        'Department': 'แผนกฉุกเฉิน (ER)',
        'ID CODE': 'EQ-MED-009',
        'Itris ID': 'ITR-00891',
        'Equipment(English)': 'Defibrillator (AED)',
        'Manufacturer': 'Philips',
        'Model': 'HeartStart FRx',
        'Serial number': 'PH-889921',
        'Risk Levels': 'High',
        'Purchase Date': '2025/02/10',
        'Installation date': '2025/02/15',
        'Inventory Date': '2025/02/12',
        'Warranty (วันที่รับประกัน)': '2025/02/15 ถึง 2026/02/15',
        'Purchase': '85,000 บาท',
        'Equipment  Vendor': 'บริษัท ฟิลิปส์ เมดิคอล เซอร์วิส จำกัด'
      },
      {
        'Item No.': 2,
        'Department': 'แผนกผู้ป่วยนอก (OPD)',
        'ID CODE': 'EQ-MED-010',
        'Itris ID': 'ITR-00902',
        'Equipment(English)': 'Automated Blood Pressure Monitor',
        'Manufacturer': 'Omron',
        'Model': 'HBP-1320',
        'Serial number': 'OM-441203',
        'Risk Levels': 'Low',
        'Purchase Date': '2024/11/15',
        'Installation date': '2024/11/20',
        'Inventory Date': '2024/11/18',
        'Warranty (วันที่รับประกัน)': '2024/11/20 ถึง 2026/11/20',
        'Purchase': '18,500 บาท',
        'Equipment  Vendor': 'บริษัท ออมรอน เฮลท์แคร์ จำกัด'
      },
      {
        'Item No.': 3,
        'Department': 'หอผู้ป่วยวิกฤต (ICU)',
        'ID CODE': 'EQ-MED-011',
        'Itris ID': 'ITR-00915',
        'Equipment(English)': 'Infusion Pump',
        'Manufacturer': 'Terumo',
        'Model': 'TE-112',
        'Serial number': 'TR-553210',
        'Risk Levels': 'Medium',
        'Purchase Date': '2025/01/20',
        'Installation date': '2025/01/25',
        'Inventory Date': '2025/01/22',
        'Warranty (วันที่รับประกัน)': '2025/01/25 ถึง 2026/01/25',
        'Purchase': '45,000 บาท',
        'Equipment  Vendor': 'บริษัท เทอรูโม เซอร์วิสเซส จำกัด'
      },
      {
        'Item No.': 4,
        'Department': 'ห้องผ่าตัด (OR)',
        'ID CODE': 'EQ-MED-012',
        'Itris ID': 'ITR-00933',
        'Equipment(English)': 'Patient Monitor 7 Parameters',
        'Manufacturer': 'Mindray',
        'Model': 'ePM 12M',
        'Serial number': 'MR-773419',
        'Risk Levels': 'High',
        'Purchase Date': '2024/09/05',
        'Installation date': '2024/09/10',
        'Inventory Date': '2024/09/08',
        'Warranty (วันที่รับประกัน)': '2024/09/10 ถึง 2026/09/10',
        'Purchase': '145,000 บาท',
        'Equipment  Vendor': 'บริษัท มายด์เรย์ เมดิคอล ประเทศไทย จำกัด'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // Set column widths matching exactly the 15 headers
    worksheet['!cols'] = [
      { wch: 10 }, // Item No.
      { wch: 24 }, // Department
      { wch: 16 }, // ID CODE
      { wch: 14 }, // Itris ID
      { wch: 34 }, // Equipment(English)
      { wch: 18 }, // Manufacturer
      { wch: 18 }, // Model
      { wch: 18 }, // Serial number
      { wch: 14 }, // Risk Levels
      { wch: 16 }, // Purchase Date
      { wch: 18 }, // Installation date
      { wch: 16 }, // Inventory Date
      { wch: 26 }, // Warranty (วันที่รับประกัน)
      { wch: 16 }, // Purchase
      { wch: 36 }  // Equipment  Vendor
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ทะเบียนเครื่องมือแพทย์');
    XLSX.writeFile(workbook, 'แบบฟอร์มนำเข้าทะเบียนเครื่องมือแพทย์_Template.xlsx');
  };

  const handleConfirmImport = () => {
    const selectedItems = parsedRows
      .filter((_, idx) => selectedIndices.has(idx))
      .filter(r => r.isValid)
      .map(r => {
        let warrantyStartDate = '';
        let warrantyEndDate = '';
        const warrantyPeriod = r.warrantyPeriod && r.warrantyPeriod.trim() !== '-' ? r.warrantyPeriod.trim() : '';
        let warrantyYears = (r.warrantyYears && r.warrantyYears.trim() !== '-' ? r.warrantyYears.trim().replace(/\s*ปี$/, '') : '') || extractWarrantyYears(warrantyPeriod);

        if (warrantyPeriod) {
          const splitRange = splitWarrantyDateRange(warrantyPeriod);
          if (splitRange) {
            const pStart = parseDateString(splitRange.rawStart);
            const pEnd = parseDateString(splitRange.rawEnd);
            warrantyStartDate = pStart ? formatDateSlash(pStart) : splitRange.rawStart;
            warrantyEndDate = pEnd ? formatDateSlash(pEnd) : splitRange.rawEnd;
            if (!warrantyYears) {
              warrantyYears = extractWarrantyYears(undefined, warrantyStartDate, warrantyEndDate);
            }
          }
        }

        return {
          code: r.code,
          name: r.name,
          riskLevel: r.riskLevel,
          department: r.department,
          manufacturer: r.manufacturer,
          model: r.model,
          serialNumber: r.serialNumber,
          purchaseDate: r.purchaseDate,
          purchase: r.purchase,
          itrisId: r.itrisId,
          installationDate: r.installationDate,
          registrationDate: r.registrationDate,
          warrantyStartDate,
          warrantyEndDate,
          warrantyYears: warrantyYears || '',
          warrantyPeriod,
          vendorCompany: r.vendorCompany,
          status: 'active' as const
        };
      });

    if (selectedItems.length === 0) {
      alert('กรุณาเลือกรายการที่ต้องการนำเข้าอย่างน้อย 1 รายการ');
      return;
    }

    onImport(selectedItems);
    onClose();
  };

  const toggleSelectAll = () => {
    const validCount = parsedRows.filter(r => r.isValid).length;
    if (selectedIndices.size === validCount && validCount > 0) {
      setSelectedIndices(new Set());
    } else {
      const all = new Set<number>();
      parsedRows.forEach((r, idx) => {
        if (r.isValid) all.add(idx);
      });
      setSelectedIndices(all);
    }
  };

  const toggleRow = (idx: number) => {
    const next = new Set(selectedIndices);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
    }
    setSelectedIndices(next);
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden my-4 border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-600 rounded-xl text-white">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base">นำเข้าข้อมูลเครื่องมือแพทย์จากไฟล์ Excel (.xlsx)</h3>
              <p className="text-xs text-slate-400">อัปโหลดไฟล์ตารางเครื่องมือเพื่อลงทะเบียนเข้าสู่ระบบโดยอัตโนมัติ</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium transition-colors border border-slate-700"
              title="ดาวน์โหลดไฟล์แม่แบบตัวอย่าง Excel"
            >
              <Download size={14} className="text-emerald-400" />
              <span>ดาวน์โหลด Template</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50/50">
          {/* Upload Area */}
          {parsedRows.length === 0 ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFile(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                isDragging 
                  ? 'border-emerald-500 bg-emerald-50/70 scale-[0.99]' 
                  : 'border-slate-300 hover:border-emerald-500 bg-white hover:bg-emerald-50/20 shadow-xs'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                  <UploadCloud size={32} />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-800 text-base">
                    คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
                  </p>
                  <p className="text-xs text-slate-500">
                    รองรับไฟล์ <span className="font-semibold text-emerald-700">.xlsx</span>, <span className="font-semibold text-emerald-700">.xls</span> หรือ <span className="font-semibold text-emerald-700">.csv</span> (เช่น สเปรดชีตไม่มีชื่อ.xlsx หรือไฟล์จาก Google Sheets / Excel)
                  </p>
                </div>
                <div className="inline-flex items-center space-x-2 text-[11px] text-slate-500 bg-slate-100 px-3.5 py-1.5 rounded-full mt-2 border border-slate-200">
                  <span className="font-semibold text-slate-700">รูปแบบคอลัมน์มาตรฐาน (15 คอลัมน์):</span>
                  <span>Item No. | Department | ID CODE | Itris ID | Equipment(English) | Manufacturer | Model | Serial number | Risk Levels | Purchase Date | Installation date | Inventory Date | Warranty | Purchase | Equipment Vendor</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Info & Stats Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                    <FileSpreadsheet size={18} />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900">{fileName}</div>
                    <div className="text-xs text-slate-500 flex items-center space-x-2">
                      <span>พบทั้งหมด {parsedRows.length} รายการ</span>
                      <span>•</span>
                      <span className="text-emerald-600 font-medium">ถูกต้อง {validCount} รายการ</span>
                      {invalidCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-rose-600 font-medium">ไม่สมบูรณ์ {invalidCount} รายการ</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setParsedRows([]);
                      setFileName('');
                      setSelectedIndices(new Set());
                    }}
                    className="flex items-center space-x-1 px-3 py-1.5 text-xs text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200"
                  >
                    <Trash2 size={13} />
                    <span>เปลี่ยนไฟล์</span>
                  </button>
                  <button
                    onClick={toggleSelectAll}
                    className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
                  >
                    {selectedIndices.size === validCount && validCount > 0 ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกที่ถูกต้องทั้งหมด'}
                  </button>
                </div>
              </div>

              {/* Data Preview Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="max-h-[420px] overflow-x-auto overflow-y-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-[#2B6CB0] text-white font-semibold sticky top-0 z-10">
                      <tr>
                        <th className="p-3 w-10 text-center border-r border-blue-600">
                          <input
                            type="checkbox"
                            checked={validCount > 0 && selectedIndices.size === validCount}
                            onChange={toggleSelectAll}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                        </th>
                        <th className="p-3 border-r border-blue-600">Item No.</th>
                        <th className="p-3 border-r border-blue-600">Department</th>
                        <th className="p-3 border-r border-blue-600">ID CODE</th>
                        <th className="p-3 border-r border-blue-600">Itris ID</th>
                        <th className="p-3 border-r border-blue-600">Equipment(English)</th>
                        <th className="p-3 border-r border-blue-600">Manufacturer</th>
                        <th className="p-3 border-r border-blue-600">Model</th>
                        <th className="p-3 border-r border-blue-600">Serial number</th>
                        <th className="p-3 border-r border-blue-600">Risk Levels</th>
                        <th className="p-3 border-r border-blue-600">Purchase Date</th>
                        <th className="p-3 border-r border-blue-600">Installation date</th>
                        <th className="p-3 border-r border-blue-600">Inventory Date</th>
                        <th className="p-3 border-r border-blue-600">Warranty (วันที่รับประกัน)</th>
                        <th className="p-3 border-r border-blue-600">Warranty (ปี)</th>
                        <th className="p-3 border-r border-blue-600">Purchase</th>
                        <th className="p-3 border-r border-blue-600">Equipment Vendor</th>
                        <th className="p-3">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRows.map((row, idx) => {
                        const isSelected = selectedIndices.has(idx);
                        return (
                          <tr
                            key={idx}
                            onClick={() => row.isValid && toggleRow(idx)}
                            className={`transition-colors ${
                              !row.isValid 
                                ? 'bg-rose-50/40 text-slate-400' 
                                : isSelected 
                                  ? 'bg-emerald-50/40 hover:bg-emerald-50/70' 
                                  : 'hover:bg-slate-50'
                            } ${row.isValid ? 'cursor-pointer' : ''}`}
                          >
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                disabled={!row.isValid}
                                checked={isSelected}
                                onChange={() => toggleRow(idx)}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-30"
                              />
                            </td>
                            <td className="p-3 text-slate-500 font-mono text-center">{row.itemNo || idx + 1}</td>
                            <td className="p-3 text-slate-700 font-medium">{formatCellText(row.department)}</td>
                            <td className="p-3 font-mono font-semibold text-blue-700">
                              {row.code || <span className="text-rose-500 italic">ไม่มีรหัส</span>}
                            </td>
                            <td className="p-3 font-mono text-slate-600">{formatCellText(row.itrisId)}</td>
                            <td className="p-3 font-medium text-slate-900">
                              {row.name || <span className="text-rose-500 italic">ไม่มีชื่อ</span>}
                            </td>
                            <td className="p-3 text-slate-600">{formatCellText(row.manufacturer)}</td>
                            <td className="p-3 text-slate-600">{formatCellText(row.model)}</td>
                            <td className="p-3 font-mono text-slate-600">{formatCellText(row.serialNumber)}</td>
                            <td className="p-3">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                row.riskLevel === 'High' 
                                  ? 'bg-rose-100 text-rose-700' 
                                  : row.riskLevel === 'Medium' 
                                    ? 'bg-amber-100 text-amber-700' 
                                    : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {row.riskLevel}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600 font-mono">{formatDateSlash(row.purchaseDate)}</td>
                            <td className="p-3 text-slate-600 font-mono">{formatDateSlash(row.installationDate)}</td>
                            <td className="p-3 text-slate-600 font-mono">{formatDateSlash(row.registrationDate)}</td>
                            <td className="p-3 font-mono text-[12px] text-slate-700 whitespace-nowrap">
                              {(() => {
                                const range = formatWarrantyDateRange(row);
                                if (range && range.fullText) return <span>{range.fullText}</span>;
                                if (row.warrantyPeriod && row.warrantyPeriod !== '-' && formatDateSlash(row.warrantyPeriod) !== '-') return <span>{formatDateSlash(row.warrantyPeriod)}</span>;
                                return <span className="text-slate-400 font-sans">-</span>;
                              })()}
                            </td>
                            <td className="p-3 text-slate-600 font-medium">
                              {(() => {
                                const disp = formatWarrantyDisplay({ warrantyYears: row.warrantyYears, warrantyPeriod: row.warrantyPeriod });
                                return disp !== '-' ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    {disp}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                );
                              })()}
                            </td>
                            <td className="p-3 text-slate-700 font-mono">{formatPurchasePrice(row.purchase)}</td>
                            <td className="p-3 text-slate-600">{formatCellText(row.vendorCompany)}</td>
                            <td className="p-3">
                              {row.isValid ? (
                                <span className="inline-flex items-center text-emerald-700 font-medium space-x-1">
                                  <CheckCircle size={13} />
                                  <span>พร้อมนำเข้า</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-rose-600 font-medium space-x-1" title={row.error}>
                                  <AlertCircle size={13} />
                                  <span>{row.error}</span>
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
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {parsedRows.length > 0 && (
              <span>เลือกนำเข้า <strong className="text-slate-900 font-bold">{selectedIndices.size}</strong> จาก {validCount} รายการที่สมบูรณ์</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              disabled={selectedIndices.size === 0}
              onClick={handleConfirmImport}
              className="flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
            >
              <Check size={15} />
              <span>ยืนยันการนำเข้า ({selectedIndices.size} รายการ)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
