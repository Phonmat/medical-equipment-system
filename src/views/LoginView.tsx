import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { Lock, User, Stethoscope, Building2, ChevronDown, Eye, EyeOff, Sun, Moon } from 'lucide-react';
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
    <div
      className={`min-h-screen flex items-center justify-center p-4 relative transition-colors duration-200 ${
        isDarkMode ? 'bg-slate-900' : 'bg-[#eaeff7]'
      }`}
    >
      {/* Dark / Light Mode Toggle Icon Button at Top-Right Corner */}
      <button
        type="button"
        onClick={toggleDarkMode}
        className={`fixed top-4 right-4 z-50 flex items-center justify-center w-10 h-10 rounded-2xl transition-all cursor-pointer active:scale-95 ${
          isDarkMode
            ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 shadow-lg'
            : 'bg-[#eef3fa] text-slate-600 border border-white/80 shadow-[6px_6px_14px_#cbd4e2,-6px_-6px_14px_#ffffff] hover:text-blue-600'
        }`}
        title={isDarkMode ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
        aria-label={isDarkMode ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
      >
        {isDarkMode ? (
          <Sun size={18} className="text-amber-400 shrink-0" />
        ) : (
          <Moon size={18} className="text-slate-600 shrink-0" />
        )}
      </button>

      {/* Neumorphic Main Card */}
      <div
        className={`max-w-[430px] w-full rounded-[32px] p-7 sm:p-9 transition-all duration-200 ${
          isDarkMode
            ? 'bg-slate-800 border border-slate-700 shadow-2xl'
            : 'bg-[#eef3fa] border border-white/80 shadow-[16px_16px_36px_#c8d2e1,-16px_-16px_36px_#ffffff]'
        }`}
      >
        {/* Top Medical Device Icon */}
        <div className="flex justify-center mb-5">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
              isDarkMode
                ? 'bg-gradient-to-b from-[#5584ff] to-[#3b66f5] text-white shadow-[0_8px_20px_rgba(59,102,245,0.4)]'
                : 'bg-[#eef3fa] text-[#3b66f5] border border-white/80 shadow-[6px_6px_14px_#c8d2e1,-6px_-6px_14px_#ffffff]'
            }`}
          >
            <Stethoscope size={32} strokeWidth={2.2} />
          </div>
        </div>

        {/* Title & Subtitle */}
        <div className="text-center mb-7">
          <h1
            className={`text-xl sm:text-2xl font-extrabold tracking-tight ${
              isDarkMode ? 'text-white' : 'text-[#1e293b]'
            }`}
          >
            ระบบบริหารจัดการเครื่องมือแพทย์
          </h1>
          <p
            className={`text-sm mt-1.5 font-medium text-center ${
              isDarkMode ? 'text-slate-400' : 'text-[#7c8ba1]'
            }`}
          >
            By PHONMAT
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div
              className={`p-3.5 text-sm rounded-2xl text-center font-medium ${
                isDarkMode
                  ? 'bg-red-950/60 text-red-300 border border-red-800/60'
                  : 'bg-[#f8e8ec] text-rose-600 shadow-[inset_3px_3px_6px_#dfcad0,inset_-3px_-3px_6px_#ffffff]'
              }`}
            >
              {error}
            </div>
          )}

          {/* Facility Select */}
          <div>
            <label
              htmlFor="login-facility-select"
              className={`block text-xs font-bold mb-2 pl-1 ${
                isDarkMode ? 'text-slate-300' : 'text-[#334155]'
              }`}
            >
              สถานประกอบการ (Facility)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Building2
                  className={`h-4 w-4 ${isDarkMode ? 'text-slate-400' : 'text-[#7c8ba1]'}`}
                />
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
                className={`pl-11 pr-10 w-full rounded-2xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all appearance-none cursor-pointer ${
                  isDarkMode
                    ? 'bg-slate-900 border border-slate-700 text-slate-100'
                    : 'bg-[#e8eef7] text-[#334155] border border-white/60 shadow-[inset_4px_4px_8px_#cad4e2,inset_-4px_-4px_8px_#ffffff]'
                }`}
              >
                <option value="">-- เลือกสถานประกอบการ --</option>
                {availableFacilities.map((fac) => (
                  <option key={fac} value={fac}>
                    {fac}
                  </option>
                ))}
                <option value="ส่วนกลาง (Super Admin)">ส่วนกลาง (Super Admin)</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <ChevronDown
                  className={`h-4 w-4 ${isDarkMode ? 'text-slate-400' : 'text-[#64748b]'}`}
                />
              </div>
            </div>
          </div>

          {/* Username Input */}
          <div>
            <label
              htmlFor="login-username-input"
              className={`block text-xs font-bold mb-2 pl-1 ${
                isDarkMode ? 'text-slate-300' : 'text-[#334155]'
              }`}
            >
              ชื่อผู้ใช้งาน (Username)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User
                  className={`h-4 w-4 ${isDarkMode ? 'text-slate-400' : 'text-[#7c8ba1]'}`}
                />
              </div>
              <input
                id="login-username-input"
                type="text"
                required
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                className={`pl-11 w-full rounded-2xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all ${
                  isDarkMode
                    ? 'bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500'
                    : 'bg-[#e8eef7] text-[#334155] placeholder-[#94a3b8] border border-white/60 shadow-[inset_4px_4px_8px_#cad4e2,inset_-4px_-4px_8px_#ffffff]'
                }`}
                placeholder="กรอกชื่อผู้ใช้งาน..."
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label
              htmlFor="login-password-input"
              className={`block text-xs font-bold mb-2 pl-1 ${
                isDarkMode ? 'text-slate-300' : 'text-[#334155]'
              }`}
            >
              รหัสผ่าน (Password)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock
                  className={`h-4 w-4 ${isDarkMode ? 'text-slate-400' : 'text-[#7c8ba1]'}`}
                />
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
                className={`pl-11 pr-11 w-full rounded-2xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all ${
                  isDarkMode
                    ? 'bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500'
                    : 'bg-[#e8eef7] text-[#334155] placeholder-[#94a3b8] border border-white/60 shadow-[inset_4px_4px_8px_#cad4e2,inset_-4px_-4px_8px_#ffffff]'
                }`}
                placeholder="••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute inset-y-0 right-0 pr-4 flex items-center focus:outline-none cursor-pointer transition-colors ${
                  isDarkMode
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-[#64748b] hover:text-[#334155]'
                }`}
                title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Primary 3D Blue Pill Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-gradient-to-b from-[#5584ff] to-[#3b66f5] hover:from-[#4777fb] hover:to-[#2f58e8] active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-2xl shadow-[0_10px_20px_rgba(59,102,245,0.35),inset_0_1px_1px_rgba(255,255,255,0.45)] transition-all duration-200 cursor-pointer flex items-center justify-center space-x-2 text-sm tracking-wide"
            >
              <span>เข้าสู่ระบบ</span>
              <span className="text-base leading-none">→</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

