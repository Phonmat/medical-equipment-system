import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, ChevronsUpDown, Check, Building2, Tag, AlertCircle } from 'lucide-react';
import { Equipment } from '../types';

interface EquipmentSearchSelectProps {
  equipment: Equipment[];
  selectedId: string;
  onSelect: (equipmentId: string, equipment?: Equipment) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  filterFn?: (item: Equipment) => boolean;
  accentColor?: 'amber' | 'blue' | 'purple' | 'emerald';
  hasError?: boolean;
  onSelectNonRegistered?: (typedQuery?: string) => void;
}

export default function EquipmentSearchSelect({
  equipment,
  selectedId,
  onSelect,
  placeholder = 'พิมพ์ค้นหารหัสเครื่อง, ชื่อเครื่องมือ, หรือแผนก...',
  required = false,
  disabled = false,
  className = '',
  filterFn,
  accentColor = 'amber',
  hasError = false,
  onSelectNonRegistered
}: EquipmentSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find currently selected equipment
  const selectedEquipment = useMemo(() => {
    return equipment.find(e => e.id === selectedId);
  }, [equipment, selectedId]);

  // Filter equipment based on search query and optional custom filter
  const filteredList = useMemo(() => {
    let list = equipment;
    if (filterFn) {
      list = list.filter(filterFn);
    }
    if (!searchQuery.trim()) {
      return list;
    }
    const q = searchQuery.toLowerCase().trim();
    return list.filter(item => {
      const codeMatch = (item.code || '').toLowerCase().includes(q);
      const nameMatch = (item.name || '').toLowerCase().includes(q);
      const deptMatch = (item.department || '').toLowerCase().includes(q);
      const snMatch = (item.serialNumber || '').toLowerCase().includes(q);
      const mfgMatch = (item.manufacturer || '').toLowerCase().includes(q);
      const modelMatch = (item.model || '').toLowerCase().includes(q);
      return codeMatch || nameMatch || deptMatch || snMatch || mfgMatch || modelMatch;
    });
  }, [equipment, searchQuery, filterFn]);

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOpenDropdown = () => {
    if (disabled) return;
    setIsOpen(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleSelectItem = (item: Equipment) => {
    onSelect(item.id, item);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect('', undefined);
    setSearchQuery('');
    setIsOpen(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const ringFocusClass = {
    amber: 'focus-within:ring-amber-500 focus-within:border-amber-500',
    blue: 'focus-within:ring-blue-500 focus-within:border-blue-500',
    purple: 'focus-within:ring-purple-500 focus-within:border-purple-500',
    emerald: 'focus-within:ring-emerald-500 focus-within:border-emerald-500'
  }[accentColor];

  const badgeBgClass = {
    amber: 'bg-amber-50 text-amber-900 border-amber-200',
    blue: 'bg-blue-50 text-blue-900 border-blue-200',
    purple: 'bg-purple-50 text-purple-900 border-purple-200',
    emerald: 'bg-emerald-50 text-emerald-900 border-emerald-200'
  }[accentColor];

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Hidden input for form data without blocking native submission */}
      <input
        type="hidden"
        value={selectedId}
        name="selectedEquipmentId"
      />

      {/* Main trigger / Search box container */}
      <div
        id="equipment-search-selector"
        onClick={handleOpenDropdown}
        className={`w-full min-h-[42px] border rounded-xl bg-white transition-all shadow-xs cursor-pointer flex items-center px-3 py-1.5 gap-2 ${
          hasError
            ? 'border-red-500 ring-2 ring-red-100 bg-red-50/10'
            : isOpen 
              ? `border-slate-300 ring-2 ${ringFocusClass}` 
              : 'border-slate-300 hover:border-slate-400'
        } ${disabled ? 'bg-slate-100 cursor-not-allowed opacity-60' : ''}`}
      >
        <Search size={16} className={`shrink-0 ${hasError ? 'text-red-400' : 'text-slate-400'}`} />

        {/* When dropdown is closed and an item is selected */}
        {!isOpen && selectedEquipment ? (
          <div className="flex-1 flex items-center justify-between min-w-0">
            <div className="flex items-center space-x-2 truncate">
              <span className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold border ${badgeBgClass}`}>
                {selectedEquipment.code}
              </span>
              <span className="text-sm font-medium text-slate-800 truncate">
                {selectedEquipment.name}
              </span>
              {selectedEquipment.department && (
                <span className="hidden sm:inline-flex items-center text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  <Building2 size={11} className="mr-1 text-slate-400" />
                  {selectedEquipment.department}
                </span>
              )}
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={handleClearSelection}
                title="เปลี่ยนเครื่องมือ"
                className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors ml-1 shrink-0"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ) : (
          /* Search Input when open or no selection */
          <div className="flex-1 flex items-center min-w-0">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredList.length > 0) {
                    handleSelectItem(filteredList[0]);
                  }
                } else if (e.key === 'Escape') {
                  setIsOpen(false);
                }
              }}
              placeholder={selectedEquipment ? `เลือกอยู่: ${selectedEquipment.code} (พิมพ์เพื่อค้นหาใหม่)...` : placeholder}
              disabled={disabled}
              className="w-full text-sm bg-transparent border-0 outline-none p-0 placeholder:text-slate-400 text-slate-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchQuery('');
                  inputRef.current?.focus();
                }}
                className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        <ChevronsUpDown size={16} className="text-slate-400 shrink-0 ml-auto pointer-events-none" />
      </div>

      {/* Dropdown Options List */}
      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-72 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-150">
          {/* Status info bar */}
          <div className="px-3 py-1.5 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500 sticky top-0 z-10 border-b border-slate-100">
            <span>
              {searchQuery ? `ผลการค้นหา: "${searchQuery}"` : 'รายการเครื่องมือแพทย์ทั้งหมด'}
            </span>
            <span className="font-semibold text-slate-700">
              พบ {filteredList.length} รายการ
            </span>
          </div>

          {filteredList.length === 0 ? (
            <div className="p-6 text-center text-slate-500 space-y-3">
              <AlertCircle size={20} className="mx-auto text-slate-400" />
              <div>
                <p className="text-sm font-medium">ไม่พบเครื่องมือแพทย์ในทะเบียนที่ตรงกับคำค้นหา</p>
                <p className="text-xs text-slate-400 mt-0.5">ลองค้นหาด้วยรหัสเครื่อง, ชื่อเครื่องมือ, ยี่ห้อ หรือชื่อแผนก</p>
              </div>

              {onSelectNonRegistered && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onSelectNonRegistered(searchQuery);
                    }}
                    className="w-full py-2.5 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <span>🏷️ แจ้งซ่อมเป็น "เครื่องมือนอกทะเบียน" {searchQuery ? `(${searchQuery})` : ''}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {filteredList.map((item) => {
                const isSelected = item.id === selectedId;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className={`px-3 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                      isSelected ? 'bg-slate-50/80 font-medium' : ''
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                          {item.code}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {item.name}
                        </span>
                        {item.status && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            item.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            (item.status === 'repairing' || (item.status as string) === 'repair') ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            item.status === 'decommissioned' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                            item.status === 'broken' ? 'bg-red-50 text-red-700 border border-red-200' :
                            'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {item.status === 'active' ? 'พร้อมใช้งาน' : 
                             (item.status === 'repairing' || (item.status as string) === 'repair') ? 'กำลังซ่อม' : 
                             item.status === 'decommissioned' ? 'จำหน่าย' :
                             item.status === 'broken' ? 'ชำรุด' :
                             item.status === 'inactive' ? 'งดใช้งาน' : item.status}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-slate-500 flex-wrap gap-y-1">
                        {item.department && (
                          <span className="inline-flex items-center">
                            <Building2 size={12} className="mr-1 text-slate-400" />
                            {item.department}
                          </span>
                        )}
                        {(item.manufacturer || item.model) && (
                          <span className="inline-flex items-center text-slate-400">
                            <Tag size={12} className="mr-1 text-slate-400" />
                            {[item.manufacturer, item.model].filter(Boolean).join(' / ')}
                          </span>
                        )}
                        {item.serialNumber && (
                          <span className="text-slate-400 font-mono text-[11px]">
                            S/N: {item.serialNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="shrink-0 text-emerald-600 pt-1">
                        <Check size={16} />
                      </div>
                    )}
                  </div>
                );
              })}

              {onSelectNonRegistered && (
                <div className="p-2.5 bg-slate-50/90 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 sticky bottom-0 backdrop-blur-xs">
                  <span className="text-[11px] text-slate-500">ไม่พบเครื่องมือที่ต้องการในระบบ?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onSelectNonRegistered(searchQuery);
                    }}
                    className="text-amber-700 hover:text-amber-800 font-semibold hover:underline flex items-center gap-1 cursor-pointer bg-white px-2 py-1 rounded-md border border-amber-200 shadow-2xs"
                  >
                    <span>+ แจ้งซ่อมเครื่องมือนอกทะเบียน</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
