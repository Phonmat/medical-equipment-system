import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { AppUser, Role } from '../types';
import {
  Plus,
  Trash2,
  Shield,
  User,
  ShieldAlert,
  ClipboardCheck,
  Eye,
  EyeOff,
  Pencil,
  Check,
  X,
  Layers,
  Building2,
  Lock,
  AlertCircle,
  CheckCircle2,
  Users,
  Calendar,
  Clock,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import {
  isProtectedSuperAdmin,
  getFacilityQuotaStats,
  getFacilityMaxRegularUsers,
  canDeleteUser,
  MAX_ADMINS_PER_FACILITY,
  MAX_REGULAR_USERS_PER_FACILITY,
  DEFAULT_FACILITY_USAGE_DAYS,
  getFacilityUsageStatus,
} from '../utils/accessControl';

export default function UserManagementView() {
  const {
    users,
    facilities,
    facilityConfigs,
    addFacility,
    updateFacilityUsageDays,
    updateFacilityExpiryDate,
    updateFacilityMaxRegularUsers,
    deleteFacility,
    addUser,
    updateUsername,
    updateUserRole,
    updateUserFacility,
    updateUserPassword,
    deleteUser,
    currentUser,
    userRole: currentUserRole,
    currentFacility,
  } = useAppStore();

  const isViewerSuperAdmin = currentUserRole === 'Super Admin';
  const isViewerAdmin = currentUserRole === 'Admin';

  const currentUserObj = useMemo(() => {
    const normUser = (currentUser || '').trim().toLowerCase();
    if (!normUser) return null;
    if (currentFacility) {
      const normFac = currentFacility.trim().toLowerCase();
      const exactMatch = users.find(
        (u) =>
          u.username.trim().toLowerCase() === normUser &&
          (isProtectedSuperAdmin(u) || (u.facility || '').trim().toLowerCase() === normFac)
      );
      if (exactMatch) return exactMatch;
    }
    return users.find((u) => u.username.trim().toLowerCase() === normUser) || null;
  }, [users, currentUser, currentFacility]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<Role>('User');
  const [selectedFacility, setSelectedFacility] = useState<string>(
    !isViewerSuperAdmin && currentFacility ? currentFacility : facilities[0] || 'โรงพยาบาลศูนย์การแพทย์'
  );
  const [isCreatingNewFacility, setIsCreatingNewFacility] = useState(false);
  const [customFacilityName, setCustomFacilityName] = useState('');
  const [newFacilityUsageDays, setNewFacilityUsageDays] = useState<string>(String(DEFAULT_FACILITY_USAGE_DAYS));

  // Draft state for editing usage days and max regular users per facility card
  const [draftUsageDays, setDraftUsageDays] = useState<Record<string, string>>({});
  const [draftMaxUsers, setDraftMaxUsers] = useState<Record<string, string>>({});

  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [filterFacility, setFilterFacility] = useState<string>('all');

  // Edit Username state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Notifications
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [facilityToDelete, setFacilityToDelete] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setFeedbackSuccess(msg);
    setFeedbackError(null);
    setTimeout(() => setFeedbackSuccess(null), 5000);
  };

  const showError = (msg: string) => {
    setFeedbackError(msg);
    setFeedbackSuccess(null);
  };

  const formatThaiDateShort = (dateStr: string) => {
    if (!dateStr) return '-';
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
    if (!match) return dateStr;
    const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Track recently saved facility card for inline feedback
  const [savedFacilityIndicator, setSavedFacilityIndicator] = useState<string | null>(null);

  const triggerInlineSaved = (fac: string) => {
    setSavedFacilityIndicator(fac);
    setTimeout(() => {
      setSavedFacilityIndicator((prev) => (prev === fac ? null : prev));
    }, 3000);
  };

  const handleUsageDaysInputChange = (fac: string, rawVal: string) => {
    setDraftUsageDays((prev) => ({ ...prev, [fac]: rawVal }));
    if (rawVal.trim() !== '') {
      const parsed = Math.max(0, Math.floor(Number(rawVal)));
      if (!isNaN(parsed)) {
        updateFacilityUsageDays(fac, parsed);
      }
    }
  };

  const handleSaveFacilityUsageDays = (fac: string, explicitDays?: number) => {
    const currentStatus = getFacilityUsageStatus(facilityConfigs[fac]);
    const raw = explicitDays !== undefined ? String(explicitDays) : (draftUsageDays[fac] ?? String(currentStatus.usageDays));
    const days = Math.max(0, Math.floor(Number(raw) || 0));
    updateFacilityUsageDays(fac, days);
    setDraftUsageDays((prev) => {
      const next = { ...prev };
      delete next[fac];
      return next;
    });
    triggerInlineSaved(fac);
    showSuccess(`กำหนดวันใช้งานของ "${fac}" เป็น ${days} วัน (คงเหลือ ${days} วัน) เรียบร้อยแล้ว`);
  };

  const handleFacilityExpiryChange = (fac: string, expiryDate: string) => {
    if (!expiryDate) return;
    updateFacilityExpiryDate(fac, expiryDate);
    setDraftUsageDays((prev) => {
      const next = { ...prev };
      delete next[fac];
      return next;
    });
    triggerInlineSaved(fac);
    showSuccess(`อัปเดตวันหมดอายุของ "${fac}" เรียบร้อยแล้ว`);
  };

  const handleMaxUsersInputChange = (fac: string, rawVal: string) => {
    const cleaned = rawVal.replace(/[^0-9]/g, '');
    setDraftMaxUsers((prev) => ({ ...prev, [fac]: cleaned }));
    if (cleaned !== '') {
      const parsed = Math.max(1, Math.floor(Number(cleaned)));
      if (!isNaN(parsed)) {
        updateFacilityMaxRegularUsers(fac, parsed);
      }
    }
  };

  const handleCommitMaxUsers = (fac: string, minRequired: number) => {
    const currentMax = getFacilityMaxRegularUsers(facilityConfigs, fac);
    const raw = draftMaxUsers[fac] !== undefined ? draftMaxUsers[fac] : String(currentMax);
    const safeMin = Math.max(1, minRequired);
    const parsed = Math.max(safeMin, Math.floor(Number(raw) || safeMin));
    updateFacilityMaxRegularUsers(fac, parsed);
    setDraftMaxUsers((prev) => {
      const next = { ...prev };
      delete next[fac];
      return next;
    });
    triggerInlineSaved(fac);
  };

  const handleAdjustMaxUsers = (fac: string, delta: number, minRequired: number) => {
    const currentMax = getFacilityMaxRegularUsers(facilityConfigs, fac);
    const safeMin = Math.max(1, minRequired);
    const nextMax = Math.max(safeMin, currentMax + delta);
    updateFacilityMaxRegularUsers(fac, nextMax);
    setDraftMaxUsers((prev) => {
      const next = { ...prev };
      delete next[fac];
      return next;
    });
    triggerInlineSaved(fac);
  };

  // Combine facilities from store and existing users
  const allFacilities = useMemo(() => {
    const set = new Set<string>();
    (facilities || []).forEach((f) => {
      if (f && f.trim() && f !== 'ส่วนกลาง (Super Admin)') set.add(f.trim());
    });
    users.forEach((u) => {
      if (u.facility && u.facility.trim() && !isProtectedSuperAdmin(u)) {
        set.add(u.facility.trim());
      }
    });
    return Array.from(set);
  }, [facilities, users]);

  // Visible users: Super Admin sees everyone; Facility Admin sees Super Admin + users in their facility
  const visibleUsers = useMemo(() => {
    let list = users;
    if (!isViewerSuperAdmin && currentFacility) {
      list = users.filter(
        (u) =>
          (u.facility || '').trim().toLowerCase() === currentFacility.trim().toLowerCase()
      );
    }
    if (filterFacility !== 'all') {
      list = list.filter(
        (u) => (u.facility || '').trim().toLowerCase() === filterFacility.trim().toLowerCase()
      );
    }
    return list;
  }, [users, isViewerSuperAdmin, currentFacility, filterFacility]);

  const activeTargetFacility = isViewerSuperAdmin
    ? isCreatingNewFacility
      ? customFacilityName.trim()
      : selectedFacility
    : currentFacility || 'โรงพยาบาลศูนย์การแพทย์';

  const currentFacilityQuota = useMemo(() => {
    const maxReg = getFacilityMaxRegularUsers(facilityConfigs, activeTargetFacility);
    return getFacilityQuotaStats(users, activeTargetFacility, undefined, maxReg);
  }, [users, activeTargetFacility, facilityConfigs]);

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleStartEdit = (user: AppUser) => {
    if (!isViewerSuperAdmin || isProtectedSuperAdmin(user)) return;
    setEditingUserId(user.id);
    setEditingUsername(user.username);
    setEditError(null);
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditingUsername('');
    setEditError(null);
  };

  const handleSaveEdit = (userId: string) => {
    if (!isViewerSuperAdmin) return;
    const trimmed = editingUsername.trim();
    if (!trimmed) {
      setEditError('กรุณาระบุชื่อผู้ใช้งาน');
      return;
    }
    const success = updateUsername(userId, trimmed);
    if (!success) {
      setEditError('ไม่สามารถใช้ชื่อผู้ใช้งานนี้ได้ หรือมีอยู่ในระบบแล้ว');
      return;
    }
    setEditingUserId(null);
    setEditingUsername('');
    setEditError(null);
    showSuccess(`เปลี่ยนชื่อผู้ใช้งานเป็น "${trimmed}" เรียบร้อยแล้ว`);
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackError(null);

    const targetFacility = isViewerSuperAdmin
      ? isCreatingNewFacility
        ? customFacilityName.trim()
        : selectedFacility.trim()
      : (currentFacility || '').trim();

    if (!targetFacility) {
      showError('กรุณาเลือกหรือระบุชื่อสถานประกอบการ');
      return;
    }

    if (!newUsername.trim()) {
      showError('กรุณาระบุชื่อผู้ใช้งาน (Username)');
      return;
    }

    if (!newPassword.trim()) {
      showError('กรุณากำหนดรหัสผ่านสำหรับผู้ใช้งาน');
      return;
    }

    if (isCreatingNewFacility && customFacilityName.trim()) {
      const initialDays = Math.max(0, Math.floor(Number(newFacilityUsageDays) || DEFAULT_FACILITY_USAGE_DAYS));
      addFacility(customFacilityName.trim(), initialDays);
    }

    const res = addUser({
      username: newUsername.trim(),
      password: newPassword.trim(),
      role: newRole,
      facility: targetFacility,
    });

    if (!res.success) {
      showError(res.error || 'ไม่สามารถสร้างผู้ใช้งานได้');
      return;
    }

    showSuccess(
      `สร้างผู้ใช้งาน "${newUsername.trim()}" (${newRole}) ในสถานประกอบการ "${targetFacility}" สำเร็จ`
    );
    setNewUsername('');
    setNewPassword('');
    setNewRole('User');
    if (isCreatingNewFacility) {
      setSelectedFacility(targetFacility);
      setIsCreatingNewFacility(false);
      setCustomFacilityName('');
      setNewFacilityUsageDays(String(DEFAULT_FACILITY_USAGE_DAYS));
    }
    setShowAddForm(false);
  };

  const handleRoleChange = (user: AppUser, nextRole: Role) => {
    const res = updateUserRole(user.id, nextRole);
    if (!res.success) {
      showError(res.error || 'ไม่สามารถเปลี่ยนสิทธิ์ได้');
    } else {
      showSuccess(`อัปเดตสิทธิ์ของ "${user.username}" เป็น ${nextRole} เรียบร้อยแล้ว`);
    }
  };

  const handleFacilityChange = (user: AppUser, nextFacility: string) => {
    const res = updateUserFacility(user.id, nextFacility);
    if (!res.success) {
      showError(res.error || 'ไม่สามารถย้ายสถานประกอบการได้');
    } else {
      showSuccess(`ย้าย "${user.username}" ไปยัง "${nextFacility}" เรียบร้อยแล้ว`);
    }
  };

  const handleDeleteUser = (user: AppUser) => {
    const res = deleteUser(user.id);
    if (!res.success) {
      showError(res.error || 'ไม่สามารถลบผู้ใช้งานได้');
    } else {
      showSuccess(`ลบผู้ใช้งาน "${user.username}" ออกจากระบบเรียบร้อยแล้ว`);
    }
  };

  const handleConfirmDeleteFacility = () => {
    if (!facilityToDelete || !isViewerSuperAdmin) return;
    const targetFac = facilityToDelete;
    const affiliatedCount = users.filter(
      (u) =>
        !isProtectedSuperAdmin(u) &&
        (u.facility || '').trim().toLowerCase() === targetFac.trim().toLowerCase()
    ).length;

    deleteFacility(targetFac);
    if (filterFacility.trim().toLowerCase() === targetFac.trim().toLowerCase()) {
      setFilterFacility('all');
    }
    if (selectedFacility.trim().toLowerCase() === targetFac.trim().toLowerCase()) {
      const remaining = allFacilities.filter(
        (f) => f.trim().toLowerCase() !== targetFac.trim().toLowerCase()
      );
      setSelectedFacility(remaining[0] || '');
    }
    setFacilityToDelete(null);
    showSuccess(
      `ลบสถานประกอบการ "${targetFac}" พร้อมผู้ใช้งานในสังกัด ${affiliatedCount} บัญชี ออกจากระบบเรียบร้อยแล้ว`
    );
  };

  const getRoleIcon = (role: Role) => {
    switch (role) {
      case 'Super Admin':
        return <ShieldAlert size={16} className="text-red-500" />;
      case 'Admin':
        return <Shield size={16} className="text-blue-500" />;
      case 'PM/CAL':
        return <ClipboardCheck size={16} className="text-emerald-500" />;
      case 'Pool':
        return <Layers size={16} className="text-purple-600" />;
      case 'User':
        return <User size={16} className="text-slate-500" />;
    }
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case 'Super Admin':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'Admin':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'PM/CAL':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Pool':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'User':
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">จัดการผู้ใช้งานและสถานประกอบการ</h2>
          <p className="text-sm text-slate-500 mt-1">
            กำหนดสิทธิ์และวันใช้งานตามสถานประกอบการ (1 สถานประกอบการมี Admin ได้ {MAX_ADMINS_PER_FACILITY} บัญชี และสร้าง User ปกติได้สูงสุด {MAX_REGULAR_USERS_PER_FACILITY} บัญชี)
          </p>
        </div>
        <button
          id="btn-toggle-add-user"
          onClick={() => {
            setShowAddForm(!showAddForm);
            setFeedbackError(null);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center space-x-2 shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Plus size={16} />
          <span>{showAddForm ? 'ปิดฟอร์มเพิ่มผู้ใช้' : 'สร้างผู้ใช้งานใหม่'}</span>
        </button>
      </div>

      {/* Feedback Banner (using section to preserve div:nth-of-type hierarchy) */}
      {feedbackError && (
        <section
          role="alert"
          className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center justify-between text-sm"
        >
          <div className="flex items-center space-x-2.5">
            <AlertCircle size={18} className="shrink-0 text-rose-600" />
            <span className="font-medium">{feedbackError}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackError(null)}
            className="text-xs font-semibold text-rose-600 hover:text-rose-800 px-2 py-1"
          >
            ปิด
          </button>
        </section>
      )}

      {feedbackSuccess && (
        <section
          role="status"
          className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center justify-between text-sm"
        >
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
            <span className="font-medium">{feedbackSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackSuccess(null)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 px-2 py-1"
          >
            ปิด
          </button>
        </section>
      )}

      {/* Facility Quota Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(isViewerSuperAdmin ? allFacilities : [currentFacility || 'โรงพยาบาลศูนย์การแพทย์']).map((fac) => {
          const facMaxRegular = getFacilityMaxRegularUsers(facilityConfigs, fac);
          const stats = getFacilityQuotaStats(users, fac, undefined, facMaxRegular);
          const isSelected = filterFacility === fac;
          const usageStatus = getFacilityUsageStatus(facilityConfigs[fac]);
          const inputDaysValue =
            draftUsageDays[fac] !== undefined ? draftUsageDays[fac] : String(usageStatus.usageDays);
          const inputMaxUsersValue =
            draftMaxUsers[fac] !== undefined ? draftMaxUsers[fac] : String(stats.maxRegularUsers);

          const remainingTextStyle =
            usageStatus.status === 'expired'
              ? 'text-rose-700'
              : usageStatus.status === 'expiring_soon'
              ? 'text-amber-700'
              : 'text-emerald-700';

          const unifiedBoxBorderStyle =
            usageStatus.status === 'expired'
              ? 'bg-rose-50/40 border-rose-200'
              : usageStatus.status === 'expiring_soon'
              ? 'bg-amber-50/40 border-amber-200'
              : 'bg-slate-50/90 border-slate-200';

          const statusPillStyle =
            usageStatus.status === 'expired'
              ? 'bg-rose-100 text-rose-700 border-rose-200'
              : usageStatus.status === 'expiring_soon'
              ? 'bg-amber-100 text-amber-800 border-amber-200'
              : 'bg-emerald-100 text-emerald-700 border-emerald-200';

          return (
            <div
              key={fac}
              onClick={() => isViewerSuperAdmin && setFilterFacility(isSelected ? 'all' : fac)}
              className={`p-4 rounded-xl border transition-all ${
                isSelected
                  ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-200'
                  : 'bg-white border-slate-200 hover:border-blue-300'
              } ${isViewerSuperAdmin ? 'cursor-pointer' : ''}`}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center space-x-2 min-w-0">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                    <Building2 size={18} />
                  </div>
                  <div className="truncate">
                    <h4 className="font-bold text-slate-800 text-sm truncate" title={fac}>
                      {fac}
                    </h4>
                    <p className="text-[11px] text-slate-500">สถานประกอบการ</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 tabular-nums">
                    รวม {stats.totalCount}/{stats.maxTotal} คน
                  </span>
                  {isViewerSuperAdmin && (
                    <button
                      type="button"
                      id={`btn-delete-facility-${fac}`}
                      aria-label={`ลบสถานประกอบการ ${fac}`}
                      title={`ลบสถานประกอบการ ${fac}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFacilityToDelete(fac);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div
                  className={`p-2.5 rounded-lg border ${
                    stats.adminCount >= stats.maxAdmins
                      ? 'bg-blue-50/80 border-blue-200 text-blue-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Admin สถานประกอบการ</span>
                    <Shield size={13} className="text-blue-600" />
                  </div>
                  <p className="text-base font-bold mt-1">
                    {stats.adminCount} / {stats.maxAdmins}{' '}
                    <span className="text-[11px] font-normal">User</span>
                  </p>
                </div>

                <div
                  onClick={(e) => isViewerSuperAdmin && e.stopPropagation()}
                  className={`p-2.5 rounded-lg border flex flex-col justify-between ${
                    stats.regularCount >= stats.maxRegularUsers
                      ? 'bg-amber-50/80 border-amber-200 text-amber-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  } ${isViewerSuperAdmin ? 'cursor-default' : ''}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium">User ปกติ</span>
                    <Users size={13} className="text-slate-600 shrink-0" />
                  </div>
                  {isViewerSuperAdmin ? (
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-base font-bold tabular-nums shrink-0">
                        {stats.regularCount} /
                      </span>
                      <div className="inline-flex flex-col items-center justify-center w-7 bg-white border border-slate-300 rounded-md overflow-hidden shadow-2xs shrink-0">
                        <button
                          type="button"
                          id={`btn-increase-max-users-${fac}`}
                          aria-label={`เพิ่มจำนวน User ปกติของ ${fac}`}
                          title="เพิ่มจำนวน User ปกติสูงสุด (+1)"
                          onClick={() => handleAdjustMaxUsers(fac, 1, stats.regularCount)}
                          className="w-full flex items-center justify-center py-0.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <ChevronUp size={13} strokeWidth={2.75} />
                        </button>
                        <input
                          id={`input-max-users-${fac}`}
                          type="text"
                          inputMode="numeric"
                          aria-label={`กำหนดจำนวน User ปกติสูงสุดของ ${fac}`}
                          value={inputMaxUsersValue}
                          onChange={(e) => handleMaxUsersInputChange(fac, e.target.value)}
                          onBlur={() => handleCommitMaxUsers(fac, stats.regularCount)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleCommitMaxUsers(fac, stats.regularCount);
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              handleAdjustMaxUsers(fac, 1, stats.regularCount);
                            } else if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              handleAdjustMaxUsers(fac, -1, stats.regularCount);
                            }
                          }}
                          className="stepper-number-input w-full px-0.5 py-0 text-xs font-bold text-center text-slate-800 bg-transparent border-0 focus:outline-none tabular-nums leading-tight"
                          title="ระบุจำนวน User ปกติสูงสุด"
                        />
                        <button
                          type="button"
                          id={`btn-decrease-max-users-${fac}`}
                          aria-label={`ลดจำนวน User ปกติของ ${fac}`}
                          title="ลดจำนวน User ปกติสูงสุด (-1)"
                          disabled={stats.maxRegularUsers <= Math.max(1, stats.regularCount)}
                          onClick={() => handleAdjustMaxUsers(fac, -1, stats.regularCount)}
                          className="w-full flex items-center justify-center py-0.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          <ChevronDown size={13} strokeWidth={2.75} />
                        </button>
                      </div>
                      <span className="text-[11px] font-normal shrink-0">User</span>
                    </div>
                  ) : (
                    <p className="text-base font-bold mt-1">
                      {stats.regularCount} / {stats.maxRegularUsers}{' '}
                      <span className="text-[11px] font-normal">User</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Usage Days & Remaining Days Unified Box */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="mt-3 pt-3 border-t border-slate-200/80 space-y-2 cursor-default"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700">
                    <Clock size={14} className="text-blue-600 shrink-0" />
                    <span>กำหนดวันใช้งานและวันคงเหลือ</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {savedFacilityIndicator === fac && (
                      <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        ✓ บันทึกแล้ว
                      </span>
                    )}
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${statusPillStyle}`}
                    >
                      {usageStatus.statusLabel}
                    </span>
                  </div>
                </div>

                <div
                  data-testid={`unified-usage-box-${fac}`}
                  className={`p-3 rounded-lg border text-xs ${unifiedBoxBorderStyle}`}
                >
                  <div className="grid grid-cols-2 gap-3 items-stretch">
                    {/* Left: กำหนดวันใช้งาน */}
                    <div className="flex flex-col justify-between pr-3 border-r border-slate-200/80">
                      <label
                        htmlFor={`input-usage-days-${fac}`}
                        className="font-medium text-slate-600 flex items-center justify-between"
                      >
                        <span>กำหนดวันใช้งาน</span>
                        <Calendar size={13} className="text-blue-600 shrink-0" />
                      </label>
                      {isViewerSuperAdmin ? (
                        <div className="mt-1.5 flex items-center gap-1">
                          <input
                            id={`input-usage-days-${fac}`}
                            type="number"
                            min={0}
                            max={3650}
                            aria-label={`กำหนดวันใช้งานของ ${fac}`}
                            value={inputDaysValue}
                            onChange={(e) => handleUsageDaysInputChange(fac, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveFacilityUsageDays(fac);
                              }
                            }}
                            className="w-full min-w-0 px-1.5 py-1 text-sm font-bold text-center text-slate-800 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none tabular-nums"
                            placeholder="จำนวนวัน"
                          />
                          <span className="text-[11px] text-slate-500 shrink-0">วัน</span>
                          <button
                            id={`btn-save-usage-days-${fac}`}
                            type="button"
                            aria-label={`บันทึกวันใช้งานของ ${fac}`}
                            onClick={() => handleSaveFacilityUsageDays(fac)}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-md transition-colors shrink-0 cursor-pointer"
                            title="บันทึกจำนวนวันใช้งาน"
                          >
                            บันทึก
                          </button>
                        </div>
                      ) : (
                        <p className="text-base font-bold text-slate-800 mt-1 tabular-nums">
                          {usageStatus.usageDays}{' '}
                          <span className="text-[11px] font-normal text-slate-500">วัน</span>
                        </p>
                      )}
                    </div>

                    {/* Right: วันคงเหลือในการใช้งาน */}
                    <div className={`flex flex-col justify-between min-w-0 ${remainingTextStyle}`}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-medium whitespace-nowrap">วันใช้งานคงเหลือ</span>
                        <Clock size={13} className="shrink-0" />
                      </div>
                      <div className="mt-1.5 flex items-baseline justify-between gap-1 whitespace-nowrap">
                        <p
                          className="text-base font-extrabold tabular-nums whitespace-nowrap shrink-0"
                          data-testid={`remaining-days-${fac}`}
                        >
                          {usageStatus.remainingDays}{' '}
                          <span className="text-[11px] font-normal whitespace-nowrap">วัน</span>
                        </p>
                        <span
                          className="text-[10px] opacity-85 whitespace-nowrap shrink-0"
                          title={`วันหมดอายุ: ${formatThaiDateShort(usageStatus.expiryDate)}`}
                        >
                          ถึง {formatThaiDateShort(usageStatus.expiryDate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Presets & Expiry Date Selector inside the same unified box */}
                  {isViewerSuperAdmin && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                      <div className="flex items-center gap-1 flex-wrap">
                        {[30, 90, 180, 365].map((presetDays) => (
                          <button
                            key={presetDays}
                            type="button"
                            onClick={() => handleSaveFacilityUsageDays(fac, presetDays)}
                            className={`px-2 py-0.5 rounded border font-medium transition-colors cursor-pointer ${
                              usageStatus.usageDays === presetDays &&
                              usageStatus.remainingDays === presetDays
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                            }`}
                          >
                            {presetDays} วัน
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        <label htmlFor={`input-expiry-date-${fac}`} className="text-slate-500">
                          วันหมดอายุ:
                        </label>
                        <input
                          id={`input-expiry-date-${fac}`}
                          type="date"
                          aria-label={`วันหมดอายุของ ${fac}`}
                          value={usageStatus.expiryDate}
                          onChange={(e) => handleFacilityExpiryChange(fac, e.target.value)}
                          className="px-1.5 py-0.5 text-[11px] bg-white border border-slate-200 rounded text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-800">สร้างผู้ใช้งานใหม่</h3>
              <p className="text-xs text-slate-500">
                1 สถานประกอบการจะมี User Admin ได้ {MAX_ADMINS_PER_FACILITY} User และสร้าง User ปกติได้สูงสุด {currentFacilityQuota.maxRegularUsers} User สำหรับสถานประกอบการที่เลือก
              </p>
            </div>
            {activeTargetFacility && (
              <div className="flex items-center gap-2 text-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <span className="text-slate-600">โควตาคงเหลือของ <strong>{activeTargetFacility}</strong>:</span>
                <span className={`px-2 py-0.5 rounded font-semibold ${currentFacilityQuota.adminCount >= currentFacilityQuota.maxAdmins ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                  Admin {currentFacilityQuota.adminCount}/{currentFacilityQuota.maxAdmins}
                </span>
                <span className={`px-2 py-0.5 rounded font-semibold ${currentFacilityQuota.regularCount >= currentFacilityQuota.maxRegularUsers ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  User ปกติ {currentFacilityQuota.regularCount}/{currentFacilityQuota.maxRegularUsers}
                </span>
              </div>
            )}
          </div>

          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {/* Facility Selection */}
            <div className="w-full">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  สถานประกอบการ <span className="text-rose-500">*</span>
                </label>
                {isViewerSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewFacility(!isCreatingNewFacility)}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {isCreatingNewFacility ? 'เลือกที่มีอยู่' : '+ เพิ่มสถานประกอบการใหม่'}
                  </button>
                )}
              </div>

              {!isViewerSuperAdmin ? (
                <input
                  type="text"
                  disabled
                  value={currentFacility || 'โรงพยาบาลศูนย์การแพทย์'}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-100 text-slate-600 font-medium cursor-not-allowed"
                />
              ) : isCreatingNewFacility ? (
                <div className="flex gap-2">
                  <input
                    id="input-new-facility"
                    type="text"
                    required
                    value={customFacilityName}
                    onChange={(e) => setCustomFacilityName(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-2 text-sm border border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="ระบุชื่อสถานประกอบการใหม่..."
                  />
                  <div className="w-28 shrink-0">
                    <input
                      id="input-new-facility-days"
                      type="number"
                      min={0}
                      max={3650}
                      value={newFacilityUsageDays}
                      onChange={(e) => setNewFacilityUsageDays(e.target.value)}
                      className="w-full px-2.5 py-2 text-sm border border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                      placeholder="วันใช้งาน"
                      title="กำหนดวันใช้งานเริ่มต้น (วัน)"
                    />
                  </div>
                </div>
              ) : (
                <select
                  id="select-user-facility"
                  value={selectedFacility}
                  onChange={(e) => setSelectedFacility(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {allFacilities.map((fac) => (
                    <option key={fac} value={fac}>
                      {fac}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Username */}
            <div className="w-full">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อผู้ใช้งาน (Username) <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-new-username"
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="เช่น user_opd"
              />
            </div>

            {/* Password */}
            <div className="w-full">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                รหัสผ่าน (Password) <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-new-password"
                type="text"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="ระบุรหัสผ่าน..."
              />
            </div>

            {/* Role */}
            <div className="w-full">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                สิทธิ์การใช้งาน (Role) <span className="text-rose-500">*</span>
              </label>
              <select
                id="select-new-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                {isViewerSuperAdmin && (
                  <option value="Admin" disabled={currentFacilityQuota.adminCount >= currentFacilityQuota.maxAdmins}>
                    Admin (ผู้ดูแลสถานประกอบการ) {currentFacilityQuota.adminCount >= currentFacilityQuota.maxAdmins ? `- เต็มแล้ว (${currentFacilityQuota.adminCount}/${currentFacilityQuota.maxAdmins})` : ''}
                  </option>
                )}
                <option value="User" disabled={currentFacilityQuota.regularCount >= currentFacilityQuota.maxRegularUsers}>
                  User (ผู้ใช้งานทั่วไป) {currentFacilityQuota.regularCount >= currentFacilityQuota.maxRegularUsers ? `- เต็มแล้ว (${currentFacilityQuota.regularCount}/${currentFacilityQuota.maxRegularUsers})` : ''}
                </option>
                <option value="PM/CAL" disabled={currentFacilityQuota.regularCount >= currentFacilityQuota.maxRegularUsers}>
                  PM/CAL (ผู้ดูแลงานบำรุงรักษา/สอบเทียบ)
                </option>
                <option value="Pool" disabled={currentFacilityQuota.regularCount >= currentFacilityQuota.maxRegularUsers}>
                  Pool (ผู้ดูแลงานเบิกจ่ายเครื่องมือ)
                </option>
              </select>
            </div>

            <div className="md:col-span-2 lg:col-span-4 flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-white text-slate-700 border border-slate-300 px-5 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                id="btn-submit-new-user"
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
              >
                บันทึกผู้ใช้งาน
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Bar */}
      {isViewerSuperAdmin && (
        <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center space-x-2 text-xs text-slate-600">
            <Building2 size={16} className="text-blue-600" />
            <span className="font-semibold">กรองตามสถานประกอบการ:</span>
            <select
              value={filterFacility}
              onChange={(e) => setFilterFacility(e.target.value)}
              className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">ทั้งหมด ({users.length} บัญชี)</option>
              {allFacilities.map((fac) => (
                <option key={fac} value={fac}>
                  {fac}
                </option>
              ))}
            </select>
          </div>
          {filterFacility !== 'all' && (
            <button
              onClick={() => setFilterFacility('all')}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              แสดงทั้งหมด
            </button>
          )}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold">ชื่อผู้ใช้งาน</th>
                <th className="p-4 font-semibold">สถานประกอบการ</th>
                <th className="p-4 font-semibold">รหัสผ่าน</th>
                <th className="p-4 font-semibold">สิทธิ์การใช้งาน</th>
                <th className="p-4 font-semibold">วันที่สร้าง</th>
                <th className="p-4 font-semibold text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {visibleUsers.map((user) => {
                const isProtected = isProtectedSuperAdmin(user);
                const isCurrentUser = user.username.toLowerCase() === currentUser?.toLowerCase();
                const deletable = canDeleteUser(user, currentUserObj);

                return (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    {/* Username */}
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-slate-500 shrink-0">
                          {user.avatar ? (
                            <img
                              src={user.avatar}
                              alt={user.username}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            getRoleIcon(user.role)
                          )}
                        </div>
                        {editingUserId === user.id ? (
                          <div className="flex flex-col space-y-1">
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                autoFocus
                                value={editingUsername}
                                onChange={(e) => {
                                  setEditingUsername(e.target.value);
                                  if (editError) setEditError(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit(user.id);
                                  if (e.key === 'Escape') handleCancelEdit();
                                }}
                                placeholder="ชื่อผู้ใช้งาน..."
                                className="px-2.5 py-1 text-sm border border-blue-400 rounded-md focus:ring-2 focus:ring-blue-500 bg-white font-medium text-slate-800"
                              />
                            </div>
                            {editError && <span className="text-xs text-red-500">{editError}</span>}
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <span>{user.username}</span>
                              {isCurrentUser && (
                                <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                                  (คุณ)
                                </span>
                              )}
                              {isProtected && (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full"
                                  title="บัญชี Super Admin หลัก ห้ามลบออกจากระบบไม่ว่ากรณีใดๆ"
                                >
                                  <Lock size={10} /> ห้ามลบ
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Facility */}
                    <td className="p-4">
                      {isProtected ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 px-2.5 py-1 rounded-lg border border-red-200">
                          <Building2 size={13} />
                          <span>ทุกสถานประกอบการ (Super Admin)</span>
                        </span>
                      ) : isViewerSuperAdmin ? (
                        <select
                          value={user.facility || allFacilities[0] || 'โรงพยาบาลศูนย์การแพทย์'}
                          onChange={(e) => handleFacilityChange(user, e.target.value)}
                          className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {allFacilities.map((fac) => (
                            <option key={fac} value={fac}>
                              {fac}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                          <Building2 size={13} className="text-slate-500" />
                          <span>{user.facility || '-'}</span>
                        </span>
                      )}
                    </td>

                    {/* Password */}
                    <td className="p-4">
                      {isViewerSuperAdmin || isViewerAdmin ? (
                        <div className="relative flex items-center w-full max-w-[160px]">
                          <input
                            type={visiblePasswords.has(user.id) ? 'text' : 'password'}
                            value={user.password || ''}
                            disabled={isProtected}
                            onChange={(e) => updateUserPassword(user.id, e.target.value)}
                            className={`w-full pr-8 px-2.5 py-1 text-xs font-mono border rounded-md ${
                              isProtected
                                ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed'
                                : 'border-slate-300 focus:ring-2 focus:ring-blue-500'
                            }`}
                            placeholder="ไม่มีรหัส"
                          />
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(user.id)}
                            className="absolute right-2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                            title={visiblePasswords.has(user.id) ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                          >
                            {visiblePasswords.has(user.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-mono">••••••••</span>
                      )}
                    </td>

                    {/* Role */}
                    <td className="p-4">
                      {isProtected ? (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md border ${getRoleBadge(user.role)}`}>
                          {getRoleIcon(user.role)}
                          <span>Super Admin</span>
                        </span>
                      ) : (
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user, e.target.value as Role)}
                          disabled={!isViewerSuperAdmin && user.role === 'Admin'}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${getRoleBadge(user.role)} ${
                            !isViewerSuperAdmin && user.role === 'Admin'
                              ? 'opacity-70 cursor-not-allowed'
                              : 'cursor-pointer hover:brightness-95'
                          }`}
                        >
                          {isViewerSuperAdmin && <option value="Admin">Admin</option>}
                          {!isViewerSuperAdmin && user.role === 'Admin' && <option value="Admin">Admin</option>}
                          <option value="PM/CAL">PM/CAL</option>
                          <option value="Pool">Pool</option>
                          <option value="User">User</option>
                        </select>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="p-4 text-xs text-slate-500">
                      {(() => {
                        if (!user.createdAt) return '-';
                        const d = new Date(user.createdAt);
                        if (isNaN(d.getTime())) return user.createdAt;
                        return d.toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        });
                      })()}
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {isViewerSuperAdmin && !isProtected && (
                          editingUserId === user.id ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(user.id)}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                                title="บันทึกชื่อผู้ใช้"
                              >
                                <Check size={17} />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
                                title="ยกเลิก"
                              >
                                <X size={17} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleStartEdit(user)}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                              title="แก้ไขชื่อผู้ใช้งาน"
                            >
                              <Pencil size={17} />
                            </button>
                          )
                        )}
                        <button
                          id={`btn-delete-user-${user.username}`}
                          onClick={() => deletable && handleDeleteUser(user)}
                          disabled={!deletable}
                          className={`p-1.5 rounded-lg transition-colors ${
                            !deletable
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-red-500 hover:bg-red-50 cursor-pointer'
                          }`}
                          title={
                            isProtected
                              ? 'ไม่สามารถลบ Super Admin (Phonmat) ออกจากระบบได้ไม่ว่ากรณีใดๆ'
                              : !deletable
                              ? 'ไม่มีสิทธิ์ลบผู้ใช้งานนี้'
                              : 'ลบผู้ใช้งาน'
                          }
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    ยังไม่มีข้อมูลผู้ใช้งานในสถานประกอบการนี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Delete Facility Modal */}
      {facilityToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-facility-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          onClick={() => setFacilityToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-100 text-rose-600 shrink-0">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 id="modal-delete-facility-title" className="text-base font-bold text-slate-900">
                    ยืนยันการลบสถานประกอบการ
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    การดำเนินการนี้ไม่สามารถย้อนกลับได้
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="ปิดหน้าต่างยืนยัน"
                onClick={() => setFacilityToDelete(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1.5">
              <p className="font-semibold text-sm text-rose-900">
                ต้องการลบ &ldquo;{facilityToDelete}&rdquo; ใช่หรือไม่?
              </p>
              <p className="leading-relaxed">
                ระบบจะลบสถานประกอบการนี้ รวมถึงบัญชีผู้ใช้งานในสังกัดทั้งหมดจำนวน{' '}
                <span className="font-bold underline tabular-nums">
                  {
                    users.filter(
                      (u) =>
                        !isProtectedSuperAdmin(u) &&
                        (u.facility || '').trim().toLowerCase() ===
                          facilityToDelete.trim().toLowerCase()
                    ).length
                  }{' '}
                  บัญชี
                </span>{' '}
                ออกจากระบบทันที
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                id="btn-cancel-delete-facility"
                onClick={() => setFacilityToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                id="btn-confirm-delete-facility"
                onClick={handleConfirmDeleteFacility}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Trash2 size={14} />
                <span>ยืนยันการลบสถานประกอบการ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
