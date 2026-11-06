import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { AlertTriangle, Pencil, Trash2, X, Check, Search, Printer } from 'lucide-react';
import { Decommission } from '../types';
import SignaturePad from '../components/SignaturePad';
import DecommissionReportModal from '../components/DecommissionReportModal';
import { formatDateSlash } from '../utils/dateUtils';

export default function DecommissionView({ 
  initialEquipmentId = '',
  initialIsAdding = false
}: { 
  initialEquipmentId?: string;
  initialIsAdding?: boolean;
} = {}) {
  const { equipment, decommissions, addDecommission, updateDecommission, deleteDecommission, userRole } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [isAdding, setIsAdding] = useState(initialIsAdding);
  const [editingDecom, setEditingDecom] = useState<Decommission | null>(null);
  const [decomToDelete, setDecomToDelete] = useState<Decommission | null>(null);
  const [printingDecom, setPrintingDecom] = useState<Decommission | null>(null);
  const [formData, setFormData] = useState({
    equipmentId: initialEquipmentId,
    reason: '',
    date: new Date().toISOString().split('T')[0],
    technician: '',
    technicianSignature: '',
    approvedBy: '',
    approverSignature: ''
  });
  const [editFormData, setEditFormData] = useState({
    reason: '',
    date: '',
    technician: '',
    technicianSignature: '',
    approvedBy: '',
    approverSignature: ''
  });

  const isAdmin = userRole === 'Super Admin' || userRole === 'Admin';

  // Can decommission active or repairing equipment
  const availableEquipment = equipment.filter(e => e.status !== 'decommissioned' || e.id === formData.equipmentId);

  const filteredAvailableEquipment = useMemo(() => {
    if (!equipmentSearch.trim()) return availableEquipment;
    const q = equipmentSearch.toLowerCase().trim();
    return availableEquipment.filter(eq => {
      const codeMatch = (eq.code || '').toLowerCase().includes(q);
      const nameMatch = (eq.name || '').toLowerCase().includes(q);
      const deptMatch = (eq.department || '').toLowerCase().includes(q);
      const modelMatch = (eq.model || '').toLowerCase().includes(q);
      const snMatch = (eq.serialNumber || '').toLowerCase().includes(q);
      const itrisMatch = (eq.itrisId || '').toLowerCase().includes(q);
      const vendorMatch = (eq.vendorCompany || '').toLowerCase().includes(q);
      return codeMatch || nameMatch || deptMatch || modelMatch || snMatch || itrisMatch || vendorMatch;
    });
  }, [availableEquipment, equipmentSearch]);

  const handleEquipmentSearchChange = (query: string) => {
    setEquipmentSearch(query);
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return;
    }

    // Find best match in available equipment
    const matches = availableEquipment.filter(eq => {
      const codeMatch = (eq.code || '').toLowerCase().includes(trimmed);
      const nameMatch = (eq.name || '').toLowerCase().includes(trimmed);
      const deptMatch = (eq.department || '').toLowerCase().includes(trimmed);
      const modelMatch = (eq.model || '').toLowerCase().includes(trimmed);
      const snMatch = (eq.serialNumber || '').toLowerCase().includes(trimmed);
      const itrisMatch = (eq.itrisId || '').toLowerCase().includes(trimmed);
      const vendorMatch = (eq.vendorCompany || '').toLowerCase().includes(trimmed);
      return codeMatch || nameMatch || deptMatch || modelMatch || snMatch || itrisMatch || vendorMatch;
    });

    if (matches.length > 0) {
      // 1. Check exact code/SN/name match first
      const exactMatch = matches.find(eq => 
        (eq.code || '').toLowerCase() === trimmed ||
        (eq.serialNumber || '').toLowerCase() === trimmed ||
        (eq.name || '').toLowerCase() === trimmed
      );
      
      // Auto select exact match or the top matching item automatically
      const targetEq = exactMatch || matches[0];
      setFormData(prev => ({ ...prev, equipmentId: targetEq.id }));
    }
  };

  // Include explicit decommission records + any equipment marked as 'decommissioned'
  const allDecommissions = useMemo(() => {
    const list = [...decommissions];
    const recordedEqIds = new Set(decommissions.map(d => d.equipmentId));

    equipment.forEach(eq => {
      if (eq.status === 'decommissioned' && !recordedEqIds.has(eq.id)) {
        list.push({
          id: `auto-decom-${eq.id}`,
          equipmentId: eq.id,
          reason: 'เปลี่ยนสถานะเป็นยกเลิกการใช้งาน',
          date: eq.registrationDate || eq.installationDate || new Date().toISOString().split('T')[0],
          technician: 'ผู้ดูแลระบบ',
          technicianSignature: '',
          approvedBy: 'หัวหน้างาน / ผู้มีอำนาจอนุมัติ',
          approverSignature: ''
        });
      }
    });
    return list;
  }, [decommissions, equipment]);

  const filteredDecommissions = useMemo(() => {
    return allDecommissions.filter(decom => {
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase().trim();
      const eq = equipment.find(e => e.id === decom.equipmentId);
      const codeMatch = (eq?.code || '').toLowerCase().includes(q);
      const nameMatch = (eq?.name || '').toLowerCase().includes(q);
      const deptMatch = (eq?.department || '').toLowerCase().includes(q);
      const reasonMatch = (decom.reason || '').toLowerCase().includes(q);
      const approverMatch = (decom.approvedBy || '').toLowerCase().includes(q);
      const techMatch = (decom.technician || '').toLowerCase().includes(q);
      const dateMatch = (decom.date || '').toLowerCase().includes(q);
      return codeMatch || nameMatch || deptMatch || reasonMatch || approverMatch || techMatch || dateMatch;
    });
  }, [allDecommissions, equipment, searchTerm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.equipmentId || !formData.reason) return;
    
    addDecommission(formData);
    setFormData({ 
      equipmentId: '', 
      reason: '', 
      date: new Date().toISOString().split('T')[0], 
      technician: '',
      technicianSignature: '',
      approvedBy: '', 
      approverSignature: '' 
    });
    setEquipmentSearch('');
    setIsAdding(false);
  };

  const handleStartEdit = (decom: Decommission) => {
    setEditingDecom(decom);
    setEditFormData({
      reason: decom.reason || '',
      date: decom.date || '',
      technician: decom.technician || '',
      technicianSignature: decom.technicianSignature || '',
      approvedBy: decom.approvedBy || '',
      approverSignature: decom.approverSignature || ''
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDecom) return;
    updateDecommission(editingDecom.id, editFormData);
    setEditingDecom(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">จัดการยกเลิกการใช้งาน</h2>
          <p className="text-xs text-slate-500 mt-1">ประวัติรายการยกเลิกการใช้งานเครื่องมือแพทย์ ({allDecommissions.length} รายการ)</p>
        </div>
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Quick Search Bar with Magnifying Glass */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาประวัติการยกเลิก..."
              className="pl-9 pr-7 py-2 bg-white border border-slate-300 rounded-lg text-sm w-52 sm:w-64 focus:w-80 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all shadow-2xs placeholder-slate-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                title="ล้างคำค้นหา"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-2xs"
          >
            <AlertTriangle size={16} />
            <span>{isAdding ? 'ยกเลิก' : 'ยกเลิกการใช้งานเครื่องมือ'}</span>
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl border border-red-200 shadow-sm mb-6 border-l-4 border-l-red-500 animate-in fade-in duration-200">
          <h3 className="text-lg font-medium text-slate-900 mb-2">ฟอร์มบันทึกการยกเลิกการใช้งาน</h3>
          <p className="text-xs text-red-600 mb-4 font-medium">คำเตือน: เครื่องมือที่ถูกยกเลิกการใช้งานจะถูกปรับสถานะเป็น "ชำรุด/ยกเลิกการใช้งาน"</p>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <label className="block text-sm font-medium text-slate-700">
                  เลือกเครื่องมือที่ต้องการยกเลิกการใช้งาน
                </label>
                <span className="text-xs text-slate-500">
                  (สามารถพิมพ์ค้นหาหรือเลือกจากรายการดรอปดาวน์ได้)
                </span>
              </div>

              {/* Quick Search Input for Equipment */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                <input
                  type="text"
                  value={equipmentSearch}
                  onChange={(e) => handleEquipmentSearchChange(e.target.value)}
                  placeholder="พิมพ์ค้นหาเครื่องมือ... (รหัสเครื่อง, ชื่อ, แผนก, ยี่ห้อ, รุ่น, SN)"
                  className="w-full pl-9.5 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-all"
                />
                {equipmentSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setEquipmentSearch('');
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title="ล้างคำค้นหา"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Instant Match Indicators if searching */}
              {equipmentSearch.trim() && filteredAvailableEquipment.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap text-xs bg-slate-100/70 p-2 rounded-lg border border-slate-200">
                  <span className="text-slate-500 font-medium">ผลการค้นหา ({filteredAvailableEquipment.length}):</span>
                  {filteredAvailableEquipment.slice(0, 3).map(eq => (
                    <button
                      key={eq.id}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, equipmentId: eq.id }));
                      }}
                      className={`px-2 py-0.5 rounded text-xs transition-colors ${
                        formData.equipmentId === eq.id
                          ? 'bg-red-600 text-white font-medium shadow-2xs'
                          : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      {eq.code} - {eq.name}
                    </button>
                  ))}
                  {filteredAvailableEquipment.length > 3 && (
                    <span className="text-slate-400 text-[11px]">และอีก {filteredAvailableEquipment.length - 3} เครื่อง (เลือกได้ที่ Dropdown ด้านล่าง)</span>
                  )}
                </div>
              )}

              {/* Standard Select Dropdown */}
              <div>
                <select
                  required
                  value={formData.equipmentId}
                  onChange={e => setFormData({...formData, equipmentId: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 font-mono bg-white"
                >
                  <option value="">-- กรุณาเลือกเครื่องมือ ({filteredAvailableEquipment.length} รายการ) --</option>
                  {filteredAvailableEquipment.map(eq => (
                    <option key={eq.id} value={eq.id}>
                      {eq.code} - {eq.name} [{eq.department || 'ไม่ระบุแผนก'}] ({eq.status === 'active' ? 'ปกติ' : 'กำลังซ่อม'})
                    </option>
                  ))}
                </select>
                {equipmentSearch && filteredAvailableEquipment.length === 0 && (
                  <p className="text-xs text-rose-500 mt-1">
                    ไม่พบเครื่องมือที่ตรงกับ "{equipmentSearch}" (คลิกปุ่มกากบาทเพื่อล้างคำค้นหาและแสดงเครื่องทั้งหมด)
                  </p>
                )}
              </div>

              {/* Selected Equipment Information Card */}
              {(() => {
                const selectedEq = equipment.find(e => e.id === formData.equipmentId);
                if (!selectedEq) return null;
                return (
                  <div className="p-3 bg-red-50/70 border border-red-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2 animate-in fade-in duration-200">
                    <div className="space-y-0.5">
                      <div className="text-red-900 font-semibold text-sm flex items-center flex-wrap gap-2">
                        <span className="font-mono">{selectedEq.code}</span>
                        <span className="font-normal text-slate-400">-</span>
                        <span>{selectedEq.name}</span>
                      </div>
                      <div className="text-slate-600 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>แผนก: <strong className="text-slate-800">{selectedEq.department || '-'}</strong></span>
                        {selectedEq.model && <span>รุ่น: <strong className="text-slate-800">{selectedEq.model}</strong></span>}
                        {selectedEq.serialNumber && <span>SN: <strong className="text-slate-800 font-mono">{selectedEq.serialNumber}</strong></span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, equipmentId: '' })}
                      className="self-start sm:self-center px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 rounded border border-red-200 transition-colors"
                    >
                      เปลี่ยนเครื่อง
                    </button>
                  </div>
                );
              })()}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">สาเหตุที่ชำรุด / เหตุผลการจำหน่าย</label>
              <textarea required value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" rows={3} placeholder="ระบุเหตุผลให้ชัดเจน..." />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">วันที่อนุมัติยกเลิกการใช้งาน</label>
              <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full sm:w-1/2 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
            </div>
            
            {/* Signature Pad Section - Technician & Approver */}
            <div className="md:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Technician / Inspector Signature */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <SignaturePad
                  value={formData.technicianSignature}
                  onChange={(sigUrl) => setFormData(prev => ({ ...prev, technicianSignature: sigUrl }))}
                  signerName={formData.technician}
                  onSignerNameChange={(name) => setFormData(prev => ({ ...prev, technician: name }))}
                  namePlaceholder="ระบุชื่อช่างผู้ตรวจสอบ / วิศวกรการแพทย์"
                  label="1. ลายมือชื่อช่างผู้ตรวจสอบ (Technician Signature)"
                />
              </div>

              {/* Approver Signature */}
              <div className="p-3.5 bg-red-50/40 rounded-xl border border-red-200/80">
                <SignaturePad
                  value={formData.approverSignature}
                  onChange={(sigUrl) => setFormData(prev => ({ ...prev, approverSignature: sigUrl }))}
                  signerName={formData.approvedBy}
                  onSignerNameChange={(name) => setFormData(prev => ({ ...prev, approvedBy: name }))}
                  namePlaceholder="ระบุชื่อผู้มีอำนาจอนุมัติ / ผู้อำนวยการ"
                  label="2. ลายมือชื่อผู้อนุมัติ (Approver Signature)"
                />
              </div>
            </div>
            
            <div className="md:col-span-2 flex justify-end space-x-3 mt-2">
              <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50">ยกเลิก</button>
              <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">ยืนยันการยกเลิกการใช้งาน</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[72vh] overflow-y-auto">
          <table className="w-full text-left text-sm border-separate border-spacing-0">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-xs">
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="px-5 py-4 font-medium bg-slate-50 border-b border-slate-200">รหัสเครื่องมือ</th>
                <th className="px-5 py-4 font-medium bg-slate-50 border-b border-slate-200">ชื่อเครื่องมือ</th>
                <th className="px-5 py-4 font-medium bg-slate-50 border-b border-slate-200">สาเหตุ</th>
                <th className="px-5 py-4 font-medium bg-slate-50 border-b border-slate-200">วันที่อนุมัติ</th>
                <th className="px-5 py-4 font-medium bg-slate-50 border-b border-slate-200">ช่างผู้ตรวจสอบ</th>
                <th className="px-5 py-4 font-medium bg-slate-50 border-b border-slate-200">ผู้อนุมัติ</th>
                <th className="px-5 py-4 font-medium text-right bg-slate-50 border-b border-slate-200 sticky right-0 top-0 z-20">จัดการ</th>
              </tr>
            </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredDecommissions.map(decom => {
              const eq = equipment.find(e => e.id === decom.equipmentId);
              return (
                <tr key={decom.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4 text-slate-900 font-mono font-medium">{eq?.code || 'Unknown'}</td>
                  <td className="px-5 py-4 text-slate-700 font-medium">{eq?.name || 'Unknown'}</td>
                  <td className="px-5 py-4 text-slate-700 max-w-xs">{decom.reason}</td>
                  <td className="px-5 py-4 text-slate-500 font-mono text-xs">{formatDateSlash(decom.date)}</td>
                  <td className="px-5 py-4 text-slate-700">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-800">{decom.technician || '-'}</span>
                      {decom.technicianSignature && (
                        <div className="mt-1 flex items-center space-x-1.5">
                          <img
                            src={decom.technicianSignature}
                            alt="ลายเซ็นช่าง"
                            className="h-6 max-w-[80px] object-contain border border-slate-200 rounded bg-white px-1 py-0.5"
                            referrerPolicy="no-referrer"
                          />
                          <span className="text-[10px] text-emerald-600 font-semibold">✓ ช่างเซ็น</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-800">{decom.approvedBy || '-'}</span>
                      {decom.approverSignature && (
                        <div className="mt-1 flex items-center space-x-1.5">
                          <img
                            src={decom.approverSignature}
                            alt="ลายเซ็นผู้อนุมัติ"
                            className="h-6 max-w-[80px] object-contain border border-slate-200 rounded bg-white px-1 py-0.5"
                            referrerPolicy="no-referrer"
                          />
                          <span className="text-[10px] text-emerald-600 font-semibold">✓ อนุมัติแล้ว</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => setPrintingDecom(decom)}
                        className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-slate-200 shadow-2xs"
                        title="พิมพ์ใบคำร้องขอยกเลิกและจำหน่ายเครื่องมือแพทย์"
                      >
                        <Printer size={16} />
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => handleStartEdit(decom)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="แก้ไขข้อมูลการยกเลิก"
                          >
                            <Pencil size={17} />
                          </button>
                          <button
                            onClick={() => setDecomToDelete(decom)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="ลบรายการจำหน่าย/คืนสถานะเครื่องมือ"
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
            {filteredDecommissions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                  {searchTerm ? (
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Search size={24} className="text-slate-300" />
                      <p className="text-sm font-medium text-slate-700">ไม่พบรายการยกเลิกการใช้งานที่ตรงกับ "{searchTerm}"</p>
                      <button
                        onClick={() => setSearchTerm('')}
                        className="text-xs text-red-600 hover:underline font-semibold"
                      >
                        ล้างคำค้นหา
                      </button>
                    </div>
                  ) : (
                    'ยังไม่มีประวัติการยกเลิกการใช้งาน'
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>

      {/* Edit Modal */}
      {editingDecom && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">แก้ไขข้อมูลยกเลิกการใช้งาน</h3>
              <button onClick={() => setEditingDecom(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">สาเหตุที่ชำรุด / เหตุผลการจำหน่าย</label>
                <textarea
                  required
                  rows={3}
                  value={editFormData.reason}
                  onChange={e => setEditFormData({...editFormData, reason: e.target.value})}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">วันที่อนุมัติ</label>
                <input
                  type="date"
                  required
                  value={editFormData.date}
                  onChange={e => setEditFormData({...editFormData, date: e.target.value})}
                  className="w-full sm:w-1/2 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Edit Signature Pads - Technician & Approver */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <SignaturePad
                    value={editFormData.technicianSignature}
                    onChange={(sigUrl) => setEditFormData(prev => ({ ...prev, technicianSignature: sigUrl }))}
                    signerName={editFormData.technician}
                    onSignerNameChange={(name) => setEditFormData(prev => ({ ...prev, technician: name }))}
                    namePlaceholder="ระบุชื่อช่างผู้ตรวจสอบ"
                    label="ลายมือชื่อช่างผู้ตรวจสอบ (Technician)"
                  />
                </div>

                <div className="p-3 bg-red-50/40 rounded-xl border border-red-200/80">
                  <SignaturePad
                    value={editFormData.approverSignature}
                    onChange={(sigUrl) => setEditFormData(prev => ({ ...prev, approverSignature: sigUrl }))}
                    signerName={editFormData.approvedBy}
                    onSignerNameChange={(name) => setEditFormData(prev => ({ ...prev, approvedBy: name }))}
                    namePlaceholder="ระบุชื่อผู้มีอำนาจอนุมัติ"
                    label="ลงลายมือชื่อผู้อนุมัติ (Approver)"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingDecom(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center space-x-1 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold hover:bg-red-700"
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
      {decomToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-rose-50 border-b border-rose-100">
              <div className="flex items-center space-x-2">
                <AlertTriangle size={20} className="text-rose-600" />
                <h3 className="font-bold text-slate-900 text-base">ยืนยันการลบรายการจำหน่าย</h3>
              </div>
              <button onClick={() => setDecomToDelete(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-600">
                เมื่อลบประวัติการยกเลิกนี้ สถานะของเครื่องมือจะถูกเปลี่ยนกลับเป็น "ปกติ (Active)" โดยอัตโนมัติ
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1 font-mono">
                <div>ผู้อนุมัติ: <span className="font-semibold text-slate-800">{decomToDelete.approvedBy}</span></div>
                <div>สาเหตุ: <span className="text-slate-700">{decomToDelete.reason}</span></div>
              </div>
            </div>
            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDecomToDelete(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteDecommission(decomToDelete.id);
                  setDecomToDelete(null);
                }}
                className="inline-flex items-center space-x-1 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700"
              >
                <Trash2 size={15} />
                <span>ยืนยันลบรายการ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decommission Print Report Modal */}
      {printingDecom && (
        <DecommissionReportModal
          decommission={printingDecom}
          equipment={equipment.find(e => e.id === printingDecom.equipmentId)}
          isOpen={Boolean(printingDecom)}
          onClose={() => setPrintingDecom(null)}
        />
      )}
    </div>
  );
}
