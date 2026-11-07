import React, { useState, useEffect } from 'react';
import { X, Save, Pencil, Building2, Calendar, ShieldCheck, DollarSign, Tag, Info, AlertCircle } from 'lucide-react';
import { Equipment, RiskLevel, EquipmentStatus } from '../types';
import { calculateWarrantyDuration, calculateEndDateFromYears, extractWarrantyYears, formatDateSlash, formatPurchasePrice, isNumericPrice } from '../utils/dateUtils';
import AddDepartmentModal from './AddDepartmentModal';
import { useAppStore } from '../store';

interface EditEquipmentModalProps {
  isOpen: boolean;
  equipment: Equipment | null;
  onClose: () => void;
  onSave: (id: string, data: Partial<Equipment>) => void;
  departments: string[];
  isAdmin: boolean;
}

export default function EditEquipmentModal({
  isOpen,
  equipment,
  onClose,
  onSave,
  departments,
  isAdmin
}: EditEquipmentModalProps) {
  const { users, facilities, userRole, currentUser, currentFacility } = useAppStore();
  const isSuperAdmin = userRole === 'Super Admin' || (userRole === 'Admin' && (currentFacility === 'ส่วนกลาง' || currentFacility === 'ส่วนกลาง (Super Admin)'));
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    riskLevel: 'Low' as RiskLevel,
    purchaseDate: '',
    purchase: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    department: '',
    facility: '',
    ownerUsername: '',
    team: '',
    itrisId: '',
    status: 'active' as EquipmentStatus,
    installationDate: '',
    registrationDate: '',
    vendorCompany: '',
    warrantyYears: '',
    warrantyStartDate: '',
    warrantyEndDate: '',
    warrantyPeriod: ''
  });

  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (equipment) {
      const derivedYears = equipment.warrantyYears !== undefined && equipment.warrantyYears !== null && String(equipment.warrantyYears).trim() !== ''
        ? String(equipment.warrantyYears).trim()
        : extractWarrantyYears(equipment.warrantyPeriod, equipment.warrantyStartDate, equipment.warrantyEndDate);

      const resolvedPurchase = isNumericPrice(equipment.purchase)
        ? formatPurchasePrice(equipment.purchase)
        : (isNumericPrice(equipment.vendorCompany) ? formatPurchasePrice(equipment.vendorCompany) : (equipment.purchase || ''));
      const resolvedVendor = isNumericPrice(equipment.vendorCompany) && !isNumericPrice(equipment.purchase)
        ? ''
        : (equipment.vendorCompany || '');

      setFormData({
        code: equipment.code || '',
        name: equipment.name || '',
        riskLevel: equipment.riskLevel || 'Low',
        purchaseDate: equipment.purchaseDate || '',
        purchase: resolvedPurchase === '-' ? '' : resolvedPurchase,
        manufacturer: equipment.manufacturer || '',
        model: equipment.model || '',
        serialNumber: equipment.serialNumber || '',
        department: equipment.department || '',
        facility: equipment.facility || currentFacility || (facilities[0] || 'โรงพยาบาลศูนย์การแพทย์'),
        ownerUsername: equipment.ownerUsername || currentUser || '',
        team: equipment.team || '',
        itrisId: equipment.itrisId || '',
        status: equipment.status || 'active',
        installationDate: equipment.installationDate || '',
        registrationDate: equipment.registrationDate || '',
        vendorCompany: resolvedVendor,
        warrantyYears: derivedYears || '',
        warrantyStartDate: equipment.warrantyStartDate || '',
        warrantyEndDate: equipment.warrantyEndDate || '',
        warrantyPeriod: equipment.warrantyPeriod || ''
      });
      setErrorMsg(null);
    }
  }, [equipment, isOpen]);

  if (!isOpen || !equipment) return null;

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
    const startDate = formData.warrantyStartDate || formData.installationDate || formData.purchaseDate;
    const calculatedDuration = calculateWarrantyDuration(startDate, endDate);
    const derivedYears = extractWarrantyYears(calculatedDuration, startDate, endDate);

    setFormData(prev => ({
      ...prev,
      warrantyEndDate: endDate,
      warrantyPeriod: calculatedDuration || prev.warrantyPeriod,
      warrantyYears: derivedYears || prev.warrantyYears
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      setErrorMsg('กรุณาระบุรหัสเครื่องมือแพทย์');
      return;
    }
    if (!formData.name.trim()) {
      setErrorMsg('กรุณาระบุชื่อเครื่องมือแพทย์');
      return;
    }

    const rangeFromDates = formData.warrantyStartDate && formData.warrantyEndDate
      ? `${formatDateSlash(formData.warrantyStartDate)}-${formatDateSlash(formData.warrantyEndDate)}`
      : '';
    const finalWarrantyPeriod = (formData.warrantyPeriod && formData.warrantyPeriod.trim() !== '-' ? formData.warrantyPeriod.trim() : '') || rangeFromDates || calculateWarrantyDuration(formData.warrantyStartDate, formData.warrantyEndDate);
    const finalWarrantyYears = formData.warrantyYears || extractWarrantyYears(finalWarrantyPeriod, formData.warrantyStartDate, formData.warrantyEndDate);

    const cleanPurchase = formData.purchase.trim() ? formatPurchasePrice(formData.purchase) : '';
    onSave(equipment.id, {
      ...formData,
      purchase: cleanPurchase === '-' ? '' : cleanPurchase,
      warrantyYears: finalWarrantyYears,
      warrantyPeriod: finalWarrantyPeriod
    });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 overflow-y-auto animate-fade-in">
        <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden border border-slate-200 my-auto flex flex-col max-h-[90vh]">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-linear-to-r from-blue-600 to-indigo-700 text-white shrink-0">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/15 rounded-xl backdrop-blur-xs">
                <Pencil size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-snug">แก้ไขข้อมูลเครื่องมือแพทย์</h3>
                <p className="text-xs text-blue-100 font-mono mt-0.5">
                  รหัส: {equipment.code} — {equipment.name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
              title="ปิดหน้าต่าง"
            >
              <X size={20} />
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center space-x-2 text-xs">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Code */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <span>รหัสเครื่องมือ</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="เช่น EQ-001"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <span>ชื่อเครื่องมือแพทย์</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="เช่น สว่านไฟฟ้า, Infusion Pump"
                />
              </div>

              {/* Manufacturer */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Manufacturer (ผู้ผลิต / ยี่ห้อ)</label>
                <input
                  type="text"
                  value={formData.manufacturer}
                  onChange={e => setFormData({ ...formData, manufacturer: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="เช่น Siemens, GE, Philips"
                />
              </div>

              {/* Model */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Model (รุ่น)</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={e => setFormData({ ...formData, model: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="เช่น X-1000, TE-112"
                />
              </div>

              {/* Serial Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Serial Number (S/N)</label>
                <input
                  type="text"
                  value={formData.serialNumber}
                  onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="เช่น SN-998822"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department (แผนกที่ใช้งาน)</label>
                <div className="flex gap-2">
                  <select
                    value={formData.department}
                    onChange={e => {
                      if (e.target.value === '__add_new__') {
                        setIsDeptModalOpen(true);
                        return;
                      }
                      setFormData({ ...formData, department: e.target.value });
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">-- กรุณาเลือกแผนก --</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                    {isAdmin && (
                      <option value="__add_new__" className="text-blue-600 font-semibold bg-blue-50">
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

              {/* Itris ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Itris ID</label>
                <input
                  type="text"
                  value={formData.itrisId}
                  onChange={e => setFormData({ ...formData, itrisId: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="เช่น ITR-12345"
                />
              </div>

              {/* Facility */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">สถานประกอบการ (Facility)</label>
                {isSuperAdmin ? (
                  <select
                    value={formData.facility}
                    onChange={e => setFormData({ ...formData, facility: e.target.value })}
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
                    value={formData.facility}
                    className="w-full border border-slate-200 bg-slate-100 text-slate-600 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                  />
                )}
              </div>



              {/* Risk Level */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Risk Level (ระดับความเสี่ยง)</label>
                <select
                  required
                  value={formData.riskLevel}
                  onChange={e => setFormData({ ...formData, riskLevel: e.target.value as RiskLevel })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="Low">Low (ความเสี่ยงต่ำ)</option>
                  <option value="Medium">Medium (ความเสี่ยงปานกลาง)</option>
                  <option value="High">High (ความเสี่ยงสูง)</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">สถานะเครื่องมือ</label>
                <select
                  required
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value as EquipmentStatus })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium"
                >
                  <option value="active">ปกติ / พร้อมใช้งาน (Active)</option>
                  <option value="repairing">ส่งซ่อม / ชำรุดระหว่างซ่อม (Repairing)</option>
                  <option value="broken">ชำรุด (Broken)</option>
                  <option value="decommissioned">ยกเลิกการใช้งาน / ปลดระวาง (Decommissioned)</option>
                </select>
              </div>

              {/* Purchase Price */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Purchase (ราคาจัดซื้อ)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.purchase}
                    onChange={e => setFormData({ ...formData, purchase: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg pl-3 pr-12 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="เช่น 150,000"
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-semibold text-slate-500 pointer-events-none">
                    บาท
                  </span>
                </div>
              </div>

              {/* Purchase Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">วันที่จัดซื้อ (Purchase Date)</label>
                <input
                  type="date"
                  value={formData.purchaseDate}
                  onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              {/* Installation Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">วันที่ติดตั้ง (Installation Date)</label>
                <input
                  type="date"
                  value={formData.installationDate}
                  onChange={e => setFormData({ ...formData, installationDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              {/* Registration Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">วันขึ้นทะเบียน (Inventory Date)</label>
                <input
                  type="date"
                  value={formData.registrationDate}
                  onChange={e => setFormData({ ...formData, registrationDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              {/* Vendor Company */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">บริษัทที่ขายเครื่อง (Vendor)</label>
                <input
                  type="text"
                  value={formData.vendorCompany}
                  onChange={e => setFormData({ ...formData, vendorCompany: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  placeholder="เช่น บริษัท เมดิคอล เซอร์วิส จำกัด"
                />
              </div>

              {/* Warranty Section */}
              <div className="md:col-span-2 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck size={16} className="text-blue-600" />
                    <span className="text-xs font-bold text-slate-800">ข้อมูลการรับประกัน (Warranty)</span>
                  </div>
                  <span className="text-[11px] text-blue-700 font-medium">ระบุจำนวนปี หรือกำหนดวันที่เริ่ม-สิ้นสุด</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      ปีการรับประกัน (ปี / Years)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={formData.warrantyYears}
                        onChange={e => handleWarrantyYearsChange(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-semibold text-emerald-700"
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
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="flex items-center space-x-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
              >
                <Save size={15} />
                <span>บันทึกการแก้ไขข้อมูล</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <AddDepartmentModal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        onDepartmentAdded={(newDept) => {
          setFormData(prev => ({ ...prev, department: newDept }));
        }}
      />
    </>
  );
}
