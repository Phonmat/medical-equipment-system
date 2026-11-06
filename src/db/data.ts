import fs from 'fs';
import path from 'path';
import {
  SUPER_ADMIN_USERNAME,
  SUPER_ADMIN_PASSWORD,
  DEFAULT_FACILITY_USAGE_DAYS,
  MAX_REGULAR_USERS_PER_FACILITY,
  ensureSuperAdminAccount,
  isProtectedSuperAdmin,
  createFacilityUsageConfig,
} from '../utils/accessControl.ts';
import type { FacilityUsageConfig } from '../types.ts';
import { normalizeLastDateToOct2026 } from '../utils/dateUtils.ts';

const DATA_FILE = path.resolve(process.cwd(), '.data-store.json');

const DEFAULT_DEPARTMENTS = [
  'แผนกฉุกเฉิน (ER)',
  'ห้องผ่าตัด (OR)',
  'ICU',
  'แผนกผู้ป่วยใน (IPD)',
  'แผนกผู้ป่วยนอก (OPD)',
  'ห้องปฏิบัติการ (LAB)',
  'แผนกรังสีวิทยา (X-Ray)',
  'แผนกกายภาพบำบัด',
  'งานจ่ายกลาง (CSSD)',
  'แผนกไตเทียม',
  'แผนกทันตกรรม',
  'แผนกสูติ-นรีเวช',
  'แผนกกุมารเวชกรรม',
];

const DEFAULT_FACILITIES = [
  'โรงพยาบาลศูนย์การแพทย์',
];

const INITIAL_USERS = ensureSuperAdminAccount([
  {
    id: 'super-admin-phonmat',
    username: SUPER_ADMIN_USERNAME,
    password: SUPER_ADMIN_PASSWORD,
    role: 'Super Admin',
    facility: 'ส่วนกลาง (Super Admin)',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'user-admin-1',
    username: 'admin_hospital1',
    password: '1234',
    role: 'Admin',
    facility: 'โรงพยาบาลศูนย์การแพทย์',
    createdAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 'user-reg-1',
    username: 'user_icu',
    password: '1234',
    role: 'User',
    facility: 'โรงพยาบาลศูนย์การแพทย์',
    createdAt: '2026-01-03T00:00:00.000Z',
  },
  {
    id: 'user-reg-2',
    username: 'user_er',
    password: '1234',
    role: 'User',
    facility: 'โรงพยาบาลศูนย์การแพทย์',
    createdAt: '2026-01-04T00:00:00.000Z',
  },
]);

const INITIAL_EQUIPMENT: any[] = [];
const INITIAL_REPAIRS: any[] = [];
const INITIAL_MAINTENANCES: any[] = [];
const INITIAL_CALIBRATIONS: any[] = [];
const INITIAL_POOL_LOANS: any[] = [];
const INITIAL_DOCUMENTS: any[] = [];

interface DataStoreShape {
  equipment: any[];
  repairs: any[];
  decommissions: any[];
  maintenances: any[];
  calibrations: any[];
  poolLoans: any[];
  departments: string[];
  facilities: string[];
  facilityConfigs: Record<string, FacilityUsageConfig>;
  users: any[];
  documents: any[];
}

function ensureFacilityConfigs(
  facilities: string[],
  users: any[],
  rawConfigs?: Record<string, FacilityUsageConfig>
): Record<string, FacilityUsageConfig> {
  const configs: Record<string, FacilityUsageConfig> = { ...(rawConfigs || {}) };
  const allFacs = new Set<string>(facilities || []);
  (users || []).forEach((u) => {
    if (u?.facility && !isProtectedSuperAdmin(u) && u.facility !== 'ส่วนกลาง (Super Admin)') {
      allFacs.add(String(u.facility).trim());
    }
  });
  for (const fac of allFacs) {
    const trimmed = fac.trim();
    if (!trimmed) continue;
    if (!configs[trimmed]) {
      configs[trimmed] = createFacilityUsageConfig(trimmed, DEFAULT_FACILITY_USAGE_DAYS);
    }
  }
  return configs;
}

function loadStore(): DataStoreShape {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const loadedUsers = ensureSuperAdminAccount(
          Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : INITIAL_USERS
        );
        const loadedFacilities =
          Array.isArray(parsed.facilities)
            ? parsed.facilities
            : DEFAULT_FACILITIES;
        const loadedFacilityConfigs = ensureFacilityConfigs(
          loadedFacilities,
          loadedUsers,
          parsed.facilityConfigs && typeof parsed.facilityConfigs === 'object'
            ? parsed.facilityConfigs
            : {}
        );
        const rawEquipment = Array.isArray(parsed.equipment) ? parsed.equipment : [];
        const normalizedEquipment = rawEquipment.map((eq: any, idx: number) => ({
          ...eq,
          facility: eq.facility || 'โรงพยาบาลศูนย์การแพทย์',
          ownerUsername: eq.ownerUsername || (idx % 2 === 0 ? 'user_icu' : 'user_er'),
        }));

        const normalizedMaintenances = Array.isArray(parsed.maintenances)
          ? parsed.maintenances.map((m: any) => ({
              ...m,
              lastDate: normalizeLastDateToOct2026(m.lastDate, '14'),
            }))
          : [];
        const normalizedCalibrations = Array.isArray(parsed.calibrations)
          ? parsed.calibrations.map((c: any) => ({
              ...c,
              lastDate: normalizeLastDateToOct2026(c.lastDate, '19'),
            }))
          : [];

        return {
          equipment: normalizedEquipment,
          repairs: Array.isArray(parsed.repairs) ? parsed.repairs : [],
          decommissions: Array.isArray(parsed.decommissions) ? parsed.decommissions : [],
          maintenances: normalizedMaintenances,
          calibrations: normalizedCalibrations,
          poolLoans: Array.isArray(parsed.poolLoans) ? parsed.poolLoans : [],
          departments: Array.isArray(parsed.departments) && parsed.departments.length > 0 ? parsed.departments : DEFAULT_DEPARTMENTS,
          facilities: loadedFacilities,
          facilityConfigs: loadedFacilityConfigs,
          users: loadedUsers,
          documents: Array.isArray(parsed.documents) ? parsed.documents : [],
        };
      }
    }
  } catch (err) {
    console.error('Failed to read data store:', err);
  }
  const initial: DataStoreShape = {
    equipment: [],
    repairs: [],
    decommissions: [],
    maintenances: [],
    calibrations: [],
    poolLoans: [],
    departments: DEFAULT_DEPARTMENTS,
    facilities: DEFAULT_FACILITIES,
    facilityConfigs: ensureFacilityConfigs(DEFAULT_FACILITIES, INITIAL_USERS, {}),
    users: INITIAL_USERS,
    documents: [],
  };
  saveStore(initial);
  return initial;
}

function saveStore(store: DataStoreShape) {
  try {
    store.users = ensureSuperAdminAccount(store.users || []);
    store.facilityConfigs = ensureFacilityConfigs(store.facilities, store.users, store.facilityConfigs);
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write data store:', err);
  }
}

function upsertById(list: any[], item: any): any {
  const id = String(item.id || crypto.randomUUID());
  const normalized = { ...item, id };
  const idx = list.findIndex((x) => String(x.id) === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...normalized };
    return list[idx];
  }
  list.push(normalized);
  return normalized;
}

export async function getAllData() {
  return loadStore();
}

export async function seedInitialData(_data: any) {
  return { seeded: false, reason: 'Seeding disabled' };
}

export async function saveEquipment(item: any) {
  const store = loadStore();
  const saved = upsertById(store.equipment, item);
  if (saved.facility && !store.facilities.includes(saved.facility)) {
    store.facilities.push(saved.facility);
  }
  saveStore(store);
  return saved;
}

export async function saveBulkEquipment(items: any[]) {
  if (!items || items.length === 0) return { count: 0 };
  const store = loadStore();
  for (const item of items) {
    const saved = upsertById(store.equipment, item);
    if (saved.facility && !store.facilities.includes(saved.facility)) {
      store.facilities.push(saved.facility);
    }
    if (saved.department && typeof saved.department === 'string') {
      const dept = saved.department.trim();
      if (dept && !store.departments.includes(dept)) {
        store.departments.push(dept);
      }
    }
  }
  saveStore(store);
  return { count: items.length };
}

export async function deleteEquipmentById(id: string) {
  const store = loadStore();
  store.equipment = store.equipment.filter((x) => String(x.id) !== String(id));
  saveStore(store);
  return { success: true };
}

export async function deleteAllEquipment() {
  const store = loadStore();
  store.equipment = [];
  saveStore(store);
  return { success: true };
}

export async function saveRepair(item: any) {
  const store = loadStore();
  const saved = upsertById(store.repairs, item);
  saveStore(store);
  return saved;
}

export async function deleteRepairById(id: string) {
  const store = loadStore();
  store.repairs = store.repairs.filter((x) => String(x.id) !== String(id));
  saveStore(store);
  return { success: true };
}

export async function saveDecommission(item: any) {
  const store = loadStore();
  const saved = upsertById(store.decommissions, item);
  saveStore(store);
  return saved;
}

export async function deleteDecommissionById(id: string) {
  const store = loadStore();
  store.decommissions = store.decommissions.filter((x) => String(x.id) !== String(id));
  saveStore(store);
  return { success: true };
}

export async function saveMaintenance(item: any) {
  const store = loadStore();
  const saved = upsertById(store.maintenances, item);
  saveStore(store);
  return saved;
}

export async function saveBulkMaintenance(items: any[]) {
  if (!items || items.length === 0) return { count: 0 };
  const store = loadStore();
  if (!store.maintenances) store.maintenances = [];
  for (const item of items) {
    upsertById(store.maintenances, item);
  }
  saveStore(store);
  return { count: items.length };
}

export async function deleteMaintenanceById(id: string) {
  const store = loadStore();
  store.maintenances = store.maintenances.filter((x) => String(x.id) !== String(id));
  saveStore(store);
  return { success: true };
}

export async function saveCalibration(item: any) {
  const store = loadStore();
  const saved = upsertById(store.calibrations, item);
  saveStore(store);
  return saved;
}

export async function saveBulkCalibration(items: any[]) {
  if (!items || items.length === 0) return { count: 0 };
  const store = loadStore();
  if (!store.calibrations) store.calibrations = [];
  for (const item of items) {
    upsertById(store.calibrations, item);
  }
  saveStore(store);
  return { count: items.length };
}

export async function deleteCalibrationById(id: string) {
  const store = loadStore();
  store.calibrations = store.calibrations.filter((x) => String(x.id) !== String(id));
  saveStore(store);
  return { success: true };
}

export async function savePoolLoan(item: any) {
  const store = loadStore();
  const saved = upsertById(store.poolLoans, item);
  saveStore(store);
  return saved;
}

export async function deletePoolLoanById(id: string) {
  const store = loadStore();
  store.poolLoans = store.poolLoans.filter((x) => String(x.id) !== String(id));
  saveStore(store);
  return { success: true };
}

export async function saveDocument(item: any) {
  const store = loadStore();
  const saved = upsertById(store.documents, item);
  saveStore(store);
  return saved;
}

export async function deleteDocumentById(id: string) {
  const store = loadStore();
  store.documents = store.documents.filter((x) => String(x.id) !== String(id));
  saveStore(store);
  return { success: true };
}

export async function addDepartmentName(name: string) {
  const store = loadStore();
  const trimmed = String(name || '').trim();
  if (trimmed && !store.departments.includes(trimmed)) {
    store.departments.push(trimmed);
    saveStore(store);
  }
  return { name: trimmed };
}

export async function deleteDepartmentByName(name: string) {
  const store = loadStore();
  store.departments = store.departments.filter((d) => d !== name);
  saveStore(store);
  return { success: true };
}

export async function addFacilityName(name: string, usageDays?: number) {
  const store = loadStore();
  const trimmed = String(name || '').trim();
  if (trimmed) {
    if (!store.facilities.includes(trimmed)) {
      store.facilities.push(trimmed);
    }
    const existingMax = store.facilityConfigs[trimmed]?.maxRegularUsers;
    if (usageDays !== undefined && usageDays !== null) {
      store.facilityConfigs[trimmed] = createFacilityUsageConfig(
        trimmed,
        Number(usageDays),
        undefined,
        existingMax
      );
    } else if (!store.facilityConfigs[trimmed]) {
      store.facilityConfigs[trimmed] = createFacilityUsageConfig(
        trimmed,
        DEFAULT_FACILITY_USAGE_DAYS,
        undefined,
        existingMax
      );
    }
    saveStore(store);
  }
  return { name: trimmed, config: store.facilityConfigs[trimmed] };
}

export async function saveFacilityUsageConfig(config: FacilityUsageConfig) {
  const store = loadStore();
  const trimmed = String(config?.facility || '').trim();
  if (!trimmed) {
    throw new Error('กรุณาระบุชื่อสถานประกอบการ');
  }
  if (!store.facilities.includes(trimmed) && trimmed !== 'ส่วนกลาง (Super Admin)') {
    store.facilities.push(trimmed);
  }
  const existing = store.facilityConfigs[trimmed];
  const resolvedMaxRegular =
    config.maxRegularUsers !== undefined && config.maxRegularUsers !== null && !isNaN(Number(config.maxRegularUsers))
      ? Math.max(1, Math.floor(Number(config.maxRegularUsers)))
      : existing?.maxRegularUsers ?? MAX_REGULAR_USERS_PER_FACILITY;

  const normalized: FacilityUsageConfig = {
    facility: trimmed,
    usageDays: Math.max(0, Math.floor(Number(config.usageDays ?? existing?.usageDays ?? DEFAULT_FACILITY_USAGE_DAYS) || 0)),
    startDate: String(config.startDate || existing?.startDate || '').trim(),
    expiryDate: String(config.expiryDate || existing?.expiryDate || '').trim(),
    maxRegularUsers: resolvedMaxRegular,
    updatedAt: new Date().toISOString(),
  };
  store.facilityConfigs[trimmed] = normalized;
  saveStore(store);
  return normalized;
}

export async function deleteFacilityByName(name: string) {
  const store = loadStore();
  const target = String(name || '').trim().toLowerCase();
  store.facilities = store.facilities.filter(
    (f) => String(f || '').trim().toLowerCase() !== target
  );
  if (store.facilityConfigs) {
    for (const key of Object.keys(store.facilityConfigs)) {
      if (key.trim().toLowerCase() === target) {
        delete store.facilityConfigs[key];
      }
    }
  }
  const beforeCount = store.users.length;
  store.users = store.users.filter((u) => {
    if (isProtectedSuperAdmin(u)) return true;
    return String(u.facility || '').trim().toLowerCase() !== target;
  });
  const deletedUsersCount = beforeCount - store.users.length;
  saveStore(store);
  return { success: true, deletedUsersCount };
}

export async function saveAppUser(userItem: any) {
  const store = loadStore();
  if (
    userItem.username &&
    String(userItem.username).trim().toLowerCase() === SUPER_ADMIN_USERNAME.toLowerCase()
  ) {
    userItem = {
      ...userItem,
      username: SUPER_ADMIN_USERNAME,
      password: SUPER_ADMIN_PASSWORD,
      role: 'Super Admin',
      facility: 'ส่วนกลาง (Super Admin)',
    };
  }
  const saved = upsertById(store.users, userItem);
  if (saved.facility && saved.role !== 'Super Admin' && !store.facilities.includes(saved.facility)) {
    store.facilities.push(saved.facility);
  }
  saveStore(store);
  return saved;
}

export async function deleteAppUserById(id: string) {
  const store = loadStore();
  const target = store.users.find((u) => String(u.id) === String(id));
  if (target && isProtectedSuperAdmin(target)) {
    throw new Error('ไม่สามารถลบบัญชี Super Admin (Phonmat) ออกจากระบบได้');
  }
  store.users = store.users.filter((u) => String(u.id) !== String(id));
  saveStore(store);
  return { success: true };
}
