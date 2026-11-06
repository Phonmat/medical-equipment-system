import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { PoolLoan, PoolLoanStatus, PoolReturnCondition, Equipment } from '../types';
import { 
  Layers, Plus, Search, Filter, Calendar, Clock, CheckCircle2, 
  AlertCircle, RotateCcw, Printer, Pencil, Trash2, X, Check, 
  Building2, User, FileText, ArrowRight, Download, Eye, AlertTriangle, Sparkles
} from 'lucide-react';
import { formatDateSlash } from '../utils/dateUtils';
import EquipmentSearchSelect from '../components/EquipmentSearchSelect';

export default function PoolView() {
  const { equipment, poolLoans, departments, addPoolLoan, updatePoolLoan, returnPoolLoan, deletePoolLoan, userRole } = useAppStore();
  const isAdmin = userRole === 'Super Admin' || userRole === 'Admin';
  const canManagePool = isAdmin || userRole === 'Pool';

  const [activeTab, setActiveTab] = useState<'loans' | 'inventory'>('loans');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<PoolLoan | null>(null);
  const [returningLoan, setReturningLoan] = useState<PoolLoan | null>(null);
  const [printingLoan, setPrintingLoan] = useState<PoolLoan | null>(null);
  const [loanToDelete, setLoanToDelete] = useState<PoolLoan | null>(null);

  // Form State for Add
  const todayStr = new Date().toISOString().split('T')[0];
  const next7DaysStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    equipmentId: '',
    borrowerDepartment: '',
    borrowerName: '',
    borrowDate: todayStr,
    borrowTime: new Date().toTimeString().slice(0, 5),
    expectedReturnDate: next7DaysStr,
    purpose: '',
    issuedBy: '',
    notes: ''
  });

  // Form State for Return
  const [returnData, setReturnData] = useState({
    actualReturnDate: todayStr,
    returnedTo: '',
    returnCondition: 'normal' as PoolReturnCondition,
    notes: ''
  });

  // Check and auto-calculate loan stats
  const activeLoans = useMemo(() => {
    return poolLoans.map(loan => {
      // Auto determine if overdue
      if (loan.status === 'borrowed' && loan.expectedReturnDate) {
        const expDate = new Date(loan.expectedReturnDate);
        const now = new Date(todayStr);
        if (!isNaN(expDate.getTime()) && expDate < now) {
          return { ...loan, isOverdueCalc: true };
        }
      }
      return { ...loan, isOverdueCalc: loan.status === 'overdue' };
    });
  }, [poolLoans, todayStr]);

  // Statistics
  const totalLoansCount = poolLoans.length;
  const currentlyBorrowedCount = activeLoans.filter(l => l.status === 'borrowed' || l.status === 'overdue').length;
  const overdueCount = activeLoans.filter(l => l.isOverdueCalc && l.status !== 'returned').length;
  const returnedCount = poolLoans.filter(l => l.status === 'returned').length;

  // Filtered Loans
  const filteredLoans = useMemo(() => {
    return activeLoans.filter(loan => {
      // Search
      const matchSearch = 
        (loan.equipmentCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (loan.equipmentName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (loan.borrowerDepartment || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (loan.borrowerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (loan.purpose || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (loan.issuedBy || '').toLowerCase().includes(searchTerm.toLowerCase());

      // Status
      let matchStatus = true;
      if (statusFilter === 'borrowed') {
        matchStatus = loan.status === 'borrowed' && !loan.isOverdueCalc;
      } else if (statusFilter === 'overdue') {
        matchStatus = loan.isOverdueCalc && loan.status !== 'returned';
      } else if (statusFilter === 'returned') {
        matchStatus = loan.status === 'returned';
      }

      // Department
      const matchDept = deptFilter === 'all' || loan.borrowerDepartment === deptFilter;

      return matchSearch && matchStatus && matchDept;
    });
  }, [activeLoans, searchTerm, statusFilter, deptFilter]);

  // Pool Inventory: active equipment and their current loan status
  const poolInventory = useMemo(() => {
    return equipment.map(eq => {
      const activeLoan = activeLoans.find(l => l.equipmentId === eq.id && l.status !== 'returned');
      let availability: 'available' | 'borrowed' | 'maintenance' | 'decommissioned' = 'available';

      if (eq.status === 'decommissioned') {
        availability = 'decommissioned';
      } else if (eq.status === 'repairing') {
        availability = 'maintenance';
      } else if (activeLoan) {
        availability = 'borrowed';
      }

      return {
        ...eq,
        availability,
        currentLoan: activeLoan
      };
    });
  }, [equipment, activeLoans]);

  const availableEquipmentCount = poolInventory.filter(e => e.availability === 'available').length;

  // Handle open add with specific equipment pre-selected
  const handleOpenAddForEquipment = (eqId: string) => {
    const targetEq = equipment.find(e => e.id === eqId);
    setFormData({
      equipmentId: eqId,
      borrowerDepartment: '',
      borrowerName: '',
      borrowDate: todayStr,
      borrowTime: new Date().toTimeString().slice(0, 5),
      expectedReturnDate: next7DaysStr,
      purpose: '',
      issuedBy: '',
      notes: ''
    });
    setIsAddModalOpen(true);
  };

  // Submit Add Loan
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipmentId || !formData.borrowerDepartment) return;

    const eq = equipment.find(e => e.id === formData.equipmentId);
    
    addPoolLoan({
      equipmentId: formData.equipmentId,
      equipmentCode: eq?.code || 'EQ-POOL',
      equipmentName: eq?.name || 'เครื่องมือแพทย์ Pool',
      borrowerDepartment: formData.borrowerDepartment,
      borrowerName: formData.borrowerName,
      borrowDate: formData.borrowDate,
      borrowTime: formData.borrowTime,
      expectedReturnDate: formData.expectedReturnDate,
      purpose: formData.purpose,
      status: 'borrowed',
      issuedBy: formData.issuedBy,
      notes: formData.notes
    });

    setIsAddModalOpen(false);
    setFormData({
      equipmentId: '',
      borrowerDepartment: '',
      borrowerName: '',
      borrowDate: todayStr,
      borrowTime: new Date().toTimeString().slice(0, 5),
      expectedReturnDate: next7DaysStr,
      purpose: '',
      issuedBy: '',
      notes: ''
    });
  };

  // Submit Return
  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningLoan) return;

    returnPoolLoan(returningLoan.id, {
      actualReturnDate: returnData.actualReturnDate,
      returnedTo: returnData.returnedTo,
      returnCondition: returnData.returnCondition,
      notes: returnData.notes
    });

    setReturningLoan(null);
    setReturnData({
      actualReturnDate: todayStr,
      returnedTo: '',
      returnCondition: 'normal',
      notes: ''
    });
  };

  // Submit Edit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLoan) return;

    const eq = equipment.find(e => e.id === editingLoan.equipmentId);
    updatePoolLoan(editingLoan.id, {
      ...editingLoan,
      equipmentCode: eq?.code || editingLoan.equipmentCode,
      equipmentName: eq?.name || editingLoan.equipmentName
    });

    setEditingLoan(null);
  };

  // Export to Excel
  const exportToExcel = async () => {
    const XLSX = await import('xlsx');
    const rows = filteredLoans.map((loan, idx) => ({
      'ลำดับ': idx + 1,
      'รหัสเครื่องมือ': loan.equipmentCode || '-',
      'ชื่อเครื่องมือแพทย์': loan.equipmentName || '-',
      'แผนกที่ยืม': loan.borrowerDepartment,
      'ผู้ขอยืม': loan.borrowerName || '-',
      'วันที่ยืม': loan.borrowDate + (loan.borrowTime ? ` ${loan.borrowTime}` : ''),
      'กำหนดส่งคืน': loan.expectedReturnDate || '-',
      'วันที่คืนจริง': loan.actualReturnDate || '-',
      'สถานะ': loan.status === 'returned' ? 'คืนแล้ว' : (loan.isOverdueCalc ? 'เกินกำหนด' : 'กำลังยืม'),
      'สภาพตอนรับคืน': loan.returnCondition === 'normal' ? 'ปกติ' : loan.returnCondition === 'damaged' ? 'ชำรุด' : loan.returnCondition === 'needs_cleaning' ? 'ต้องทำความสะอาด' : '-',
      'ผู้จ่ายเครื่อง': loan.issuedBy || '-',
      'ผู้รับคืน': loan.returnedTo || '-',
      'วัตถุประสงค์': loan.purpose || '-',
      'หมายเหตุ': loan.notes || '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pool_Loans');
    XLSX.writeFile(workbook, `Medical_Equipment_Pool_Report_${todayStr}.xlsx`);
  };

  // Print Slip Action
  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
              <Layers size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">งาน Pool (ศูนย์เครื่องมือแพทย์ส่วนกลาง)</h2>
              <p className="text-xs text-slate-500 mt-0.5">ระบบบันทึกและติดตามการยืม-คืนเครื่องมือแพทย์ส่วนกลาง (Equipment Pool Management)</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={exportToExcel}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all border border-slate-200"
          >
            <Download size={15} />
            <span>ส่งออก Excel</span>
          </button>

          {canManagePool && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
            >
              <Plus size={16} />
              <span>บันทึกการยืมเครื่องมือ</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div 
          onClick={() => { setStatusFilter('borrowed'); setActiveTab('loans'); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'borrowed' && activeTab === 'loans'
              ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20' 
              : 'bg-white border-slate-200 hover:border-blue-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">กำลังถูกยืม</span>
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
              <RotateCcw size={15} />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-700 mt-2">{currentlyBorrowedCount}</p>
          <span className="text-[11px] text-slate-400">รายการที่ยังไม่ส่งคืน</span>
        </div>

        <div 
          onClick={() => { setStatusFilter('overdue'); setActiveTab('loans'); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'overdue' && activeTab === 'loans'
              ? 'bg-red-50/80 border-red-300 ring-2 ring-red-500/20' 
              : 'bg-white border-slate-200 hover:border-red-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">เกินกำหนดคืน</span>
            <div className="p-1.5 bg-red-100 text-red-700 rounded-lg">
              <AlertTriangle size={15} />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-600 mt-2">{overdueCount}</p>
          <span className="text-[11px] text-red-500 font-medium">ต้องติดตามด่วน</span>
        </div>

        <div 
          onClick={() => { setStatusFilter('returned'); setActiveTab('loans'); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'returned' && activeTab === 'loans'
              ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20' 
              : 'bg-white border-slate-200 hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">คืนแล้ว</span>
            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{returnedCount}</p>
          <span className="text-[11px] text-slate-400">รับคืนเรียบร้อย</span>
        </div>

        <div 
          onClick={() => setActiveTab('inventory')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            activeTab === 'inventory'
              ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20' 
              : 'bg-white border-slate-200 hover:border-indigo-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">เครื่องพร้อมใช้</span>
            <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
              <Sparkles size={15} />
            </div>
          </div>
          <p className="text-2xl font-bold text-indigo-700 mt-2">{availableEquipmentCount}</p>
          <span className="text-[11px] text-slate-400">พร้อมให้ยืมในคลัง</span>
        </div>

        <div 
          onClick={() => { setStatusFilter('all'); setActiveTab('loans'); }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'all' && activeTab === 'loans'
              ? 'bg-slate-100 border-slate-300' 
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">รายการยืมทั้งหมด</span>
            <div className="p-1.5 bg-slate-100 text-slate-700 rounded-lg">
              <FileText size={15} />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{totalLoansCount}</p>
          <span className="text-[11px] text-slate-400">ประวัติในระบบ</span>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center space-x-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('loans')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'loans'
              ? 'border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <RotateCcw size={15} />
          <span>รายการยืม-คืนเครื่องมือแพทย์ ({poolLoans.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'inventory'
              ? 'border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-lg'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers size={15} />
          <span>สถานะเครื่องมือแพทย์ Pool ({equipment.length})</span>
        </button>
      </div>

      {/* Tab Content 1: Loans & Transactions */}
      {activeTab === 'loans' && (
        <div className="space-y-4">
          {/* Filters Row */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="ค้นหารหัสเครื่อง, ชื่อเครื่อง, แผนกที่ยืม, ผู้ขอยืม..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50/50"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Status Filter */}
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-slate-500 mr-2 font-medium">สถานะ:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
                >
                  <option value="all">ทั้งหมด ({totalLoansCount})</option>
                  <option value="borrowed">กำลังยืม ({currentlyBorrowedCount - overdueCount})</option>
                  <option value="overdue">เกินกำหนด ({overdueCount})</option>
                  <option value="returned">คืนแล้ว ({returnedCount})</option>
                </select>
              </div>

              {/* Department Filter */}
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                <Building2 size={14} className="text-slate-400 mr-1.5" />
                <select
                  value={deptFilter}
                  onChange={e => setDeptFilter(e.target.value)}
                  className="bg-transparent font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
                >
                  <option value="all">ทุกแผนกที่ยืม</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {(searchTerm || statusFilter !== 'all' || deptFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setDeptFilter('all');
                  }}
                  className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          </div>

          {/* Loans Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="w-full text-left border-separate border-spacing-0 text-xs">
                <thead className="bg-slate-50 sticky top-0 z-10 shadow-xs">
                  <tr className="border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="px-4 py-3.5 bg-slate-50 border-b border-slate-200">รหัสเครื่องมือ</th>
                    <th className="px-4 py-3.5 bg-slate-50 border-b border-slate-200">ชื่อเครื่องมือแพทย์</th>
                    <th className="px-4 py-3.5 bg-slate-50 border-b border-slate-200">แผนกที่ยืม</th>
                    <th className="px-4 py-3.5 bg-slate-50 border-b border-slate-200">ผู้ขอยืม</th>
                    <th className="px-4 py-3.5 bg-slate-50 border-b border-slate-200">วันที่ยืม</th>
                    <th className="px-4 py-3.5 bg-slate-50 border-b border-slate-200">กำหนดส่งคืน</th>
                    <th className="px-4 py-3.5 bg-slate-50 border-b border-slate-200">วันที่คืนจริง</th>
                    <th className="px-4 py-3.5 bg-slate-50 border-b border-slate-200">วัตถุประสงค์</th>
                    <th className="px-4 py-3.5 bg-slate-50 border-b border-slate-200">สถานะ</th>
                    <th className="px-4 py-3.5 text-right bg-slate-50 border-b border-slate-200 sticky right-0 top-0 z-20">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLoans.map(loan => {
                    const isReturned = loan.status === 'returned';
                    const isOverdue = loan.isOverdueCalc && !isReturned;

                    return (
                      <tr key={loan.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {loan.equipmentCode || 'EQ-POOL'}
                        </td>
                        <td className="px-4 py-3 text-slate-800 font-medium max-w-[200px]">
                          <div className="truncate font-semibold">{loan.equipmentName}</div>
                          {loan.issuedBy && (
                            <div className="text-[10px] text-slate-400">ผู้จ่าย: {loan.issuedBy}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-blue-700 whitespace-nowrap">
                          <span className="px-2.5 py-1 bg-blue-50 rounded-lg border border-blue-100">
                            {loan.borrowerDepartment}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          <div className="font-medium">{loan.borrowerName || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          <div className="font-medium font-mono">{formatDateSlash(loan.borrowDate)}</div>
                          {loan.borrowTime && (
                            <div className="text-[10px] text-slate-400">{loan.borrowTime} น.</div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className={`font-semibold font-mono ${isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                            {formatDateSlash(loan.expectedReturnDate)}
                          </div>
                          {isOverdue && (
                            <span className="text-[10px] text-red-500 font-bold flex items-center gap-0.5">
                              <AlertTriangle size={10} /> เกินกำหนด
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {loan.actualReturnDate ? (
                            <div>
                              <div className="text-emerald-700 font-semibold font-mono">{formatDateSlash(loan.actualReturnDate)}</div>
                              {loan.returnedTo && (
                                <div className="text-[10px] text-slate-400">รับโดย: {loan.returnedTo}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-[180px]">
                          <div className="truncate" title={loan.purpose || loan.notes || '-'}>
                            {loan.purpose || loan.notes || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {isReturned ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[11px]">
                              <CheckCircle2 size={12} />
                              <span>คืนแล้ว</span>
                            </span>
                          ) : isOverdue ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-800 rounded-full font-bold text-[11px] animate-pulse">
                              <AlertCircle size={12} />
                              <span>เกินกำหนดคืน</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full font-bold text-[11px]">
                              <Clock size={12} />
                              <span>กำลังยืม</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-1">
                            {isAdmin && !isReturned && (
                              <button
                                onClick={() => {
                                  setReturningLoan(loan);
                                  setReturnData({
                                    actualReturnDate: todayStr,
                                    returnedTo: '',
                                    returnCondition: 'normal',
                                    notes: ''
                                  });
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-colors inline-flex items-center space-x-1"
                                title="บันทึกรับคืนเครื่องมือ"
                              >
                                <Check size={12} />
                                <span>คืนเครื่อง</span>
                              </button>
                            )}

                            <button
                              onClick={() => setPrintingLoan(loan)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="พิมพ์ใบยืม-คืน"
                            >
                              <Printer size={15} />
                            </button>

                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => setEditingLoan(loan)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="แก้ไขข้อมูลการยืม"
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  onClick={() => setLoanToDelete(loan)}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="ลบรายการ"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredLoans.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                            <Layers size={24} />
                          </div>
                          <p className="text-sm font-medium text-slate-600">ไม่พบรายการยืม-คืนตามเงื่อนไขที่ค้นหา</p>
                          {canManagePool && (
                            <button
                              onClick={() => setIsAddModalOpen(true)}
                              className="mt-2 text-xs text-blue-600 hover:underline font-semibold"
                            >
                              + บันทึกการยืมเครื่องมือใหม่
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
        </div>
      )}

      {/* Tab Content 2: Pool Inventory & Availability */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">ทะเบียนเครื่องมือแพทย์และสถานะความพร้อมใช้งาน (Pool Equipment)</h3>
              <p className="text-xs text-slate-500">ตรวจสอบเครื่องมือที่ว่างพร้อมจ่าย หรือกำลังถูกยืมประจำแผนกต่างๆ</p>
            </div>
            <div className="flex items-center space-x-2 text-xs font-semibold">
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
                พร้อมใช้: {availableEquipmentCount} เครื่อง
              </span>
              <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg border border-amber-100">
                ถูกยืม: {currentlyBorrowedCount} เครื่อง
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {poolInventory.map(item => {
              const isAvailable = item.availability === 'available';
              const isBorrowed = item.availability === 'borrowed';
              const isRepairing = item.availability === 'maintenance';
              const isDecom = item.availability === 'decommissioned';

              return (
                <div 
                  key={item.id} 
                  className={`bg-white rounded-2xl border p-4 shadow-xs flex flex-col justify-between transition-all ${
                    isAvailable ? 'border-slate-200 hover:border-blue-300 hover:shadow-md' :
                    isBorrowed ? 'border-amber-200 bg-amber-50/20' :
                    'border-slate-200 opacity-70 bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="px-2.5 py-0.5 bg-slate-100 font-mono font-bold text-xs text-slate-800 rounded-md">
                        {item.code}
                      </span>
                      {isAvailable ? (
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[11px] inline-flex items-center gap-1">
                          <CheckCircle2 size={11} /> พร้อมใช้
                        </span>
                      ) : isBorrowed ? (
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[11px] inline-flex items-center gap-1">
                          <Clock size={11} /> ถูกยืมใช้งาน
                        </span>
                      ) : isRepairing ? (
                        <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[11px]">
                          ส่งซ่อม
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-slate-200 text-slate-700 rounded-full font-bold text-[11px]">
                          จำหน่าย
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{item.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{item.model || 'Standard Model'} {item.manufacturer ? `• ${item.manufacturer}` : ''}</p>

                    <div className="mt-3 space-y-1 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="flex justify-between">
                        <span className="text-slate-400">สังกัดเดิม:</span>
                        <span className="font-medium text-slate-700">{item.department || 'ศูนย์เครื่องมือส่วนกลาง'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">ระดับความเสี่ยง:</span>
                        <span className={`font-semibold ${item.riskLevel === 'High' ? 'text-red-600' : item.riskLevel === 'Medium' ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {item.riskLevel} Risk
                        </span>
                      </div>
                      {isBorrowed && item.currentLoan && (
                        <div className="pt-2 mt-2 border-t border-slate-200/60 text-amber-900">
                          <div className="font-semibold text-xs">ยืมโดย: {item.currentLoan.borrowerDepartment}</div>
                          <div className="text-[11px] text-amber-700">ผู้ยืม: {item.currentLoan.borrowerName || '-'}</div>
                          <div className="text-[11px] text-amber-700">กำหนดคืน: {item.currentLoan.expectedReturnDate}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {canManagePool && (
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      {isAvailable ? (
                        <button
                          onClick={() => handleOpenAddForEquipment(item.id)}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center justify-center space-x-1.5"
                        >
                          <Plus size={14} />
                          <span>บันทึกขอยืมเครื่องนี้</span>
                        </button>
                      ) : isBorrowed && item.currentLoan ? (
                        <button
                          onClick={() => {
                            setReturningLoan(item.currentLoan!);
                            setReturnData({
                              actualReturnDate: todayStr,
                              returnedTo: '',
                              returnCondition: 'normal',
                              notes: ''
                            });
                          }}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center justify-center space-x-1.5"
                        >
                          <Check size={14} />
                          <span>บันทึกรับคืนเครื่อง</span>
                        </button>
                      ) : (
                        <div className="w-full text-center py-1.5 text-xs text-slate-400 font-medium">
                          ไม่พร้อมให้บริการ
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* -------------------- MODALS -------------------- */}

      {/* Modal 1: Add New Loan */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <Plus size={18} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">บันทึกการยืมเครื่องมือแพทย์ Pool</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  เลือกเครื่องมือแพทย์ (พิมพ์ค้นหารหัสเครื่องได้) <span className="text-red-500">*</span>
                </label>
                <EquipmentSearchSelect
                  equipment={equipment}
                  selectedId={formData.equipmentId}
                  onSelect={(eqId) => setFormData(prev => ({ ...prev, equipmentId: eqId }))}
                  placeholder="พิมพ์ค้นหารหัสเครื่อง, ชื่อเครื่องมือ หรือแผนก..."
                  required
                  accentColor="purple"
                  filterFn={(eq) => eq.status !== 'decommissioned'}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">แผนก/หน่วยงานที่ขอยืม *</label>
                  <select
                    required
                    value={formData.borrowerDepartment}
                    onChange={e => setFormData({ ...formData, borrowerDepartment: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- เลือกแผนก --</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ชื่อผู้ขอยืม / ผู้รับผิดชอบ</label>
                  <input
                    type="text"
                    placeholder="เช่น พว.สมศรี, นพ.สมชาย"
                    value={formData.borrowerName}
                    onChange={e => setFormData({ ...formData, borrowerName: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">วันที่ยืม *</label>
                  <input
                    type="date"
                    required
                    value={formData.borrowDate}
                    onChange={e => setFormData({ ...formData, borrowDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">เวลายืม</label>
                  <input
                    type="time"
                    value={formData.borrowTime}
                    onChange={e => setFormData({ ...formData, borrowTime: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">กำหนดส่งคืน *</label>
                  <input
                    type="date"
                    required
                    value={formData.expectedReturnDate}
                    onChange={e => setFormData({ ...formData, expectedReturnDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">วัตถุประสงค์การยืม</label>
                <input
                  type="text"
                  placeholder="เช่น สำรองใช้งานฉุกเฉิน, เครื่องมือแผนกส่งซ่อม, รับผู้ป่วยหนักเคสพิเศษ"
                  value={formData.purpose}
                  onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">เจ้าหน้าที่ผู้จ่ายเครื่อง (Pool)</label>
                  <input
                    type="text"
                    placeholder="ชื่อช่าง/เจ้าหน้าที่ศูนย์เครื่องมือ"
                    value={formData.issuedBy}
                    onChange={e => setFormData({ ...formData, issuedBy: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">หมายเหตุเพิ่มเติม</label>
                  <input
                    type="text"
                    placeholder="เช่น สายไฟครบชุด, มีเสาน้ำเกลือพร้อมใช้"
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  บันทึกการยืม
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Return Loan Modal */}
      {returningLoan && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 bg-emerald-50 border-b border-emerald-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-600 text-white rounded-lg">
                  <Check size={18} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">บันทึกรับคืนเครื่องมือแพทย์</h3>
              </div>
              <button onClick={() => setReturningLoan(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-slate-700 space-y-1">
                <div className="font-bold text-slate-900 text-sm">{returningLoan.equipmentName}</div>
                <div className="flex justify-between text-slate-500">
                  <span>รหัส: <b className="font-mono text-slate-800">{returningLoan.equipmentCode}</b></span>
                  <span>แผนกที่ยืม: <b className="text-blue-700">{returningLoan.borrowerDepartment}</b></span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>วันที่ยืม: {returningLoan.borrowDate}</span>
                  <span>กำหนดคืน: {returningLoan.expectedReturnDate}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">วันที่รับคืนจริง *</label>
                <input
                  type="date"
                  required
                  value={returnData.actualReturnDate}
                  onChange={e => setReturnData({ ...returnData, actualReturnDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">สภาพเครื่องมือตอนรับคืน *</label>
                <select
                  value={returnData.returnCondition}
                  onChange={e => setReturnData({ ...returnData, returnCondition: e.target.value as PoolReturnCondition })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="normal">สภาพปกติ พร้อมใช้งานต่อได้ทันที</option>
                  <option value="needs_cleaning">ต้องส่งทำความสะอาด / ฆ่าเชื้อก่อนนำกลับเข้าคลัง</option>
                  <option value="damaged">ชำรุด / มีปัญหา (ต้องส่งซ่อมบำรุง)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">เจ้าหน้าที่ผู้รับคืน (Pool)</label>
                <input
                  type="text"
                  placeholder="ชื่อผู้รับคืน / ตรวจสอบสภาพ"
                  value={returnData.returnedTo}
                  onChange={e => setReturnData({ ...returnData, returnedTo: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">หมายเหตุการรับคืน</label>
                <textarea
                  rows={2}
                  placeholder="บันทึกผลการตรวจสอบ หรืออุปกรณ์ประกอบที่ได้รับคืน..."
                  value={returnData.notes}
                  onChange={e => setReturnData({ ...returnData, notes: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReturningLoan(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs inline-flex items-center space-x-1.5"
                >
                  <Check size={14} />
                  <span>ยืนยันรับคืนเครื่อง</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Edit Loan Modal */}
      {editingLoan && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <Pencil size={18} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">แก้ไขข้อมูลการยืม-คืน</h3>
              </div>
              <button onClick={() => setEditingLoan(null)} className="p-1.5 text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">แผนกที่ยืม</label>
                  <select
                    value={editingLoan.borrowerDepartment}
                    onChange={e => setEditingLoan({ ...editingLoan, borrowerDepartment: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                  >
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ชื่อผู้ขอยืม</label>
                  <input
                    type="text"
                    value={editingLoan.borrowerName || ''}
                    onChange={e => setEditingLoan({ ...editingLoan, borrowerName: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">วันที่ยืม</label>
                  <input
                    type="date"
                    value={editingLoan.borrowDate}
                    onChange={e => setEditingLoan({ ...editingLoan, borrowDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">เวลายืม</label>
                  <input
                    type="time"
                    value={editingLoan.borrowTime || ''}
                    onChange={e => setEditingLoan({ ...editingLoan, borrowTime: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">กำหนดส่งคืน</label>
                  <input
                    type="date"
                    value={editingLoan.expectedReturnDate}
                    onChange={e => setEditingLoan({ ...editingLoan, expectedReturnDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">สถานะ</label>
                  <select
                    value={editingLoan.status}
                    onChange={e => setEditingLoan({ ...editingLoan, status: e.target.value as PoolLoanStatus })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="borrowed">กำลังยืม</option>
                    <option value="overdue">เกินกำหนดคืน</option>
                    <option value="returned">คืนแล้ว</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">วันที่คืนจริง</label>
                  <input
                    type="date"
                    value={editingLoan.actualReturnDate || ''}
                    onChange={e => setEditingLoan({ ...editingLoan, actualReturnDate: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">วัตถุประสงค์</label>
                <input
                  type="text"
                  value={editingLoan.purpose || ''}
                  onChange={e => setEditingLoan({ ...editingLoan, purpose: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ผู้จ่ายเครื่อง</label>
                  <input
                    type="text"
                    value={editingLoan.issuedBy || ''}
                    onChange={e => setEditingLoan({ ...editingLoan, issuedBy: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">ผู้รับคืน</label>
                  <input
                    type="text"
                    value={editingLoan.returnedTo || ''}
                    onChange={e => setEditingLoan({ ...editingLoan, returnedTo: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">หมายเหตุ</label>
                <textarea
                  rows={2}
                  value={editingLoan.notes || ''}
                  onChange={e => setEditingLoan({ ...editingLoan, notes: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingLoan(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Print Loan Slip */}
      {printingLoan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Printer size={18} className="text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">ใบยืม-คืนเครื่องมือแพทย์ส่วนกลาง (Equipment Loan Slip)</h3>
              </div>
              <button onClick={() => setPrintingLoan(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-8 space-y-6 text-slate-800 bg-white" id="printable-loan-slip">
              {/* Slip Header */}
              <div className="text-center pb-4 border-b-2 border-slate-800">
                <h2 className="text-xl font-bold uppercase tracking-wide">โรงพยาบาล / ศูนย์เครื่องมือแพทย์ส่วนกลาง</h2>
                <h3 className="text-base font-semibold text-slate-700 mt-1">แบบฟอร์มการยืม-คืนเครื่องมือแพทย์ (Medical Equipment Loan Form)</h3>
                <p className="text-xs text-slate-500 mt-1">เลขที่อ้างอิง: POOL-{printingLoan.id.slice(0, 8).toUpperCase()} | วันที่ออกเอกสาร: {formatDateSlash(todayStr)}</p>
              </div>

              {/* Loan Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-slate-900 border-b pb-1">ข้อมูลเครื่องมือแพทย์</h4>
                  <div><span className="text-slate-500">รหัสเครื่องมือ:</span> <b className="font-mono">{printingLoan.equipmentCode}</b></div>
                  <div><span className="text-slate-500">ชื่อเครื่องมือ:</span> <b>{printingLoan.equipmentName}</b></div>
                </div>

                <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-slate-900 border-b pb-1">ข้อมูลการยืม</h4>
                  <div><span className="text-slate-500">หน่วยงาน/แผนกที่ยืม:</span> <b className="text-blue-800">{printingLoan.borrowerDepartment}</b></div>
                  <div><span className="text-slate-500">ผู้ขอยืม:</span> <b>{printingLoan.borrowerName || '-'}</b></div>
                  <div><span className="text-slate-500">วันที่ยืม:</span> <b>{formatDateSlash(printingLoan.borrowDate)} {printingLoan.borrowTime || ''}</b></div>
                  <div><span className="text-slate-500">กำหนดส่งคืน:</span> <b className="text-red-700">{formatDateSlash(printingLoan.expectedReturnDate)}</b></div>
                </div>
              </div>

              {/* Purpose & Notes */}
              <div className="text-xs space-y-1 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div><span className="font-semibold text-slate-700">วัตถุประสงค์การยืม:</span> {printingLoan.purpose || 'สำรองใช้งานตามภารกิจ'}</div>
                <div><span className="font-semibold text-slate-700">หมายเหตุ / อุปกรณ์ประกอบ:</span> {printingLoan.notes || 'ตรวจสอบการทำงานครบถ้วน'}</div>
                {printingLoan.status === 'returned' && (
                  <div className="mt-2 pt-2 border-t text-emerald-800 font-semibold">
                    บันทึกการส่งคืน: คืนเมื่อ {formatDateSlash(printingLoan.actualReturnDate)} | สภาพ: {printingLoan.returnCondition === 'normal' ? 'ปกติพร้อมใช้' : printingLoan.returnCondition} | ผู้รับคืน: {printingLoan.returnedTo || '-'}
                  </div>
                )}
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-4 pt-8 text-center text-xs">
                <div className="space-y-8">
                  <div className="border-b border-dashed border-slate-400 pb-1">
                    <span className="text-slate-400">({printingLoan.borrowerName || '...........................................'})</span>
                  </div>
                  <p className="font-semibold">ผู้ขอยืมเครื่องมือ</p>
                </div>

                <div className="space-y-8">
                  <div className="border-b border-dashed border-slate-400 pb-1">
                    <span className="text-slate-400">({printingLoan.issuedBy || '...........................................'})</span>
                  </div>
                  <p className="font-semibold">ผู้จ่ายเครื่องมือ (Pool)</p>
                </div>

                <div className="space-y-8">
                  <div className="border-b border-dashed border-slate-400 pb-1">
                    <span className="text-slate-400">({printingLoan.returnedTo || '...........................................'})</span>
                  </div>
                  <p className="font-semibold">ผู้รับคืน / ตรวจสอบสภาพ</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setPrintingLoan(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100"
              >
                ปิด
              </button>
              <button
                type="button"
                onClick={handlePrintSlip}
                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-xs inline-flex items-center space-x-1.5"
              >
                <Printer size={15} />
                <span>สั่งพิมพ์เอกสาร (Print)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Delete Confirmation */}
      {loanToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-rose-50 border-b border-rose-100">
              <h3 className="font-bold text-slate-900 text-sm">ยืนยันการลบรายการยืม-คืน</h3>
              <button onClick={() => setLoanToDelete(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 text-xs text-slate-600">
              คุณต้องการลบประวัติการยืมเครื่องมือ <b>{loanToDelete.equipmentName}</b> ของแผนก <b>{loanToDelete.borrowerDepartment}</b> ออกจากระบบหรือไม่?
            </div>
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setLoanToDelete(null)}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  deletePoolLoan(loanToDelete.id);
                  setLoanToDelete(null);
                }}
                className="px-3.5 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 shadow-xs"
              >
                ลบรายการ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
