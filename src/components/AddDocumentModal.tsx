import React, { useState, useRef, useMemo } from 'react';
import { 
  FileText, FilePlus, UploadCloud, X, Search, Check, Printer, Download, 
  Eye, Trash2, Calendar, Paperclip, Tag, AlertCircle, CheckCircle2, 
  Building2, ChevronDown
} from 'lucide-react';
import { Equipment, EquipmentDocument, EquipmentDocType } from '../types';
import { useAppStore } from '../store';

interface AddDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEquipmentId?: string;
  initialTab?: 'create_form' | 'upload_file' | 'all_documents';
  initialDocType?: 'mutation_in' | 'inspection' | 'manual' | 'warranty' | 'calibration_cert' | 'other';
  onOpenPrintModal?: (equipment: Equipment, docType: 'mutation_in' | 'inspection') => void;
}

const DOC_TYPE_LABELS: Record<EquipmentDocType, { label: string; color: string; bg: string; iconText: string }> = {
  mutation_in: { 
    label: 'Mutation IN (รับเครื่องเข้า)', 
    color: 'text-blue-700 border-blue-200', 
    bg: 'bg-blue-50', 
    iconText: 'FP-001' 
  },
  inspection: { 
    label: 'แบบตรวจรับและทดสอบสภาพ', 
    color: 'text-indigo-700 border-indigo-200', 
    bg: 'bg-indigo-50', 
    iconText: 'FP-005' 
  },
  manual: { 
    label: 'คู่มือการใช้งาน (Manual)', 
    color: 'text-teal-700 border-teal-200', 
    bg: 'bg-teal-50', 
    iconText: 'MANUAL' 
  },
  warranty: { 
    label: 'ใบรับประกันสินค้า (Warranty)', 
    color: 'text-amber-700 border-amber-200', 
    bg: 'bg-amber-50', 
    iconText: 'WARRANTY' 
  },
  calibration_cert: { 
    label: 'ใบรับรองการสอบเทียบ (Calibration)', 
    color: 'text-purple-700 border-purple-200', 
    bg: 'bg-purple-50', 
    iconText: 'CAL-CERT' 
  },
  invoice: { 
    label: 'ใบสั่งซื้อ / ใบเสร็จรับเงิน (PO/Invoice)', 
    color: 'text-emerald-700 border-emerald-200', 
    bg: 'bg-emerald-50', 
    iconText: 'PO/INV' 
  },
  service_report: { 
    label: 'รายงานผลบริการ / ซ่อมบำรุง', 
    color: 'text-rose-700 border-rose-200', 
    bg: 'bg-rose-50', 
    iconText: 'REPORT' 
  },
  other: { 
    label: 'เอกสารอื่นๆ', 
    color: 'text-slate-700 border-slate-200', 
    bg: 'bg-slate-50', 
    iconText: 'OTHER' 
  }
};

export const AddDocumentModal: React.FC<AddDocumentModalProps> = ({
  isOpen,
  onClose,
  initialEquipmentId,
  initialTab = 'create_form',
  initialDocType,
  onOpenPrintModal
}) => {
  const { equipment, documents, addDocument, deleteDocument, currentUser } = useAppStore();

  const [activeTab, setActiveTab] = useState<'create_form' | 'upload_file' | 'all_documents'>(initialTab);
  
  // Selected equipment
  const [selectedEqId, setSelectedEqId] = useState<string>(initialEquipmentId || (equipment[0]?.id || ''));
  const [eqSearchQuery, setEqSearchQuery] = useState('');
  const [isEqDropdownOpen, setIsEqDropdownOpen] = useState(false);

  // Create official form tab states
  const [formType, setFormType] = useState<'mutation_in' | 'inspection'>(
    initialDocType === 'inspection' ? 'inspection' : 'mutation_in'
  );
  const [autoRecordInRepo, setAutoRecordInRepo] = useState(true);

  // Upload tab states
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDocType, setUploadDocType] = useState<EquipmentDocType>(
    initialDocType ? (initialDocType as EquipmentDocType) : 'manual'
  );
  const [uploadDocNumber, setUploadDocNumber] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [fileData, setFileData] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [fileType, setFileType] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // All documents tab states
  const [filterQuery, setFilterQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [previewDoc, setPreviewDoc] = useState<EquipmentDocument | null>(null);

  // Reset states when opening
  React.useEffect(() => {
    if (isOpen) {
      if (initialEquipmentId) setSelectedEqId(initialEquipmentId);
      if (initialTab) setActiveTab(initialTab);
      if (initialDocType === 'inspection' || initialDocType === 'mutation_in') {
        setFormType(initialDocType);
      }
      setIsSavedSuccess(false);
    }
  }, [isOpen, initialEquipmentId, initialTab, initialDocType]);

  const selectedEquipment = useMemo(() => {
    return equipment.find(e => e.id === selectedEqId);
  }, [equipment, selectedEqId]);

  const filteredEquipmentList = useMemo(() => {
    if (!eqSearchQuery.trim()) return equipment;
    const q = eqSearchQuery.toLowerCase();
    return equipment.filter(e => 
      e.code.toLowerCase().includes(q) ||
      e.name.toLowerCase().includes(q) ||
      e.department?.toLowerCase().includes(q) ||
      e.serialNumber?.toLowerCase().includes(q) ||
      e.itrisId?.toLowerCase().includes(q)
    );
  }, [equipment, eqSearchQuery]);

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const matchType = filterType === 'all' || doc.docType === filterType;
      const q = filterQuery.toLowerCase().trim();
      if (!q) return matchType;

      const matchText = 
        doc.title.toLowerCase().includes(q) ||
        (doc.equipmentCode && doc.equipmentCode.toLowerCase().includes(q)) ||
        (doc.equipmentName && doc.equipmentName.toLowerCase().includes(q)) ||
        (doc.department && doc.department.toLowerCase().includes(q)) ||
        (doc.docNumber && doc.docNumber.toLowerCase().includes(q)) ||
        (doc.fileName && doc.fileName.toLowerCase().includes(q));

      return matchType && matchText;
    });
  }, [documents, filterType, filterQuery]);

  if (!isOpen) return null;

  // Handle file selection
  const handleFileChange = (file: File) => {
    if (!file) return;

    // Size calculation
    const sizeStr = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    setFileName(file.name);
    setFileSize(sizeStr);
    setFileType(file.type);

    if (!uploadTitle) {
      const cleanName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setUploadTitle(cleanName);
    }

    // Read as Data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      setFileData(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSaveUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipment) return;
    if (!uploadTitle.trim()) return;

    addDocument({
      equipmentId: selectedEquipment.id,
      equipmentCode: selectedEquipment.code,
      equipmentName: selectedEquipment.name,
      department: selectedEquipment.department,
      title: uploadTitle.trim(),
      docType: uploadDocType,
      docNumber: uploadDocNumber.trim() || undefined,
      fileName: fileName || `${uploadTitle.trim()}.pdf`,
      fileSize: fileSize || '120 KB',
      fileType: fileType || 'application/pdf',
      fileData: fileData || undefined,
      uploadedBy: currentUser || 'Admin',
      notes: uploadNotes.trim() || undefined
    });

    setIsSavedSuccess(true);
    setTimeout(() => {
      setIsSavedSuccess(false);
      setActiveTab('all_documents');
      // Reset form
      setUploadTitle('');
      setUploadDocNumber('');
      setUploadNotes('');
      setFileData('');
      setFileName('');
      setFileSize('');
    }, 900);
  };

  const handleGenerateOfficialForm = () => {
    if (!selectedEquipment) return;

    // Optional auto record in documents repo
    if (autoRecordInRepo) {
      const title = formType === 'mutation_in'
        ? `แบบฟอร์ม Mutation IN (รับเครื่องเข้าสู่ระบบ)`
        : `แบบตรวจรับและทดสอบสภาพเครื่องมือแพทย์ (Inspection Form)`;
      
      const docNumber = formType === 'mutation_in' ? 'FP-OP-005-001' : 'FP-OP-005-005';

      // Check if not already added recently today
      const alreadyExists = documents.some(
        d => d.equipmentId === selectedEquipment.id && d.docType === formType
      );

      if (!alreadyExists) {
        addDocument({
          equipmentId: selectedEquipment.id,
          equipmentCode: selectedEquipment.code,
          equipmentName: selectedEquipment.name,
          department: selectedEquipment.department,
          title: `${title} - ${selectedEquipment.code}`,
          docType: formType,
          docNumber: docNumber,
          fileName: `${formType === 'mutation_in' ? 'Mutation-IN' : 'Inspection'}_${selectedEquipment.code}.pdf`,
          fileSize: '150 KB',
          fileType: 'application/pdf',
          uploadedBy: currentUser || 'Admin',
          notes: 'เอกสารทางการที่สร้างผ่านระบบอัตโนมัติ'
        });
      }
    }

    // Call external handler to open print modal
    if (onOpenPrintModal) {
      onOpenPrintModal(selectedEquipment, formType);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-fade-in"
        id="modal-add-document"
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-xs">
              <FilePlus size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                เพิ่มเอกสาร / จัดการเอกสารเครื่องมือแพทย์
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Document Center
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                สร้างแบบฟอร์มเอกสารทางการ (Mutation IN / Inspection) หรือแนบไฟล์เอกสารคู่มือ ใบรับประกัน ใบสอบเทียบ
              </p>
            </div>
          </div>
          <button
            id="btn-close-add-doc-modal"
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
            title="ปิดหน้าต่าง"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 bg-white flex space-x-2 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('create_form')}
            className={`flex items-center space-x-2 py-2.5 px-4 font-medium text-sm border-b-2 transition-colors cursor-pointer ${
              activeTab === 'create_form'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText size={16} />
            <span>สร้างแบบฟอร์มเอกสาร (Print Forms)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload_file')}
            className={`flex items-center space-x-2 py-2.5 px-4 font-medium text-sm border-b-2 transition-colors cursor-pointer ${
              activeTab === 'upload_file'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <UploadCloud size={16} />
            <span>แนบไฟล์เอกสารใหม่ (Upload File)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all_documents')}
            className={`flex items-center space-x-2 py-2.5 px-4 font-medium text-sm border-b-2 transition-colors cursor-pointer ${
              activeTab === 'all_documents'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Paperclip size={16} />
            <span>คลังเอกสารทั้งหมด</span>
            <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600 font-semibold">
              {documents.length}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          
          {/* TAB 1: CREATE OFFICIAL FORM */}
          {activeTab === 'create_form' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* Equipment Selector */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <label className="block text-sm font-semibold text-slate-800 mb-2">
                  1. เลือกเครื่องมือแพทย์ที่ต้องการสร้างเอกสาร <span className="text-red-500">*</span>
                </label>
                
                <div className="relative">
                  <div 
                    onClick={() => setIsEqDropdownOpen(prev => !prev)}
                    className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-300 rounded-lg cursor-pointer transition-colors"
                  >
                    {selectedEquipment ? (
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 shrink-0">
                          {selectedEquipment.code}
                        </span>
                        <span className="text-sm font-medium text-slate-800 truncate">
                          {selectedEquipment.name}
                        </span>
                        <span className="text-xs text-slate-500 shrink-0">
                          ({selectedEquipment.department || 'ไม่ระบุแผนก'})
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">คลิกเพื่อเลือกเครื่องมือแพทย์...</span>
                    )}
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${isEqDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>

                  {isEqDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 z-30 p-2 max-h-64 overflow-hidden flex flex-col">
                      <div className="relative mb-2">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={eqSearchQuery}
                          onChange={(e) => setEqSearchQuery(e.target.value)}
                          placeholder="ค้นหารหัส, ชื่อเครื่อง, หรือแผนก..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                          autoFocus
                        />
                      </div>
                      <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
                        {filteredEquipmentList.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400">ไม่พบเครื่องมือแพทย์ที่ตรงกับคำค้นหา</div>
                        ) : (
                          filteredEquipmentList.map(eq => (
                            <div
                              key={eq.id}
                              onClick={() => {
                                setSelectedEqId(eq.id);
                                setIsEqDropdownOpen(false);
                              }}
                              className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer hover:bg-slate-50 text-xs transition-colors ${
                                eq.id === selectedEqId ? 'bg-indigo-50/70 font-semibold text-indigo-900' : 'text-slate-700'
                              }`}
                            >
                              <div className="flex items-center space-x-2 truncate">
                                <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                                  {eq.code}
                                </span>
                                <span className="truncate">{eq.name}</span>
                              </div>
                              <span className="text-slate-400 text-[11px] shrink-0 ml-2">{eq.department}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {selectedEquipment && (
                  <div className="mt-3.5 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600 bg-slate-50/50 p-2.5 rounded-lg">
                    <div><span className="text-slate-400">ยี่ห้อ:</span> {selectedEquipment.manufacturer || '-'}</div>
                    <div><span className="text-slate-400">รุ่น:</span> {selectedEquipment.model || '-'}</div>
                    <div><span className="text-slate-400">S/N:</span> {selectedEquipment.serialNumber || '-'}</div>
                    <div><span className="text-slate-400">ITRIS ID:</span> {selectedEquipment.itrisId || '-'}</div>
                  </div>
                )}
              </div>

              {/* Form Type Selection */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <label className="block text-sm font-semibold text-slate-800 mb-3">
                  2. เลือกประเภทแบบฟอร์มเอกสารทางการที่ต้องการสร้าง
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Mutation IN Form */}
                  <div 
                    onClick={() => setFormType('mutation_in')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      formType === 'mutation_in'
                        ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-mono text-xs font-bold">
                          001
                        </span>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">แบบฟอร์ม Mutation IN</h4>
                          <span className="text-[11px] text-slate-500 font-mono">FP-OP-005-001 Rev.00</span>
                        </div>
                      </div>
                      {formType === 'mutation_in' && (
                        <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                          <Check size={12} />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mt-2">
                      แบบฟอร์มการรับเครื่องมือแพทย์เข้าสู่ระบบ รวบรวมข้อมูลสัญญา ประวัติเครื่อง รายละเอียดฝ่ายการพยาบาล และระบบลายเซ็นรับมอบ
                    </p>
                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-indigo-700 font-medium">
                      <span>พร้อมระบบลายเซ็นดิจิทัล</span>
                      <span>ขนาด A4 มาตรฐาน</span>
                    </div>
                  </div>

                  {/* Inspection Form */}
                  <div 
                    onClick={() => setFormType('inspection')}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      formType === 'inspection'
                        ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-mono text-xs font-bold">
                          005
                        </span>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">แบบตรวจรับและทดสอบสภาพ</h4>
                          <span className="text-[11px] text-slate-500 font-mono">FP-OP-005-005 Rev.00</span>
                        </div>
                      </div>
                      {formType === 'inspection' && (
                        <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                          <Check size={12} />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mt-2">
                      แบบบันทึกผลการทดสอบสมรรถนะและความปลอดภัยทางไฟฟ้า รายการตรวจสอบอุปกรณ์ประกอบ การอบรมผู้ใช้ และการลงนามตรวจรับ
                    </p>
                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-indigo-700 font-medium">
                      <span>ตารางตรวจเช็ค 10 หัวข้อ</span>
                      <span>ขนาด A4 มาตรฐาน</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center space-x-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    id="chk-auto-record"
                    checked={autoRecordInRepo}
                    onChange={(e) => setAutoRecordInRepo(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <label htmlFor="chk-auto-record" className="cursor-pointer">
                    บันทึกรายการเอกสารนี้ลงในคลังเอกสารของระบบโดยอัตโนมัติ (Document Repository)
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleGenerateOfficialForm}
                  disabled={!selectedEquipment}
                  className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all shadow-md cursor-pointer"
                >
                  <Printer size={16} />
                  <span>เปิดสร้างและพิมพ์เอกสารทันที</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: UPLOAD & ATTACH FILE */}
          {activeTab === 'upload_file' && (
            <form onSubmit={handleSaveUpload} className="space-y-5 max-w-3xl mx-auto">
              {isSavedSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center space-x-2.5 text-sm animate-fade-in">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  <span className="font-semibold">บันทึกและแนบเอกสารสำเร็จ! กำลังนำไปยังคลังเอกสาร...</span>
                </div>
              )}

              {/* Equipment Selector */}
              <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-2xs">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  เครื่องมือแพทย์ที่ต้องการแนบเอกสาร <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedEqId}
                  onChange={(e) => setSelectedEqId(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  required
                >
                  {equipment.map(eq => (
                    <option key={eq.id} value={eq.id}>
                      [{eq.code}] {eq.name} - {eq.department || 'ไม่ระบุแผนก'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Document Meta Form */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ชื่อหัวข้อเอกสาร <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="เช่น คู่มือการใช้งาน, ใบรับประกันสินค้า 2 ปี, ใบรับรองสอบเทียบ"
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ประเภทเอกสาร <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={uploadDocType}
                      onChange={(e) => setUploadDocType(e.target.value as EquipmentDocType)}
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    >
                      <option value="manual">📖 คู่มือการใช้งาน / ซ่อมบำรุง (Manual)</option>
                      <option value="warranty">🛡️ ใบรับประกันสินค้า (Warranty Certificate)</option>
                      <option value="calibration_cert">📐 ใบรับรองการสอบเทียบ (Calibration Certificate)</option>
                      <option value="mutation_in">📥 แบบฟอร์มรับเข้า (Mutation IN)</option>
                      <option value="inspection">📋 แบบตรวจรับสภาพ (Inspection Form)</option>
                      <option value="invoice">🧾 ใบสั่งซื้อ / ใบส่งมอบ / ใบเสร็จ (PO / Invoice)</option>
                      <option value="service_report">🛠️ รายงานผลบริการ / บันทึกการซ่อม</option>
                      <option value="other">📁 เอกสารอื่นๆ (Other)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      เลขที่เอกสาร / เลขที่อ้างอิง (ถ้ามี)
                    </label>
                    <input
                      type="text"
                      value={uploadDocNumber}
                      onChange={(e) => setUploadDocNumber(e.target.value)}
                      placeholder="เช่น WAR-2026-001, MAN-882, CAL-091"
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      หมายเหตุเพิ่มเติม
                    </label>
                    <input
                      type="text"
                      value={uploadNotes}
                      onChange={(e) => setUploadNotes(e.target.value)}
                      placeholder="เช่น เอกสารฉบับจริงอยู่ที่ห้องช่าง, ไฟล์สแกนภาษาไทย"
                      className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Upload Drag & Drop Area */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ไฟล์เอกสาร (PDF, รูปภาพ JPG/PNG, เอกสารสแกน)
                  </label>
                  
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                      isDragging 
                        ? 'border-indigo-500 bg-indigo-50/50' 
                        : fileName 
                          ? 'border-emerald-400 bg-emerald-50/20' 
                          : 'border-slate-300 hover:border-indigo-400 bg-slate-50/60'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleFileChange(e.target.files[0]);
                        }
                      }}
                    />

                    {fileName ? (
                      <div className="flex items-center justify-center space-x-3 text-slate-800">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                          <Check size={20} />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-xs text-slate-900 truncate max-w-sm">{fileName}</p>
                          <p className="text-[11px] text-slate-500">{fileSize} • คลิกเพื่อเปลี่ยนไฟล์</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <UploadCloud size={32} className="text-slate-400 mb-2" />
                        <p className="text-xs font-medium text-slate-700">
                          ลากและวางไฟล์เอกสารที่นี่ หรือ <span className="text-indigo-600 font-semibold underline">คลิกเพื่อเลือกไฟล์</span>
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          รองรับไฟล์ PDF, รูปถ่าย, เอกสารสแกน ขนาดไม่เกิน 25 MB
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={!uploadTitle.trim()}
                  className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all shadow-md cursor-pointer"
                >
                  <FilePlus size={16} />
                  <span>บันทึกและแนบเอกสาร</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: ALL DOCUMENTS REPOSITORY */}
          {activeTab === 'all_documents' && (
            <div className="space-y-4">
              {/* Filter and Search Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="relative w-full sm:w-80">
                  <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="ค้นหาชื่อเอกสาร, รหัสเครื่อง, แผนก..."
                    className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <span className="text-xs text-slate-500 shrink-0">หมวดหมู่:</span>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">ทั้งหมด ({documents.length})</option>
                    <option value="mutation_in">Mutation IN</option>
                    <option value="inspection">แบบตรวจรับสภาพ</option>
                    <option value="manual">คู่มือการใช้งาน</option>
                    <option value="warranty">ใบรับประกัน</option>
                    <option value="calibration_cert">ใบรับรองสอบเทียบ</option>
                    <option value="invoice">ใบเสร็จ/PO</option>
                    <option value="service_report">รายงานบริการ</option>
                    <option value="other">อื่นๆ</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setActiveTab('upload_file')}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer shadow-2xs"
                  >
                    <FilePlus size={13} />
                    <span>แนบเอกสาร</span>
                  </button>
                </div>
              </div>

              {/* Documents List */}
              {filteredDocuments.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <Paperclip size={24} />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-700">ไม่พบเอกสาร</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    ยังไม่มีเอกสารในหมวดนี้ หรือไม่พบข้อมูลตามคำค้นหา คุณสามารถกดปุ่ม "แนบไฟล์เอกสารใหม่" เพื่อเริ่มจัดเก็บเอกสาร
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredDocuments.map(doc => {
                    const typeConfig = DOC_TYPE_LABELS[doc.docType] || DOC_TYPE_LABELS.other;
                    return (
                      <div 
                        key={doc.id}
                        className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-start space-x-3.5">
                          <div className={`w-10 h-10 rounded-xl ${typeConfig.bg} ${typeConfig.color} flex items-center justify-center shrink-0 font-mono text-[10px] font-bold border border-current/20`}>
                            {typeConfig.iconText}
                          </div>
                          <div>
                            <div className="flex items-center flex-wrap gap-2 mb-1">
                              <h4 className="text-sm font-bold text-slate-900">{doc.title}</h4>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeConfig.bg} ${typeConfig.color}`}>
                                {typeConfig.label}
                              </span>
                              {doc.docNumber && (
                                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                  No: {doc.docNumber}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                              <span className="font-semibold text-slate-700">
                                รหัสเครื่อง: {doc.equipmentCode || '-'}
                              </span>
                              <span>•</span>
                              <span>ชื่อเครื่อง: {doc.equipmentName || '-'}</span>
                              <span>•</span>
                              <span className="text-slate-400">{doc.department || 'ไม่ระบุแผนก'}</span>
                              <span>•</span>
                              <span className="text-slate-400">วันที่: {doc.uploadDate}</span>
                              {doc.fileSize && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-400">{doc.fileSize}</span>
                                </>
                              )}
                            </div>

                            {doc.notes && (
                              <p className="text-[11px] text-slate-500 mt-1 italic">
                                หมายเหตุ: {doc.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-center">
                          {/* Preview Button */}
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(doc)}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors"
                            title="ดูรายละเอียดเอกสาร"
                          >
                            <Eye size={15} />
                            <span className="text-xs">เปิดดู</span>
                          </button>

                          {/* Print action if official document */}
                          {(doc.docType === 'mutation_in' || doc.docType === 'inspection') && onOpenPrintModal && (
                            <button
                              type="button"
                              onClick={() => {
                                const targetEq = equipment.find(e => e.id === doc.equipmentId);
                                if (targetEq) {
                                  onOpenPrintModal(targetEq, doc.docType as 'mutation_in' | 'inspection');
                                  onClose();
                                }
                              }}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors"
                              title="เปิดพิมพ์แบบฟอร์มเอกสารนี้"
                            >
                              <Printer size={15} />
                              <span className="text-xs">พิมพ์</span>
                            </button>
                          )}

                          {/* Download Button */}
                          <button
                            type="button"
                            onClick={() => {
                              if (doc.fileData) {
                                const link = document.createElement('a');
                                link.href = doc.fileData;
                                link.download = doc.fileName || `${doc.title}.pdf`;
                                link.click();
                              } else {
                                alert(`ดาวน์โหลดเอกสาร: ${doc.fileName || doc.title}`);
                              }
                            }}
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors"
                            title="ดาวน์โหลดไฟล์เอกสาร"
                          >
                            <Download size={15} />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`ยืนยันการลบเอกสาร "${doc.title}"?`)) {
                                deleteDocument(doc.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs transition-colors"
                            title="ลบเอกสารนี้"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>ระบบจัดเก็บเอกสารทางการแพทย์มาตรฐานโรงพยาบาล</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            ปิด
          </button>
        </div>
      </div>

      {/* Preview Lightbox Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h4 className="font-bold text-base text-slate-900">{previewDoc.title}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  เครื่องมือ: {previewDoc.equipmentCode} - {previewDoc.equipmentName} ({previewDoc.department})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={20} />
              </button>
            </div>

            {previewDoc.fileData && previewDoc.fileData.startsWith('data:image') ? (
              <div className="max-h-96 overflow-auto rounded-lg border bg-slate-50 p-2 flex items-center justify-center">
                <img src={previewDoc.fileData} alt={previewDoc.title} className="max-h-80 object-contain" />
              </div>
            ) : (
              <div className="p-8 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto">
                  <FileText size={32} />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{previewDoc.fileName || previewDoc.title}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    ประเภท: {DOC_TYPE_LABELS[previewDoc.docType]?.label} | ขนาด: {previewDoc.fileSize || 'ไม่ระบุ'}
                  </p>
                  {previewDoc.docNumber && (
                    <p className="text-xs text-indigo-600 font-mono mt-0.5">เลขที่: {previewDoc.docNumber}</p>
                  )}
                  {previewDoc.notes && (
                    <p className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border mt-3 max-w-md mx-auto text-left">
                      <strong>หมายเหตุ:</strong> {previewDoc.notes}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2 border-t">
              {(previewDoc.docType === 'mutation_in' || previewDoc.docType === 'inspection') && onOpenPrintModal && (
                <button
                  type="button"
                  onClick={() => {
                    const targetEq = equipment.find(e => e.id === previewDoc.equipmentId);
                    if (targetEq) {
                      setPreviewDoc(null);
                      onOpenPrintModal(targetEq, previewDoc.docType as 'mutation_in' | 'inspection');
                      onClose();
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5"
                >
                  <Printer size={14} />
                  <span>พิมพ์แบบฟอร์มเอกสารนี้</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
