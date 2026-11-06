import React, { useRef, useMemo, useState } from 'react';
import { Printer, X, FileText, Loader2, ExternalLink } from 'lucide-react';
import { RepairJob, Equipment } from '../types';
import { formatDateSlash, parseDateString } from '../utils/dateUtils';
import { printElement, printInNewWindow } from '../utils/printUtils';
import { useAppStore } from '../store';

interface RepairReportModalProps {
  repair: RepairJob | null;
  equipment?: Equipment;
  isOpen: boolean;
  onClose: () => void;
}

export default function RepairReportModal({ repair, equipment, isOpen, onClose }: RepairReportModalProps) {
  const printContentRef = useRef<HTMLDivElement>(null);
  const { equipment: allEquipment = [], repairs = [], userRole } = useAppStore();
  const isAdmin = userRole === 'Super Admin' || userRole === 'Admin';

  // ตรวจสอบว่าเป็นเครื่องนอกทะเบียนหรือไม่
  const isNonRegistered = Boolean(
    repair?.isNonRegistered ||
    repair?.equipmentId === 'NON_REGISTERED' ||
    repair?.equipmentId?.startsWith('non-reg-') ||
    repair?.equipmentCode === 'นอกทะเบียน' ||
    (!equipment && !allEquipment.some(e => e.id === repair?.equipmentId))
  );

  // ค้นหาข้อมูลเครื่องมือในระบบ (เฉพาะกรณีที่เป็นเครื่องในทะเบียน)
  const targetEq = !isNonRegistered
    ? (equipment || allEquipment.find(e => e.id === repair?.equipmentId || (repair?.equipmentCode && (e.code === repair.equipmentCode || e.itrisId === repair.equipmentCode))))
    : undefined;

  // หากเป็นเครื่องนอกทะเบียน ให้นำข้อมูลเครื่องมาจากการเปิดงานซ่อม (repair) โดยตรง
  const displayName = isNonRegistered
    ? (repair?.equipmentName || 'ไม่ระบุชื่อเครื่องมือ')
    : (targetEq?.name || repair?.equipmentName || 'ไม่ระบุชื่อเครื่องมือ');

  const displayCode = isNonRegistered
    ? (repair?.equipmentCode || 'นอกทะเบียน')
    : (repair?.equipmentCode || targetEq?.code || targetEq?.itrisId || '-');

  const displaySerial = isNonRegistered
    ? (repair?.serialNumber || '-')
    : (targetEq?.serialNumber || repair?.serialNumber || '-');

  const displayModel = isNonRegistered
    ? (repair?.model || '-')
    : (targetEq?.model || repair?.model || '-');

  const displayManufacturer = isNonRegistered
    ? (repair?.manufacturer || '-')
    : (targetEq?.manufacturer || repair?.manufacturer || '-');

  const displayDepartment = isNonRegistered
    ? (repair?.department || '-')
    : (repair?.department || targetEq?.department || '-');

  const deviceDescription = displayCode && displayName ? `${displayCode} - ${displayName}` : (displayCode || displayName || 'ไม่ระบุชื่อเครื่องมือ');

  // Format Report No.: วันที่.เดือน/ลำดับการเปิดงานของวันนั้นๆเรียงตามลำดับ (ตัวอย่างเช่น 12.9/1)
  const reportNumber = useMemo(() => {
    if (!repair) return 'REPORT';

    // วันที่เปิดงาน: ใช้ reportDate หรือ signatureDate หากไม่มีใช้วันปัจจุบัน
    const rawDate = repair.reportDate || repair.signatureDate || new Date().toISOString().split('T')[0];
    const parsed = parseDateString(rawDate);

    let year = 0;
    let month = 0;
    let day = 0;
    let targetIsoDate = '';

    if (parsed && /^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
      const [y, m, d] = parsed.split('-').map(Number);
      year = y;
      month = m;
      day = d;
      targetIsoDate = parsed;
    } else {
      const dt = new Date(rawDate);
      if (!isNaN(dt.getTime())) {
        year = dt.getFullYear();
        month = dt.getMonth() + 1;
        day = dt.getDate();
        targetIsoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      } else {
        const now = new Date();
        year = now.getFullYear();
        month = now.getMonth() + 1;
        day = now.getDate();
        targetIsoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    // หารายการแจ้งซ่อมทั้งหมดที่เปิดในวันเดียวกัน
    const sameDayRepairs = repairs.filter(r => {
      const rDate = r.reportDate || r.signatureDate;
      if (!rDate) return false;
      const rParsed = parseDateString(rDate);
      if (rParsed && /^\d{4}-\d{2}-\d{2}$/.test(rParsed)) {
        return rParsed === targetIsoDate;
      }
      const rDt = new Date(rDate);
      if (!isNaN(rDt.getTime())) {
        const rIso = `${rDt.getFullYear()}-${String(rDt.getMonth() + 1).padStart(2, '0')}-${String(rDt.getDate()).padStart(2, '0')}`;
        return rIso === targetIsoDate;
      }
      return false;
    });

    // เรียงลำดับตามเวลาเปิดงาน หรือตามลำดับที่เปิดงานในระบบ
    const sortedSameDay = [...sameDayRepairs].sort((a, b) => {
      if (a.reportTime && b.reportTime && a.reportTime !== b.reportTime) {
        return a.reportTime.localeCompare(b.reportTime);
      }
      const idxA = repairs.findIndex(item => item.id === a.id);
      const idxB = repairs.findIndex(item => item.id === b.id);
      return idxA - idxB;
    });

    // ลำดับที่ของงานซ่อมนี้ในวันดังกล่าว (เริ่มนับจาก 1)
    const foundIdx = sortedSameDay.findIndex(item => item.id === repair.id);
    const seq = foundIdx >= 0 ? foundIdx + 1 : sortedSameDay.length + 1;

    return `${day}.${month}/${seq}`;
  }, [repair, repairs]);

  const [isPrinting, setIsPrinting] = useState(false);

  const handlePrint = async () => {
    if (!printContentRef.current || isPrinting) return;
    setIsPrinting(true);
    try {
      await printElement(printContentRef.current, {
        documentTitle: `Service_Report_${reportNumber.replace('/', '-')}`,
        pageOrientation: 'portrait',
        pageMargin: '6mm 6mm'
      });
    } catch (err) {
      console.error('Print failed:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintInNewWindow = () => {
    if (!printContentRef.current) return;
    printInNewWindow(printContentRef.current, {
      documentTitle: `Service_Report_${reportNumber.replace('/', '-')}`,
      pageOrientation: 'portrait',
      pageMargin: '6mm 6mm'
    });
  };

  // Checkbox interactivity state
  const [urgent, setUrgent] = React.useState(false);
  const [contractType, setContractType] = React.useState<'r_plus' | 'no_contract'>('no_contract');
  const [serviceRequestBy, setServiceRequestBy] = React.useState({
    medas: false,
    itrisOffice: true,
  });
  const [requestDetail, setRequestDetail] = React.useState({
    repair: true,
    pmCal: false,
    startup: false,
    functionCheck: false,
  });

  // Diagnosis state (CSS Selectors 1 - 6)
  const [diagnosis, setDiagnosis] = React.useState({
    deviceDefect: repair?.status === 'completed',
    accessoryDefect: false,
    fallDamage: false,
    setupFailure: false,
    softwareFailure: false,
    userError: false,
  });

  // Work and Activity Performed state (CSS Selectors 7 - 14)
  const [activities, setActivities] = React.useState({
    functionCheck: true,
    checkoutConfig: true,
    deviceCleaned: true,
    accessoriesCleaned: true,
    batteryCheck: true,
    softwareCheck: false,
    displayLedCheck: true,
    printerCheck: false,
  });

  // Ready Status (CSS Selectors 15 - 16)
  const [readyStatus, setReadyStatus] = React.useState({
    deviceReady: repair?.status === 'completed',
    userTraining: false,
  });

  // Service Quality Survey (CSS Selectors 19 - 21)
  const [surveyRating, setSurveyRating] = React.useState<'good' | 'neutral' | 'poor' | null>('good');

  // Signatures footer checks (CSS Selectors 17 - 18)
  const [footerChecks, setFooterChecks] = React.useState({
    medas: false,
    invoiced: false,
  });

  // Editable Failure Description & Action Taken
  const [failureDescription, setFailureDescription] = React.useState(repair?.issue || '');
  const [actionTakenDetails, setActionTakenDetails] = React.useState(
    repair?.repairDetails || ''
  );

  React.useEffect(() => {
    if (repair) {
      setDiagnosis(prev => ({
        ...prev,
        deviceDefect: repair.status === 'completed',
      }));
      setReadyStatus(prev => ({
        ...prev,
        deviceReady: repair.status === 'completed',
      }));
      setFailureDescription(repair.issue || '');
      setActionTakenDetails(repair.repairDetails || '');
    }
  }, [repair?.id, repair?.status, repair?.issue, repair?.repairDetails]);

  if (!isOpen || !repair) return null;

  const reportDateStr = formatDateSlash(repair.reportDate || new Date().toISOString().split('T')[0]);
  const startTimeStr = repair.reportTime || '09:00';
  const endTimeStr = repair.closingTime || (repair.status === 'completed' ? '12:00' : '-');

  const calculateTotalTime = (start?: string, end?: string): string => {
    if (!start || !end || start === '-' || end === '-') return '-';
    const startMatch = start.trim().match(/^(\d{1,2}):(\d{2})/);
    const endMatch = end.trim().match(/^(\d{1,2}):(\d{2})/);
    if (!startMatch || !endMatch) return '-';

    const startTotalMins = parseInt(startMatch[1], 10) * 60 + parseInt(startMatch[2], 10);
    let endTotalMins = parseInt(endMatch[1], 10) * 60 + parseInt(endMatch[2], 10);

    if (endTotalMins < startTotalMins) {
      endTotalMins += 24 * 60;
    }

    const diffMins = endTotalMins - startTotalMins;
    if (diffMins <= 0) return '0 min';

    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    if (hours > 0 && mins > 0) {
      return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ${mins} ${mins === 1 ? 'min' : 'mins'}`;
    }
    if (hours > 0) {
      return `${hours}.0 ${hours === 1 ? 'hr' : 'hrs'}`;
    }
    return `${mins} ${mins === 1 ? 'min' : 'mins'}`;
  };

  const totalTimeStr = calculateTotalTime(startTimeStr, endTimeStr);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden my-6 border border-slate-200 print-clean-page">
        {/* Modal Action Header (Hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white print:hidden">
          <div className="flex items-center space-x-2">
            <FileText className="text-red-400" size={20} />
            <span className="font-bold text-base">แบบฟอร์มรายงานผลการซ่อม (Service Report - ITRIS Form)</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrintInNewWindow}
              type="button"
              className="flex items-center space-x-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-colors border border-slate-700 cursor-pointer"
              title="เปิดเอกสารในหน้าต่างใหม่เพื่อสั่งพิมพ์ (แนะนำหากพิมพ์โดยตรงไม่ขึ้น)"
            >
              <ExternalLink size={14} />
              <span className="hidden sm:inline">เปิดแท็บพิมพ์</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center space-x-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-400 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs cursor-pointer"
              title="สั่งพิมพ์ไปยังเครื่องพิมพ์ที่เชื่อมต่อกับคอมพิวเตอร์"
            >
              {isPrinting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>กำลังส่งข้อมูลไปยังเครื่องพิมพ์...</span>
                </>
              ) : (
                <>
                  <Printer size={15} />
                  <span>พิมพ์รายงาน (Print)</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="ปิด"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable container for preview on screen */}
        <div className="max-h-[85vh] overflow-y-auto p-4 sm:p-8 bg-slate-100 print:bg-white print:p-0 print:overflow-visible">
          {/* Interactivity Tip Banner (Screen only) */}
          <div className="w-full max-w-[800px] mx-auto mb-3 bg-blue-50/90 border border-blue-200 rounded-xl px-4 py-2 flex items-center justify-between text-xs text-blue-900 shadow-xs print:hidden">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-blue-600">✓</span>
              <span><strong>ช่องทำเครื่องหมายถูก:</strong> สามารถคลิกที่ช่องสี่เหลี่ยมหรือข้อความเพื่อติ๊กเลือก / เอาออก (✓) ได้โดยตรงก่อนสั่งพิมพ์</span>
            </div>
          </div>

          {/* Exact Service Report Paper Document (100% Match to FP-OP-002-001 Rev.03) */}
          <div
            ref={printContentRef}
            style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
            className="w-full max-w-[794px] mx-auto bg-white text-black border border-slate-300 px-7 pt-6 pb-8 text-[11px] leading-snug shadow-lg print:shadow-none print:border-none print:p-2"
          >
            {/* Header Section: iTRiS Logo & Address */}
            <div className="pl-2">
              <div className="flex items-end flex-wrap gap-x-2">
                {/* iTRiS SVG Logo */}
                <svg
                  viewBox="0 0 185 52"
                  className="h-[46px] w-auto shrink-0"
                  aria-label="iTRiS"
                >
                  {/* Red square with left-connected white cross */}
                  <polygon points="4,12 38,12 34,46 0,46" fill="#d32027" />
                  <polygon points="2,25 29,25 28,33 1,33" fill="#ffffff" />
                  <polygon points="15,17 23,17 20,41 12,41" fill="#ffffff" />

                  {/* Extended T top bar + i dots */}
                  <polygon points="47,12 56,12 55,19 46,19" fill="#d32027" />
                  <polygon points="60,12 112,12 111,19 59,19" fill="#d32027" />
                  <polygon points="130,3 139,3 138,10 129,10" fill="#d32027" />

                  {/* First 'i' stem */}
                  <polygon points="45,22 54,22 50,46 41,46" fill="#d32027" />

                  {/* 'T' stem */}
                  <polygon points="73,18 83,18 78,46 68,46" fill="#d32027" />

                  {/* 'R' */}
                  <path
                    d="M93,46 L98,18 L115,18 C122,18 125,21 124,26 C123,31 119,33 114,34 L121,46 L111,46 L105,35 L103,35 L101,46 Z M104,29 L111,29 C114,29 115,28 115,26 C116,24 114,23 111,23 L105,23 Z"
                    fill="#d32027"
                  />

                  {/* Second 'i' stem */}
                  <polygon points="128,14 137,14 132,46 123,46" fill="#d32027" />

                  {/* 'S' */}
                  <path
                    d="M140,37 L149,37 C149,40 151,41 156,41 C160,41 163,40 163,38 C163,36 161,35 155,34 C146,32 142,29 143,23 C144,16 151,12 161,12 C170,12 175,16 175,22 L166,22 C166,19 164,18 159,18 C155,18 153,19 152,21 C152,23 154,24 160,25 C169,27 173,30 172,36 C171,43 165,47 154,47 C144,47 139,43 140,37 Z"
                    fill="#d32027"
                  />
                </svg>

                {/* MEDICAL (Thailand) Co., Ltd. */}
                <div className="italic font-bold text-[#777777] text-[22px] leading-none tracking-tight pb-[3px]">
                  MEDICAL (Thailand) Co., Ltd.
                </div>
              </div>

              {/* Address & Contact Info aligned under MEDICAL */}
              <div className="pl-[186px] text-[9.5px] italic text-[#555555] leading-[1.35] mt-0.5">
                <div>218/5, 218/6 Rom Klao Rd., Kwang Klong Sam Pravet, Khet Lad Krabang, Bangkok 10520</div>
                <div>Tel: 021800606 Fax: 021800605 E-Mail: info@itris-medical.co.th, web: www.itris-medical.co.th</div>
              </div>
            </div>

            {/* Title "Service Report" & Flush Right "Report No:" Box */}
            <div className="relative flex items-end justify-center mt-2">
              <h1 className="text-[19px] font-bold text-black leading-none pb-1.5">
                Service Report
              </h1>
              <div className="ml-auto border-t border-l border-r border-black w-[27.5%] min-h-[28px] px-2 py-1 flex items-center">
                <span className="text-[11px] font-normal text-black mr-1.5">Report No:</span>
                <span className="text-[11px] font-semibold text-black">{reportNumber}</span>
              </div>
            </div>

            {/* MAIN FORM TABLE WITH 3PX DOUBLE OUTER BORDER */}
            <div className="border-[3px] border-double border-black text-[11px] text-black">
              {/* SECTION 1: Customer & Device Info + Service Request By / Contract */}
              <div className="grid grid-cols-12 border-b border-black">
                {/* Left 50% (6 cols) with 3px double right border */}
                <div className="col-span-6 border-r-[3px] border-double border-black flex flex-col">
                  {/* Customer / Name / Address (matches height of Device description + ID no = 70px) */}
                  <div className="h-[70px] px-1.5 py-1 border-b border-black flex flex-col justify-between">
                    <div className="font-bold text-[12px] leading-tight">Customer</div>
                    <div className="space-y-0.5 text-[11px] pb-0.5">
                      <div className="flex items-baseline">
                        <span className="w-14 shrink-0">Name</span>
                        <span className="font-medium truncate">{repair.facility || targetEq?.facility || ''}</span>
                      </div>
                      <div className="flex items-baseline">
                        <span className="w-14 shrink-0">Address</span>
                        <span className="truncate"></span>
                      </div>
                    </div>
                  </div>

                  {/* Urgent / Date / Time (height 23px) */}
                  <div className="h-[23px] px-1.5 border-b border-black flex items-center text-[11px]">
                    <div
                      onClick={() => isAdmin && setUrgent(!urgent)}
                      className={`inline-flex items-center space-x-1.5 select-none mr-3 ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                        {urgent ? '✓' : ''}
                      </span>
                      <span>Urgent</span>
                    </div>
                    <div className="inline-flex items-baseline mr-4">
                      <span className="mr-1">Date</span>
                      <span className="inline-block border-b border-black min-w-[52px] text-center text-[10px] leading-none pb-[1px]">
                        {urgent ? reportDateStr : ''}
                      </span>
                    </div>
                    <div className="inline-flex items-baseline">
                      <span className="mr-1">Time:</span>
                      <span className="text-[10px]">{urgent ? startTimeStr : ''}</span>
                    </div>
                  </div>

                  {/* Department (height 23px) */}
                  <div className="h-[23px] px-1.5 border-b border-black flex items-center text-[11px]">
                    <span className="mr-2 shrink-0">Department:</span>
                    <span className="font-medium truncate">{displayDepartment !== '-' ? displayDepartment : ''}</span>
                  </div>

                  {/* Customer / user name | ITRIS engineer name (matches Manufacturer + Contract no = 46px) */}
                  <div className="h-[46px] border-b border-black grid grid-cols-12">
                    <div className="col-span-6 border-r border-black px-1.5 py-0.5 flex flex-col justify-between overflow-hidden">
                      <div className="text-[10.5px] leading-tight">Customer / user name:</div>
                      <div className="flex items-center justify-center gap-1.5 pb-0.5">
                        {repair.requesterSignature && (
                          <img
                            src={repair.requesterSignature}
                            className="h-5 w-auto max-w-[65px] object-contain"
                            alt="signature"
                          />
                        )}
                        <span className="font-semibold text-[10px] leading-none truncate">
                          {repair.signerName || repair.reportedBy || ''}
                        </span>
                      </div>
                    </div>
                    <div className="col-span-6 px-1.5 py-0.5 flex flex-col justify-between overflow-hidden">
                      <div className="text-[10.5px] leading-tight">ITRIS engineer name:</div>
                      <div className="flex items-center justify-center gap-1.5 pb-0.5">
                        {(repair.technicianSignature || repair.closingTechnicianSignature) && (
                          <img
                            src={repair.technicianSignature || repair.closingTechnicianSignature}
                            className="h-5 w-auto max-w-[65px] object-contain"
                            alt="engineer signature"
                          />
                        )}
                        <span className="font-semibold text-[10px] leading-none truncate">
                          {repair.technician || repair.closingTechnician || ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Service request by (height 23px) */}
                  <div className="h-[23px] px-1.5 flex items-center text-[11px]">
                    <span className="mr-3">Service request by:</span>
                    <label
                      onClick={() => isAdmin && setServiceRequestBy(prev => ({ ...prev, medas: !prev.medas }))}
                      className={`inline-flex items-center space-x-1 mr-5 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                        {serviceRequestBy.medas ? '✓' : ''}
                      </span>
                      <span>MEDAS</span>
                    </label>
                    <label
                      onClick={() => isAdmin && setServiceRequestBy(prev => ({ ...prev, itrisOffice: !prev.itrisOffice }))}
                      className={`inline-flex items-center space-x-1 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                        {serviceRequestBy.itrisOffice ? '✓' : ''}
                      </span>
                      <span>To ITRIS office</span>
                    </label>
                  </div>
                </div>

                {/* Right 50% (6 cols) */}
                <div className="col-span-6 flex flex-col">
                  {/* Device description (height 47px) */}
                  <div className="h-[47px] px-1.5 py-1 border-b border-black flex flex-col justify-between">
                    <div className="text-[11px] leading-tight">Device description:</div>
                    <div className="font-semibold text-[11px] truncate pb-0.5">
                      {displayName !== 'ไม่ระบุชื่อเครื่องมือ' ? displayName : ''}
                    </div>
                  </div>

                  {/* ID no. (height 23px) */}
                  <div className="h-[23px] px-1.5 border-b border-black flex items-center text-[11px]">
                    <span className="w-24 shrink-0">ID no.:</span>
                    <span className="font-semibold truncate">{displayCode !== '-' ? displayCode : ''}</span>
                  </div>

                  {/* Serial no. (height 23px) */}
                  <div className="h-[23px] px-1.5 border-b border-black flex items-center text-[11px]">
                    <span className="w-24 shrink-0">Serial no.:</span>
                    <span className="truncate">{displaySerial !== '-' ? displaySerial : ''}</span>
                  </div>

                  {/* Model / Type (height 23px) */}
                  <div className="h-[23px] px-1.5 border-b border-black flex items-center text-[11px]">
                    <span className="w-24 shrink-0">Model / Type:</span>
                    <span className="truncate">{displayModel !== '-' ? displayModel : ''}</span>
                  </div>

                  {/* Manufacturer (height 23px) */}
                  <div className="h-[23px] px-1.5 border-b border-black flex items-center text-[11px]">
                    <span className="w-24 shrink-0">Manufacturer:</span>
                    <span className="truncate">{displayManufacturer !== '-' ? displayManufacturer : ''}</span>
                  </div>

                  {/* Contract no. (height 23px) */}
                  <div className="h-[23px] px-1.5 border-b border-black flex items-center text-[11px]">
                    <span className="w-24 shrink-0">Contract no.:</span>
                    <span></span>
                  </div>

                  {/* Contract (height 23px) */}
                  <div className="h-[23px] px-1.5 flex items-center text-[11px]">
                    <span className="mr-4">Contract:</span>
                    <label
                      onClick={() => isAdmin && setContractType(contractType === 'r_plus' ? 'no_contract' : 'r_plus')}
                      className={`inline-flex items-center space-x-1 mr-4 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                        {contractType === 'r_plus' ? '✓' : ''}
                      </span>
                      <span>R+ Contract</span>
                    </label>
                    <label
                      onClick={() => isAdmin && setContractType(contractType === 'no_contract' ? 'r_plus' : 'no_contract')}
                      className={`inline-flex items-center space-x-1 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                        {contractType === 'no_contract' ? '✓' : ''}
                      </span>
                      <span>No Contract</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Request detail & Failure description (2 ruled rows, ends with 3px double border) */}
              <div className="border-b-[3px] border-double border-black">
                {/* Request detail row */}
                <div className="h-[23px] px-1.5 border-b border-black flex items-center text-[11px]">
                  <span className="mr-7">Request detail:</span>
                  <label
                    onClick={() => isAdmin && setRequestDetail(prev => ({ ...prev, repair: !prev.repair }))}
                    className={`inline-flex items-center space-x-1 mr-4 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {requestDetail.repair ? '✓' : ''}
                    </span>
                    <span>Repair</span>
                  </label>
                  <label
                    onClick={() => isAdmin && setRequestDetail(prev => ({ ...prev, pmCal: !prev.pmCal }))}
                    className={`inline-flex items-center space-x-1 mr-5 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {requestDetail.pmCal ? '✓' : ''}
                    </span>
                    <span>PM/CAL</span>
                  </label>
                  <label
                    onClick={() => isAdmin && setRequestDetail(prev => ({ ...prev, startup: !prev.startup }))}
                    className={`inline-flex items-center space-x-1 mr-6 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {requestDetail.startup ? '✓' : ''}
                    </span>
                    <span>New device initial start-up</span>
                  </label>
                  <label
                    onClick={() => isAdmin && setRequestDetail(prev => ({ ...prev, functionCheck: !prev.functionCheck }))}
                    className={`inline-flex items-center space-x-1 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {requestDetail.functionCheck ? '✓' : ''}
                    </span>
                    <span>Device function check</span>
                  </label>
                </div>

                {/* Failure description: 2 ruled lines */}
                <div className="h-[23px] px-1.5 border-b border-black flex items-center text-[11px]">
                  <span className="mr-2 shrink-0">Failure description:</span>
                  <input
                    type="text"
                    value={failureDescription}
                    onChange={(e) => isAdmin && setFailureDescription(e.target.value)}
                    readOnly={!isAdmin}
                    className="w-full bg-transparent border-none focus:outline-none text-[11px] font-medium text-black p-0"
                  />
                </div>
                <div className="h-[23px] px-1.5 flex items-center text-[11px]"></div>
              </div>

              {/* SECTION 3: Diagnosis (2 rows, ends with 3px double border) */}
              <div className="border-b-[3px] border-double border-black">
                <div className="h-[23px] px-1.5 border-b border-black flex items-center text-[11px] flex-wrap">
                  <span className="mr-3">Diagnosis:</span>
                  <label
                    onClick={() => isAdmin && setDiagnosis(prev => ({ ...prev, deviceDefect: !prev.deviceDefect }))}
                    className={`inline-flex items-center space-x-1 mr-4 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {diagnosis.deviceDefect ? '✓' : ''}
                    </span>
                    <span>Device defect</span>
                  </label>
                  <label
                    onClick={() => isAdmin && setDiagnosis(prev => ({ ...prev, accessoryDefect: !prev.accessoryDefect }))}
                    className={`inline-flex items-center space-x-1 mr-4 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {diagnosis.accessoryDefect ? '✓' : ''}
                    </span>
                    <span>Accessory defect</span>
                  </label>
                  <label
                    onClick={() => isAdmin && setDiagnosis(prev => ({ ...prev, fallDamage: !prev.fallDamage }))}
                    className={`inline-flex items-center space-x-1 mr-4 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {diagnosis.fallDamage ? '✓' : ''}
                    </span>
                    <span>Fall damage</span>
                  </label>
                  <label
                    onClick={() => isAdmin && setDiagnosis(prev => ({ ...prev, setupFailure: !prev.setupFailure }))}
                    className={`inline-flex items-center space-x-1 mr-4 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {diagnosis.setupFailure ? '✓' : ''}
                    </span>
                    <span>Set-up failure</span>
                  </label>
                  <label
                    onClick={() => isAdmin && setDiagnosis(prev => ({ ...prev, softwareFailure: !prev.softwareFailure }))}
                    className={`inline-flex items-center space-x-1 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {diagnosis.softwareFailure ? '✓' : ''}
                    </span>
                    <span>Application or Software failure</span>
                  </label>
                </div>
                <div className="h-[23px] px-1.5 flex items-center text-[11px] pl-[69px]">
                  <label
                    onClick={() => isAdmin && setDiagnosis(prev => ({ ...prev, userError: !prev.userError }))}
                    className={`inline-flex items-center space-x-1 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {diagnosis.userError ? '✓' : ''}
                    </span>
                    <span>User Error</span>
                  </label>
                </div>
              </div>

              {/* SECTION 4: Engineer Timesheet Table (Header + 5 Body Rows, ends with 3px double border) */}
              <div className="border-b-[3px] border-double border-black">
                <table className="w-full border-collapse text-[11px] text-black table-fixed">
                  <thead>
                    <tr className="border-b border-black h-[22px] font-normal text-left">
                      <th className="border-r border-black px-1.5 font-normal w-[11.5%]">Date</th>
                      <th className="border-r border-black px-1.5 font-normal w-[26%]">Engineer name</th>
                      <th className="border-r border-black px-1.5 font-normal w-[12.5%]">Start time</th>
                      <th className="border-r border-black px-1.5 font-normal w-[12.5%]">End time</th>
                      <th className="border-r border-black px-1.5 font-normal w-[14.5%]">Total labour time</th>
                      <th className="border-r border-black px-1.5 font-normal w-[11.5%]">Travel time</th>
                      <th className="px-1.5 font-normal w-[11.5%]">Total time</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-black h-[22px] text-center">
                      <td className="border-r border-black px-1">{reportDateStr}</td>
                      <td className="border-r border-black px-1.5 text-center">{repair.technician || ''}</td>
                      <td className="border-r border-black px-1">{startTimeStr}</td>
                      <td className="border-r border-black px-1">{endTimeStr !== '-' ? endTimeStr : ''}</td>
                      <td className="border-r border-black px-1"></td>
                      <td className="border-r border-black px-1"></td>
                      <td className="px-1 whitespace-nowrap">{totalTimeStr !== '-' ? totalTimeStr : ''}</td>
                    </tr>
                    <tr className="border-b border-black h-[22px]">
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td></td>
                    </tr>
                    <tr className="border-b border-black h-[22px]">
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td></td>
                    </tr>
                    <tr className="border-b border-black h-[22px]">
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td></td>
                    </tr>
                    <tr className="h-[22px]">
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* SECTION 5: Work and activity performed (ends with 3px double border) */}
              <div className="border-b-[3px] border-double border-black">
                {/* Title row */}
                <div className="h-[22px] px-1.5 border-b border-black flex items-center text-[11px]">
                  Work and activity performed:
                </div>

                {/* Checkbox Row 1 */}
                <div className="h-[22px] px-1.5 border-b border-black grid grid-cols-12 items-center text-[11px]">
                  <label
                    onClick={() => isAdmin && setActivities(prev => ({ ...prev, functionCheck: !prev.functionCheck }))}
                    className={`col-span-3 inline-flex items-center space-x-1.5 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {activities.functionCheck ? '✓' : ''}
                    </span>
                    <span>Function check</span>
                  </label>
                  <label
                    onClick={() => isAdmin && setActivities(prev => ({ ...prev, checkoutConfig: !prev.checkoutConfig }))}
                    className={`col-span-4 inline-flex items-center space-x-1.5 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {activities.checkoutConfig ? '✓' : ''}
                    </span>
                    <span>Checkout device configuration</span>
                  </label>
                  <label
                    onClick={() => isAdmin && setActivities(prev => ({ ...prev, deviceCleaned: !prev.deviceCleaned }))}
                    className={`col-span-2 inline-flex items-center space-x-1.5 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {activities.deviceCleaned ? '✓' : ''}
                    </span>
                    <span>Device cleaned</span>
                  </label>
                  <label
                    onClick={() => isAdmin && setActivities(prev => ({ ...prev, accessoriesCleaned: !prev.accessoriesCleaned }))}
                    className={`col-span-3 inline-flex items-center space-x-1.5 pl-4 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {activities.accessoriesCleaned ? '✓' : ''}
                    </span>
                    <span>Accessories cleaned</span>
                  </label>
                </div>

                {/* Checkbox Row 2 */}
                <div className="h-[22px] px-1.5 border-b border-black grid grid-cols-12 items-center text-[11px]">
                  <label
                    onClick={() => isAdmin && setActivities(prev => ({ ...prev, batteryCheck: !prev.batteryCheck }))}
                    className={`col-span-3 inline-flex items-center space-x-1.5 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {activities.batteryCheck ? '✓' : ''}
                    </span>
                    <span>Battery check</span>
                  </label>
                  <label
                    onClick={() => isAdmin && setActivities(prev => ({ ...prev, softwareCheck: !prev.softwareCheck }))}
                    className={`col-span-4 inline-flex items-center space-x-1.5 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {activities.softwareCheck ? '✓' : ''}
                    </span>
                    <span>Application/Software check</span>
                  </label>
                  <label
                    onClick={() => isAdmin && setActivities(prev => ({ ...prev, displayLedCheck: !prev.displayLedCheck }))}
                    className={`col-span-2 inline-flex items-center space-x-1.5 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {activities.displayLedCheck ? '✓' : ''}
                    </span>
                    <span>Display/LED check</span>
                  </label>
                  <label
                    onClick={() => isAdmin && setActivities(prev => ({ ...prev, printerCheck: !prev.printerCheck }))}
                    className={`col-span-3 inline-flex items-center space-x-1.5 pl-4 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {activities.printerCheck ? '✓' : ''}
                    </span>
                    <span>Printer check/test print</span>
                  </label>
                </div>

                {/* 3 Ruled Rows for Work/Action Taken Details */}
                <div className="relative h-[66px] border-b border-black">
                  {/* Ruled horizontal lines at 22px and 44px */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col">
                    <div className="h-[22px] border-b border-black w-full"></div>
                    <div className="h-[22px] border-b border-black w-full"></div>
                    <div className="h-[22px] w-full"></div>
                  </div>
                  <textarea
                    value={actionTakenDetails}
                    onChange={(e) => isAdmin && setActionTakenDetails(e.target.value)}
                    readOnly={!isAdmin}
                    rows={3}
                    className="relative z-10 w-full h-[66px] px-1.5 py-0 bg-transparent border-none focus:outline-none resize-none text-[11px] leading-[22px] text-black overflow-hidden"
                  />
                </div>

                {/* Device tested and ready for use / User training executed */}
                <div className="h-[23px] px-1.5 flex items-center text-[11px]">
                  <label
                    onClick={() => isAdmin && setReadyStatus(prev => ({ ...prev, deviceReady: !prev.deviceReady }))}
                    className={`inline-flex items-center space-x-1.5 mr-9 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {readyStatus.deviceReady ? '✓' : ''}
                    </span>
                    <span className="font-bold">Device tested and ready for use</span>
                  </label>
                  <label
                    onClick={() => isAdmin && setReadyStatus(prev => ({ ...prev, userTraining: !prev.userTraining }))}
                    className={`inline-flex items-center space-x-1.5 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {readyStatus.userTraining ? '✓' : ''}
                    </span>
                    <span>User training executed</span>
                  </label>
                </div>
              </div>

              {/* SECTION 6: Spare parts table (ends with 3px double border) */}
              <div className="border-b-[3px] border-double border-black">
                <div className="h-[22px] px-1.5 border-b border-black flex items-center text-[11px]">
                  Spare parts for repair, consumable materials for the maintenance:
                </div>
                <table className="w-full border-collapse text-[11px] text-black table-fixed">
                  <thead>
                    <tr className="border-b border-black h-[22px] text-left font-normal">
                      <th className="border-r border-black px-1.5 font-normal w-[19.5%]">Article no./ Order no.</th>
                      <th className="border-r border-black px-1.5 font-normal w-[6.5%]">Qty.</th>
                      <th className="border-r border-black px-1.5 font-normal w-[36.5%]">Description</th>
                      <th className="border-r border-black px-1.5 font-normal w-[17%]">Serial-no. device</th>
                      <th className="px-1.5 font-normal w-[20.5%]">Supplier</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-black h-[22px]">
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td></td>
                    </tr>
                    <tr className="border-b border-black h-[22px]">
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td></td>
                    </tr>
                    <tr className="h-[22px]">
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td className="border-r border-black"></td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* SECTION 7: Service Quality Survey (ends with 3px double border) */}
              <div className="h-[25px] px-4 border-b-[3px] border-double border-black flex items-center justify-end text-[11px]">
                <span className="mr-8">Service Quality Survey:</span>

                {/* Happy Face */}
                <div
                  onClick={() => isAdmin && setSurveyRating(surveyRating === 'good' ? null : 'good')}
                  className={`inline-flex items-center space-x-2.5 mr-9 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                    {surveyRating === 'good' ? '✓' : ''}
                  </span>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-black" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="12" cy="12" r="9.5" />
                    <circle cx="9" cy="9.5" r="1" fill="currentColor" />
                    <circle cx="15" cy="9.5" r="1" fill="currentColor" />
                    <path d="M8 13.5c1.1 2 2.5 3 4 3s2.9-1 4-3" strokeLinecap="round" />
                  </svg>
                </div>

                {/* Neutral Face */}
                <div
                  onClick={() => isAdmin && setSurveyRating(surveyRating === 'neutral' ? null : 'neutral')}
                  className={`inline-flex items-center space-x-2.5 mr-9 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                    {surveyRating === 'neutral' ? '✓' : ''}
                  </span>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-black" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="12" cy="12" r="9.5" />
                    <circle cx="9" cy="9.5" r="1" fill="currentColor" />
                    <circle cx="15" cy="9.5" r="1" fill="currentColor" />
                    <line x1="8.5" y1="15" x2="15.5" y2="15" strokeLinecap="round" />
                  </svg>
                </div>

                {/* Sad Face */}
                <div
                  onClick={() => isAdmin && setSurveyRating(surveyRating === 'poor' ? null : 'poor')}
                  className={`inline-flex items-center space-x-2.5 select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                    {surveyRating === 'poor' ? '✓' : ''}
                  </span>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-black" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="12" cy="12" r="9.5" />
                    <circle cx="9" cy="9.5" r="1" fill="currentColor" />
                    <circle cx="15" cy="9.5" r="1" fill="currentColor" />
                    <path d="M8 16.5c1.1-2 2.5-3 4-3s2.9 1 4 3" strokeLinecap="round" />
                  </svg>
                </div>
              </div>

              {/* SECTION 8: Bottom Signatures Row */}
              <div className="flex h-[50px] text-[11px]">
                {/* Col 1: Admitted in MEDAS / Invoiced (19.5%) */}
                <div className="w-[19.5%] border-r border-black flex flex-col">
                  <div
                    onClick={() => isAdmin && setFooterChecks(prev => ({ ...prev, medas: !prev.medas }))}
                    className={`h-1/2 px-1.5 border-b border-black flex items-center justify-between select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span>Admitted in MEDAS:</span>
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {footerChecks.medas ? '✓' : ''}
                    </span>
                  </div>
                  <div
                    onClick={() => isAdmin && setFooterChecks(prev => ({ ...prev, invoiced: !prev.invoiced }))}
                    className={`h-1/2 px-1.5 flex items-center justify-between select-none ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span>Invoiced:</span>
                    <span className="inline-flex items-center justify-center w-[11px] h-[11px] border border-black text-[9px] font-bold leading-none bg-white">
                      {footerChecks.invoiced ? '✓' : ''}
                    </span>
                  </div>
                </div>

                {/* Col 2: Date (15%, right border is 3px double) */}
                <div className="w-[15%] border-r-[3px] border-double border-black px-2 py-1 flex flex-col justify-between">
                  <div>Date:</div>
                  <div className="border-b border-black w-full text-center text-[10px] leading-none pb-0.5 mb-0.5">
                    {reportDateStr}
                  </div>
                </div>

                {/* Col 3: ITRIS signature (28%, right border is 3px double) */}
                <div className="w-[28%] border-r-[3px] border-double border-black px-2 py-1 flex flex-col justify-between overflow-hidden">
                  <div>ITRIS signature:</div>
                  <div className="flex items-center justify-center gap-2 pb-0.5">
                    {repair.closingTechnicianSignature && (
                      <img
                        src={repair.closingTechnicianSignature}
                        alt="ITRIS signature"
                        className="max-h-6 max-w-[90px] object-contain"
                      />
                    )}
                    {repair.closingTechnician && (
                      <span className="text-[10px] font-semibold truncate">
                        ({repair.closingTechnician})
                      </span>
                    )}
                  </div>
                </div>

                {/* Col 4: Customer signature (37.5%) */}
                <div className="w-[37.5%] px-2 py-1 flex flex-col justify-between overflow-hidden">
                  <div>Customer signature:</div>
                  <div className="flex items-center justify-center gap-2 pb-0.5">
                    {repair.closingSignature && (
                      <img
                        src={repair.closingSignature}
                        alt="Customer signature"
                        className="max-h-6 max-w-[90px] object-contain"
                      />
                    )}
                    {(repair.closingSignerName || repair.closerName) && (
                      <span className="text-[10px] font-semibold truncate">
                        ({repair.closingSignerName || repair.closerName})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Document Bottom Footer */}
            <div className="flex items-center pt-5 text-[10px] text-black">
              <div className="w-[25%]">FP-OP-002-001 Rev.03</div>
              <div>ITRIS Medical (Thailand) Co., Ltd. terms &amp; conditions are applicable</div>
            </div>
          </div>
        </div>

        {/* Modal Footer (Hidden when printing) */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
          <button
            type="button"
            onClick={handlePrintInNewWindow}
            className="flex items-center space-x-1.5 px-3.5 py-2 border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            title="เปิดเอกสารในหน้าต่างใหม่เพื่อสั่งพิมพ์ (กรณีพิมพ์โดยตรงไม่ตอบสนอง)"
          >
            <ExternalLink size={14} />
            <span>เปิดหน้าต่างพิมพ์</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex items-center space-x-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            title="สั่งพิมพ์ไปยังเครื่องพิมพ์ที่เชื่อมต่อกับคอมพิวเตอร์"
          >
            {isPrinting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>กำลังส่งข้อมูลไปยังเครื่องพิมพ์...</span>
              </>
            ) : (
              <>
                <Printer size={15} />
                <span>พิมพ์รายงาน (Print)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
