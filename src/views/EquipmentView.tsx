import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { useAppStore, DEFAULT_DEPARTMENTS } from '../store';
import { Plus, Pencil, Trash2, Building2, FileSpreadsheet, CheckCircle2, AlertTriangle, X, Search, Filter, Columns3, Eye, EyeOff, RotateCcw, Check, ChevronDown, Download, Printer, Package } from 'lucide-react';
import { Equipment, EquipmentStatus } from '../types';
import { calculateWarrantyDuration, calculateEndDateFromYears, extractWarrantyYears, formatWarrantyDisplay, formatWarrantyDateRange, formatDateSlash, formatPurchasePrice, formatCellText, isNumericPrice, calculateEquipmentUsageAge } from '../utils/dateUtils';

import AddDepartmentModal from '../components/AddDepartmentModal';
const ImportExcelModal = lazy(() => import('../components/ImportExcelModal'));
const EditEquipmentModal = lazy(() => import('../components/EditEquipmentModal'));
const EquipmentPrintModal = lazy(() => import('../components/EquipmentPrintModal'));

interface ColumnConfig {
  key: string;
  label: string;
  shortLabel?: string;
  defaultVisible: boolean;
}

const TABLE_COLUMNS: ColumnConfig[] = [
  { key: 'itemNo', label: 'Item No. (ลำดับ)', defaultVisible: true },
  { key: 'department', label: 'Department (แผนก)', defaultVisible: true },
  { key: 'code', label: 'ID CODE (รหัสเครื่อง)', defaultVisible: true },
  { key: 'itrisId', label: 'Itris ID', defaultVisible: true },
  { key: 'name', label: 'Equipment (ชื่อเครื่องมือ)', defaultVisible: true },
  { key: 'manufacturer', label: 'Manufacturer (ผู้ผลิต)', defaultVisible: true },
  { key: 'model', label: 'Model (รุ่น)', defaultVisible: true },
  { key: 'serialNumber', label: 'Serial number (หมายเลขเครื่อง)', defaultVisible: true },
  { key: 'riskLevel', label: 'Risk (ระดับความเสี่ยง)', defaultVisible: true },
  { key: 'purchaseDate', label: 'Purchase Date (วันที่จัดซื้อ)', defaultVisible: true },
  { key: 'installationDate', label: 'Install Date (วันที่ติดตั้ง)', defaultVisible: true },
  { key: 'usageAge', label: 'อายุการใช้งาน', defaultVisible: true },
  { key: 'registrationDate', label: 'Inventory Date (วันขึ้นทะเบียน)', defaultVisible: true },
  { key: 'warrantyRange', label: 'Warranty (วันที่รับประกัน)', defaultVisible: true },
  { key: 'warrantyYears', label: 'Warranty (ปีการรับประกัน)', defaultVisible: true },
  { key: 'purchase', label: 'Purchase (ราคา)', defaultVisible: true },
  { key: 'vendorCompany', label: 'Equipment Vendor (ผู้แทนจำหน่าย)', defaultVisible: true },
  { key: 'status', label: 'สถานะเครื่องมือ', defaultVisible: true },
];

const DEFAULT_COLUMNS_STATE = TABLE_COLUMNS.reduce<Record<string, boolean>>((acc, col) => {
  acc[col.key] = col.defaultVisible;
  return acc;
}, {});

export default function EquipmentView() {
  const { equipment, allEquipment, addEquipment, bulkAddEquipment, updateEquipment, deleteEquipment, clearAllEquipment, departments, facilities, users, currentUser, currentFacility, userRole, refreshData } = useAppStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedRisk, setSelectedRisk] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [isAdding, setIsAdding] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedEquipmentForEdit, setSelectedEquipmentForEdit] = useState<Equipment | null>(null);
  const [confirmDeleteEquipment, setConfirmDeleteEquipment] = useState<Equipment | null>(null);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [printingEquipment, setPrintingEquipment] = useState<Equipment | null>(null);
  const [isPrintListModalOpen, setIsPrintListModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Column Visibility State
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('equipment_table_visible_cols');
      if (saved) {
        const parsed = JSON.parse(saved);
        const filtered: Record<string, boolean> = { ...DEFAULT_COLUMNS_STATE };
        for (const col of TABLE_COLUMNS) {
          if (typeof parsed[col.key] === 'boolean') {
            filtered[col.key] = parsed[col.key];
          }
        }
        return filtered;
      }
    } catch (e) {
      console.error('Failed to parse saved column settings', e);
    }
    return DEFAULT_COLUMNS_STATE;
  });
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const columnDropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(event.target as Node)) {
        setIsColumnDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('equipment_table_visible_cols', JSON.stringify(updated));
      } catch (err) {
        console.error(err);
      }
      return updated;
    });
  };

  const showAllColumns = () => {
    const allVisible = TABLE_COLUMNS.reduce<Record<string, boolean>>((acc, col) => {
      acc[col.key] = true;
      return acc;
    }, {});
    setVisibleColumns(allVisible);
    try {
      localStorage.setItem('equipment_table_visible_cols', JSON.stringify(allVisible));
    } catch (err) {
      console.error(err);
    }
  };

  const resetColumnsToDefault = () => {
    setVisibleColumns(DEFAULT_COLUMNS_STATE);
    try {
      localStorage.setItem('equipment_table_visible_cols', JSON.stringify(DEFAULT_COLUMNS_STATE));
    } catch (err) {
      console.error(err);
    }
  };

  const visibleColumnCount = useMemo(() => {
    return TABLE_COLUMNS.filter(col => visibleColumns[col.key]).length;
  }, [visibleColumns]);

  // Combine departments from store with any departments currently in equipment records + fallback
  const allDepartments = useMemo(() => {
    const deptSet = new Set<string>();
    if (userRole === 'Super Admin' || userRole === 'Admin') {
      (departments || []).forEach(d => {
        const name = typeof d === 'string' ? d.trim() : ((d as any)?.name ? String((d as any).name).trim() : '');
        if (name) deptSet.add(name);
      });
    }
    equipment.forEach(eq => {
      if (eq.department && eq.department.trim()) {
        deptSet.add(eq.department.trim());
      }
    });
    if (deptSet.size === 0) {
      if (userRole === 'Super Admin' || userRole === 'Admin') {
        DEFAULT_DEPARTMENTS.forEach(d => deptSet.add(d));
      } else if (currentUser) {
        deptSet.add(currentUser);
      }
    }
    return Array.from(deptSet).sort((a, b) => a.localeCompare(b, 'th'));
  }, [departments, equipment, userRole, currentUser]);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    riskLevel: 'Low' as const,
    status: 'active' as EquipmentStatus,
    purchaseDate: '',
    purchase: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    department: '',
    facility: currentFacility && currentFacility !== 'ส่วนกลาง (Super Admin)' && currentFacility !== 'ส่วนกลาง' ? currentFacility : (facilities[0] || 'โรงพยาบาลศูนย์การแพทย์'),
    ownerUsername: currentUser || '',
    itrisId: '',
    installationDate: '',
    registrationDate: '',
    vendorCompany: '',
    warrantyYears: '',
    warrantyStartDate: '',
    warrantyEndDate: '',
    warrantyPeriod: ''
  });

  const isAdmin = !userRole || userRole === 'Super Admin' || userRole === 'Admin';
  const isSuperAdmin = userRole === 'Super Admin' || (userRole === 'Admin' && (currentFacility === 'ส่วนกลาง' || currentFacility === 'ส่วนกลาง (Super Admin)'));
  const facilityUsersForAssignment = useMemo(() => {
    const targetFac = isSuperAdmin ? formData.facility : (currentFacility || formData.facility);
    return users.filter(u => u.role !== 'Super Admin' && (!targetFac || (u.facility || '').trim().toLowerCase() === targetFac.trim().toLowerCase()));
  }, [users, isSuperAdmin, formData.facility, currentFacility]);

  const handleWarrantyYearsChange = (years: string) => {
    const startDate = formData.warrantyStartDate || formData.installationDate || formData.purchaseDate;
    let newEndDate = formData.warrantyEndDate;

    if (startDate && years && Number(years) > 0) {
      newEndDate = calculateEndDateFromYears(startDate, years);
    }

    const calculatedDuration = calculateWarrantyDuration(startDate, newEndDate);
    const period = years ? `${years} ปี` : calculatedDuration;

    setFormData(prev => ({
      ...prev,
      warrantyYears: years,
      warrantyEndDate: newEndDate,
      warrantyPeriod: period || prev.warrantyPeriod
    }));
  };

  const handleWarrantyStartDateChange = (startDate: string) => {
    let newEndDate = formData.warrantyEndDate;
    if (startDate && formData.warrantyYears && Number(formData.warrantyYears) > 0) {
      newEndDate = calculateEndDateFromYears(startDate, formData.warrantyYears);
    }
    const calculatedDuration = calculateWarrantyDuration(startDate, newEndDate);
    setFormData(prev => ({
      ...prev,
      warrantyStartDate: startDate,
      warrantyEndDate: newEndDate,
      warrantyPeriod: calculatedDuration || (prev.warrantyYears ? `${prev.warrantyYears} ปี` : prev.warrantyPeriod)
    }));
  };

  const handleWarrantyEndDateChange = (endDate: string) => {
    const calculatedDuration = calculateWarrantyDuration(formData.warrantyStartDate, endDate);
    const derivedYears = extractWarrantyYears(calculatedDuration, formData.warrantyStartDate, endDate);
    setFormData(prev => ({
      ...prev,
      warrantyEndDate: endDate,
      warrantyPeriod: calculatedDuration || prev.warrantyPeriod,
      warrantyYears: derivedYears || prev.warrantyYears
    }));
  };

  const filteredEquipment = useMemo(() => {
    let result = equipment.filter(eq => {
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchCode = (eq.code || '').toLowerCase().includes(q);
        const matchName = (eq.name || '').toLowerCase().includes(q);
        const matchItris = (eq.itrisId || '').toLowerCase().includes(q);
        const matchSN = (eq.serialNumber || '').toLowerCase().includes(q);
        const matchModel = (eq.model || '').toLowerCase().includes(q);
        const matchManuf = (eq.manufacturer || '').toLowerCase().includes(q);
        const matchDept = (eq.department || '').toLowerCase().includes(q);
        const matchVendor = (eq.vendorCompany || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchItris && !matchSN && !matchModel && !matchManuf && !matchDept && !matchVendor) {
          return false;
        }
      }

      if (selectedDept !== 'all' && eq.department !== selectedDept) {
        return false;
      }

      if (selectedRisk !== 'all' && eq.riskLevel !== selectedRisk) {
        return false;
      }

      if (selectedStatus !== 'all') {
        if (selectedStatus === 'decommissioned') {
          if (eq.status !== 'decommissioned' && eq.status !== 'inactive') return false;
        } else if (eq.status !== selectedStatus) {
          return false;
        }
      }

      return true;
    });

    switch (sortBy) {
      case 'nameAsc':
        result.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'th'));
        break;
      case 'nameDesc':
        result.sort((a, b) => (b.name || '').localeCompare(a.name || '', 'th'));
        break;
      case 'codeAsc':
        result.sort((a, b) => (a.code || '').localeCompare(b.code || '', 'th', { numeric: true }));
        break;
      case 'codeDesc':
        result.sort((a, b) => (b.code || '').localeCompare(a.code || '', 'th', { numeric: true }));
        break;
      case 'dateAsc':
        result.sort((a, b) => new Date(a.registrationDate || 0).getTime() - new Date(b.registrationDate || 0).getTime());
        break;
      case 'dateDesc':
        result.sort((a, b) => new Date(b.registrationDate || 0).getTime() - new Date(a.registrationDate || 0).getTime());
        break;
      default:
        break;
    }

    return result;
  }, [equipment, searchTerm, selectedDept, selectedRisk, selectedStatus, sortBy]);

  // Pagination for high performance rendering (1,600+ items)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(50);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDept, selectedRisk, selectedStatus, sortBy]);

  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredEquipment.length / Number(pageSize)));

  const paginatedEquipment = useMemo(() => {
    if (pageSize === 'all') return filteredEquipment;
    const size = Number(pageSize);
    const start = (currentPage - 1) * size;
    return filteredEquipment.slice(start, start + size);
  }, [filteredEquipment, currentPage, pageSize]);

  const startIndex = pageSize === 'all' ? 0 : (currentPage - 1) * Number(pageSize);

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const exportData = filteredEquipment.map((eq, index) => {
      const range = formatWarrantyDateRange(eq);
      const warrantyRangeStr = range ? range.fullText : '-';
      return {
        'Item No. (ลำดับ)': index + 1,
        'Department (แผนก)': eq.department || '-',
        'ID CODE (รหัสเครื่อง)': eq.code || '-',
        'Itns ID': eq.itrisId || '-',
        'Equipment (ชื่อเครื่องมือ)': eq.name || '-',
        'Manufacturer (ผู้ผลิต)': eq.manufacturer || '-',
        'Model (รุ่น)': eq.model || '-',
        'Serial number (หมายเลขเครื่อง)': eq.serialNumber || '-',
        'Risk (ระดับความเสี่ยง)': eq.riskLevel || '-',
        'Purchase Date (วันที่จัดซื้อ)': eq.purchaseDate ? formatDateSlash(eq.purchaseDate) : '-',
        'Install Date (วันที่ติดตั้ง)': eq.installationDate ? formatDateSlash(eq.installationDate) : '-',
        'อายุการใช้งาน': calculateEquipmentUsageAge(eq.installationDate),
        'Inventory Date (วันขึ้นทะเบียน)': eq.registrationDate ? formatDateSlash(eq.registrationDate) : '-',
        'Warranty (วันที่รับประกัน)': warrantyRangeStr,
        'Warranty (ปีการรับประกัน)': eq.warrantyYears ? String(eq.warrantyYears).replace(/\s*ปี$/, '') : '',
        'Purchase (ราคา)': formatPurchasePrice(isNumericPrice(eq.purchase) ? eq.purchase : (isNumericPrice(eq.vendorCompany) ? eq.vendorCompany : eq.purchase)),
        'Equipment Vendor (ผู้แทนจำหน่าย)': isNumericPrice(eq.vendorCompany) && !isNumericPrice(eq.purchase) ? '-' : (eq.vendorCompany || '-'),
        'สถานะเครื่องมือ': eq.status === 'active' ? 'ปกติ' : (eq.status === 'repairing' ? 'ส่งซ่อม' : (eq.status === 'broken' ? 'ชำรุด' : 'ยกเลิกการใช้งาน')),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Equipment_Register');
    XLSX.writeFile(workbook, `Equipment_Register_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.name) return;
    
    // Check for duplicate code
    const isDuplicate = equipment.some(eq => eq.code.trim().toLowerCase() === formData.code.trim().toLowerCase());
    if (isDuplicate) {
      setErrorMsg(`รหัสเครื่องมือ "${formData.code}" มีการลงทะเบียนในระบบแล้ว กรุณาใช้รหัสอื่น`);
      setTimeout(() => setErrorMsg(null), 5000);
      return;
    }

    // Check for duplicate Itris ID
    if (formData.itrisId && formData.itrisId.trim() !== '') {
      const isItrisDuplicate = equipment.some(eq => eq.itrisId && eq.itrisId.trim().toLowerCase() === formData.itrisId.trim().toLowerCase());
      if (isItrisDuplicate) {
        setErrorMsg(`Itris ID "${formData.itrisId}" มีการลงทะเบียนในระบบแล้ว กรุณาใช้รหัสอื่น`);
        setTimeout(() => setErrorMsg(null), 5000);
        return;
      }
    }
    
    const rangeFromDates = formData.warrantyStartDate && formData.warrantyEndDate
      ? `${formatDateSlash(formData.warrantyStartDate)}-${formatDateSlash(formData.warrantyEndDate)}`
      : '';
    const finalWarrantyPeriod = rangeFromDates || formData.warrantyPeriod || calculateWarrantyDuration(formData.warrantyStartDate, formData.warrantyEndDate);
    const finalWarrantyYears = formData.warrantyYears || extractWarrantyYears(finalWarrantyPeriod, formData.warrantyStartDate, formData.warrantyEndDate);

    const cleanPurchase = formData.purchase.trim() ? formatPurchasePrice(formData.purchase) : '';
    addEquipment({
      ...formData,
      purchase: cleanPurchase === '-' ? '' : cleanPurchase,
      warrantyYears: finalWarrantyYears,
      warrantyPeriod: finalWarrantyPeriod,
      status: formData.status || 'active'
    });
    setSuccessMsg(`เพิ่มเครื่องมือแพทย์ "${formData.name}" เรียบร้อยแล้ว`);
    resetForm();
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      riskLevel: 'Low',
      status: 'active',
      purchaseDate: '',
      purchase: '',
      manufacturer: '',
      model: '',
      serialNumber: '',
      department: '',
      facility: currentFacility && currentFacility !== 'ส่วนกลาง (Super Admin)' ? currentFacility : (facilities[0] || 'โรงพยาบาลศูนย์การแพทย์'),
      ownerUsername: currentUser || '',
      itrisId: '',
      installationDate: '',
      registrationDate: '',
      vendorCompany: '',
      warrantyYears: '',
      warrantyStartDate: '',
      warrantyEndDate: '',
      warrantyPeriod: ''
    });
    setIsAdding(false);
  };

  const handleSaveEquipment = (id: string, updatedData: Partial<Equipment>) => {
    updateEquipment(id, updatedData);
    setSuccessMsg(`บันทึกการแก้ไขข้อมูลเครื่องมือ "${updatedData.name || 'สำเร็จ'}" เรียบร้อยแล้ว`);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Toast / Banner Notification */}
      {successMsg && (
        <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl shadow-xs animate-fade-in">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="text-emerald-600 shrink-0" size={20} />
            <span className="text-sm font-medium">{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold px-2 py-1 hover:bg-emerald-100/60 rounded-md"
          >
            ปิด
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">ทะเบียนเครื่องมือ</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSuperAdmin
              ? `แสดงข้อมูลทุกสถานประกอบการ รวมทั้งหมด ${equipment.length} รายการ`
              : userRole === 'Admin'
              ? `แสดงข้อมูลทั้งหมดของสถานประกอบการ "${currentFacility || '-'}" (${equipment.length} รายการ)`
              : `แสดงเฉพาะเครื่องมือของแผนก "${allDepartments[0] || currentUser || '-'}" (${currentFacility || '-'}) จำนวน ${equipment.length} รายการ`}
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Add New Single Button */}
          {isAdmin && (
            <button
              onClick={() => {
                if (isAdding) {
                  resetForm();
                } else {
                  setIsAdding(true);
                }
              }}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-sm font-medium transition-colors shadow-2xs cursor-pointer"
            >
              <Plus size={16} />
              <span>{isAdding ? 'ยกเลิกการเพิ่ม' : 'เพิ่มเครื่องมือใหม่'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Add New Equipment Inline Panel */}
      {isAdding && isAdmin && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
          <h3 className="text-lg font-medium text-slate-900 mb-4">ลงทะเบียนเครื่องมือแพทย์ใหม่</h3>
          
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-center space-x-2 animate-fade-in">
              <AlertTriangle size={18} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">รหัสเครื่องมือ</label>
              <input required type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="เช่น EQ-001" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อเครื่องมือ</label>
              <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="เช่น สว่านไฟฟ้า" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Manufacturer (ผู้ผลิต)</label>
              <input type="text" value={formData.manufacturer} onChange={e => setFormData({...formData, manufacturer: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="เช่น Siemens, GE" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Model (รุ่น)</label>
              <input type="text" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="เช่น X-1000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Serial Number</label>
              <input type="text" value={formData.serialNumber} onChange={e => setFormData({...formData, serialNumber: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="SN..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department (แผนก)</label>
              <div className="flex gap-2">
                <select 
                  value={formData.department} 
                  onChange={e => {
                    if (e.target.value === '__add_new__') {
                      setIsDeptModalOpen(true);
                      return;
                    }
                    setFormData({...formData, department: e.target.value});
                  }} 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">-- กรุณาเลือกแผนก --</option>
                  {allDepartments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                  {isAdmin && (
                    <option value="__add_new__" className="text-blue-600 font-semibold bg-blue-50/50">
                      + เพิ่มแผนกใหม่ (Admin)...
                    </option>
                  )}
                </select>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsDeptModalOpen(true)}
                    title="จัดการรายชื่อแผนก"
                    className="p-2 border border-slate-200 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors shrink-0"
                  >
                    <Building2 size={16} />
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Itris ID</label>
              <input type="text" value={formData.itrisId} onChange={e => setFormData({...formData, itrisId: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="เช่น ITR-12345" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">สถานประกอบการ (Facility)</label>
              {isSuperAdmin ? (
                <select
                  value={formData.facility}
                  onChange={e => setFormData({...formData, facility: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {(facilities.length > 0 ? facilities : ['โรงพยาบาลศูนย์การแพทย์']).map(fac => (
                    <option key={fac} value={fac}>{fac}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  disabled
                  value={currentFacility || formData.facility}
                  className="w-full border border-slate-200 bg-slate-100 text-slate-600 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Risk Level (ระดับความเสี่ยง)</label>
              <select required value={formData.riskLevel} onChange={e => setFormData({...formData, riskLevel: e.target.value as any})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">วันที่จัดซื้อ</label>
              <input type="date" value={formData.purchaseDate} onChange={e => setFormData({...formData, purchaseDate: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Purchase (ราคา / หน่วยเป็น บาท)</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.purchase}
                  onChange={e => setFormData({...formData, purchase: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg pl-3 pr-12 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="เช่น 150,000"
                />
                <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs font-semibold text-slate-500 pointer-events-none">
                  บาท
                </span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">วันขึ้นทะเบียน</label>
              <input type="date" value={formData.registrationDate} onChange={e => setFormData({...formData, registrationDate: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">วันที่ติดตั้ง</label>
              <input type="date" value={formData.installationDate} onChange={e => setFormData({...formData, installationDate: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">สถานะเครื่องมือ</label>
              <select
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as EquipmentStatus})}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="active">ปกติ / พร้อมใช้งาน</option>
                <option value="repairing">ส่งซ่อม</option>
                <option value="broken">ชำรุด</option>
                <option value="decommissioned">ยกเลิกการใช้งาน</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">บริษัทที่ขายเครื่อง</label>
              <input type="text" value={formData.vendorCompany} onChange={e => setFormData({...formData, vendorCompany: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="เช่น บริษัท เมดิคอล เซอร์วิส จำกัด" />
            </div>
            {/* Warranty Information Section */}
            <div className="md:col-span-2 p-3.5 bg-blue-50/40 border border-blue-100 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  ข้อมูลการรับประกัน (Warranty)
                </span>
                <span className="text-[11px] text-blue-700 font-medium">
                  ระบุปีรับประกัน หรือกำหนดวันที่เริ่ม-สิ้นสุด
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    ปีของการรับประกัน (ปี / Years)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.warrantyYears}
                      onChange={e => handleWarrantyYearsChange(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      placeholder="เช่น 1, 2, 3, 5"
                    />
                    <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-semibold text-slate-400 pointer-events-none">
                      ปี
                    </span>
                  </div>
                  <div className="flex items-center space-x-1 mt-1.5">
                    {[1, 2, 3, 5].map(yr => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => handleWarrantyYearsChange(String(yr))}
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition-colors ${
                          formData.warrantyYears === String(yr)
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-blue-50 hover:border-blue-300'
                        }`}
                      >
                        {yr} ปี
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">เริ่มรับประกัน</label>
                  <input
                    type="date"
                    value={formData.warrantyStartDate}
                    onChange={e => handleWarrantyStartDateChange(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">สิ้นสุดการรับประกัน</label>
                  <input
                    type="date"
                    value={formData.warrantyEndDate}
                    onChange={e => handleWarrantyEndDateChange(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>
            </div>
            <div className="md:col-span-2 flex justify-end space-x-3 mt-2">
              <button type="button" onClick={resetForm} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">ยกเลิก</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                บันทึกข้อมูล
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between">
          {/* Magnifying Glass Search Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={18} />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาข้อมูลเครื่อง... (รหัส, ชื่อ, Itris ID, แผนก, ยี่ห้อ, รุ่น, SN, ผู้ขาย)"
              className="w-full pl-9.5 pr-8 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                title="ล้างคำค้นหา"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Filters & Column Customizer */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Department Filter */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-2.5 py-2 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer font-medium"
            >
              <option value="all">ทุกแผนก ({allDepartments.length})</option>
              {allDepartments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>

            {/* Risk Filter */}
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">ทุกความเสี่ยง</option>
              <option value="High">ความเสี่ยงสูง (High)</option>
              <option value="Medium">ความเสี่ยงปานกลาง (Medium)</option>
              <option value="Low">ความเสี่ยงต่ำ (Low)</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="active">ปกติ</option>
              <option value="repairing">ส่งซ่อม</option>
              <option value="broken">ชำรุด</option>
              <option value="decommissioned">ยกเลิกการใช้งาน</option>
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="default">เรียงลำดับปกติ</option>
              <option value="nameAsc">ชื่อเครื่องมือ (A-Z, ก-ฮ)</option>
              <option value="nameDesc">ชื่อเครื่องมือ (Z-A, ฮ-ก)</option>
              <option value="codeAsc">รหัสเครื่องมือ (น้อยไปมาก)</option>
              <option value="codeDesc">รหัสเครื่องมือ (มากไปน้อย)</option>
              <option value="dateAsc">วันขึ้นทะเบียน (เก่าไปใหม่)</option>
              <option value="dateDesc">วันขึ้นทะเบียน (ใหม่ไปเก่า)</option>
            </select>

            {/* Column Visibility Customizer Dropdown */}
            <div className="relative" ref={columnDropdownRef}>
              <button
                type="button"
                onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
                className={`flex items-center space-x-1.5 px-3 py-2 border rounded-lg transition-all font-medium shadow-2xs ${
                  visibleColumnCount < TABLE_COLUMNS.length
                    ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                title="คลิกเพื่อเลือกซ่อนหรือแสดงคอลัมน์ในตาราง"
              >
                <Columns3 size={15} className={visibleColumnCount < TABLE_COLUMNS.length ? 'text-blue-600' : 'text-slate-500'} />
                <span>คอลัมน์ ({visibleColumnCount}/{TABLE_COLUMNS.length})</span>
                <ChevronDown size={13} className={`transition-transform duration-200 ${isColumnDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isColumnDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center space-x-1.5 font-semibold text-slate-800 text-xs">
                      <Columns3 size={14} className="text-blue-600" />
                      <span>จัดการคอลัมน์ในตาราง</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsColumnDropdownOpen(false)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] px-1">
                    <span className="text-slate-500 font-medium">แสดง {visibleColumnCount} จาก {TABLE_COLUMNS.length}</span>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={showAllColumns}
                        className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                      >
                        แสดงทั้งหมด
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={resetColumnsToDefault}
                        className="text-slate-500 hover:text-slate-700 font-medium hover:underline"
                      >
                        ค่าเริ่มต้น
                      </button>
                    </div>
                  </div>

                  {/* Columns Checklist */}
                  <div className="max-h-60 overflow-y-auto space-y-1 pr-1 divide-y divide-slate-50">
                    {TABLE_COLUMNS.map((col) => {
                      const isVisible = visibleColumns[col.key] !== false;
                      return (
                        <label
                          key={col.key}
                          className="flex items-center justify-between px-2 py-1.5 hover:bg-blue-50/50 rounded-lg cursor-pointer transition-colors text-xs select-none"
                        >
                          <span className={`font-medium ${isVisible ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                            {col.label}
                          </span>
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={() => toggleColumn(col.key)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                          />
                        </label>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 text-center">
                    💡 คลิกที่ปุ่ม ✕ บนหัวคอลัมน์ของตารางเพื่อซ่อนได้โดยตรง
                  </div>
                </div>
              )}
            </div>

            {(searchTerm || selectedDept !== 'all' || selectedRisk !== 'all' || selectedStatus !== 'all' || sortBy !== 'default') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedDept('all');
                  setSelectedRisk('all');
                  setSelectedStatus('all');
                  setSortBy('default');
                }}
                className="px-2.5 py-2 text-rose-600 hover:bg-rose-50 rounded-lg font-medium transition-colors"
                title="ล้างตัวกรองทั้งหมด"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>

        {/* Search Result Summary Badge */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
          <div>
            แสดง <span className="font-semibold text-blue-700">{filteredEquipment.length}</span> จากทั้งหมด <span className="font-semibold text-slate-800">{equipment.length}</span> รายการ
            {searchTerm && <span className="ml-1 text-slate-400"> (ผลการค้นหา "{searchTerm}")</span>}
          </div>
          {visibleColumnCount < TABLE_COLUMNS.length && (
            <div className="flex items-center space-x-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              <EyeOff size={12} />
              <span>ซ่อน {TABLE_COLUMNS.length - visibleColumnCount} คอลัมน์</span>
              <button
                type="button"
                onClick={showAllColumns}
                className="text-blue-700 font-semibold underline ml-1 hover:text-blue-900"
              >
                แสดงทั้งหมด
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[72vh] overflow-y-auto">
          <table className="w-full text-left text-[11px] whitespace-nowrap border-separate border-spacing-0">
            <thead className="bg-[#2B6CB0] text-white sticky top-0 z-10 shadow-xs select-none">
              <tr className="border-b border-blue-700 text-[11px]">
                {visibleColumns.itemNo && (
                  <th className="px-1.5 py-2 font-semibold text-center border-r border-blue-600 w-10 bg-[#2B6CB0] group relative">
                    <div className="flex items-center justify-center space-x-1">
                      <span>Item No.</span>
                      <button
                        type="button"
                        onClick={() => toggleColumn('itemNo')}
                        className="opacity-0 group-hover:opacity-100 text-blue-200 hover:text-white transition-opacity p-0.5 hover:bg-blue-700 rounded"
                        title="ซ่อนคอลัมน์ Item No."
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </th>
                )}
                {visibleColumns.department && (
                  <th className="px-2 py-2 font-semibold border-r border-blue-600 max-w-[130px] truncate bg-[#2B6CB0] group relative" title="Department">
                    <div className="flex items-center justify-between space-x-1">
                      <span className="truncate">Department</span>
                      <button
                        type="button"
                        onClick={() => toggleColumn('department')}
                        className="opacity-0 group-hover:opacity-100 text-blue-200 hover:text-white transition-opacity p-0.5 hover:bg-blue-700 rounded shrink-0"
                        title="ซ่อนคอลัมน์ Department"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </th>
                )}
                {visibleColumns.code && (
                  <th className="px-2 py-2 font-semibold border-r border-blue-600 bg-[#2B6CB0] group relative" title="ID CODE">
                    <div className="flex items-center justify-between space-x-1">
                      <span>ID CODE</span>
                      <button
                        type="button"
                        onClick={() => toggleColumn('code')}
                        className="opacity-0 group-hover:opacity-100 text-blue-200 hover:text-white transition-opacity p-0.5 hover:bg-blue-700 rounded"
                        title="ซ่อนคอลัมน์ ID CODE"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </th>
                )}
                {visibleColumns.itrisId && (
                  <th className="px-1.5 py-2 font-semibold border-r border-blue-600 bg-[#2B6CB0] group relative" title="Itris ID">
                    <div className="flex items-center justify-between space-x-1">
                      <span>Itris ID</span>
                      <button
                        type="button"
                        onClick={() => toggleColumn('itrisId')}
                        className="opacity-0 group-hover:opacity-100 text-blue-200 hover:text-white transition-opacity p-0.5 hover:bg-blue-700 rounded"
                        title="ซ่อนคอลัมน์ Itris ID"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </th>
                )}
                {visibleColumns.name && (
                  <th className="px-2 py-2 font-semibold border-r border-blue-600 max-w-[160px] truncate bg-[#2B6CB0] group relative" title="Equipment(English)">
                    <div className="flex items-center justify-between space-x-1">
                      <span className="truncate">Equipment(English)</span>
                      <button
                        type="button"
                        onClick={() => toggleColumn('name')}
                        className="opacity-0 group-hover:opacity-100 text-blue-200 hover:text-white transition-opacity p-0.5 hover:bg-blue-700 rounded shrink-0"
                        title="ซ่อนคอลัมน์ Equipment"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </th>
                )}
                {visibleColumns.manufacturer && (
                  <th className="px-1.5 py-2 font-semibold border-r border-blue-600 bg-[#2B6CB0] group relative" title="Manufacturer">
                    <div className="flex items-center justify-between space-x-1">
                      <span className="truncate">Manufacturer</span>
                      <button
                        type="button"
                        onClick={() => toggleColumn('manufacturer')}
                        className="opacity-0 group-hover:opacity-100 text-blue-200 hover:text-white transition-opacity p-0.5 hover:bg-blue-700 rounded shrink-0"
                        title="ซ่อนคอลัมน์ Manufacturer"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </th>
                )}
                {visibleColumns.model && (
                  <th className="px-1.5 py-2 font-semibold border-r border-blue-600 bg-[#2B6CB0] group relative" title="Model">
                    <div className="flex items-center justify-between space-x-1">
                      <span className="truncate">Model</span>
                      <button
                        type="button"
                        onClick={() => toggleColumn('model')}
                        className="opacity-0 group-hover:opacity-100 text-blue-200 hover:text-white transition-opacity p-0.5 hover:bg-blue-700 rounded shrink-0"
                        title="ซ่อนคอลัมน์ Model"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </th>
                )}
                {visibleColumns.serialNumber && (
                  <th className="px-1.5 py-2 font-semibold border-r border-blue-600 bg-[#2B6CB0] group relative" title="Serial number">
                    <div className="flex items-center justify-between space-x-1">
                      <span>Serial number</span>
                      <button
                        type="button"
                        onClick={() => toggleColumn('serialNumber')}
                        className="opacity-0 group-hover:opacity-100 text-blue-200 hover:text-white transition-opacity p-0.5 hover:bg-blue-700 rounded"
                        title="ซ่อนคอลัมน์ Serial number"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </th>
                )}
                {visibleColumns.riskLevel && (
                  <th className="px-1.5 py-2 font-semibold border-r border-blue-600 text-center bg-[#2B6CB0] group relative" title="Risk Levels">
                    <div className="flex items-center justify-center space-x-1">
                      <span>Risk</span>
                      <button
                        type="button"
                        onClick={() => toggleColumn('riskLevel')}
                        className="opacity-0 group-hover:opacity-100 text-blue-200 hover:text-white transition-opacity p-0.5 hover:bg-blue-700 rounded"
                        title="ซ่อนคอลัมน์ Risk"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </th>
                )}
                {visibleColumns.purchaseDate && (
                  <th className="px-1.5 py-2 font-semibold border-r border-blue-600 bg-[#2B6CB0] group relative" title="Purchase Date">
                    <div className="flex items-center justify-between space-x-1">
                      <span>Purchase Date</span>
                      <button
                        type="button"
                        onClick={() => toggleColumn('purchaseDate')}
                        className="opacity-0 group-hover:opacity-100 text-blue-200 hover:text-white transition-opacity p-0.5 hover:bg-blue-700 rounded"
                        title="ซ่อนคอลัมน์ Purchase Date"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </th>
                )}
                {visibleColumns.installationDate && (
                  <th className="px-1.5 py-2 font-semibold border-r border-blue-600 bg-[#2B6CB0] group relative" title="Installation date">
                    <div className="flex items-center justify-between space-x-1">
                      <span>Install Date</span>
                      <button
                        type="button"
                        onClick={() => toggleColumn('installationDate')}
                        className="opacity-0 group-hover:opacity-100 text-blue-200 hover:text-white transition-opacity p-0.5 hover:bg-blue-700 rounded"
                        title="ซ่อนคอลัมน์ Install Date"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </th>
                )}
                {visibleColumns.usageAge && (
                  <th className="px-1.5 py-2 font-semibold border-r border-blue-600 bg-[#2B6CB0] group relative whitespace-nowrap" title="อายุการใช้งาน (คำนวณจากวันปัจจุบัน - วันที่ติดตั้งเครื่อง)">
                    <div className="flex items-center justify-between space-x-1">
                      <span>อายุการใช้งาน</span>
                      <button
                        type="button"
                        onClick={() => toggleColumn('usageAge')}
                        className="opacity-0 group-hover:opacity-100 text-blue-200 hover:text-white transition-opacity p-0.5 hover:bg-blue-700 rounded shrink-0"
                        title="ซ่อนคอลัมน์ อายุการใช้งาน"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </th>
                )}
                {visibleColumns.registrationDate && (
                  <th className="px-1.5 py-2 font-semibold border-r border-blue-600 bg-[#2B6CB0] group relative" title="Inventory Date">
                    <div className="flex items-center justify-between space-x-1">
                      <span>Inventory Date</span>
                      <button
                        type="button"
                        onClick={() => toggleColumn('registrationDate')}
                        className="opacity-0 group-hover:opacity-100 text-blue-200 hover:text-white transition-opacity p-0.5 hover:bg-blue-700 rounded"
                        title="ซ่อนคอลัมน์ Inventory Date"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </th>
                )}
                {visibleColumns.warrantyRange && (
                  <th className="px-2 py-2 font-semibold border-r border-blue-600 bg-[#2B6CB0] w-[165px] min-w-[165px] group relative" title="Warranty (วันที่รับประกัน)">
                    <div className="flex items-center justify-between space-x-1">
                      <span className="truncate">Warranty (วันที่)</span>
                      <button
                        type="button"
                        onClick={() => toggleColumn('warrantyRange')}
                        className="opacity-0 group-hover:opacity-100 text-blue-200 hover:text-white transition-opacity p-0.5 hover:bg-blue-700 rounded shrink-0"
                        title="ซ่อนคอลัมน์ Warranty (วันที่รับประกัน)"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </th>
                )}
                {visibleColumns.warrantyYears && (
                  <th className="px-1.5 py-2 font-semibold border-r border-blue-600 bg-[#2B6CB0] group relative" title="Warranty (สรุปปีการรับประกัน)">
                    <div className="flex items-center justify-between space-x-1">
                      <span>Warranty (ปี)</span>
                      <button
                        type="button"
                        onClick={() => toggleColumn('warrantyYears')}
                        className="opacity-0 group-hover:opacity-100 text-blue-200 hover:text-white transition-opacity p-0.5 hover:bg-blue-700 rounded"
                        title="ซ่อนคอลัมน์ Warranty (ปี)"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </th>
                )}
                {visibleColumns.purchase && (
                  <th className="px-2 py-2 font-semibold border-r border-blue-600 bg-[#2B6CB0] w-[95px] min-w-[95px] max-w-[105px] text-right group relative" title="Purchase (ราคาซื้อเครื่อง / บาท)">
                    <div className="flex items-center justify-between space-x-1">
                      <span className="truncate">ราคา (บาท)</span>
                      <button
                        type="button"
                        onClick={() => toggleColumn('purchase')}
                        className="opacity-0 group-hover:opacity-100 text-blue-200 hover:text-white transition-opacity p-0.5 hover:bg-blue-700 rounded shrink-0"
                        title="ซ่อนคอลัมน์ Purchase"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </th>
                )}
                {visibleColumns.vendorCompany && (
                  <th className="px-2 py-2 font-semibold border-r border-blue-600 max-w-[140px] truncate bg-[#2B6CB0] group relative" title="Equipment Vendor">
                    <div className="flex items-center justify-between space-x-1">
                      <span className="truncate">Equipment Vendor</span>
                      <button
                        type="button"
                        onClick={() => toggleColumn('vendorCompany')}
                        className="opacity-0 group-hover:opacity-100 text-blue-200 hover:text-white transition-opacity p-0.5 hover:bg-blue-700 rounded shrink-0"
                        title="ซ่อนคอลัมน์ Equipment Vendor"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </th>
                )}
                {visibleColumns.status && (
                  <th className="px-1.5 py-2 font-semibold border-r border-blue-600 text-center bg-[#2B6CB0] group relative">
                    <div className="flex items-center justify-center space-x-1">
                      <span>สถานะ</span>
                      <button
                        type="button"
                        onClick={() => toggleColumn('status')}
                        className="opacity-0 group-hover:opacity-100 text-blue-200 hover:text-white transition-opacity p-0.5 hover:bg-blue-700 rounded"
                        title="ซ่อนคอลัมน์ สถานะ"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  </th>
                )}
                <th className="px-1.5 py-2 font-semibold text-center sticky right-0 top-0 z-20 bg-[#2B6CB0] shadow-xs">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedEquipment.map((eq, idx) => (
                <tr
                  key={eq.id}
                  onDoubleClick={() => isAdmin && setSelectedEquipmentForEdit(eq)}
                  className={`hover:bg-blue-50/50 transition-colors ${isAdmin ? 'cursor-pointer' : ''} group/row`}
                  title={isAdmin ? "ดับเบิ้ลคลิกที่แถวนี้เพื่อแก้ไขข้อมูล" : undefined}
                >
                  {visibleColumns.itemNo && (
                    <td className="px-1.5 py-1.5 text-center text-slate-500 font-mono">{startIndex + idx + 1}</td>
                  )}
                  {visibleColumns.department && (
                    <td className="px-2 py-1.5 text-slate-700 font-medium max-w-[130px] truncate" title={formatCellText(eq.department)}>{formatCellText(eq.department)}</td>
                  )}
                  {visibleColumns.code && (
                    <td className="px-2 py-1.5 font-mono font-semibold text-blue-700">{eq.code}</td>
                  )}
                  {visibleColumns.itrisId && (
                    <td className="px-1.5 py-1.5 font-mono text-slate-600">{formatCellText(eq.itrisId)}</td>
                  )}
                  {visibleColumns.name && (
                    <td className="px-2 py-1.5 font-medium text-slate-900 max-w-[160px] truncate" title={eq.name}>{eq.name}</td>
                  )}
                  {visibleColumns.manufacturer && (
                    <td className="px-1.5 py-1.5 text-slate-600 max-w-[110px] truncate" title={formatCellText(eq.manufacturer)}>{formatCellText(eq.manufacturer)}</td>
                  )}
                  {visibleColumns.model && (
                    <td className="px-1.5 py-1.5 text-slate-600 max-w-[100px] truncate" title={formatCellText(eq.model)}>{formatCellText(eq.model)}</td>
                  )}
                  {visibleColumns.serialNumber && (
                    <td className="px-1.5 py-1.5 font-mono text-slate-600">{formatCellText(eq.serialNumber)}</td>
                  )}
                  {visibleColumns.riskLevel && (
                    <td className="px-1.5 py-1.5 text-center">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        eq.riskLevel === 'High' ? 'bg-red-100 text-red-700' :
                        eq.riskLevel === 'Medium' ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {eq.riskLevel}
                      </span>
                    </td>
                  )}
                  {visibleColumns.purchaseDate && (
                    <td className="px-1.5 py-1.5 text-slate-600 font-mono text-[11px]">{formatDateSlash(eq.purchaseDate)}</td>
                  )}
                  {visibleColumns.installationDate && (
                    <td className="px-1.5 py-1.5 text-slate-600 font-mono text-[11px]">{formatDateSlash(eq.installationDate)}</td>
                  )}
                  {visibleColumns.usageAge && (
                    <td className="px-1.5 py-1.5 text-slate-700 font-medium text-[11px] whitespace-nowrap">
                      {(() => {
                        const age = calculateEquipmentUsageAge(eq.installationDate);
                        if (age === '-') return <span className="text-slate-400">-</span>;
                        return <span>{age}</span>;
                      })()}
                    </td>
                  )}
                  {visibleColumns.registrationDate && (
                    <td className="px-1.5 py-1.5 text-slate-600 font-mono text-[11px]">{formatDateSlash(eq.registrationDate)}</td>
                  )}
                  {visibleColumns.warrantyRange && (
                    <td className="px-2 py-1.5 font-mono text-[11px] text-slate-700 whitespace-nowrap w-[165px] min-w-[165px]" title={(() => {
                      const range = formatWarrantyDateRange(eq);
                      return range?.fullText || '-';
                    })()}>
                      {(() => {
                        const range = formatWarrantyDateRange(eq);
                        if (range && range.fullText) {
                          return <span className="inline-block">{range.fullText}</span>;
                        }
                        return <span className="text-slate-400 font-sans">-</span>;
                      })()}
                    </td>
                  )}
                  {visibleColumns.warrantyYears && (
                    <td className="px-1.5 py-1.5 font-medium" title={eq.warrantyYears ? `สรุปปีการรับประกัน: ${eq.warrantyYears} ปี` : ''}>
                      {(() => {
                        const display = formatWarrantyDisplay(eq);
                        if (display === '-') return <span className="text-slate-400">-</span>;
                        return (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                            {display}
                          </span>
                        );
                      })()}
                    </td>
                  )}
                  {visibleColumns.purchase && (
                    <td className="px-2 py-1.5 text-slate-800 font-semibold font-mono text-[11px] text-right whitespace-nowrap w-[95px] min-w-[95px] max-w-[105px]">
                      {formatPurchasePrice(isNumericPrice(eq.purchase) ? eq.purchase : (isNumericPrice(eq.vendorCompany) ? eq.vendorCompany : eq.purchase))}
                    </td>
                  )}
                  {visibleColumns.vendorCompany && (
                    <td className="px-2 py-1.5 text-slate-600 max-w-[140px] truncate" title={formatCellText(isNumericPrice(eq.vendorCompany) && !isNumericPrice(eq.purchase) ? '-' : eq.vendorCompany)}>
                      {formatCellText(isNumericPrice(eq.vendorCompany) && !isNumericPrice(eq.purchase) ? '-' : eq.vendorCompany)}
                    </td>
                  )}
                  {visibleColumns.status && (
                    <td className="px-1.5 py-1.5 text-center">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        eq.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                        eq.status === 'repairing' ? 'bg-amber-100 text-amber-700' :
                        eq.status === 'broken' ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700 border border-red-200 font-semibold'
                      }`}>
                        {eq.status === 'active' ? 'ปกติ' : eq.status === 'repairing' ? 'ส่งซ่อม' : eq.status === 'broken' ? 'ชำรุด' : 'ยกเลิกการใช้งาน'}
                      </span>
                    </td>
                  )}
                  <td className="px-1.5 py-1.5 text-center sticky right-0 bg-white group-hover:bg-blue-50/40 shadow-xs border-l border-slate-100">
                    <div className="flex items-center justify-center space-x-1">
                      {/* Printer Button */}
                      <button
                        onClick={() => setPrintingEquipment(eq)}
                        className="p-1 text-slate-600 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors cursor-pointer"
                        title={`พิมพ์เอกสาร (Mutation IN / Inspection) - ${eq.code}`}
                      >
                        <Printer size={13} />
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => setSelectedEquipmentForEdit(eq)}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                            title="แก้ไขข้อมูลเครื่องมือแพทย์"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            id={`btn-delete-eq-${eq.id}`}
                            onClick={() => setConfirmDeleteEquipment(eq)}
                            className="p-1 text-rose-600 hover:bg-rose-100 rounded transition-colors"
                            title="ลบเครื่องมือออกจากระบบ"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredEquipment.length === 0 && (
                <tr>
                  <td colSpan={visibleColumnCount + 1} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="p-3 bg-slate-100 rounded-full text-slate-400">
                        <Package size={32} />
                      </div>
                      <p className="font-semibold text-slate-700 text-base">
                        {equipment.length === 0 ? 'ยังไม่มีข้อมูลในทะเบียนเครื่องมือแพทย์' : 'ไม่พบข้อมูลเครื่องมือแพทย์ที่ตรงกับเงื่อนไขการค้นหา'}
                      </p>
                      {equipment.length === 0 && isAdmin ? (
                        <div className="flex items-center space-x-2 pt-2">
                          <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5"
                          >
                            <FileSpreadsheet size={15} />
                            <span>นำเข้าข้อมูลจาก Excel</span>
                          </button>
                          <button
                            onClick={() => setIsAdding(true)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5"
                          >
                            <Plus size={15} />
                            <span>เพิ่มเครื่องมือใหม่</span>
                          </button>
                        </div>
                      ) : (searchTerm || selectedDept !== 'all' || selectedRisk !== 'all' || selectedStatus !== 'all') && (
                        <button
                          onClick={() => {
                            setSearchTerm('');
                            setSelectedDept('all');
                            setSelectedRisk('all');
                            setSelectedStatus('all');
                          }}
                          className="text-xs text-blue-600 hover:underline font-semibold"
                        >
                          ล้างการค้นหาและตัวกรองทั้งหมด
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

      {/* Pagination Controls */}
      {filteredEquipment.length > 0 && (
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
              <option value={200}>200 รายการ / หน้า</option>
              <option value="all">แสดงทั้งหมด ({filteredEquipment.length})</option>
            </select>
            <span className="text-slate-400">|</span>
            <span>
              ลำดับที่ <strong className="text-slate-800">{filteredEquipment.length === 0 ? 0 : startIndex + 1}</strong> ถึง <strong className="text-slate-800">{pageSize === 'all' ? filteredEquipment.length : Math.min(startIndex + Number(pageSize), filteredEquipment.length)}</strong> จากทั้งหมด <strong className="text-blue-700">{filteredEquipment.length.toLocaleString()}</strong> รายการ
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

      {/* Export Floating Button */}
      <button
        onClick={handleExportExcel}
        className="fixed bottom-8 right-8 z-50 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 flex items-center justify-center group"
        title="Export Excel (ส่งออกทะเบียนเครื่องมือ)"
      >
        <Download size={24} />
        <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 ease-in-out font-medium">
          Export Excel
        </span>
      </button>

      {/* Delete Equipment Confirmation Modal */}
      {confirmDeleteEquipment && (
        <div id="delete-equipment-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-rose-100 bg-rose-50/70 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">ยืนยันการลบเครื่องมือแพทย์</h3>
                  <p className="text-xs text-slate-500">การดำเนินการนี้จะไม่สามารถย้อนกลับได้</p>
                </div>
              </div>
              <button
                id="btn-close-delete-modal"
                onClick={() => setConfirmDeleteEquipment(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-rose-100/50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-700">
                คุณแน่ใจหรือไม่ว่าต้องการลบรายการเครื่องมือแพทย์นี้ออกจากทะเบียน?
              </p>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">รหัสเครื่องมือ:</span>
                  <span className="font-mono font-bold text-blue-700">{confirmDeleteEquipment.code}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">ชื่อเครื่องมือ:</span>
                  <span className="font-bold text-slate-900 text-right max-w-[200px] truncate">{confirmDeleteEquipment.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">แผนก:</span>
                  <span className="text-slate-700">{confirmDeleteEquipment.department || '-'}</span>
                </div>
                {confirmDeleteEquipment.serialNumber && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Serial Number:</span>
                    <span className="font-mono text-slate-700">{confirmDeleteEquipment.serialNumber}</span>
                  </div>
                )}
                {confirmDeleteEquipment.model && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">ยี่ห้อ / รุ่น:</span>
                    <span className="text-slate-700">{confirmDeleteEquipment.manufacturer || ''} {confirmDeleteEquipment.model}</span>
                  </div>
                )}
              </div>
              <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-[11px] text-rose-700 flex items-center space-x-1.5">
                <AlertTriangle size={14} className="shrink-0 text-rose-500" />
                <span>คำเตือน: ข้อมูลประวัติเครื่องมือนี้จะถูกลบออกจากทะเบียนเครื่องมืออย่างถาวร</span>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                id="btn-cancel-delete-equipment"
                type="button"
                onClick={() => setConfirmDeleteEquipment(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                id="btn-confirm-delete-equipment"
                type="button"
                onClick={() => {
                  deleteEquipment(confirmDeleteEquipment.id);
                  setSuccessMsg(`ลบเครื่องมือ "${confirmDeleteEquipment.name}" (${confirmDeleteEquipment.code}) ออกจากระบบเรียบร้อยแล้ว`);
                  setConfirmDeleteEquipment(null);
                  setTimeout(() => setSuccessMsg(null), 5000);
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

      {/* Clear All Equipment Confirmation Modal */}
      {isClearAllModalOpen && (
        <div id="clear-all-equipment-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-rose-100 bg-rose-50/70 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">ยืนยันการล้างทะเบียนเครื่องมือ</h3>
                  <p className="text-xs text-slate-500">การดำเนินการนี้จะไม่สามารถย้อนกลับได้</p>
                </div>
              </div>
              <button
                id="btn-close-clear-all-modal"
                onClick={() => setIsClearAllModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-rose-100/50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-700">
                คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลเครื่องมือแพทย์ทั้งหมด ({equipment.length} รายการ) ออกจากระบบ?
              </p>
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
                <AlertTriangle size={16} className="shrink-0 text-rose-500" />
                <span>คำเตือน: ข้อมูลทะเบียนเครื่องมือแพทย์ทั้งหมดจะถูกลบอย่างถาวร</span>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                id="btn-cancel-clear-all"
                type="button"
                onClick={() => setIsClearAllModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                id="btn-confirm-clear-all"
                type="button"
                onClick={async () => {
                  await clearAllEquipment();
                  setIsClearAllModalOpen(false);
                  setSuccessMsg('ลบข้อมูลทะเบียนเครื่องมือแพทย์ทั้งหมดออกจากระบบเรียบร้อยแล้ว');
                  setTimeout(() => setSuccessMsg(null), 5000);
                }}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Trash2 size={15} />
                <span>ยืนยันล้างข้อมูลทั้งหมด</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {isDeptModalOpen && (
        <Suspense fallback={null}>
          <AddDepartmentModal
            isOpen={isDeptModalOpen}
            onClose={() => setIsDeptModalOpen(false)}
            onDepartmentAdded={(newDept) => {
              setFormData(prev => ({ ...prev, department: newDept }));
            }}
          />
        </Suspense>
      )}

      {/* Import Excel Modal */}
      {isImportModalOpen && (
        <Suspense fallback={null}>
          <ImportExcelModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onImport={(importedItems) => {
              const count = bulkAddEquipment(importedItems);
              setSuccessMsg(`นำเข้าข้อมูลเครื่องมือแพทย์สำเร็จจำนวน ${count} รายการเรียบร้อยแล้ว!`);
              setTimeout(() => setSuccessMsg(null), 6000);
            }}
          />
        </Suspense>
      )}

      {/* Direct Edit Equipment Modal */}
      {selectedEquipmentForEdit && isAdmin && (
        <Suspense fallback={null}>
          <EditEquipmentModal
            isOpen={Boolean(selectedEquipmentForEdit)}
            equipment={selectedEquipmentForEdit}
            onClose={() => setSelectedEquipmentForEdit(null)}
            onSave={handleSaveEquipment}
            departments={allDepartments}
            isAdmin={isAdmin}
          />
        </Suspense>
      )}

      {/* Equipment Print Modal (Mutation IN / Inspection / Register List) */}
      {(printingEquipment || isPrintListModalOpen) && (
        <Suspense fallback={null}>
          <EquipmentPrintModal
            equipment={printingEquipment}
            equipmentList={filteredEquipment}
            isOpen={Boolean(printingEquipment || isPrintListModalOpen)}
            onClose={() => {
              setPrintingEquipment(null);
              setIsPrintListModalOpen(false);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
