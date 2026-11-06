import React, { useState } from 'react';
import { X, Download, Archive, FileSpreadsheet, Code2, CheckCircle2, AlertCircle, Loader2, Sparkles, FolderArchive, ArrowDownToLine, Info } from 'lucide-react';

interface DownloadZipModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DownloadZipModal({ isOpen, onClose }: DownloadZipModalProps) {
  const [downloadingType, setDownloadingType] = useState<'data' | 'code' | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadBackupZip = async () => {
    try {
      setDownloadingType('data');
      setErrorMessage(null);
      setDownloadSuccess(null);

      const response = await fetch('/api/export/backup-zip');
      if (!response.ok) {
        throw new Error('ไม่สามารถสร้างไฟล์สำรองข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const today = new Date().toISOString().split('T')[0];
      a.download = `medical-system-backup-${today}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setDownloadSuccess('ดาวน์โหลดไฟล์ ZIP สำรองข้อมูลสำเร็จแล้ว!');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการดาวน์โหลด');
    } finally {
      setDownloadingType(null);
    }
  };

  const handleDownloadCodeZip = async () => {
    try {
      setDownloadingType('code');
      setErrorMessage(null);
      setDownloadSuccess(null);

      const response = await fetch('/api/export/project-zip');
      if (!response.ok) {
        throw new Error('ไม่สามารถบีบอัดไฟล์ Source Code ได้ กรุณาลองใหม่อีกครั้ง');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'medical-equipment-system-code.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setDownloadSuccess('ดาวน์โหลดไฟล์ ZIP Source Code สำเร็จแล้ว!');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการดาวน์โหลด');
    } finally {
      setDownloadingType(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-5 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
              <FolderArchive size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                ดาวน์โหลดไฟล์ ZIP
                <span className="text-[11px] bg-white/20 text-white px-2 py-0.5 rounded-full font-medium">Export</span>
              </h2>
              <p className="text-xs text-blue-100/90 mt-0.5">
                เลือกรูปแบบการดาวน์โหลดข้อมูลระบบหรือ Source Code ทั้งโปรเจกต์
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {downloadSuccess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <span className="font-semibold">{downloadSuccess}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
              <span className="font-semibold">{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option 1: Data Backup ZIP */}
            <div className="border border-slate-200 hover:border-blue-400 bg-white hover:bg-blue-50/20 rounded-xl p-4.5 flex flex-col justify-between transition-all duration-200 shadow-2xs group">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <FileSpreadsheet size={22} />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Data Backup
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 text-sm group-hover:text-blue-700 transition-colors">
                  สำรองข้อมูลระบบทั้งหมด
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  ดาวน์โหลดข้อมูลทุกส่วนในระบบเป็นไฟล์ ZIP ประกอบด้วย:
                </p>
                <ul className="text-[11px] text-slate-600 space-y-1 mt-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    ไฟล์ Excel รวม Sheet (เครื่องมือ, ซ่อม, PM, สอบเทียบ, Pool)
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    ไฟล์ JSON Backup แยกแต่ละตาราง
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    รายงานสรุปจำนวนข้อมูล (Summary)
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={handleDownloadBackupZip}
                disabled={downloadingType !== null}
                className="mt-4 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors cursor-pointer shadow-xs disabled:opacity-60"
              >
                {downloadingType === 'data' ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>กำลังสร้างไฟล์ ZIP...</span>
                  </>
                ) : (
                  <>
                    <ArrowDownToLine size={16} />
                    <span>ดาวน์โหลด Backup (.zip)</span>
                  </>
                )}
              </button>
            </div>

            {/* Option 2: Source Code ZIP */}
            <div className="border border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/20 rounded-xl p-4.5 flex flex-col justify-between transition-all duration-200 shadow-2xs group">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Code2 size={22} />
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Source Code
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 text-sm group-hover:text-indigo-700 transition-colors">
                  โค้ดโปรเจกต์ทั้งหมด
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  ดาวน์โหลดไฟล์โปรเจกต์ทั้งหมดเพื่อนำไปรันหรือพัฒนาต่อ:
                </p>
                <ul className="text-[11px] text-slate-600 space-y-1 mt-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    React 19 + TypeScript + Vite + Tailwind
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    Express Server & Cloud SQL Schemas
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    คู่มือวิธีติดตั้งและรันในเครื่อง (README)
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={handleDownloadCodeZip}
                disabled={downloadingType !== null}
                className="mt-4 w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors cursor-pointer shadow-xs disabled:opacity-60"
              >
                {downloadingType === 'code' ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>กำลังบีบอัดโค้ด...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>ดาวน์โหลด Source Code (.zip)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI Studio Export Guide */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/90 text-xs text-slate-600 space-y-2">
            <div className="flex items-center space-x-2 text-slate-800 font-semibold">
              <Info size={16} className="text-blue-600 shrink-0" />
              <span>วิธีดาวน์โหลดโค้ดผ่าน Google AI Studio โดยตรง:</span>
            </div>
            <p className="leading-relaxed text-slate-600 pl-6">
              นอกจากปุ่มดาวน์โหลดข้างต้น ท่านยังสามารถคลิกที่เมนู <strong>จุด 3 จุด (⋮)</strong> หรือปุ่ม <strong>Share / Export</strong> ที่มุมบนขวาของหน้าต่าง Google AI Studio แล้วเลือก <strong>&ldquo;Download Code&rdquo;</strong> หรือ <strong>&ldquo;Export&rdquo;</strong> เพื่อดาวน์โหลด ZIP จากระบบของ Google ได้ทันทีเช่นกันครับ
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
