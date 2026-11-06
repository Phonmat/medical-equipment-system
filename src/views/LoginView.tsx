import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { Lock, User, Wrench, Building2, ChevronDown, Eye, EyeOff, Sun, Moon } from 'lucide-react';
import { isProtectedSuperAdmin, validateUserLogin } from '../utils/accessControl';

export default function LoginView() {
  const { login, users, facilities, facilityConfigs, isDarkMode, toggleDarkMode } = useAppStore();
  const [selectedFacility, setSelectedFacility] = useState('');
  const [hasManuallySelectedFacility, setHasManuallySelectedFacility] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const availableFacilities = useMemo(() => {
    const set = new Set<string>();
    facilities.forEach((f) => {
      const trimmed = (f || '').trim();
      if (trimmed && trimmed !== 'ส่วนกลาง (Super Admin)') set.add(trimmed);
    });
    users.forEach((u) => {
      const trimmed = (u.facility || '').trim();
      if (trimmed && trimmed !== 'ส่วนกลาง (Super Admin)') set.add(trimmed);
    });
    return Array.from(set);
  }, [facilities, users]);

  const handleUsernameChange = (val: string) => {
    setUsername(val);
    setError('');
    if (!hasManuallySelectedFacility) {
      const trimmed = val.trim().toLowerCase();
      const matchingUsers = users.filter((u) => u.username.trim().toLowerCase() === trimmed);
      const superAdminMatch = matchingUsers.find((u) => isProtectedSuperAdmin(u));
      if (superAdminMatch) {
        setSelectedFacility('ส่วนกลาง (Super Admin)');
      } else if (matchingUsers.length === 1 && matchingUsers[0].facility) {
        setSelectedFacility(matchingUsers[0].facility);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const matchingUsers = users.filter(
      (u) => u.username.trim().toLowerCase() === username.trim().toLowerCase()
    );
    const superAdminMatch = matchingUsers.find((u) => isProtectedSuperAdmin(u));
    const singleMatchedUser = matchingUsers.length === 1 ? matchingUsers[0] : undefined;

    const effectiveFacility =
      selectedFacility ||
      (!hasManuallySelectedFacility
        ? superAdminMatch
          ? 'ส่วนกลาง (Super Admin)'
          : singleMatchedUser?.facility || ''
        : '');

    const result = validateUserLogin(users, facilityConfigs, {
      username,
      password,
      selectedFacility: effectiveFacility,
    });

    if (!result.valid || !result.user) {
      setError(result.error || 'ไม่สามารถเข้าสู่ระบบได้');
      return;
    }

    login(result.user.username, result.user.role, result.resolvedFacility);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative transition-colors duration-200">
      {/* Dark / Light Mode Toggle Button at Top-Right Corner */}
      <button
        type="button"
        onClick={toggleDarkMode}
        className={`fixed top-4 right-4 z-50 flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold border shadow-sm transition-all cursor-pointer active:scale-95 ${
          isDarkMode
            ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
        }`}
        title={isDarkMode ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
        aria-label={isDarkMode ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
      >
        {isDarkMode ? (
          <>
            <Sun size={16} className="text-amber-400 shrink-0" />
            <span>โหมดสว่าง</span>
          </>
        ) : (
          <>
            <Moon size={16} className="text-slate-600 shrink-0" />
            <span>โหมดมืด</span>
          </>
        )}
      </button>

      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden transition-colors duration-200">
        <div className="bg-slate-900 p-8 text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
            <Wrench className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            ระบบบริหารจัดการเครื่องมือแพทย์
          </h1>
          <p className="text-slate-400 text-sm mt-2">By PHONMAT</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 text-center">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="login-facility-select" className="block text-sm font-medium text-slate-700 mb-2">
                สถานประกอบการ (Facility)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-slate-400" />
                </div>
                <select
                  id="login-facility-select"
                  aria-label="เลือกสถานประกอบการ"
                  value={selectedFacility}
                  onChange={(e) => {
                    setSelectedFacility(e.target.value);
                    setHasManuallySelectedFacility(true);
                    setError('');
                  }}
                  className="pl-10 pr-10 w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors appearance-none cursor-pointer"
                >
                  <option value="">-- เลือกสถานประกอบการ --</option>
                  {availableFacilities.map((fac) => (
                    <option key={fac} value={fac}>
                      {fac}
                    </option>
                  ))}
                  <option value="ส่วนกลาง (Super Admin)">ส่วนกลาง (Super Admin)</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="login-username-input" className="block text-sm font-medium text-slate-700 mb-2">
                ชื่อผู้ใช้งาน (Username)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="login-username-input"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className="pl-10 w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="กรอกชื่อผู้ใช้งาน..."
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password-input" className="block text-sm font-medium text-slate-700 mb-2">
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  className="pl-10 pr-10 w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer transition-colors"
                  title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer"
            >
              เข้าสู่ระบบ
            </button>
          </form>
          
          <div className="mt-6 text-center text-xs text-slate-500">
            *ติดต่อ: phonmat 0823152505
          </div>
        </div>
      </div>
    </div>
  );
}

