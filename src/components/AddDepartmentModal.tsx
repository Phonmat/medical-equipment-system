import React, { useState } from 'react';
import { useAppStore } from '../store';
import { Building2, Plus, X, Check, Trash2 } from 'lucide-react';

interface AddDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDepartmentAdded?: (deptName: string) => void;
}

export default function AddDepartmentModal({ isOpen, onClose, onDepartmentAdded }: AddDepartmentModalProps) {
  const { departments, addDepartment, deleteDepartment, userRole } = useAppStore();
  const [newDeptName, setNewDeptName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'add' | 'list'>('add');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const isAdmin = userRole === 'Super Admin' || userRole === 'Admin';

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmed = newDeptName.trim();
    if (!trimmed) {
      setErrorMsg('กรุณากรอกชื่อแผนก');
      return;
    }

    if (departments.some(d => d.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg('มีแผนกนี้อยู่ในระบบแล้ว');
      return;
    }

    const success = addDepartment(trimmed);
    if (success) {
      setSuccessMsg(`เพิ่ม "${trimmed}" สำเร็จแล้ว`);
      setNewDeptName('');
      if (onDepartmentAdded) {
        onDepartmentAdded(trimmed);
      }
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 900);
    } else {
      setErrorMsg('ไม่สามารถเพิ่มแผนกได้');
    }
  };

  const handleDelete = (dept: string) => {
    deleteDepartment(dept);
    setDeleteConfirm(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div 
        className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Building2 size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">จัดการรายชื่อแผนก</h3>
              <p className="text-xs text-slate-500">สิทธิ์สำหรับ Admin & Super Admin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-200 text-xs font-semibold px-6 bg-white">
          <button
            type="button"
            onClick={() => { setActiveTab('add'); setErrorMsg(''); setSuccessMsg(''); setDeleteConfirm(null); }}
            className={`py-2.5 mr-4 border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'add'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Plus size={14} />
            <span>เพิ่มแผนกใหม่</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('list'); setErrorMsg(''); setSuccessMsg(''); setDeleteConfirm(null); }}
            className={`py-2.5 border-b-2 flex items-center space-x-1.5 transition-colors ${
              activeTab === 'list'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>รายการแผนกทั้งหมด ({departments.length})</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'add' ? (
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  ชื่อแผนกใหม่ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={newDeptName}
                  onChange={(e) => { setNewDeptName(e.target.value); setErrorMsg(''); }}
                  placeholder="เช่น แผนกกายอุปกรณ์, แผนกเวชระเบียน..."
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-all"
                />
              </div>

              {errorMsg && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg flex items-center space-x-1.5">
                  <Check size={14} />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-medium rounded-xl hover:bg-slate-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={!newDeptName.trim()}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-xl transition-colors shadow-xs"
                >
                  <Plus size={14} />
                  <span>เพิ่มและบันทึก</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                {departments.map((dept, index) => (
                  <div 
                    key={dept} 
                    className="flex items-center justify-between py-2 px-2 hover:bg-slate-50 rounded-lg text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-400 font-mono text-[11px] w-5">{index + 1}.</span>
                      <span className="text-slate-800 font-medium">{dept}</span>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center">
                        {deleteConfirm === dept ? (
                          <div className="flex items-center space-x-1 animate-in fade-in slide-in-from-right-2 duration-200">
                            <button
                              type="button"
                              onClick={() => handleDelete(dept)}
                              className="bg-red-600 text-white px-2 py-1 rounded-md text-[10px] font-bold hover:bg-red-700 transition-colors shadow-sm"
                            >
                              ยืนยันลบ
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(null)}
                              className="text-slate-500 bg-slate-100 px-2 py-1 rounded-md text-[10px] hover:bg-slate-200 transition-colors"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(dept)}
                            className="flex items-center text-slate-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                            title="ลบแผนก"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-xl hover:bg-slate-200 transition-colors"
                >
                  ปิด
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
