export function formatCellText(val?: string | number | null): string {
  if (val === undefined || val === null) return '-';
  const str = String(val).trim();
  if (!str || str === '-' || str === '/' || str === '//' || !/[^\/\-\.\s]/.test(str)) {
    return '-';
  }
  return str;
}

export function calculateWarrantyDuration(startDateStr?: string, endDateStr?: string): string {
  if (!startDateStr || !endDateStr) return '';
  try {
    const parsedStart = parseDateString(startDateStr);
    const parsedEnd = parseDateString(endDateStr);
    if (!parsedStart || !parsedEnd) return '';
    const start = new Date(parsedStart);
    const end = new Date(parsedEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return '';

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
      months--;
      const prevMonthLastDay = new Date(end.getFullYear(), end.getMonth(), 0).getDate();
      days += prevMonthLastDay;
    }
    if (months < 0) {
      years--;
      months += 12;
    }

    const parts: string[] = [];
    if (years > 0) parts.push(`${years} ปี`);
    if (months > 0) parts.push(`${months} เดือน`);
    if (days > 0 && years === 0) parts.push(`${days} วัน`);

    if (parts.length === 0) return '0 วัน';
    return parts.join(' ');
  } catch (e) {
    return '';
  }
}

export function calculateEndDateFromYears(startDateStr: string, years: number | string): string {
  if (!startDateStr) return '';
  const numYears = Number(years);
  if (isNaN(numYears) || numYears <= 0) return '';

  try {
    const parsedStart = parseDateString(startDateStr);
    if (!parsedStart) return '';
    const start = new Date(parsedStart);
    if (isNaN(start.getTime())) return '';

    const end = new Date(start.getTime());
    end.setFullYear(start.getFullYear() + numYears);
    if (isNaN(end.getTime())) return '';

    return end.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
}

export function splitWarrantyDateRange(str?: string): { rawStart: string; rawEnd: string } | null {
  if (!str) return null;
  const trimmed = str.trim();
  if (!trimmed || !/\d/.test(trimmed) || /^[0\/\-\.\s#]+$/.test(trimmed)) return null;

  // 1. Separated by "ถึง" or "to"
  const toMatch = trimmed.match(/^(.+?)\s*(?:ถึง|to)\s*(.+)$/i);
  if (toMatch) {
    return { rawStart: toMatch[1].trim(), rawEnd: toMatch[2].trim() };
  }

  // 2. Two ISO dates (YYYY-MM-DD or YYYY/MM/DD) separated by "-"
  const isoRangeMatch = trimmed.match(/^(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\s*-\s*(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})$/);
  if (isoRangeMatch) {
    return { rawStart: isoRangeMatch[1].trim(), rawEnd: isoRangeMatch[2].trim() };
  }

  // 3. Slash or dot dates separated by "-" (e.g. "17/6/2013-16/6/2014", "18/10/2012 -17/10/2013", "9/2024-9/2026")
  const slashRangeMatch = trimmed.match(/^(\d{1,4}[\/\.]\d{1,2}(?:[\/\.]\d{2,4})?)\s*-\s*(.+)$/);
  if (slashRangeMatch) {
    return { rawStart: slashRangeMatch[1].trim(), rawEnd: slashRangeMatch[2].trim() };
  }

  return null;
}

export function extractWarrantyYears(durationStr?: string, startDateStr?: string, endDateStr?: string): string {
  if (startDateStr && endDateStr) {
    try {
      const parsedStart = parseDateString(startDateStr);
      const parsedEnd = parseDateString(endDateStr);
      if (parsedStart && parsedEnd) {
        const start = new Date(parsedStart);
        const end = new Date(parsedEnd);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start) {
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          const years = Math.round((diffDays / 365.25) * 10) / 10;
          if (years > 0) return `${years % 1 === 0 ? Math.round(years) : years}`;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  if (!durationStr) return '';
  const trimmed = String(durationStr).trim();
  if (!trimmed || !/\d/.test(trimmed) || /^[0\/\-\.\s#]+$/.test(trimmed)) return '';

  // Check if durationStr is a date range e.g. "2024-01-15 ถึง 2026-01-15" or "17/6/2013-16/6/2014"
  const split = splitWarrantyDateRange(trimmed);
  if (split) {
    const s = parseDateString(split.rawStart);
    const e = parseDateString(split.rawEnd);
    if (s && e && s !== e) {
      const derived = extractWarrantyYears(undefined, s, e);
      if (derived) return derived;
    }
    return '';
  }

  // Do not treat single dates (like "2015-06-23" or "17/6/2013") as warranty years
  if (/^\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}$/.test(trimmed)) return '';

  const match = trimmed.match(/(\d+(\.\d+)?)\s*(?:ปี|years?|y|yr|yrs)/i);
  if (match) return match[1];

  // If it's just a number and reasonably small (<= 50)
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!isNaN(num) && num > 0 && num <= 50) {
      return `${num % 1 === 0 ? Math.round(num) : num}`;
    }
  }

  return '';
}

export function parseDateString(str?: string): string {
  if (!str) return '';
  const trimmed = str.trim();
  if (!trimmed || !/\d/.test(trimmed) || /^[0\/\-\.\s#]+$/.test(trimmed)) return '';

  // YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymdMatch) {
    let y = Number(ymdMatch[1]);
    let m = Number(ymdMatch[2]);
    let d = Number(ymdMatch[3]);
    if (y > 2400) y -= 543;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // DD/MM/YYYY, D/M/YYYY, DD/MM.YYYY, D/M.YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{2,4})$/);
  if (slashMatch) {
    let d = Number(slashMatch[1]);
    let m = Number(slashMatch[2]);
    let y = Number(slashMatch[3]);
    if (m > 12 && d <= 12) {
      const temp = d;
      d = m;
      m = temp;
    }
    if (y < 100) y += 2000;
    if (y > 2400) y -= 543;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // DD-MM-YYYY
  const dashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (dashMatch) {
    let d = Number(dashMatch[1]);
    let m = Number(dashMatch[2]);
    let y = Number(dashMatch[3]);
    if (m > 12 && d <= 12) {
      const temp = d;
      d = m;
      m = temp;
    }
    if (y < 100) y += 2000;
    if (y > 2400) y -= 543;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // YYYY-MM or YYYY/MM
  const ymMatch = trimmed.match(/^(\d{4})[\/\-](\d{1,2})$/);
  if (ymMatch) {
    let y = Number(ymMatch[1]);
    let m = Number(ymMatch[2]);
    if (y > 2400) y -= 543;
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  // MM/YYYY or M/YYYY
  const myMatch = trimmed.match(/^(\d{1,2})[\/\.](\d{4})$/);
  if (myMatch) {
    let m = Number(myMatch[1]);
    let y = Number(myMatch[2]);
    if (y > 2400) y -= 543;
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  return trimmed;
}

export function formatDateSlash(dateStr?: string): string {
  if (!dateStr) return '-';
  const trimmed = String(dateStr).trim();
  if (!trimmed || trimmed === '-' || trimmed === '/' || trimmed === '//') return '-';
  // If there are no digits in the string, or only slashes/dashes/spaces/zeros/hashes
  if (!/\d/.test(trimmed) || /^[0\/\-\.\s#]+$/.test(trimmed)) return '-';

  const parsed = parseDateString(trimmed);
  if (parsed && /^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
    const [y, m, d] = parsed.split('-');
    return `${d}/${m}/${y}`;
  }
  if (parsed && /^\d{4}-\d{2}$/.test(parsed)) {
    const [y, m] = parsed.split('-');
    return `${m}/${y}`;
  }

  return trimmed.replace(/-/g, '/');
}

export function isNumericPrice(val?: string | number | null): boolean {
  if (val === undefined || val === null) return false;
  if (typeof val === 'number') return !isNaN(val) && val >= 0;
  const str = String(val).trim();
  if (!str || str === '-' || str === '/' || str === '//' || /^[0\/\-\.\s#]+$/.test(str)) return false;
  if (/^(?:บริษัท|บจก|หจก|บมจ|ltd|inc|corp|co\.|service|medical)/i.test(str)) return false;
  // Reject date strings like YYYY-MM-DD, DD/MM/YYYY, etc.
  if (/^\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}$/.test(str)) return false;
  const clean = str.replace(/บาท/g, '').replace(/บ\./g, '').replace(/฿/g, '').replace(/THB/gi, '').replace(/,/g, '').trim();
  return /^(\d+)(\.\d+)?$/.test(clean) && Number(clean) >= 0;
}

export function formatPurchasePrice(val?: string | number | null): string {
  if (val === undefined || val === null) return '-';
  const str = String(val).trim();
  if (!str || str === '-' || str === '/' || str === '//' || !/\d/.test(str) || /^[0\/\-\.\s#]+$/.test(str)) return '-';

  // Reject date strings like YYYY-MM-DD, DD/MM/YYYY
  if (/^\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}$/.test(str)) return '-';

  // If it's pure company name or text without numbers, don't format as price
  if (/^(?:บริษัท|บจก|หจก|บมจ|ltd|corp)/i.test(str) && !/\d{3,}/.test(str)) return '-';

  // Extract digits and decimals, stripping 'บาท', 'บ.', '฿', 'THB', commas
  const cleanNum = str.replace(/บาท/g, '').replace(/บ\./g, '').replace(/฿/g, '').replace(/THB/gi, '').replace(/,/g, '').trim();
  if (/^(\d+)(\.\d+)?$/.test(cleanNum)) {
    const num = Number(cleanNum);
    if (!isNaN(num)) {
      return num.toLocaleString('th-TH', {
        minimumFractionDigits: Number.isInteger(num) ? 0 : 2,
        maximumFractionDigits: 2,
      });
    }
  }

  return '-';
}

export function formatWarrantyDateRange(eq?: {
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  purchaseDate?: string;
  installationDate?: string;
  warrantyYears?: string | number;
  warrantyPeriod?: string;
}): { start: string; end: string; fullText: string } | null {
  if (!eq) return null;

  try {
    // 1. If warrantyPeriod explicitly contains a date or date range (e.g. "17/6/2013-16/6/2014", "2015-06-23")
    if (eq.warrantyPeriod) {
      const trimmedPeriod = String(eq.warrantyPeriod).trim();
      const isOnlyYears = /^\d+(\.\d+)?\s*(?:ปี|years?|y|yr|yrs)?$/i.test(trimmedPeriod);
      const isDurationText = /(?:เดือน|วัน|months?|days?)/i.test(trimmedPeriod);
      if (trimmedPeriod && !isOnlyYears && !isDurationText && /\d/.test(trimmedPeriod) && !/^[0\/\-\.\s#]+$/.test(trimmedPeriod)) {
        const split = splitWarrantyDateRange(trimmedPeriod);
        if (split) {
          const isStartIso = /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(split.rawStart);
          const isEndIso = /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(split.rawEnd);
          const startDisp = isStartIso ? formatDateSlash(split.rawStart) : split.rawStart;
          const endDisp = isEndIso ? formatDateSlash(split.rawEnd) : split.rawEnd;
          return {
            start: startDisp,
            end: endDisp,
            fullText: `${startDisp}-${endDisp}`
          };
        }
        return {
          start: trimmedPeriod,
          end: '',
          fullText: trimmedPeriod
        };
      }
    }

    // 2. Otherwise check explicit warrantyStartDate / warrantyEndDate
    let start = parseDateString(eq.warrantyStartDate || '');
    let end = parseDateString(eq.warrantyEndDate || '');

    if (!start && end) {
      start = parseDateString(eq.installationDate || eq.purchaseDate || '');
    }

    if (start && !end) {
      const years = eq.warrantyYears || extractWarrantyYears(eq.warrantyPeriod);
      if (years && Number(years) > 0) {
        end = calculateEndDateFromYears(start, years);
      }
    }

    const startSlash = start ? formatDateSlash(start) : '';
    const endSlash = end ? formatDateSlash(end) : '';

    if (startSlash && endSlash && startSlash !== '-' && endSlash !== '-') {
      return {
        start: startSlash,
        end: endSlash,
        fullText: `${startSlash}-${endSlash}`
      };
    }

    if (startSlash && startSlash !== '-' && eq.warrantyStartDate) {
      return {
        start: startSlash,
        end: '',
        fullText: startSlash
      };
    }

    return null;
  } catch (e) {
    return null;
  }
}

export function formatWarrantyDisplay(eq?: {
  warrantyYears?: string | number;
  warrantyPeriod?: string;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  installationDate?: string;
  purchaseDate?: string;
}): string {
  if (!eq) return '-';

  // 1. Direct warrantyYears field
  if (eq.warrantyYears !== undefined && eq.warrantyYears !== null && String(eq.warrantyYears).trim() !== '') {
    const yrStr = String(eq.warrantyYears).trim();
    if (/\d/.test(yrStr) && !/^[0\/\-\.\s]+$/.test(yrStr)) {
      if (yrStr.includes('ปี')) return yrStr;
      const extracted = extractWarrantyYears(yrStr);
      if (extracted) return `${extracted} ปี`;
      if (/^\d+(\.\d+)?$/.test(yrStr)) return `${yrStr} ปี`;
    }
  }

  // 2. Extract from warrantyPeriod (e.g. "1 ปี", "2 Years", or "2024-01-15 ถึง 2026-01-15")
  if (eq.warrantyPeriod && String(eq.warrantyPeriod).trim() !== '') {
    const pStr = String(eq.warrantyPeriod).trim();
    if (/\d/.test(pStr) && !/^[0\/\-\.\s]+$/.test(pStr)) {
      const extracted = extractWarrantyYears(pStr);
      if (extracted) {
        return `${extracted} ปี`;
      }
      if (/^\d+(\.\d+)?$/.test(pStr)) {
        return `${pStr} ปี`;
      }
      if (/^\d+(\.\d+)?\s*ปี$/.test(pStr)) {
        return pStr;
      }
    }
  }

  // 3. Extract from start and end dates or calculated range
  const range = formatWarrantyDateRange(eq);
  if (range && range.start && range.end) {
    const derivedYears = extractWarrantyYears(undefined, range.start, range.end);
    if (derivedYears) {
      return `${derivedYears} ปี`;
    }
    const duration = calculateWarrantyDuration(range.start, range.end);
    if (duration) return duration;
  }

  if (eq.warrantyStartDate && eq.warrantyEndDate) {
    const derivedYears = extractWarrantyYears(undefined, eq.warrantyStartDate, eq.warrantyEndDate);
    if (derivedYears) {
      return `${derivedYears} ปี`;
    }
    const duration = calculateWarrantyDuration(eq.warrantyStartDate, eq.warrantyEndDate);
    if (duration) return duration;
  }

  return '-';
}

export function calculateEquipmentUsageAge(installationDateStr?: string, referenceDate: Date = new Date()): string {
  if (!installationDateStr) return '-';
  const parsed = parseDateString(installationDateStr);
  if (!parsed || !/^\d{4}-\d{2}-\d{2}$/.test(parsed)) return '-';

  const [installYear, installMonth, installDay] = parsed.split('-').map(Number);
  if (!installYear || !installMonth || !installDay) return '-';

  const curYear = referenceDate.getFullYear();
  const curMonth = referenceDate.getMonth() + 1;
  const curDay = referenceDate.getDate();

  const installDateObj = new Date(installYear, installMonth - 1, installDay);
  const currentDateObj = new Date(curYear, curMonth - 1, curDay);
  if (isNaN(installDateObj.getTime()) || currentDateObj < installDateObj) {
    return '-';
  }

  let years = curYear - installYear;
  let months = curMonth - installMonth;
  let days = curDay - installDay;

  if (days < 0) {
    months--;
    const prevMonthLastDay = new Date(curYear, curMonth - 1, 0).getDate();
    days += prevMonthLastDay;
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ปี`);
  if (months > 0) parts.push(`${months} เดือน`);
  if (days > 0) parts.push(`${days} วัน`);

  if (parts.length === 0) return '0 วัน';
  return parts.join(' ');
}

export function getTodayIsoLocalString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function resolvePlanStatusByNextDate(
  nextDateStr?: string,
  fallbackStatus: 'pending' | 'completed' | 'overdue' = 'pending'
): 'pending' | 'completed' | 'overdue' {
  if (fallbackStatus === 'completed') return 'completed';
  const parsedNext = parseDateString(nextDateStr);
  if (parsedNext) {
    const today = getTodayIsoLocalString();
    const nextComp = parsedNext.length === 7 ? `${parsedNext}-31` : parsedNext;
    return today > nextComp ? 'overdue' : 'pending';
  }
  return fallbackStatus;
}

export function normalizeLastDateToOct2026(dateStr?: string, defaultDay: string = '14'): string {
  const parsed = parseDateString(dateStr);
  if (parsed && /^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
    const [, , d] = parsed.split('-');
    const dayNum = Math.min(31, Math.max(1, Number(d) || Number(defaultDay) || 14));
    return `2026-10-${String(dayNum).padStart(2, '0')}`;
  }
  return `2026-10-${defaultDay.padStart(2, '0')}`;
}




