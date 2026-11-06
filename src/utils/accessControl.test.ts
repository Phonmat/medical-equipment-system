import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPER_ADMIN_USERNAME,
  SUPER_ADMIN_PASSWORD,
  isProtectedSuperAdmin,
  ensureSuperAdminAccount,
  getFacilityQuotaStats,
  validateFacilityUserQuota,
  validateNewUsernameForFacility,
  filterEquipmentForUser,
  filterRelatedRecordsByEquipment,
  canDeleteUser,
  createFacilityUsageConfig,
  createFacilityUsageConfigFromExpiry,
  getFacilityUsageStatus,
  validateUserLogin,
  deleteFacilityAndAffiliatedUsers,
} from './accessControl.ts';
import type { AppUser, Equipment } from '../types.ts';

describe('Access Control & Facility Quota Rules', () => {
  it('always ensures Super Admin Phonmat exists with password Phonmat55556666 and cannot be deleted', () => {
    const users: AppUser[] = [
      { id: 'u1', username: 'somchai', password: '123', role: 'User', facility: 'รพ. ก', createdAt: '2026-01-01' },
    ];
    const ensured = ensureSuperAdminAccount(users);
    const superAdmin = ensured.find((u) => u.username === SUPER_ADMIN_USERNAME);
    assert.ok(superAdmin, 'Super Admin Phonmat must be present');
    assert.equal(superAdmin.password, SUPER_ADMIN_PASSWORD);
    assert.equal(superAdmin.role, 'Super Admin');
    assert.equal(isProtectedSuperAdmin(superAdmin), true);
    assert.equal(canDeleteUser(superAdmin, superAdmin), false);
    assert.equal(canDeleteUser(superAdmin, users[0]), false);
  });

  it('enforces 1 Admin and max 5 regular Users per facility', () => {
    const facility = 'โรงพยาบาลทดสอบ A';
    const users: AppUser[] = ensureSuperAdminAccount([
      { id: 'a1', username: 'admin_a', role: 'Admin', facility, createdAt: '2026-01-01' },
      { id: 'u1', username: 'user1', role: 'User', facility, createdAt: '2026-01-01' },
      { id: 'u2', username: 'user2', role: 'User', facility, createdAt: '2026-01-01' },
      { id: 'u3', username: 'user3', role: 'PM/CAL', facility, createdAt: '2026-01-01' },
      { id: 'u4', username: 'user4', role: 'Pool', facility, createdAt: '2026-01-01' },
    ]);

    // Trying to add a 2nd Admin to the same facility should fail
    const secondAdminCheck = validateFacilityUserQuota(users, {
      username: 'admin_a2',
      facility,
      role: 'Admin',
    });
    assert.equal(secondAdminCheck.valid, false);

    // Adding a 5th regular user should succeed
    const fifthUserCheck = validateFacilityUserQuota(users, {
      username: 'user5',
      facility,
      role: 'User',
    });
    assert.equal(fifthUserCheck.valid, true);

    const usersWith5Regular = [
      ...users,
      { id: 'u5', username: 'user5', role: 'User' as const, facility, createdAt: '2026-01-01' },
    ];

    // Trying to add a 6th regular user to the same facility should fail
    const sixthUserCheck = validateFacilityUserQuota(usersWith5Regular, {
      username: 'user6',
      facility,
      role: 'User',
    });
    assert.equal(sixthUserCheck.valid, false);

    // Adding an Admin to a different facility should succeed
    const otherFacilityAdminCheck = validateFacilityUserQuota(usersWith5Regular, {
      username: 'admin_b',
      facility: 'โรงพยาบาลทดสอบ B',
      role: 'Admin',
    });
    assert.equal(otherFacilityAdminCheck.valid, true);
  });

  it('filters equipment so regular users only see their own, Admin sees all in their facility, and Super Admin sees all', () => {
    const eqList: Equipment[] = [
      {
        id: 'eq1',
        code: 'EQ-01',
        name: 'Ventilator 1',
        riskLevel: 'High',
        purchaseDate: '',
        purchase: '100000',
        manufacturer: 'M1',
        model: 'X1',
        serialNumber: 'S1',
        department: 'ICU',
        facility: 'รพ. A',
        ownerUsername: 'user_a1',
        itrisId: 'IT1',
        status: 'active',
      },
      {
        id: 'eq2',
        code: 'EQ-02',
        name: 'Monitor 2',
        riskLevel: 'Medium',
        purchaseDate: '',
        purchase: '50000',
        manufacturer: 'M2',
        model: 'X2',
        serialNumber: 'S2',
        department: 'ER',
        facility: 'รพ. A',
        ownerUsername: 'user_a2',
        itrisId: 'IT2',
        status: 'active',
      },
      {
        id: 'eq3',
        code: 'EQ-03',
        name: 'Pump 3',
        riskLevel: 'Low',
        purchaseDate: '',
        purchase: '25000',
        manufacturer: 'M3',
        model: 'X3',
        serialNumber: 'S3',
        department: 'IPD',
        facility: 'รพ. B',
        ownerUsername: 'user_b1',
        itrisId: 'IT3',
        status: 'active',
      },
    ];

    // Regular user user_a1 only sees eq1
    const forUserA1 = filterEquipmentForUser(eqList, {
      username: 'user_a1',
      role: 'User',
      facility: 'รพ. A',
    });
    assert.deepEqual(forUserA1.map((e) => e.id), ['eq1']);

    // Department user "ICU" sees eq1 (department "ICU" in รพ. A) even when ownerUsername is different
    const forIcuUser = filterEquipmentForUser(
      [
        { ...eqList[0], department: 'ICU - แผนกผู้ป่วยวิกฤต', ownerUsername: 'Phonmat' },
        { ...eqList[1], department: 'Emergency Room - แผนกห้องฉุกเฉิน', ownerUsername: 'Phonmat' },
      ],
      {
        username: 'ICU',
        role: 'User',
        facility: 'รพ. A',
      }
    );
    assert.deepEqual(forIcuUser.map((e) => e.id), ['eq1']);

    // Admin of รพ. A sees eq1 and eq2 (all in รพ. A), but not eq3
    const forAdminA = filterEquipmentForUser(eqList, {
      username: 'admin_a',
      role: 'Admin',
      facility: 'รพ. A',
    });
    assert.deepEqual(forAdminA.map((e) => e.id), ['eq1', 'eq2']);

    // Super Admin Phonmat sees all
    const forSuperAdmin = filterEquipmentForUser(eqList, {
      username: SUPER_ADMIN_USERNAME,
      role: 'Super Admin',
      facility: 'ส่วนกลาง (Super Admin)',
    });
    assert.deepEqual(forSuperAdmin.map((e) => e.id), ['eq1', 'eq2', 'eq3']);

    // Related records filtering
    const repairs = [
      { id: 'r1', equipmentId: 'eq1', issue: 'Issue 1' },
      { id: 'r2', equipmentId: 'eq2', issue: 'Issue 2' },
      { id: 'r3', equipmentId: 'eq3', issue: 'Issue 3' },
    ];
    assert.deepEqual(
      filterRelatedRecordsByEquipment(repairs, forUserA1, {
        username: 'user_a1',
        role: 'User',
        facility: 'รพ. A',
      }).map((r) => r.id),
      ['r1']
    );
    assert.deepEqual(
      filterRelatedRecordsByEquipment(repairs, forAdminA, {
        username: 'admin_a',
        role: 'Admin',
        facility: 'รพ. A',
      }).map((r) => r.id),
      ['r1', 'r2']
    );
  });

  it('calculates facility usage days and remaining days accurately across active, expiring soon, and expired states', () => {
    const cfg30 = createFacilityUsageConfig('โรงพยาบาลศูนย์การแพทย์', 30, '2026-10-20');
    assert.equal(cfg30.usageDays, 30);
    assert.equal(cfg30.startDate, '2026-10-20');
    assert.equal(cfg30.expiryDate, '2026-11-19');

    // On start date, remaining days is 30
    const statusDay0 = getFacilityUsageStatus(cfg30, '2026-10-20');
    assert.equal(statusDay0.remainingDays, 30);
    assert.equal(statusDay0.status, 'active');
    assert.equal(statusDay0.statusLabel, 'ใช้งานได้ปกติ');

    // 25 days later (5 days left), status is expiring_soon
    const statusDay25 = getFacilityUsageStatus(cfg30, '2026-11-14');
    assert.equal(statusDay25.remainingDays, 5);
    assert.equal(statusDay25.status, 'expiring_soon');
    assert.equal(statusDay25.statusLabel, 'ใกล้หมดอายุ');

    // On expiry date (0 days left) or after, status is expired
    const statusExpired = getFacilityUsageStatus(cfg30, '2026-11-19');
    assert.equal(statusExpired.remainingDays, 0);
    assert.equal(statusExpired.status, 'expired');
    assert.equal(statusExpired.statusLabel, 'หมดอายุการใช้งาน');

    // Creating from expiry date calculates usageDays & remainingDays
    const fromExpiry = createFacilityUsageConfigFromExpiry('รพ. ทดสอบ', '2026-10-30', '2026-10-20');
    assert.equal(fromExpiry.usageDays, 10);
    assert.equal(getFacilityUsageStatus(fromExpiry, '2026-10-20').remainingDays, 10);
  });

  it('validates facility selection and expiration during user login', () => {
    const sampleUsers = ensureSuperAdminAccount([
      { id: 'u-admin-1', username: 'admin_a', password: '123', role: 'Admin', facility: 'รพ. A', createdAt: '2026-01-01' },
      { id: 'u-reg-2', username: 'user_b1', password: '123', role: 'User', facility: 'รพ. B', createdAt: '2026-01-01' },
    ]);
    const configs = {
      'รพ. A': createFacilityUsageConfig('รพ. A', 30, '2026-10-20'),
      'รพ. B': createFacilityUsageConfig('รพ. B', 0, '2026-10-20'),
    };

    // Valid login with matching facility
    const okLogin = validateUserLogin(
      sampleUsers,
      configs,
      { username: 'admin_a', password: '123', selectedFacility: 'รพ. A' },
      '2026-10-20'
    );
    assert.equal(okLogin.valid, true);

    // Mismatched facility
    const wrongFacility = validateUserLogin(
      sampleUsers,
      configs,
      { username: 'admin_a', password: '123', selectedFacility: 'รพ. B' },
      '2026-10-20'
    );
    assert.equal(wrongFacility.valid, false);

    // Missing facility for regular/admin user
    const missingFacility = validateUserLogin(
      sampleUsers,
      configs,
      { username: 'admin_a', password: '123', selectedFacility: '' },
      '2026-10-20'
    );
    assert.equal(missingFacility.valid, false);

    // Expired facility blocks regular user login
    const expiredLogin = validateUserLogin(
      sampleUsers,
      configs,
      { username: 'user_b1', password: '123', selectedFacility: 'รพ. B' },
      '2026-10-20'
    );
    assert.equal(expiredLogin.valid, false);

    // Super Admin can always log in
    const superLogin = validateUserLogin(
      sampleUsers,
      configs,
      { username: SUPER_ADMIN_USERNAME, password: SUPER_ADMIN_PASSWORD, selectedFacility: '' },
      '2026-10-20'
    );
    assert.equal(superLogin.valid, true);
  });

  it('deletes a facility and all its affiliated users while preserving Super Admin', () => {
    const sampleUsers = ensureSuperAdminAccount([
      { id: 'u-admin-1', username: 'admin_a', password: '123', role: 'Admin', facility: 'รพ. A', createdAt: '2026-01-01' },
      { id: 'u-reg-1', username: 'user_a1', password: '123', role: 'User', facility: 'รพ. A', createdAt: '2026-01-01' },
      { id: 'u-reg-2', username: 'user_b1', password: '123', role: 'User', facility: 'รพ. B', createdAt: '2026-01-01' },
    ]);
    const facilities = ['รพ. A', 'รพ. B'];
    const configs = {
      'รพ. A': createFacilityUsageConfig('รพ. A', 30, '2026-10-20'),
      'รพ. B': createFacilityUsageConfig('รพ. B', 90, '2026-10-20'),
    };

    const result = deleteFacilityAndAffiliatedUsers(facilities, configs, sampleUsers, 'รพ. A');
    assert.deepEqual(result.facilities, ['รพ. B']);
    assert.equal(result.facilityConfigs['รพ. A'], undefined);
    assert.ok(result.facilityConfigs['รพ. B']);
    assert.equal(result.deletedUsersCount, 2);
    assert.equal(result.users.some((u) => u.username === 'admin_a'), false);
    assert.equal(result.users.some((u) => u.username === 'user_a1'), false);
    assert.equal(result.users.some((u) => u.username === 'user_b1'), true);
    assert.equal(result.users.some((u) => isProtectedSuperAdmin(u)), true);
  });

  it('disallows duplicate usernames within the same facility, allows same username in different facilities, and reserves Super Admin username globally', () => {
    const sampleUsers = ensureSuperAdminAccount([
      { id: 'u1', username: 'admin', password: '111', role: 'Admin', facility: 'รพ. A', createdAt: '2026-01-01' },
      { id: 'u2', username: 'tech01', password: '222', role: 'User', facility: 'รพ. A', createdAt: '2026-01-01' },
    ]);

    // Duplicate username in same facility should fail (case-insensitive)
    const dupSameFac = validateNewUsernameForFacility(sampleUsers, 'ADMIN', 'รพ. A');
    assert.equal(dupSameFac.valid, false);

    // Same username in different facility should succeed
    const sameUserDiffFac = validateNewUsernameForFacility(sampleUsers, 'admin', 'รพ. B');
    assert.equal(sameUserDiffFac.valid, true);

    const sameTechDiffFac = validateNewUsernameForFacility(sampleUsers, 'tech01', 'รพ. B');
    assert.equal(sameTechDiffFac.valid, true);

    // Super Admin username (Phonmat) is reserved across all facilities
    const superAdminAttempt = validateNewUsernameForFacility(sampleUsers, 'phonmat', 'รพ. B');
    assert.equal(superAdminAttempt.valid, false);
  });

  it('authenticates the correct facility account when two facilities share the same username', () => {
    const sampleUsers = ensureSuperAdminAccount([
      { id: 'u-a', username: 'admin', password: 'passwordA', role: 'Admin', facility: 'รพ. A', createdAt: '2026-01-01' },
      { id: 'u-b', username: 'admin', password: 'passwordB', role: 'Admin', facility: 'รพ. B', createdAt: '2026-01-01' },
    ]);
    const configs = {
      'รพ. A': createFacilityUsageConfig('รพ. A', 30, '2026-10-20'),
      'รพ. B': createFacilityUsageConfig('รพ. B', 30, '2026-10-20'),
    };

    // Logging into รพ. B with รพ. B's password succeeds and returns u-b
    const loginB = validateUserLogin(
      sampleUsers,
      configs,
      { username: 'admin', password: 'passwordB', selectedFacility: 'รพ. B' },
      '2026-10-20'
    );
    assert.equal(loginB.valid, true);
    assert.equal(loginB.user?.id, 'u-b');
    assert.equal(loginB.resolvedFacility, 'รพ. B');

    // Logging into รพ. B with รพ. A's password fails
    const wrongPassB = validateUserLogin(
      sampleUsers,
      configs,
      { username: 'admin', password: 'passwordA', selectedFacility: 'รพ. B' },
      '2026-10-20'
    );
    assert.equal(wrongPassB.valid, false);
  });
});




