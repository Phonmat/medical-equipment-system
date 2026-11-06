import type { AppUser, Equipment, FacilityUsageConfig, Role } from '../types.ts';

export const SUPER_ADMIN_USERNAME = 'Phonmat';
export const SUPER_ADMIN_PASSWORD = 'Phonmat55556666';
export const MAX_ADMINS_PER_FACILITY = 1;
export const MAX_REGULAR_USERS_PER_FACILITY = 5;
export const DEFAULT_FACILITY_USAGE_DAYS = 365;

export function isProtectedSuperAdmin(user?: Pick<AppUser, 'username' | 'role'> | null): boolean {
  if (!user) return false;
  return (
    user.username.trim().toLowerCase() === SUPER_ADMIN_USERNAME.toLowerCase() ||
    user.role === 'Super Admin'
  );
}

export function ensureSuperAdminAccount(users: AppUser[]): AppUser[] {
  const existingIdx = users.findIndex(
    (u) => u.username.trim().toLowerCase() === SUPER_ADMIN_USERNAME.toLowerCase()
  );

  const canonicalSuperAdmin: AppUser = {
    id: existingIdx >= 0 ? users[existingIdx].id : 'super-admin-phonmat',
    username: SUPER_ADMIN_USERNAME,
    password: SUPER_ADMIN_PASSWORD,
    role: 'Super Admin',
    facility: 'ส่วนกลาง (Super Admin)',
    avatar: existingIdx >= 0 ? users[existingIdx].avatar : undefined,
    createdAt: existingIdx >= 0 ? users[existingIdx].createdAt : new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    const copy = [...users];
    copy[existingIdx] = canonicalSuperAdmin;
    return copy;
  }

  return [canonicalSuperAdmin, ...users];
}

export function getFacilityMaxRegularUsers(
  facilityConfigs: Record<string, FacilityUsageConfig> | undefined | null,
  facility?: string | null
): number {
  const trimmed = (facility || '').trim();
  if (!trimmed || !facilityConfigs) return MAX_REGULAR_USERS_PER_FACILITY;
  const direct = facilityConfigs[trimmed];
  if (direct && typeof direct.maxRegularUsers === 'number' && !isNaN(direct.maxRegularUsers)) {
    return Math.max(1, Math.floor(direct.maxRegularUsers));
  }
  const lower = trimmed.toLowerCase();
  const matchedKey = Object.keys(facilityConfigs).find((k) => k.trim().toLowerCase() === lower);
  if (matchedKey) {
    const cfg = facilityConfigs[matchedKey];
    if (cfg && typeof cfg.maxRegularUsers === 'number' && !isNaN(cfg.maxRegularUsers)) {
      return Math.max(1, Math.floor(cfg.maxRegularUsers));
    }
  }
  return MAX_REGULAR_USERS_PER_FACILITY;
}

export function getFacilityQuotaStats(
  users: AppUser[],
  facility: string,
  excludeUserId?: string,
  customMaxRegularUsers?: number
): {
  adminCount: number;
  maxAdmins: number;
  regularCount: number;
  maxRegularUsers: number;
  totalCount: number;
  maxTotal: number;
} {
  const normFacility = (facility || '').trim().toLowerCase();
  const facilityUsers = users.filter((u) => {
    if (excludeUserId && u.id === excludeUserId) return false;
    if (isProtectedSuperAdmin(u)) return false;
    return (u.facility || '').trim().toLowerCase() === normFacility && normFacility !== '';
  });

  const adminCount = facilityUsers.filter((u) => u.role === 'Admin').length;
  const regularCount = facilityUsers.filter((u) => u.role !== 'Admin').length;
  const maxRegular =
    typeof customMaxRegularUsers === 'number' && !isNaN(customMaxRegularUsers)
      ? Math.max(1, Math.floor(customMaxRegularUsers))
      : MAX_REGULAR_USERS_PER_FACILITY;

  return {
    adminCount,
    maxAdmins: MAX_ADMINS_PER_FACILITY,
    regularCount,
    maxRegularUsers: maxRegular,
    totalCount: adminCount + regularCount,
    maxTotal: MAX_ADMINS_PER_FACILITY + maxRegular,
  };
}

export function validateFacilityUserQuota(
  users: AppUser[],
  candidate: {
    username?: string;
    facility?: string;
    role: Role;
    excludeUserId?: string;
    maxRegularUsers?: number;
  },
  facilityConfigs?: Record<string, FacilityUsageConfig>
): { valid: boolean; error?: string } {
  if (candidate.role === 'Super Admin') {
    if (
      candidate.username &&
      candidate.username.trim().toLowerCase() === SUPER_ADMIN_USERNAME.toLowerCase()
    ) {
      return { valid: true };
    }
    return {
      valid: false,
      error: 'ไม่สามารถสร้างหรือกำหนดสิทธิ์ Super Admin เพิ่มเติมได้ (สงวนสิทธิ์เฉพาะ Phonmat เท่านั้น)',
    };
  }

  const facility = (candidate.facility || '').trim();
  if (!facility) {
    return {
      valid: false,
      error: 'กรุณาระบุสถานประกอบการสำหรับผู้ใช้งานนี้',
    };
  }

  const effectiveMaxRegular =
    typeof candidate.maxRegularUsers === 'number' && !isNaN(candidate.maxRegularUsers)
      ? Math.max(1, Math.floor(candidate.maxRegularUsers))
      : getFacilityMaxRegularUsers(facilityConfigs, facility);

  const stats = getFacilityQuotaStats(users, facility, candidate.excludeUserId, effectiveMaxRegular);

  if (candidate.role === 'Admin') {
    if (stats.adminCount >= MAX_ADMINS_PER_FACILITY) {
      return {
        valid: false,
        error: `สถานประกอบการ "${facility}" มี Admin ครบ ${MAX_ADMINS_PER_FACILITY} บัญชีแล้ว (1 สถานประกอบการมี Admin ได้ 1 บัญชี)`,
      };
    }
  } else {
    if (stats.regularCount >= stats.maxRegularUsers) {
      return {
        valid: false,
        error: `สถานประกอบการ "${facility}" มีผู้ใช้งานทั่วไปครบ ${stats.maxRegularUsers} บัญชีแล้ว (สร้าง User ปกติได้สูงสุด ${stats.maxRegularUsers} บัญชีสำหรับสถานประกอบการนี้)`,
      };
    }
  }

  return { valid: true };
}

export function doesEquipmentBelongToUserDepartment(
  eq: Pick<Equipment, 'department' | 'ownerUsername' | 'team'>,
  viewer: Pick<AppUser, 'username' | 'team'>
): boolean {
  const viewerUsername = (viewer.username || '').trim().toLowerCase();
  const viewerTeam = (viewer.team || '').trim().toLowerCase();
  const eqDept = (eq.department || '').trim().toLowerCase();
  const eqOwner = (eq.ownerUsername || '').trim().toLowerCase();

  if (eqOwner && eqOwner === viewerUsername) {
    return true;
  }

  if (!eqDept) return false;

  const candidates = [viewerUsername, viewerTeam].filter(Boolean);
  for (const c of [...candidates]) {
    if (c.startsWith('user_') && c.length > 5) {
      candidates.push(c.slice(5));
    }
  }

  const deptParts = eqDept
    .split(/\s+-\s+|\s*\(\s*|\s*\)\s*|\s*\/\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const cand of candidates) {
    if (eqDept === cand) return true;
    if (deptParts.some((part) => part === cand || part.startsWith(cand + ' '))) return true;
    if (/[\u0E00-\u0E7F]/.test(cand) && cand.length >= 2 && eqDept.includes(cand)) return true;
    if (cand === 'er' && (eqDept.includes('emergency room') || eqDept.includes('ฉุกเฉิน'))) return true;
    if (cand === 'or' && (eqDept.includes('operating room') || eqDept.includes('ผ่าตัด'))) return true;
    if (cand === 'lr' && (eqDept.includes('labour room') || eqDept.includes('ห้องคลอด'))) return true;
  }

  return false;
}

export function filterEquipmentForUser(
  equipment: Equipment[],
  viewer?: Pick<AppUser, 'username' | 'role' | 'facility' | 'team'> | null
): Equipment[] {
  if (!viewer || !viewer.username) return [];

  if (isProtectedSuperAdmin(viewer)) {
    return equipment;
  }

  const viewerFacility = (viewer.facility || '').trim().toLowerCase();

  if (viewer.role === 'Admin') {
    if (!viewerFacility) return [];
    return equipment.filter(
      (eq) => (eq.facility || '').trim().toLowerCase() === viewerFacility
    );
  }

  // Regular user (User, PM/CAL, Pool): only sees equipment of their own department in their facility
  return equipment.filter((eq) => {
    const eqFacility = (eq.facility || '').trim().toLowerCase();
    if (viewerFacility && eqFacility && eqFacility !== viewerFacility) return false;
    return doesEquipmentBelongToUserDepartment(eq, viewer);
  });
}

export function filterRelatedRecordsByEquipment<
  T extends { equipmentId?: string; isNonRegistered?: boolean; reportedBy?: string; ownerUsername?: string; facility?: string; department?: string }
>(
  records: T[],
  visibleEquipment: Equipment[],
  viewer?: Pick<AppUser, 'username' | 'role' | 'facility' | 'team'> | null
): T[] {
  if (!viewer || !viewer.username) return [];
  if (isProtectedSuperAdmin(viewer)) return records;

  const visibleEqIds = new Set(visibleEquipment.map((eq) => eq.id));
  const viewerFacility = (viewer.facility || '').trim().toLowerCase();
  const viewerUsername = viewer.username.trim().toLowerCase();

  if (viewer.role === 'Admin') {
    if (!viewerFacility) return [];
    return records.filter((rec) => {
      if (rec.equipmentId && visibleEqIds.has(rec.equipmentId)) return true;
      if (rec.facility && rec.facility.trim().toLowerCase() === viewerFacility) return true;
      return false;
    });
  }

  // Regular user: only sees records tied to their own department's equipment or created by them in their facility
  return records.filter((rec) => {
    if (rec.equipmentId && visibleEqIds.has(rec.equipmentId)) return true;
    if (rec.isNonRegistered) {
      const owner = (rec.ownerUsername || rec.reportedBy || '').trim().toLowerCase();
      const fac = (rec.facility || '').trim().toLowerCase();
      if (!viewerFacility || !fac || fac === viewerFacility) {
        if (owner === viewerUsername) return true;
        if (
          rec.department &&
          doesEquipmentBelongToUserDepartment({ department: rec.department }, viewer)
        ) {
          return true;
        }
      }
    }
    return false;
  });
}

export function canDeleteUser(
  targetUser: AppUser,
  viewer?: Pick<AppUser, 'id' | 'username' | 'role' | 'facility'> | null
): boolean {
  if (isProtectedSuperAdmin(targetUser)) {
    return false;
  }
  if (!viewer) return false;
  if (viewer.id && viewer.id === targetUser.id) return false;
  if (
    !viewer.id &&
    viewer.username.trim().toLowerCase() === targetUser.username.trim().toLowerCase() &&
    (viewer.facility || '').trim().toLowerCase() === (targetUser.facility || '').trim().toLowerCase()
  ) {
    return false;
  }

  if (isProtectedSuperAdmin(viewer)) {
    return true;
  }

  if (viewer.role === 'Admin') {
    const viewerFacility = (viewer.facility || '').trim().toLowerCase();
    const targetFacility = (targetUser.facility || '').trim().toLowerCase();
    return (
      viewerFacility !== '' &&
      viewerFacility === targetFacility &&
      targetUser.role !== 'Admin' &&
      targetUser.role !== 'Super Admin'
    );
  }

  return false;
}

export function validateNewUsernameForFacility(
  users: AppUser[],
  username: string,
  facility?: string
): { valid: boolean; error?: string } {
  const trimmedUsername = (username || '').trim();
  const trimmedFacility = (facility || '').trim();

  if (!trimmedUsername) {
    return { valid: false, error: 'กรุณาระบุชื่อผู้ใช้งาน' };
  }

  if (trimmedUsername.toLowerCase() === SUPER_ADMIN_USERNAME.toLowerCase()) {
    return {
      valid: false,
      error: `ชื่อผู้ใช้งาน "${SUPER_ADMIN_USERNAME}" สงวนสิทธิ์เฉพาะ Super Admin เท่านั้น ห้ามตั้งซ้ำในทุกสถานประกอบการ`,
    };
  }

  if (!trimmedFacility) {
    return { valid: false, error: 'กรุณาระบุสถานประกอบการสำหรับผู้ใช้งานนี้' };
  }

  const duplicateInSameFacility = users.some((u) => {
    if (isProtectedSuperAdmin(u)) return false;
    const sameUsername = u.username.trim().toLowerCase() === trimmedUsername.toLowerCase();
    const sameFacility = (u.facility || '').trim().toLowerCase() === trimmedFacility.toLowerCase();
    return sameUsername && sameFacility;
  });

  if (duplicateInSameFacility) {
    return {
      valid: false,
      error: `ชื่อผู้ใช้งาน "${trimmedUsername}" มีอยู่ในสถานประกอบการ "${trimmedFacility}" แล้ว`,
    };
  }

  return { valid: true };
}

export function toDateStringYYYYMMDD(date?: Date | string): string {
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    return date.trim();
  }
  const d = date ? new Date(date) : new Date();
  if (isNaN(d.getTime())) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYYYYMMDDToUtcMs(dateStr: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec((dateStr || '').trim());
  if (!match) {
    const now = new Date();
    return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const baseMs = parseYYYYMMDDToUtcMs(dateStr);
  const safeDays = Math.max(0, Math.floor(Number(days) || 0));
  const target = new Date(baseMs + safeDays * 86400000);
  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, '0');
  const d = String(target.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createFacilityUsageConfig(
  facility: string,
  usageDays: number,
  startDateStr?: string,
  maxRegularUsers?: number
): FacilityUsageConfig {
  const safeDays = Math.max(0, Math.floor(Number(usageDays) || 0));
  const startDate = toDateStringYYYYMMDD(startDateStr);
  const expiryDate = addDaysToDateString(startDate, safeDays);
  const safeMaxRegular =
    typeof maxRegularUsers === 'number' && !isNaN(maxRegularUsers)
      ? Math.max(1, Math.floor(maxRegularUsers))
      : MAX_REGULAR_USERS_PER_FACILITY;
  return {
    facility: facility.trim(),
    usageDays: safeDays,
    startDate,
    expiryDate,
    maxRegularUsers: safeMaxRegular,
    updatedAt: new Date().toISOString(),
  };
}

export function createFacilityUsageConfigFromExpiry(
  facility: string,
  expiryDateStr: string,
  referenceDateStr?: string,
  maxRegularUsers?: number
): FacilityUsageConfig {
  const todayStr = toDateStringYYYYMMDD(referenceDateStr);
  const expiryDate = toDateStringYYYYMMDD(expiryDateStr);
  const todayMs = parseYYYYMMDDToUtcMs(todayStr);
  const expiryMs = parseYYYYMMDDToUtcMs(expiryDate);
  const diffDays = Math.max(0, Math.round((expiryMs - todayMs) / 86400000));
  const safeMaxRegular =
    typeof maxRegularUsers === 'number' && !isNaN(maxRegularUsers)
      ? Math.max(1, Math.floor(maxRegularUsers))
      : MAX_REGULAR_USERS_PER_FACILITY;
  return {
    facility: facility.trim(),
    usageDays: diffDays,
    startDate: todayStr,
    expiryDate,
    maxRegularUsers: safeMaxRegular,
    updatedAt: new Date().toISOString(),
  };
}

export function getFacilityUsageStatus(
  config?: FacilityUsageConfig | null,
  referenceDateStr?: string
): {
  usageDays: number;
  remainingDays: number;
  startDate: string;
  expiryDate: string;
  status: 'active' | 'expiring_soon' | 'expired';
  statusLabel: string;
} {
  const todayStr = toDateStringYYYYMMDD(referenceDateStr);
  const effectiveConfig =
    config && config.expiryDate
      ? config
      : createFacilityUsageConfig('default', DEFAULT_FACILITY_USAGE_DAYS, todayStr);

  const todayMs = parseYYYYMMDDToUtcMs(todayStr);
  const expiryMs = parseYYYYMMDDToUtcMs(effectiveConfig.expiryDate);
  const rawDiff = Math.round((expiryMs - todayMs) / 86400000);
  const remainingDays = Math.max(0, rawDiff);
  const usageDays = Math.max(0, Math.floor(Number(effectiveConfig.usageDays ?? remainingDays)));

  if (usageDays <= 0 || rawDiff <= 0) {
    return {
      usageDays,
      remainingDays: 0,
      startDate: effectiveConfig.startDate || todayStr,
      expiryDate: effectiveConfig.expiryDate,
      status: 'expired',
      statusLabel: 'หมดอายุการใช้งาน',
    };
  }

  if (remainingDays <= 7) {
    return {
      usageDays,
      remainingDays,
      startDate: effectiveConfig.startDate || todayStr,
      expiryDate: effectiveConfig.expiryDate,
      status: 'expiring_soon',
      statusLabel: 'ใกล้หมดอายุ',
    };
  }

  return {
    usageDays,
    remainingDays,
    startDate: effectiveConfig.startDate || todayStr,
    expiryDate: effectiveConfig.expiryDate,
    status: 'active',
    statusLabel: 'ใช้งานได้ปกติ',
  };
}

export function validateUserLogin(
  users: AppUser[],
  facilityConfigs: Record<string, FacilityUsageConfig>,
  input: {
    username: string;
    password?: string;
    selectedFacility?: string;
  },
  referenceDateStr?: string
): {
  valid: boolean;
  user?: AppUser;
  resolvedFacility?: string;
  error?: string;
} {
  const trimmedUsername = (input.username || '').trim();
  const password = input.password || '';
  const trimmedFacility = (input.selectedFacility || '').trim();

  if (!trimmedUsername || !password) {
    return { valid: false, error: 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน' };
  }

  const matchingUsers = users.filter(
    (u) => u.username.trim().toLowerCase() === trimmedUsername.toLowerCase()
  );

  if (matchingUsers.length === 0) {
    return { valid: false, error: 'ไม่พบชื่อผู้ใช้งานนี้ในระบบ' };
  }

  const superAdminUser = matchingUsers.find((u) => isProtectedSuperAdmin(u));
  if (superAdminUser) {
    if (superAdminUser.password && superAdminUser.password !== password) {
      return { valid: false, error: 'รหัสผ่านไม่ถูกต้อง' };
    }
    return {
      valid: true,
      user: superAdminUser,
      resolvedFacility: trimmedFacility || superAdminUser.facility || 'ส่วนกลาง (Super Admin)',
    };
  }

  if (!trimmedFacility) {
    return { valid: false, error: 'กรุณาเลือกสถานประกอบการ' };
  }

  const user = matchingUsers.find((u) => {
    const uFac = (u.facility || '').trim();
    return !uFac || uFac.toLowerCase() === trimmedFacility.toLowerCase();
  });

  if (!user) {
    return {
      valid: false,
      error: `ชื่อผู้ใช้งาน "${matchingUsers[0].username}" ไม่ได้สังกัดสถานประกอบการ "${trimmedFacility}"`,
    };
  }

  if (user.password && user.password !== password) {
    return { valid: false, error: 'รหัสผ่านไม่ถูกต้อง' };
  }

  const userFacility = (user.facility || '').trim();
  const targetFacility = userFacility || trimmedFacility;
  const usageStatus = getFacilityUsageStatus(facilityConfigs[targetFacility], referenceDateStr);
  if (usageStatus.status === 'expired') {
    return {
      valid: false,
      error: `สถานประกอบการ "${targetFacility}" หมดอายุการใช้งานแล้ว (เหลือ 0 วัน) กรุณาติดต่อผู้ดูแลระบบ`,
    };
  }

  return {
    valid: true,
    user,
    resolvedFacility: targetFacility,
  };
}

export function deleteFacilityAndAffiliatedUsers(
  facilities: string[],
  facilityConfigs: Record<string, FacilityUsageConfig>,
  users: AppUser[],
  facilityName: string
): {
  facilities: string[];
  facilityConfigs: Record<string, FacilityUsageConfig>;
  users: AppUser[];
  deletedUsersCount: number;
} {
  const target = String(facilityName || '').trim().toLowerCase();
  const nextFacilities = (facilities || []).filter(
    (f) => String(f || '').trim().toLowerCase() !== target
  );
  const nextConfigs: Record<string, FacilityUsageConfig> = { ...(facilityConfigs || {}) };
  for (const key of Object.keys(nextConfigs)) {
    if (key.trim().toLowerCase() === target) {
      delete nextConfigs[key];
    }
  }
  let deletedUsersCount = 0;
  const filteredUsers = (users || []).filter((u) => {
    if (isProtectedSuperAdmin(u)) return true;
    const isAffiliated = String(u.facility || '').trim().toLowerCase() === target;
    if (isAffiliated) {
      deletedUsersCount += 1;
      return false;
    }
    return true;
  });

  return {
    facilities: nextFacilities,
    facilityConfigs: nextConfigs,
    users: ensureSuperAdminAccount(filteredUsers),
    deletedUsersCount,
  };
}



