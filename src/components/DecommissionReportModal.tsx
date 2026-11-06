import React, { useRef, useState } from 'react';
import { Printer, X, FileText, CheckCircle2, AlertTriangle, Loader2, ExternalLink } from 'lucide-react';
import { Decommission, Equipment } from '../types';
import { formatDateSlash, formatPurchasePrice } from '../utils/dateUtils';
import { printElement, printInNewWindow } from '../utils/printUtils';

interface DecommissionReportModalProps {
  decommission: Decommission | null;
  equipment?: Equipment;
  isOpen: boolean;
  onClose: () => void;
}

export default function DecommissionReportModal({
  decommission,
  equipment,
  isOpen,
  onClose,
}: DecommissionReportModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  if (!isOpen || !decommission) return null;

  const docNumber = `DCM-${decommission.id.slice(0, 8).toUpperCase()}`;
  const docDate = formatDateSlash(decommission.date || new Date().toISOString().split('T')[0]);

  const handlePrint = async () => {
    if (!printRef.current || isPrinting) return;
    setIsPrinting(true);
    try {
      await printElement(printRef.current, {
        documentTitle: `Decommission_${docNumber}`,
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
    if (!printRef.current) return;
    printInNewWindow(printRef.current, {
      documentTitle: `Decommission_${docNumber}`,
      pageOrientation: 'portrait',
      pageMargin: '6mm 6mm'
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden my-6 border border-slate-200 print-clean-page animate-fade-in">
        {/* Modal Action Header (Hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white print:hidden">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-red-600/30 text-red-400 rounded-lg">
              <FileText size={18} />
            </div>
            <div>
              <span className="font-bold text-base block">ใบคำร้องขอยกเลิกการใช้งานและจำหน่ายเครื่องมือแพทย์</span>
              <span className="text-xs text-slate-400">Medical Equipment Decommissioning & Disposal Form ({docNumber})</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrintInNewWindow}
              type="button"
              className="flex items-center space-x-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-semibold transition-colors border border-slate-700 cursor-pointer"
              title="เปิดเอกสารในหน้าต่างใหม่เพื่อสั่งพิมพ์"
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
                  <span>พิมพ์ใบงาน (Print)</span>
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
          {/* Printable Document Sheet */}
          <div
            ref={printRef}
            className="w-full max-w-[800px] mx-auto bg-white text-slate-900 font-sans border border-slate-400 p-6 sm:p-8 text-[11px] leading-tight shadow-lg print:shadow-none print:border-slate-800 print:p-4"
          >
            {/* Header Section */}
            <div className="flex items-start justify-between pb-3 border-b-2 border-slate-800">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-red-600 rounded flex items-center justify-center text-white font-black text-2xl leading-none shrink-0 shadow-xs">
                  +
                </div>
                <div>
                  <div className="flex items-baseline space-x-1.5">
                    <span className="text-xl font-black tracking-tight text-red-600">iTRIS</span>
                    <span className="text-base font-bold text-slate-800">MEDICAL EQUIPMENT MANAGEMENT</span>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    ศูนย์บริหารจัดการเครื่องมือแพทย์และวิศวกรรมการแพทย์
                  </p>
                  <p className="text-[9px] text-slate-500">
                    Medical Engineering & Asset Disposal Management Department
                  </p>
                </div>
              </div>

              <div className="border border-slate-800 rounded px-3 py-1.5 text-right min-w-[150px] bg-slate-50">
                <div className="text-[9px] text-slate-500 font-medium">เลขที่เอกสาร / Doc No.:</div>
                <div className="text-xs font-mono font-bold text-slate-900">{docNumber}</div>
                <div className="text-[9px] text-slate-500 font-medium mt-1">วันที่อนุมัติ / Date:</div>
                <div className="text-xs font-medium text-slate-900">{docDate}</div>
              </div>
            </div>

            {/* Document Title */}
            <div className="text-center my-3 pb-2 border-b border-slate-300">
              <h1 className="text-base font-bold tracking-tight text-slate-900 uppercase">
                แบบบันทึกขอยกเลิกการใช้งานและจำหน่ายเครื่องมือแพทย์
              </h1>
              <p className="text-[10px] text-slate-600 mt-0.5">
                (Medical Equipment Decommissioning and Disposal Form)
              </p>
            </div>

            {/* Section 1: ข้อมูลเครื่องมือแพทย์ */}
            <div className="mb-3">
              <div className="bg-slate-800 text-white px-2 py-1 text-xs font-semibold flex items-center justify-between">
                <span>1. ข้อมูลเครื่องมือแพทย์ (Equipment Identification)</span>
                <span className="text-[10px] font-normal text-slate-200 font-mono">ID CODE: {equipment?.code || '-'}</span>
              </div>
              <table className="w-full border-collapse border border-slate-400 text-[10px] mt-1">
                <tbody>
                  <tr className="border-b border-slate-300">
                    <td className="w-1/4 p-1.5 bg-slate-50 font-semibold border-r border-slate-300">รหัสเครื่องมือ (Code):</td>
                    <td className="w-1/4 p-1.5 font-mono font-bold text-slate-900 border-r border-slate-300">{equipment?.code || '-'}</td>
                    <td className="w-1/4 p-1.5 bg-slate-50 font-semibold border-r border-slate-300">Itris ID:</td>
                    <td className="w-1/4 p-1.5 font-mono text-slate-800">{equipment?.itrisId || '-'}</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="p-1.5 bg-slate-50 font-semibold border-r border-slate-300">ชื่อเครื่องมือ (Name):</td>
                    <td colSpan={3} className="p-1.5 font-bold text-slate-900">{equipment?.name || '-'}</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="p-1.5 bg-slate-50 font-semibold border-r border-slate-300">แผนก / หน่วยงาน (Department):</td>
                    <td className="p-1.5 text-slate-800 border-r border-slate-300">{equipment?.department || '-'}</td>
                    <td className="p-1.5 bg-slate-50 font-semibold border-r border-slate-300">ระดับความเสี่ยง (Risk Level):</td>
                    <td className="p-1.5 text-slate-800">{equipment?.riskLevel || '-'}</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="p-1.5 bg-slate-50 font-semibold border-r border-slate-300">ผู้ผลิต / รุ่น (Manufacturer / Model):</td>
                    <td className="p-1.5 text-slate-800 border-r border-slate-300">
                      {[equipment?.manufacturer, equipment?.model].filter(Boolean).join(' / ') || '-'}
                    </td>
                    <td className="p-1.5 bg-slate-50 font-semibold border-r border-slate-300">หมายเลขเครื่อง (Serial No.):</td>
                    <td className="p-1.5 font-mono text-slate-800">{equipment?.serialNumber || '-'}</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="p-1.5 bg-slate-50 font-semibold border-r border-slate-300">วันที่ติดตั้ง / รับเข้า:</td>
                    <td className="p-1.5 text-slate-800 font-mono border-r border-slate-300">{formatDateSlash(equipment?.installationDate || equipment?.purchaseDate || '') || '-'}</td>
                    <td className="p-1.5 bg-slate-50 font-semibold border-r border-slate-300">บริษัทผู้จำหน่าย / บริการ:</td>
                    <td className="p-1.5 text-slate-800">{equipment?.vendorCompany || '-'}</td>
                  </tr>
                  <tr>
                    <td className="p-1.5 bg-slate-50 font-semibold border-r border-slate-300">ข้อมูลการจัดซื้อ / ราคา:</td>
                    <td className="p-1.5 text-slate-800 border-r border-slate-300 font-mono">
                      {formatPurchasePrice(equipment?.purchase)}
                    </td>
                    <td className="p-1.5 bg-slate-50 font-semibold border-r border-slate-300">สถานะปัจจุบัน:</td>
                    <td className="p-1.5 font-semibold text-red-600">ยกเลิกการใช้งาน / จำหน่าย (Decommissioned)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 2: สาเหตุและเหตุผลในการยกเลิกการใช้งาน */}
            <div className="mb-3">
              <div className="bg-slate-800 text-white px-2 py-1 text-xs font-semibold">
                2. สาเหตุและเหตุผลการขอยกเลิกการใช้งาน / จำหน่าย (Reason & Justification)
              </div>
              <div className="border border-slate-400 p-3 mt-1 min-h-[90px] bg-slate-50/50">
                <p className="text-slate-900 whitespace-pre-wrap leading-relaxed text-xs">
                  {decommission.reason || 'ไม่มีการระบุเหตุผล'}
                </p>
              </div>
            </div>

            {/* Section 3: การประเมินทางเทคนิค */}
            <div className="mb-3">
              <div className="bg-slate-800 text-white px-2 py-1 text-xs font-semibold">
                3. ผลการตรวจสอบและประเมินทางวิศวกรรมการแพทย์ (Technical Assessment)
              </div>
              <div className="border border-slate-400 p-2.5 mt-1 space-y-1 text-[10px]">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3.5 h-3.5 rounded border border-slate-500 flex items-center justify-center text-[9px] font-bold">✓</span>
                    <span>อุปกรณ์ชำรุดเสียหายหนัก ไม่คุ้มค่าต่อการซ่อมแซม (Beyond Economical Repair)</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3.5 h-3.5 rounded border border-slate-500 flex items-center justify-center text-[9px] font-bold">✓</span>
                    <span>หมดอายุขัยการใช้งาน / บริษัทผู้ผลิตยกเลิกการผลิตอะไหล่ (End of Life)</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3.5 h-3.5 rounded border border-slate-500 flex items-center justify-center text-[9px] font-bold">✓</span>
                    <span>ยกเลิกการเชื่อมต่อระบบความปลอดภัยและถอดออกจากบัญชีคุมเครื่องมือแพทย์</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-3.5 h-3.5 rounded border border-slate-500 flex items-center justify-center text-[9px] font-bold">✓</span>
                    <span>ติดป้ายระงับการใช้งานและดำเนินการจำหน่ายตามระเบียบพัสดุ</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Signatures Section */}
            <div className="mt-4 border-2 border-slate-800">
              <div className="grid grid-cols-2 divide-x-2 divide-slate-800">
                {/* ผู้ตรวจสอบ / วิศวกรการแพทย์ / ช่าง */}
                <div className="p-3 flex flex-col justify-between min-h-[140px] text-center">
                  <div className="text-xs font-bold text-slate-800">ผู้ตรวจสอบ / เจ้าหน้าที่วิศวกรรมการแพทย์ (ช่าง)</div>
                  <div className="my-2 flex flex-col items-center justify-center">
                    {decommission.technicianSignature ? (
                      <div className="flex flex-col items-center">
                        <img
                          src={decommission.technicianSignature}
                          alt="Technician Signature"
                          className="h-12 max-w-[160px] object-contain"
                          referrerPolicy="no-referrer"
                        />
                        <div className="text-xs font-bold text-slate-900 mt-0.5">
                          ( {decommission.technician || 'ช่างผู้ตรวจสอบ'} )
                        </div>
                      </div>
                    ) : (
                      <div className="h-10 border-b border-dotted border-slate-400 w-44 flex items-end justify-center pb-0.5 text-slate-700 text-xs font-semibold">
                        ( {decommission.technician || '......................................................'} )
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-600">
                    <div>วันที่: {docDate}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">Medical Engineering Officer / Technician</div>
                  </div>
                </div>

                {/* ผู้อนุมัติ / ผู้มีอำนาจ */}
                <div className="p-3 flex flex-col justify-between min-h-[140px] text-center bg-red-50/20">
                  <div className="text-xs font-bold text-slate-900 flex items-center justify-center space-x-1">
                    <span>ผู้อนุมัติการยกเลิกการใช้งาน / จำหน่าย</span>
                  </div>
                  <div className="my-2 flex flex-col items-center justify-center">
                    {decommission.approverSignature ? (
                      <div className="flex flex-col items-center">
                        <img
                          src={decommission.approverSignature}
                          alt="Approver Signature"
                          className="h-12 max-w-[160px] object-contain"
                          referrerPolicy="no-referrer"
                        />
                        <div className="text-xs font-bold text-slate-900 mt-0.5">
                          ( {decommission.approvedBy || 'ผู้อนุมัติ'} )
                        </div>
                      </div>
                    ) : (
                      <div className="h-10 border-b border-dotted border-slate-400 w-44 flex items-end justify-center pb-0.5 text-slate-700 text-xs font-semibold">
                        ( {decommission.approvedBy || '......................................................'} )
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-700">
                    <div>วันที่อนุมัติ: <strong>{docDate}</strong></div>
                    <div className="text-[9px] text-slate-500 mt-0.5">Authorized Approver / Hospital Director</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="mt-3 pt-2 border-t border-slate-300 flex justify-between items-center text-[9px] text-slate-500">
              <div>เอกสารนี้เป็นหลักฐานการอนุมัติจำหน่ายเครื่องมือแพทย์ ออกโดยระบบบริหารจัดการเครื่องมือแพทย์ iTRIS Medical</div>
              <div>พิมพ์เมื่อ: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
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
            title="เปิดเอกสารในหน้าต่างใหม่เพื่อสั่งพิมพ์"
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
                <span>พิมพ์ใบงาน (Print)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
