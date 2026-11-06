import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { Equipment, RepairJob, Decommission, AppUser, Role, MaintenancePlan, CalibrationPlan, PoolLoan, EquipmentDocument, FacilityUsageConfig } from './types';
import { formatPurchasePrice, isNumericPrice, resolvePlanStatusByNextDate, normalizeLastDateToOct2026 } from './utils/dateUtils';
import {
  SUPER_ADMIN_USERNAME,
  SUPER_ADMIN_PASSWORD,
  DEFAULT_FACILITY_USAGE_DAYS,
  MAX_REGULAR_USERS_PER_FACILITY,
  ensureSuperAdminAccount,
  isProtectedSuperAdmin,
  validateFacilityUserQuota,
  validateNewUsernameForFacility,
  filterEquipmentForUser,
  filterRelatedRecordsByEquipment,
  createFacilityUsageConfig,
  createFacilityUsageConfigFromExpiry,
  deleteFacilityAndAffiliatedUsers,
} from './utils/accessControl';

export const DEFAULT_DEPARTMENTS = [
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
  'แผนกกุมารเวชกรรม'
];

export const DEFAULT_FACILITIES = [
  'โรงพยาบาลศูนย์การแพทย์'
];

interface AppState {
  equipment: Equipment[];
  allEquipment: Equipment[];
  repairs: RepairJob[];
  decommissions: Decommission[];
  maintenances: MaintenancePlan[];
  calibrations: CalibrationPlan[];
  poolLoans: PoolLoan[];
  departments: string[];
  facilities: string[];
  facilityConfigs: Record<string, FacilityUsageConfig>;
  users: AppUser[];
  isAuthenticated: boolean;
  currentUser: string | null;
  userRole: string | null;
  currentFacility: string | null;
  addEquipment: (eq: Omit<Equipment, 'id'>) => void;
  bulkAddEquipment: (eqs: Omit<Equipment, 'id'>[]) => number;
  addRepair: (repair: Omit<RepairJob, 'id' | 'reportedBy'>) => void;
  updateRepairStatus: (id: string, status: RepairJob['status']) => void;
  updateRepair: (id: string, repair: Partial<RepairJob>) => void;
  deleteRepair: (id: string) => void;
  addDecommission: (decom: Omit<Decommission, 'id'>) => void;
  updateDecommission: (id: string, decom: Partial<Decommission>) => void;
  deleteDecommission: (id: string) => void;
  addMaintenance: (plan: Omit<MaintenancePlan, 'id'>) => void;
  bulkAddMaintenance: (plans: Omit<MaintenancePlan, 'id'>[]) => number;
  updateMaintenance: (id: string, plan: Partial<MaintenancePlan>) => void;
  deleteMaintenance: (id: string) => void;
  addCalibration: (plan: Omit<CalibrationPlan, 'id'>) => void;
  bulkAddCalibration: (plans: Omit<CalibrationPlan, 'id'>[]) => number;
  updateCalibration: (id: string, plan: Partial<CalibrationPlan>) => void;
  deleteCalibration: (id: string) => void;
  addPoolLoan: (loan: Omit<PoolLoan, 'id'>) => void;
  updatePoolLoan: (id: string, loan: Partial<PoolLoan>) => void;
  returnPoolLoan: (id: string, returnData: { actualReturnDate: string; returnedTo?: string; returnCondition?: PoolLoan['returnCondition']; notes?: string }) => void;
  deletePoolLoan: (id: string) => void;
  documents: EquipmentDocument[];
  addDocument: (doc: Omit<EquipmentDocument, 'id' | 'uploadDate'>) => void;
  updateDocument: (id: string, doc: Partial<EquipmentDocument>) => void;
  deleteDocument: (id: string) => void;
  updateEquipment: (id: string, eq: Partial<Equipment>) => void;
  deleteEquipment: (id: string) => void;
  clearAllEquipment: () => Promise<void>;
  addDepartment: (dept: string) => boolean;
  deleteDepartment: (dept: string) => void;
  addFacility: (facilityName: string, usageDays?: number) => boolean;
  updateFacilityUsageDays: (facilityName: string, usageDays: number) => void;
  updateFacilityExpiryDate: (facilityName: string, expiryDate: string) => void;
  updateFacilityMaxRegularUsers: (facilityName: string, maxRegularUsers: number) => void;
  deleteFacility: (facilityName: string) => void;
  addUser: (user: Omit<AppUser, 'id' | 'createdAt'>) => { success: boolean; error?: string };
  updateUsername: (id: string, newUsername: string) => boolean;
  updateUserRole: (id: string, role: Role) => { success: boolean; error?: string };
  updateUserFacility: (id: string, facility: string) => { success: boolean; error?: string };
  updateUserPassword: (id: string, password: string) => boolean;
  updateUserTeam: (id: string, team: string) => void;
  updateUserAvatar: (id: string, avatar: string | undefined) => void;
  deleteUser: (id: string) => { success: boolean; error?: string };
  login: (username: string, role: string, facility?: string) => void;
  logout: () => void;
  refreshData: () => Promise<void>;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

// Helper to sanitize equipment item and ensure numeric purchase price
function sanitizeEquipmentItem(eq: Equipment): Equipment {
  let purchase = eq.purchase ? String(eq.purchase).trim() : '';
  let vendorCompany = eq.vendorCompany ? String(eq.vendorCompany).trim() : '';

  // Auto-swap if vendorCompany has a numeric price and purchase is empty or company name
  if (isNumericPrice(vendorCompany) && (!purchase || !isNumericPrice(purchase) || /^(?:บริษัท|บจก|หจก|บมจ)/.test(purchase))) {
    const temp = purchase;
    purchase = vendorCompany;
    vendorCompany = temp && !isNumericPrice(temp) ? temp : '';
  }

  if (purchase) {
    const formatted = formatPurchasePrice(purchase);
    if (formatted !== '-') {
      purchase = formatted;
    }
  }

  return {
    ...eq,
    purchase,
    vendorCompany,
    facility: eq.facility || 'โรงพยาบาลศูนย์การแพทย์',
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('app_theme') === 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('app_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('app_auth') === 'true';
  });
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return localStorage.getItem('app_user') || null;
  });
  const [userRole, setUserRole] = useState<string | null>(() => {
    return localStorage.getItem('app_user_role') || null;
  });
  const [loggedInFacility, setLoggedInFacility] = useState<string | null>(() => {
    return localStorage.getItem('app_user_facility') || null;
  });
  const [users, setUsers] = useState<AppUser[]>(() => {
    const saved = localStorage.getItem('app_users');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return ensureSuperAdminAccount(parsed);
        }
      } catch (e) {}
    }
    return ensureSuperAdminAccount([
      {
        id: 'super-admin-phonmat',
        username: SUPER_ADMIN_USERNAME,
        password: SUPER_ADMIN_PASSWORD,
        role: 'Super Admin',
        facility: 'ส่วนกลาง (Super Admin)',
        createdAt: new Date().toISOString()
      }
    ]);
  });

  const [facilities, setFacilities] = useState<string[]>(() => {
    const saved = localStorage.getItem('app_facilities');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [...DEFAULT_FACILITIES];
  });

  const [facilityConfigs, setFacilityConfigs] = useState<Record<string, FacilityUsageConfig>>(() => {
    const saved = localStorage.getItem('app_facility_configs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (e) {}
    }
    const initial: Record<string, FacilityUsageConfig> = {};
    DEFAULT_FACILITIES.forEach((f) => {
      initial[f] = createFacilityUsageConfig(f, DEFAULT_FACILITY_USAGE_DAYS);
    });
    return initial;
  });

  const [allEquipment, setAllEquipment] = useState<Equipment[]>(() => {
    const saved = localStorage.getItem('app_equipment');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.map(sanitizeEquipmentItem);
      } catch (e) {}
    }
    return [];
  });

  const [allRepairs, setAllRepairs] = useState<RepairJob[]>(() => {
    const saved = localStorage.getItem('app_repairs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [allDecommissions, setAllDecommissions] = useState<Decommission[]>(() => {
    const saved = localStorage.getItem('app_decommissions');
    return saved ? JSON.parse(saved) : [];
  });

  const [allMaintenances, setAllMaintenances] = useState<MaintenancePlan[]>(() => {
    const saved = localStorage.getItem('app_maintenances');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((m: MaintenancePlan) => ({
            ...m,
            lastDate: normalizeLastDateToOct2026(m.lastDate, '14'),
          }));
        }
      } catch (e) {}
    }
    return [];
  });

  const [allCalibrations, setAllCalibrations] = useState<CalibrationPlan[]>(() => {
    const saved = localStorage.getItem('app_calibrations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((c: CalibrationPlan) => ({
            ...c,
            lastDate: normalizeLastDateToOct2026(c.lastDate, '19'),
          }));
        }
      } catch (e) {}
    }
    return [];
  });

  const [allPoolLoans, setAllPoolLoans] = useState<PoolLoan[]>(() => {
    const saved = localStorage.getItem('app_pool_loans');
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [allDocuments, setAllDocuments] = useState<EquipmentDocument[]>(() => {
    const saved = localStorage.getItem('app_documents');
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [departments, setDepartments] = useState<string[]>(() => {
    const saved = localStorage.getItem('app_departments');
    let loaded: string[] = [];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          loaded = parsed
            .map((item: any) => (typeof item === 'string' ? item.trim() : (item?.name || String(item || '')).trim()))
            .filter(Boolean);
        }
      } catch (e) {
        console.error('Failed to parse app_departments', e);
      }
    }
    if (loaded.length === 0) {
      loaded = [...DEFAULT_DEPARTMENTS];
    }
    return loaded;
  });

  const currentUserObj = useMemo(() => {
    if (!currentUser) return null;
    const normUser = currentUser.trim().toLowerCase();
    if (loggedInFacility) {
      const normFac = loggedInFacility.trim().toLowerCase();
      const exactMatch = users.find(
        u =>
          u.username.trim().toLowerCase() === normUser &&
          (isProtectedSuperAdmin(u) || (u.facility || '').trim().toLowerCase() === normFac)
      );
      if (exactMatch) return exactMatch;
    }
    return users.find(u => u.username.trim().toLowerCase() === normUser) || null;
  }, [users, currentUser, loggedInFacility]);

  const currentFacility = useMemo(() => {
    if (!currentUserObj) return loggedInFacility || null;
    if (isProtectedSuperAdmin(currentUserObj)) return 'ส่วนกลาง (Super Admin)';
    return currentUserObj.facility || loggedInFacility || 'โรงพยาบาลศูนย์การแพทย์';
  }, [currentUserObj, loggedInFacility]);

  // Scoped data based on logged-in user's role & facility
  const equipment = useMemo(() => {
    const viewer = currentUserObj || (currentUser ? {
      username: currentUser,
      role: (userRole as Role) || 'User',
      facility: 'โรงพยาบาลศูนย์การแพทย์'
    } : null);
    return filterEquipmentForUser(allEquipment, viewer);
  }, [allEquipment, currentUserObj, currentUser, userRole]);

  const repairs = useMemo(() => {
    const viewer = currentUserObj || (currentUser ? {
      username: currentUser,
      role: (userRole as Role) || 'User',
      facility: 'โรงพยาบาลศูนย์การแพทย์'
    } : null);
    return filterRelatedRecordsByEquipment(allRepairs, equipment, viewer);
  }, [allRepairs, equipment, currentUserObj, currentUser, userRole]);

  const decommissions = useMemo(() => {
    const viewer = currentUserObj || (currentUser ? {
      username: currentUser,
      role: (userRole as Role) || 'User',
      facility: 'โรงพยาบาลศูนย์การแพทย์'
    } : null);
    return filterRelatedRecordsByEquipment(allDecommissions, equipment, viewer);
  }, [allDecommissions, equipment, currentUserObj, currentUser, userRole]);

  const maintenances = useMemo(() => {
    const viewer = currentUserObj || (currentUser ? {
      username: currentUser,
      role: (userRole as Role) || 'User',
      facility: 'โรงพยาบาลศูนย์การแพทย์'
    } : null);
    const filtered = filterRelatedRecordsByEquipment(allMaintenances, equipment, viewer);
    return filtered.map(m => ({
      ...m,
      lastDate: normalizeLastDateToOct2026(m.lastDate, '14'),
      status: resolvePlanStatusByNextDate(m.nextDate, m.status),
    }));
  }, [allMaintenances, equipment, currentUserObj, currentUser, userRole]);

  const calibrations = useMemo(() => {
    const viewer = currentUserObj || (currentUser ? {
      username: currentUser,
      role: (userRole as Role) || 'User',
      facility: 'โรงพยาบาลศูนย์การแพทย์'
    } : null);
    const filtered = filterRelatedRecordsByEquipment(allCalibrations, equipment, viewer);
    return filtered.map(c => ({
      ...c,
      lastDate: normalizeLastDateToOct2026(c.lastDate, '19'),
      status: resolvePlanStatusByNextDate(c.nextDate, c.status),
    }));
  }, [allCalibrations, equipment, currentUserObj, currentUser, userRole]);

  const poolLoans = useMemo(() => {
    const viewer = currentUserObj || (currentUser ? {
      username: currentUser,
      role: (userRole as Role) || 'User',
      facility: 'โรงพยาบาลศูนย์การแพทย์'
    } : null);
    return filterRelatedRecordsByEquipment(allPoolLoans, equipment, viewer);
  }, [allPoolLoans, equipment, currentUserObj, currentUser, userRole]);

  const documents = useMemo(() => {
    const viewer = currentUserObj || (currentUser ? {
      username: currentUser,
      role: (userRole as Role) || 'User',
      facility: 'โรงพยาบาลศูนย์การแพทย์'
    } : null);
    return filterRelatedRecordsByEquipment(allDocuments, equipment, viewer);
  }, [allDocuments, equipment, currentUserObj, currentUser, userRole]);

  useEffect(() => {
    localStorage.setItem('app_departments', JSON.stringify(departments));
  }, [departments]);

  useEffect(() => {
    localStorage.setItem('app_facilities', JSON.stringify(facilities));
  }, [facilities]);

  useEffect(() => {
    localStorage.setItem('app_facility_configs', JSON.stringify(facilityConfigs));
  }, [facilityConfigs]);

  useEffect(() => {
    localStorage.setItem('app_equipment', JSON.stringify(allEquipment));
  }, [allEquipment]);

  useEffect(() => {
    localStorage.setItem('app_repairs', JSON.stringify(allRepairs));
  }, [allRepairs]);

  useEffect(() => {
    localStorage.setItem('app_decommissions', JSON.stringify(allDecommissions));
  }, [allDecommissions]);

  useEffect(() => {
    localStorage.setItem('app_maintenances', JSON.stringify(allMaintenances));
  }, [allMaintenances]);

  useEffect(() => {
    localStorage.setItem('app_calibrations', JSON.stringify(allCalibrations));
  }, [allCalibrations]);

  useEffect(() => {
    localStorage.setItem('app_pool_loans', JSON.stringify(allPoolLoans));
  }, [allPoolLoans]);

  useEffect(() => {
    localStorage.setItem('app_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('app_documents', JSON.stringify(allDocuments));
  }, [allDocuments]);

  // Sync from backend
  const syncFromBackend = async () => {
    try {
      const res = await fetch('/api/data', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!res.ok) return;
      const data = await res.json();

      if (data.equipment !== undefined && Array.isArray(data.equipment)) {
        const sanitized = data.equipment.map(sanitizeEquipmentItem);
        setAllEquipment(sanitized);
        localStorage.setItem('app_equipment', JSON.stringify(sanitized));
      }
      if (data.repairs !== undefined && Array.isArray(data.repairs)) {
        setAllRepairs(data.repairs);
        localStorage.setItem('app_repairs', JSON.stringify(data.repairs));
      }
      if (data.decommissions !== undefined && Array.isArray(data.decommissions)) {
        setAllDecommissions(data.decommissions);
        localStorage.setItem('app_decommissions', JSON.stringify(data.decommissions));
      }
      if (data.maintenances !== undefined && Array.isArray(data.maintenances)) {
        let needsPersist = false;
        const normalizedMaintenances = data.maintenances.map((m: MaintenancePlan) => {
          const normLast = normalizeLastDateToOct2026(m.lastDate, '14');
          if (m.lastDate !== normLast) needsPersist = true;
          return { ...m, lastDate: normLast };
        });
        setAllMaintenances(normalizedMaintenances);
        localStorage.setItem('app_maintenances', JSON.stringify(normalizedMaintenances));
        if (needsPersist && normalizedMaintenances.length > 0) {
          apiSave('/api/maintenances/bulk', normalizedMaintenances);
        }
      }
      if (data.calibrations !== undefined && Array.isArray(data.calibrations)) {
        let needsPersist = false;
        const normalizedCalibrations = data.calibrations.map((c: CalibrationPlan) => {
          const normLast = normalizeLastDateToOct2026(c.lastDate, '19');
          if (c.lastDate !== normLast) needsPersist = true;
          return { ...c, lastDate: normLast };
        });
        setAllCalibrations(normalizedCalibrations);
        localStorage.setItem('app_calibrations', JSON.stringify(normalizedCalibrations));
        if (needsPersist && normalizedCalibrations.length > 0) {
          apiSave('/api/calibrations/bulk', normalizedCalibrations);
        }
      }
      if (data.poolLoans !== undefined && Array.isArray(data.poolLoans)) {
        setAllPoolLoans(data.poolLoans);
        localStorage.setItem('app_pool_loans', JSON.stringify(data.poolLoans));
      }
      if (data.departments !== undefined && Array.isArray(data.departments) && data.departments.length > 0) {
        setDepartments(data.departments);
        localStorage.setItem('app_departments', JSON.stringify(data.departments));
      }
      if (data.facilities !== undefined && Array.isArray(data.facilities)) {
        setFacilities(data.facilities);
        localStorage.setItem('app_facilities', JSON.stringify(data.facilities));
      }
      if (data.facilityConfigs !== undefined && data.facilityConfigs && typeof data.facilityConfigs === 'object') {
        setFacilityConfigs(data.facilityConfigs);
        localStorage.setItem('app_facility_configs', JSON.stringify(data.facilityConfigs));
      }
      if (data.users !== undefined && Array.isArray(data.users) && data.users.length > 0) {
        const ensured = ensureSuperAdminAccount(data.users);
        setUsers(ensured);
        localStorage.setItem('app_users', JSON.stringify(ensured));
      }
      if (data.documents !== undefined && Array.isArray(data.documents)) {
        setAllDocuments(data.documents);
        localStorage.setItem('app_documents', JSON.stringify(data.documents));
      }
    } catch (err) {
      console.warn('Could not sync with backend:', err);
    }
  };

  useEffect(() => {
    syncFromBackend();

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.onmessage = () => {
        syncFromBackend();
      };
      eventSource.onerror = () => {};
    } catch (e) {
      console.warn('SSE not available, relying on polling fallback');
    }

    const interval = setInterval(syncFromBackend, 5000);
    const handleFocus = () => {
      syncFromBackend();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const apiSave = async (endpoint: string, body: any) => {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.error(`API save failed for ${endpoint} with status ${res.status}`);
      }
    } catch (err) {
      console.warn(`API save failed for ${endpoint}`, err);
    }
  };

  const apiDelete = async (endpoint: string) => {
    try {
      const res = await fetch(endpoint, {
        method: 'DELETE',
      });
      if (!res.ok) {
        console.error(`API delete failed for ${endpoint} with status ${res.status}`);
      }
    } catch (err) {
      console.warn(`API delete failed for ${endpoint}`, err);
    }
  };

  useEffect(() => {
    localStorage.setItem('app_auth', isAuthenticated.toString());
  }, [isAuthenticated]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('app_user', currentUser);
    } else {
      localStorage.removeItem('app_user');
    }
  }, [currentUser]);

  useEffect(() => {
    if (userRole) {
      localStorage.setItem('app_user_role', userRole);
    } else {
      localStorage.removeItem('app_user_role');
    }
  }, [userRole]);

  useEffect(() => {
    if (loggedInFacility) {
      localStorage.setItem('app_user_facility', loggedInFacility);
    } else {
      localStorage.removeItem('app_user_facility');
    }
  }, [loggedInFacility]);

  const login = (username: string, role: string, facility?: string) => {
    setIsAuthenticated(true);
    setCurrentUser(username);
    setUserRole(role);
    if (facility !== undefined) {
      setLoggedInFacility(facility);
    }
  };
  
  const logout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setUserRole(null);
    setLoggedInFacility(null);
  };

  const addEquipment = (eq: Omit<Equipment, 'id'>) => {
    const fallbackFac = facilities[0] || 'โรงพยาบาลศูนย์การแพทย์';
    const resolvedFacility = eq.facility || (currentUserObj && !isProtectedSuperAdmin(currentUserObj) ? currentUserObj.facility : fallbackFac) || fallbackFac;
    const resolvedOwner = eq.ownerUsername || currentUser || SUPER_ADMIN_USERNAME;
    const newItem: Equipment = sanitizeEquipmentItem({
      ...eq,
      facility: resolvedFacility,
      ownerUsername: resolvedOwner,
      id: crypto.randomUUID(),
    });
    setAllEquipment(prev => {
      const next = [...prev, newItem];
      localStorage.setItem('app_equipment', JSON.stringify(next));
      return next;
    });
    apiSave('/api/equipment', newItem);
  };

  const bulkAddEquipment = (eqs: Omit<Equipment, 'id'>[]): number => {
    if (!eqs || eqs.length === 0) return 0;
    const fallbackFac = facilities[0] || 'โรงพยาบาลศูนย์การแพทย์';
    const defaultFac = (currentUserObj && !isProtectedSuperAdmin(currentUserObj) ? currentUserObj.facility : fallbackFac) || fallbackFac;
    const defaultOwner = currentUser || SUPER_ADMIN_USERNAME;

    const newItems: Equipment[] = eqs.map(item => sanitizeEquipmentItem({
      ...item,
      facility: item.facility || defaultFac,
      ownerUsername: item.ownerUsername || defaultOwner,
      id: crypto.randomUUID()
    }));
    setAllEquipment(prev => {
      const next = [...prev, ...newItems];
      localStorage.setItem('app_equipment', JSON.stringify(next));
      return next;
    });
    apiSave('/api/equipment/bulk', newItems);
    
    const detectedDepts = new Set<string>();
    eqs.forEach(item => {
      if (item.department && item.department.trim()) {
        detectedDepts.add(item.department.trim());
      }
    });
    setDepartments(prev => {
      const existing = new Set(prev);
      const toAdd = Array.from(detectedDepts).filter(d => !existing.has(d));
      toAdd.forEach(d => apiSave('/api/departments', { name: d }));
      return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
    });

    return newItems.length;
  };

  const updateEquipment = (id: string, updatedFields: Partial<Equipment>) => {
    setAllEquipment(prev => {
      const next = prev.map(eq => {
        if (eq.id === id) {
          const updated = sanitizeEquipmentItem({ ...eq, ...updatedFields });
          apiSave('/api/equipment', updated);
          return updated;
        }
        return eq;
      });
      localStorage.setItem('app_equipment', JSON.stringify(next));
      return next;
    });

    if (updatedFields.status === 'decommissioned') {
      setAllDecommissions(prev => {
        const exists = prev.some(d => d.equipmentId === id);
        if (!exists) {
          const targetEq = allEquipment.find(e => e.id === id);
          const newDecom: Decommission = {
            id: crypto.randomUUID(),
            equipmentId: id,
            reason: targetEq ? `เปลี่ยนสถานะเป็นยกเลิกการใช้งาน (${targetEq.code || targetEq.name})` : 'เปลี่ยนสถานะเป็นยกเลิกการใช้งาน',
            date: new Date().toISOString().split('T')[0],
            technician: currentUser || 'ผู้ดูแลระบบ',
            technicianSignature: '',
            approvedBy: 'หัวหน้างาน / ผู้มีอำนาจอนุมัติ',
            approverSignature: ''
          };
          apiSave('/api/decommissions', newDecom);
          return [newDecom, ...prev];
        }
        return prev;
      });
    } else if (updatedFields.status) {
      setAllDecommissions(prev => {
        const matching = prev.find(d => d.equipmentId === id);
        if (matching) {
          apiDelete(`/api/decommissions/${matching.id}`);
          return prev.filter(d => d.equipmentId !== id);
        }
        return prev;
      });
    }
  };

  const deleteEquipment = (id: string) => {
    setAllEquipment(prev => prev.filter(eq => eq.id !== id));
    apiDelete(`/api/equipment/${id}`);
  };

  const clearAllEquipment = async () => {
    setAllEquipment([]);
    localStorage.setItem('app_equipment', JSON.stringify([]));
    await apiDelete('/api/equipment/clear-all');
  };

  const addRepair = (repair: Omit<RepairJob, 'id' | 'reportedBy'>) => {
    const targetEq = allEquipment.find(e => e.id === repair.equipmentId);
    const resolvedFac = repair.facility || targetEq?.facility || (currentUserObj && !isProtectedSuperAdmin(currentUserObj) ? currentUserObj.facility : 'โรงพยาบาลศูนย์การแพทย์') || 'โรงพยาบาลศูนย์การแพทย์';
    const resolvedOwner = repair.ownerUsername || targetEq?.ownerUsername || currentUser || 'Unknown';
    const newRepair: RepairJob = {
      ...repair,
      facility: resolvedFac,
      ownerUsername: resolvedOwner,
      reportedBy: currentUser || 'Unknown',
      id: crypto.randomUUID(),
    };
    setAllRepairs(prev => [...prev, newRepair]);
    apiSave('/api/repairs', newRepair);

    if (!repair.isNonRegistered && repair.equipmentId) {
      setAllEquipment(prev => prev.map(eq => {
        if (eq.id === repair.equipmentId) {
          const updated = { ...eq, status: 'repairing' as const };
          apiSave('/api/equipment', updated);
          return updated;
        }
        return eq;
      }));
    }
  };

  const updateRepairStatus = (id: string, status: RepairJob['status']) => {
    const today = new Date().toISOString().split('T')[0];
    setAllRepairs(prev => prev.map(r => {
      if (r.id === id) {
        const updated: RepairJob = {
          ...r,
          status,
          ...(status === 'completed' && !r.closingDate ? { closingDate: today } : {}),
        };
        apiSave('/api/repairs', updated);
        return updated;
      }
      return r;
    }));

    if (status === 'completed') {
      const repair = allRepairs.find(r => r.id === id);
      if (repair && !repair.isNonRegistered && repair.equipmentId) {
        setAllEquipment(prev => prev.map(eq => {
          if (eq.id === repair.equipmentId) {
            const updated = { ...eq, status: 'active' as const };
            apiSave('/api/equipment', updated);
            return updated;
          }
          return eq;
        }));
      }
    }
  };

  const updateRepair = (id: string, updatedFields: Partial<RepairJob>) => {
    setAllRepairs(prev => prev.map(r => {
      if (r.id === id) {
        const updated = { ...r, ...updatedFields };
        apiSave('/api/repairs', updated);
        return updated;
      }
      return r;
    }));

    if (updatedFields.status === 'completed') {
      const repair = allRepairs.find(r => r.id === id);
      const isNonReg = updatedFields.isNonRegistered ?? repair?.isNonRegistered;
      const targetEqId = updatedFields.equipmentId || repair?.equipmentId;
      if (!isNonReg && targetEqId) {
        setAllEquipment(prev => prev.map(eq => {
          if (eq.id === targetEqId) {
            const updated = { ...eq, status: 'active' as const };
            apiSave('/api/equipment', updated);
            return updated;
          }
          return eq;
        }));
      }
    }
  };

  const deleteRepair = (id: string) => {
    const targetRepair = allRepairs.find(r => r.id === id);
    if (targetRepair && !targetRepair.isNonRegistered && targetRepair.equipmentId) {
      setAllEquipment(prev => prev.map(eq => {
        if (eq.id === targetRepair.equipmentId) {
          const updated = { ...eq, status: 'active' as const };
          apiSave('/api/equipment', updated);
          return updated;
        }
        return eq;
      }));
    }
    setAllRepairs(prev => prev.filter(r => r.id !== id));
    apiDelete(`/api/repairs/${id}`);
  };

  const addDecommission = (decom: Omit<Decommission, 'id'>) => {
    const newItem: Decommission = { ...decom, id: crypto.randomUUID() };
    setAllDecommissions(prev => [...prev, newItem]);
    apiSave('/api/decommissions', newItem);

    setAllEquipment(prev => prev.map(eq => {
      if (eq.id === decom.equipmentId) {
        const updated = { ...eq, status: 'decommissioned' as const };
        apiSave('/api/equipment', updated);
        return updated;
      }
      return eq;
    }));
  };

  const updateDecommission = (id: string, updatedFields: Partial<Decommission>) => {
    if (id.startsWith('auto-decom-')) {
      const eqId = id.replace('auto-decom-', '');
      const newDecom: Decommission = {
        id: crypto.randomUUID(),
        equipmentId: eqId,
        reason: updatedFields.reason || 'เปลี่ยนสถานะเป็นยกเลิกการใช้งาน',
        date: updatedFields.date || new Date().toISOString().split('T')[0],
        technician: updatedFields.technician || currentUser || 'ผู้ดูแลระบบ',
        technicianSignature: updatedFields.technicianSignature || '',
        approvedBy: updatedFields.approvedBy || '',
        approverSignature: updatedFields.approverSignature || ''
      };
      setAllDecommissions(prev => [newDecom, ...prev]);
      apiSave('/api/decommissions', newDecom);
      return;
    }

    setAllDecommissions(prev => prev.map(d => {
      if (d.id === id) {
        const updated = { ...d, ...updatedFields };
        apiSave('/api/decommissions', updated);
        return updated;
      }
      return d;
    }));
  };

  const deleteDecommission = (id: string) => {
    if (id.startsWith('auto-decom-')) {
      const eqId = id.replace('auto-decom-', '');
      setAllEquipment(prev => prev.map(eq => {
        if (eq.id === eqId) {
          const updated = { ...eq, status: 'active' as const };
          apiSave('/api/equipment', updated);
          return updated;
        }
        return eq;
      }));
      return;
    }

    const targetDecom = allDecommissions.find(d => d.id === id);
    if (targetDecom) {
      setAllEquipment(prev => prev.map(eq => {
        if (eq.id === targetDecom.equipmentId) {
          const updated = { ...eq, status: 'active' as const };
          apiSave('/api/equipment', updated);
          return updated;
        }
        return eq;
      }));
    }
    setAllDecommissions(prev => prev.filter(d => d.id !== id));
    apiDelete(`/api/decommissions/${id}`);
  };

  const addMaintenance = (plan: Omit<MaintenancePlan, 'id'>) => {
    const newItem: MaintenancePlan = {
      ...plan,
      status: resolvePlanStatusByNextDate(plan.nextDate, plan.status),
      id: crypto.randomUUID(),
    };
    setAllMaintenances(prev => [...prev, newItem]);
    apiSave('/api/maintenances', newItem);
  };

  const bulkAddMaintenance = (plans: Omit<MaintenancePlan, 'id'>[]): number => {
    if (!plans || plans.length === 0) return 0;
    const newItems: MaintenancePlan[] = plans.map(p => ({
      ...p,
      status: resolvePlanStatusByNextDate(p.nextDate, p.status),
      id: crypto.randomUUID()
    }));
    setAllMaintenances(prev => {
      const next = [...prev, ...newItems];
      localStorage.setItem('app_maintenances', JSON.stringify(next));
      return next;
    });
    apiSave('/api/maintenances/bulk', newItems);
    return newItems.length;
  };

  const updateMaintenance = (id: string, updatedFields: Partial<MaintenancePlan>) => {
    setAllMaintenances(prev => prev.map(m => {
      if (m.id === id) {
        const merged = { ...m, ...updatedFields };
        const updated: MaintenancePlan = {
          ...merged,
          status:
            updatedFields.nextDate !== undefined
              ? resolvePlanStatusByNextDate(merged.nextDate, merged.status)
              : merged.status,
        };
        apiSave('/api/maintenances', updated);
        return updated;
      }
      return m;
    }));
  };

  const deleteMaintenance = (id: string) => {
    setAllMaintenances(prev => prev.filter(m => m.id !== id));
    apiDelete(`/api/maintenances/${id}`);
  };

  const addCalibration = (plan: Omit<CalibrationPlan, 'id'>) => {
    const newItem: CalibrationPlan = {
      ...plan,
      status: resolvePlanStatusByNextDate(plan.nextDate, plan.status),
      id: crypto.randomUUID(),
    };
    setAllCalibrations(prev => [...prev, newItem]);
    apiSave('/api/calibrations', newItem);
  };

  const bulkAddCalibration = (plans: Omit<CalibrationPlan, 'id'>[]): number => {
    if (!plans || plans.length === 0) return 0;
    const newItems: CalibrationPlan[] = plans.map(p => ({
      ...p,
      status: resolvePlanStatusByNextDate(p.nextDate, p.status),
      id: crypto.randomUUID()
    }));
    setAllCalibrations(prev => {
      const next = [...prev, ...newItems];
      localStorage.setItem('app_calibrations', JSON.stringify(next));
      return next;
    });
    apiSave('/api/calibrations/bulk', newItems);
    return newItems.length;
  };

  const updateCalibration = (id: string, updatedFields: Partial<CalibrationPlan>) => {
    setAllCalibrations(prev => prev.map(c => {
      if (c.id === id) {
        const merged = { ...c, ...updatedFields };
        const updated: CalibrationPlan = {
          ...merged,
          status:
            updatedFields.nextDate !== undefined
              ? resolvePlanStatusByNextDate(merged.nextDate, merged.status)
              : merged.status,
        };
        apiSave('/api/calibrations', updated);
        return updated;
      }
      return c;
    }));
  };

  const deleteCalibration = (id: string) => {
    setAllCalibrations(prev => prev.filter(c => c.id !== id));
    apiDelete(`/api/calibrations/${id}`);
  };

  const addPoolLoan = (loan: Omit<PoolLoan, 'id'>) => {
    const newItem: PoolLoan = { ...loan, id: crypto.randomUUID() };
    setAllPoolLoans(prev => [newItem, ...prev]);
    apiSave('/api/pool-loans', newItem);
  };

  const updatePoolLoan = (id: string, updatedFields: Partial<PoolLoan>) => {
    setAllPoolLoans(prev => prev.map(p => {
      if (p.id === id) {
        const updated = { ...p, ...updatedFields };
        apiSave('/api/pool-loans', updated);
        return updated;
      }
      return p;
    }));
  };

  const returnPoolLoan = (id: string, returnData: { actualReturnDate: string; returnedTo?: string; returnCondition?: PoolLoan['returnCondition']; notes?: string }) => {
    setAllPoolLoans(prev => prev.map(p => {
      if (p.id === id) {
        const updated: PoolLoan = {
          ...p,
          status: 'returned',
          actualReturnDate: returnData.actualReturnDate,
          returnedTo: returnData.returnedTo || p.returnedTo,
          returnCondition: returnData.returnCondition || 'normal',
          notes: returnData.notes ? (p.notes ? `${p.notes} | ${returnData.notes}` : returnData.notes) : p.notes
        };
        apiSave('/api/pool-loans', updated);
        return updated;
      }
      return p;
    }));
  };

  const deletePoolLoan = (id: string) => {
    setAllPoolLoans(prev => prev.filter(p => p.id !== id));
    apiDelete(`/api/pool-loans/${id}`);
  };

  const addDocument = (doc: Omit<EquipmentDocument, 'id' | 'uploadDate'>) => {
    const targetEq = allEquipment.find(e => e.id === doc.equipmentId);
    const newDoc: EquipmentDocument = {
      ...doc,
      id: crypto.randomUUID(),
      uploadDate: new Date().toISOString().split('T')[0],
      uploadedBy: doc.uploadedBy || currentUser || 'Admin',
      equipmentCode: doc.equipmentCode || targetEq?.code,
      equipmentName: doc.equipmentName || targetEq?.name,
      department: doc.department || targetEq?.department
    };
    setAllDocuments(prev => [newDoc, ...prev]);
    apiSave('/api/documents', newDoc);
  };

  const updateDocument = (id: string, updatedFields: Partial<EquipmentDocument>) => {
    setAllDocuments(prev => prev.map(d => {
      if (d.id === id) {
        const updated = { ...d, ...updatedFields };
        apiSave('/api/documents', updated);
        return updated;
      }
      return d;
    }));
  };

  const deleteDocument = (id: string) => {
    setAllDocuments(prev => prev.filter(d => d.id !== id));
    apiDelete(`/api/documents/${id}`);
  };

  const addDepartment = (dept: string): boolean => {
    const trimmed = dept.trim();
    if (!trimmed) return false;
    if (departments.some(d => d.toLowerCase() === trimmed.toLowerCase())) {
      return false;
    }
    setDepartments(prev => [...prev, trimmed]);
    apiSave('/api/departments', { name: trimmed });
    return true;
  };

  const deleteDepartment = (dept: string) => {
    setDepartments(prev => prev.filter(d => d !== dept));
    apiDelete(`/api/departments/${encodeURIComponent(dept)}`);
  };

  const addFacility = (facilityName: string, usageDays?: number): boolean => {
    const trimmed = facilityName.trim();
    if (!trimmed) return false;
    const days = usageDays !== undefined ? Math.max(0, Math.floor(Number(usageDays) || 0)) : DEFAULT_FACILITY_USAGE_DAYS;
    const existingMax = facilityConfigs[trimmed]?.maxRegularUsers;
    const newConfig = createFacilityUsageConfig(trimmed, days, undefined, existingMax);
    setFacilityConfigs(prev => ({
      ...prev,
      [trimmed]: prev[trimmed] && usageDays === undefined ? prev[trimmed] : newConfig,
    }));
    if (facilities.some(f => f.toLowerCase() === trimmed.toLowerCase())) {
      if (usageDays !== undefined) {
        apiSave('/api/facility-configs', newConfig);
      }
      return false;
    }
    setFacilities(prev => [...prev, trimmed]);
    apiSave('/api/facilities', { name: trimmed, usageDays: days });
    return true;
  };

  const updateFacilityUsageDays = (facilityName: string, usageDays: number) => {
    const trimmed = facilityName.trim();
    if (!trimmed) return;
    setFacilityConfigs(prev => {
      const existingMax = prev[trimmed]?.maxRegularUsers;
      const newConfig = createFacilityUsageConfig(trimmed, usageDays, undefined, existingMax);
      apiSave('/api/facility-configs', newConfig);
      return {
        ...prev,
        [trimmed]: newConfig,
      };
    });
  };

  const updateFacilityExpiryDate = (facilityName: string, expiryDate: string) => {
    const trimmed = facilityName.trim();
    if (!trimmed || !expiryDate) return;
    setFacilityConfigs(prev => {
      const existingMax = prev[trimmed]?.maxRegularUsers;
      const newConfig = createFacilityUsageConfigFromExpiry(trimmed, expiryDate, undefined, existingMax);
      apiSave('/api/facility-configs', newConfig);
      return {
        ...prev,
        [trimmed]: newConfig,
      };
    });
  };

  const updateFacilityMaxRegularUsers = (facilityName: string, maxRegularUsers: number) => {
    const trimmed = facilityName.trim();
    if (!trimmed) return;
    const safeMax = Math.max(1, Math.floor(Number(maxRegularUsers) || MAX_REGULAR_USERS_PER_FACILITY));
    setFacilityConfigs(prev => {
      const existing = prev[trimmed] || createFacilityUsageConfig(trimmed, DEFAULT_FACILITY_USAGE_DAYS);
      const newConfig: FacilityUsageConfig = {
        ...existing,
        facility: trimmed,
        maxRegularUsers: safeMax,
        updatedAt: new Date().toISOString(),
      };
      apiSave('/api/facility-configs', newConfig);
      return {
        ...prev,
        [trimmed]: newConfig,
      };
    });
  };

  const deleteFacility = (facilityName: string) => {
    const trimmed = facilityName.trim();
    if (!trimmed) return;
    const result = deleteFacilityAndAffiliatedUsers(facilities, facilityConfigs, users, trimmed);
    setFacilities(result.facilities);
    setFacilityConfigs(result.facilityConfigs);
    setUsers(result.users);
    apiDelete(`/api/facilities/${encodeURIComponent(trimmed)}`);
  };

  const addUser = (user: Omit<AppUser, 'id' | 'createdAt'>): { success: boolean; error?: string } => {
    const trimmedUsername = user.username.trim();
    const usernameCheck = validateNewUsernameForFacility(users, trimmedUsername, user.facility);
    if (!usernameCheck.valid) {
      return { success: false, error: usernameCheck.error };
    }

    const quotaCheck = validateFacilityUserQuota(
      users,
      {
        username: trimmedUsername,
        facility: user.facility,
        role: user.role,
      },
      facilityConfigs
    );
    if (!quotaCheck.valid) {
      return { success: false, error: quotaCheck.error };
    }

    const newUser: AppUser = {
      ...user,
      username: trimmedUsername,
      facility: user.facility?.trim(),
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };

    if (newUser.facility && !facilities.includes(newUser.facility)) {
      setFacilities(prev => [...prev, newUser.facility!]);
      apiSave('/api/facilities', { name: newUser.facility });
    }

    setUsers(prev => ensureSuperAdminAccount([...prev, newUser]));
    apiSave('/api/app-users', newUser);
    return { success: true };
  };

  const updateUsername = (id: string, newUsername: string): boolean => {
    const trimmed = newUsername.trim();
    if (!trimmed) return false;
    const targetUser = users.find(u => u.id === id);
    if (!targetUser) return false;
    // Prevent renaming Super Admin Phonmat or using Super Admin reserved name
    if (isProtectedSuperAdmin(targetUser) && trimmed.toLowerCase() !== SUPER_ADMIN_USERNAME.toLowerCase()) {
      return false;
    }
    if (!isProtectedSuperAdmin(targetUser) && trimmed.toLowerCase() === SUPER_ADMIN_USERNAME.toLowerCase()) {
      return false;
    }

    if (
      targetUser.username.toLowerCase() === currentUser?.toLowerCase() &&
      (!loggedInFacility || (targetUser.facility || '').trim().toLowerCase() === loggedInFacility.trim().toLowerCase())
    ) {
      setCurrentUser(trimmed);
    }

    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        const updated = { ...u, username: trimmed };
        apiSave('/api/app-users', updated);
        return updated;
      }
      return u;
    }));
    return true;
  };

  const updateUserRole = (id: string, role: Role): { success: boolean; error?: string } => {
    const targetUser = users.find(u => u.id === id);
    if (!targetUser) return { success: false, error: 'ไม่พบบัญชีผู้ใช้งาน' };
    if (isProtectedSuperAdmin(targetUser)) {
      return { success: false, error: 'ไม่สามารถเปลี่ยนสิทธิ์ของ Super Admin (Phonmat) ได้' };
    }

    const quotaCheck = validateFacilityUserQuota(
      users,
      {
        username: targetUser.username,
        facility: targetUser.facility,
        role,
        excludeUserId: id,
      },
      facilityConfigs
    );
    if (!quotaCheck.valid) {
      return { success: false, error: quotaCheck.error };
    }

    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        const updated = { ...u, role };
        apiSave('/api/app-users', updated);
        return updated;
      }
      return u;
    }));
    return { success: true };
  };

  const updateUserFacility = (id: string, facility: string): { success: boolean; error?: string } => {
    const targetUser = users.find(u => u.id === id);
    if (!targetUser) return { success: false, error: 'ไม่พบบัญชีผู้ใช้งาน' };
    if (isProtectedSuperAdmin(targetUser)) {
      return { success: false, error: 'ไม่สามารถเปลี่ยนสถานประกอบการของ Super Admin ได้' };
    }

    const quotaCheck = validateFacilityUserQuota(
      users,
      {
        username: targetUser.username,
        facility,
        role: targetUser.role,
        excludeUserId: id,
      },
      facilityConfigs
    );
    if (!quotaCheck.valid) {
      return { success: false, error: quotaCheck.error };
    }

    const trimmedFac = facility.trim();
    if (trimmedFac && !facilities.includes(trimmedFac)) {
      setFacilities(prev => [...prev, trimmedFac]);
      apiSave('/api/facilities', { name: trimmedFac });
    }

    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        const updated = { ...u, facility: trimmedFac };
        apiSave('/api/app-users', updated);
        return updated;
      }
      return u;
    }));
    return { success: true };
  };

  const updateUserPassword = (id: string, password: string): boolean => {
    const targetUser = users.find(u => u.id === id);
    if (!targetUser) return false;
    if (isProtectedSuperAdmin(targetUser) && password !== SUPER_ADMIN_PASSWORD) {
      return false;
    }
    setUsers(prev => {
      const next = prev.map(u => {
        if (u.id === id) {
          const updated = { ...u, password };
          apiSave('/api/app-users', updated);
          return updated;
        }
        return u;
      });
      localStorage.setItem('app_users', JSON.stringify(next));
      return next;
    });
    return true;
  };

  const updateUserTeam = (id: string, team: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        const updated = { ...u, team };
        apiSave('/api/app-users', updated);
        return updated;
      }
      return u;
    }));
  };

  const updateUserAvatar = (id: string, avatar: string | undefined) => {
    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        const updated = { ...u, avatar };
        apiSave('/api/app-users', updated);
        return updated;
      }
      return u;
    }));
  };

  const deleteUser = (id: string): { success: boolean; error?: string } => {
    const targetUser = users.find(u => u.id === id);
    if (!targetUser) return { success: false, error: 'ไม่พบบัญชีผู้ใช้งาน' };
    if (isProtectedSuperAdmin(targetUser)) {
      return { success: false, error: 'ไม่สามารถลบบัญชี Super Admin (Phonmat) ออกจากระบบได้ไม่ว่ากรณีใดๆ' };
    }
    setUsers(prev => prev.filter(u => u.id !== id));
    apiDelete(`/api/app-users/${id}`);
    return { success: true };
  };

  return (
    <AppContext.Provider value={{ 
      equipment, allEquipment, repairs, decommissions, maintenances, calibrations, poolLoans, departments, facilities, facilityConfigs, users, isAuthenticated, currentUser, userRole, currentFacility,
      documents, addDocument, updateDocument, deleteDocument,
      addEquipment, bulkAddEquipment, addRepair, updateRepairStatus, updateRepair, deleteRepair,
      addDecommission, updateDecommission, deleteDecommission,
      addMaintenance, bulkAddMaintenance, updateMaintenance, deleteMaintenance,
      addCalibration, bulkAddCalibration, updateCalibration, deleteCalibration,
      addPoolLoan, updatePoolLoan, returnPoolLoan, deletePoolLoan,
      updateEquipment, deleteEquipment, clearAllEquipment,
      addDepartment, deleteDepartment, addFacility, updateFacilityUsageDays, updateFacilityExpiryDate, updateFacilityMaxRegularUsers, deleteFacility,
      addUser, updateUsername, updateUserRole, updateUserFacility, updateUserPassword, updateUserTeam, updateUserAvatar, deleteUser,
      login, logout, refreshData: syncFromBackend, isDarkMode, toggleDarkMode
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppStore must be used within AppProvider');
  return context;
}
