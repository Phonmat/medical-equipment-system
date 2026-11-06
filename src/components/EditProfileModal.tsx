import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { Role } from '../types';
import { 
  User, 
  Settings, 
  X, 
  Check, 
  Shield, 
  ShieldAlert, 
  ClipboardCheck, 
  Layers,
  KeyRound, 
  Eye, 
  EyeOff, 
  AlertCircle,
  Camera,
  Upload,
  Trash2,
  Image as ImageIcon,
  Sun,
  Moon
} from 'lucide-react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80'
];

export default function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { 
    users, 
    currentUser, 
    userRole, 
    updateUsername, 
    updateUserPassword, 
    updateUserAvatar,
    addUser,
    isDarkMode,
    toggleDarkMode
  } = useAppStore();

  const currentUserObj = users.find(
    u => u.username.toLowerCase() === (currentUser || '').toLowerCase()
  );
  const isProtectedSuperAdminUser = (currentUser || '').trim().toLowerCase() === 'phonmat' || userRole === 'Super Admin';

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUsername(currentUser || '');
      setAvatar(currentUserObj?.avatar);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowPassword(false);
      setShowConfirmPassword(false);
      setErrorMsg('');
      setSuccessMsg('');
      setIsSaving(false);
      setShowPresets(false);
    }
  }, [isOpen, currentUser, currentUserObj]);

  if (!isOpen) return null;

  const getRoleIcon = (role?: Role | string | null) => {
    switch (role) {
      case 'Super Admin':
        return <ShieldAlert size={16} className="text-red-500" />;
      case 'Admin':
        return <Shield size={16} className="text-blue-500" />;
      case 'PM/CAL':
        return <ClipboardCheck size={16} className="text-emerald-500" />;
      case 'Pool':
        return <Layers size={16} className="text-purple-600" />;
      default:
        return <User size={16} className="text-slate-500" />;
    }
  };

  const getRoleBadgeClass = (role?: Role | string | null) => {
    switch (role) {
      case 'Super Admin':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Admin':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'PM/CAL':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Pool':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (JPEG, PNG, WebP, GIF)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('ไฟล์รูปภาพมีขนาดใหญ่เกิน 10MB กรุณาเลือกไฟล์ที่มีขนาดเล็กลง');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 320;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setAvatar(compressedDataUrl);
          setErrorMsg('');
          setSuccessMsg('เปลี่ยนรูปภาพแล้ว (กดบันทึกเพื่อยืนยัน)');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);

    // reset input value so re-selecting same file triggers onChange
    e.target.value = '';
  };

  const handleRemoveAvatar = () => {
    setAvatar(undefined);
    setSuccessMsg('นำรูปโปรไฟล์ออกแล้ว (กดบันทึกเพื่อยืนยัน)');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setErrorMsg('กรุณากรอกชื่อผู้ใช้งาน');
      return;
    }

    const isChangingPassword = Boolean(currentPassword || newPassword || confirmPassword);

    if (isChangingPassword) {
      if (isProtectedSuperAdminUser) {
        setErrorMsg('รหัสผ่านของ Super Admin (Phonmat) ถูกล็อคไว้ตามนโยบายระบบ ไม่สามารถเปลี่ยนแปลงได้');
        return;
      }
      if (!currentPassword) {
        setErrorMsg('กรุณากรอกรหัสผ่านเดิมเพื่อเปลี่ยนรหัสผ่านใหม่');
        return;
      }

      const currentActualPassword = currentUserObj?.password ?? '1';
      if (currentPassword !== currentActualPassword) {
        setErrorMsg('รหัสผ่านเดิมไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
        return;
      }

      if (!newPassword.trim()) {
        setErrorMsg('กรุณาระบุรหัสผ่านใหม่');
        return;
      }

      if (!confirmPassword.trim()) {
        setErrorMsg('กรุณากรอกยืนยันรหัสผ่านใหม่อีกครั้ง');
        return;
      }

      if (newPassword !== confirmPassword) {
        setErrorMsg('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน');
        return;
      }

      if (newPassword === currentPassword) {
        setErrorMsg('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
        return;
      }
    }

    setIsSaving(true);

    let targetUserId = currentUserObj?.id;

    // If current user object does not exist in store, create it
    if (!targetUserId) {
      addUser({
        username: trimmedUsername,
        password: newPassword.trim() || currentPassword.trim() || '1',
        role: (userRole as Role) || 'User',
        avatar: avatar
      });
      setSuccessMsg('บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว');
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 700);
      return;
    }

    // Update username if changed
    if (trimmedUsername.toLowerCase() !== (currentUser || '').toLowerCase()) {
      const success = updateUsername(targetUserId, trimmedUsername);
      if (!success) {
        setErrorMsg('ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว กรุณาเลือกชื่ออื่น');
        setIsSaving(false);
        return;
      }
    }

    // Update avatar
    updateUserAvatar(targetUserId, avatar);

    // Update password if provided
    if (isChangingPassword && newPassword.trim()) {
      updateUserPassword(targetUserId, newPassword.trim());
    }

    setSuccessMsg('บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว');
    setTimeout(() => {
      setIsSaving(false);
      onClose();
    }, 700);
  };

  return (
    <div 
      id="edit-profile-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
    >
      <div 
        id="edit-profile-modal-container"
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600/30 border border-blue-400/30 rounded-xl text-blue-300">
              <Settings size={20} className="animate-spin-slow" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">แก้ไขโปรไฟล์ผู้ใช้งาน</h3>
              <p className="text-xs text-slate-300">จัดการรูปโปรไฟล์ ชื่อผู้ใช้ และรหัสผ่าน</p>
            </div>
          </div>
          <button
            id="btn-close-edit-profile-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="ปิดหน้าต่าง"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Summary & Avatar Editor Bar */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Avatar with Upload Trigger */}
              <div className="relative group">
                <div 
                  className="w-16 h-16 rounded-full bg-blue-100 border-2 border-blue-300 shadow-sm overflow-hidden flex items-center justify-center text-blue-600 cursor-pointer relative transition-transform group-hover:scale-102"
                  onClick={() => fileInputRef.current?.click()}
                  title="คลิกเพื่อเปลี่ยนรูปโปรไฟล์"
                >
                  {avatar ? (
                    <img 
                      src={avatar} 
                      alt={currentUser || 'Avatar'} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User size={30} className="text-blue-500" />
                  )}
                  
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-slate-900/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-medium">
                    <Camera size={18} />
                    <span>เปลี่ยนรูป</span>
                  </div>
                </div>

                {/* Camera quick badge button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-md border-2 border-white transition-colors"
                  title="อัปโหลดรูปภาพใหม่"
                >
                  <Camera size={12} />
                </button>
              </div>

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* User Info & Quick Action Buttons */}
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-800 text-base">{currentUser || 'ผู้ใช้งาน'}</span>
                  <div className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getRoleBadgeClass(userRole)}`}>
                    {getRoleIcon(userRole)}
                    <span>{userRole || 'User'}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 hover:border-blue-300 rounded-lg font-medium transition-colors shadow-2xs"
                  >
                    <Upload size={12} />
                    <span>อัปโหลดรูปภาพ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPresets(!showPresets)}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg font-medium transition-colors shadow-2xs"
                  >
                    <ImageIcon size={12} />
                    <span>รูปภาพตัวอย่าง</span>
                  </button>

                  {avatar && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="inline-flex items-center space-x-1 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition-colors"
                      title="ลบรูปโปรไฟล์ออก"
                    >
                      <Trash2 size={12} />
                      <span>ลบรูป</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Dark / Light Mode Toggle Button in Profile Bar (Red Box Location) */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all cursor-pointer active:scale-95 shrink-0 ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700 shadow-md'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
              }`}
              title={isDarkMode ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
              aria-label={isDarkMode ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
            >
              {isDarkMode ? (
                <Sun size={20} className="text-amber-400 shrink-0" />
              ) : (
                <Moon size={20} className="text-slate-600 shrink-0" />
              )}
            </button>
          </div>

          {/* Presets Gallery Drawer */}
          {showPresets && (
            <div className="mt-3 pt-3 border-t border-slate-200 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="text-[11px] font-semibold text-slate-600 mb-2 flex items-center justify-between">
                <span>เลือกรูปภาพโปรไฟล์ตัวอย่าง:</span>
                <button
                  type="button"
                  onClick={() => setShowPresets(false)}
                  className="text-slate-400 hover:text-slate-600 text-[10px]"
                >
                  ปิด
                </button>
              </div>
              <div className="flex items-center space-x-2.5 overflow-x-auto pb-1">
                {PRESET_AVATARS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setAvatar(url);
                      setShowPresets(false);
                      setSuccessMsg('เลือกรูปภาพโปรไฟล์แล้ว (กดบันทึกเพื่อยืนยัน)');
                    }}
                    className={`shrink-0 w-11 h-11 rounded-full border-2 overflow-hidden transition-all hover:scale-110 ${
                      avatar === url ? 'border-blue-600 ring-2 ring-blue-400' : 'border-slate-200 hover:border-blue-400'
                    }`}
                  >
                    <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs text-rose-700">
              <AlertCircle size={16} className="shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-xs text-emerald-700">
              <Check size={16} className="shrink-0 text-emerald-500" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Username Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <User size={14} className="text-slate-500" />
                <span>ชื่อผู้ใช้งาน (Username) <span className="text-rose-500">*</span></span>
              </span>
              <span className="text-[11px] font-normal text-slate-400">ใช้สำหรับเข้าสู่ระบบ</span>
            </label>
            <input
              id="input-profile-username"
              type="text"
              required
              disabled={isProtectedSuperAdminUser}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`w-full px-3.5 py-2 text-sm border rounded-xl transition-colors ${
                isProtectedSuperAdminUser
                  ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                  : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
              }`}
              placeholder="ระบุชื่อผู้ใช้งาน"
            />
          </div>

          {/* Password Change Section */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-1.5">
                <KeyRound size={15} className="text-blue-600" />
                <span className="text-xs font-bold text-slate-800">เปลี่ยนรหัสผ่าน</span>
              </div>
              {(currentPassword || newPassword || confirmPassword) && (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="text-[11px] text-rose-500 hover:text-rose-700 hover:underline"
                >
                  ล้างข้อมูลรหัสผ่าน
                </button>
              )}
            </div>

            <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              {/* Current Password Field */}
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1 flex items-center justify-between">
                  <span>รหัสผ่านเดิม (Current Password) {(newPassword || confirmPassword) && <span className="text-rose-500">*</span>}</span>
                  <span className="text-[10px] text-slate-400">ต้องใส่เพื่อยืนยันสิทธิ์</span>
                </label>
                <div className="relative">
                  <input
                    id="input-profile-current-password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3.5 py-2 pr-10 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    placeholder="กรอกรหัสผ่านเดิมปัจจุบัน"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New Password Field */}
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  รหัสผ่านใหม่ (New Password)
                </label>
                <div className="relative">
                  <input
                    id="input-profile-new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2 pr-10 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    placeholder="กรอกรหัสผ่านใหม่ที่ต้องการ"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password Field */}
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1 flex items-center justify-between">
                  <span>ยืนยันรหัสผ่านใหม่ (Confirm New Password)</span>
                  {newPassword && confirmPassword && (
                    <span className={`text-[10px] font-medium ${newPassword === confirmPassword ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {newPassword === confirmPassword ? '✓ รหัสผ่านตรงกัน' : '✗ รหัสผ่านไม่ตรงกัน'}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    id="input-profile-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2 pr-10 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    placeholder="กรอกรหัสผ่านใหม่อีกครั้งเพื่อยืนยัน"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Dark / Light Mode Toggle Button in Profile Bar (Red Box Location) */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all cursor-pointer active:scale-95 shrink-0 ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700 shadow-md'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
              }`}
              title={isDarkMode ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
              aria-label={isDarkMode ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
            >
              {isDarkMode ? (
                <Sun size={20} className="text-amber-400 shrink-0" />
              ) : (
                <Moon size={20} className="text-slate-600 shrink-0" />
              )}
            </button>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-200 flex justify-end space-x-2">
            <button
              id="btn-cancel-edit-profile"
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              id="btn-save-edit-profile"
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <Check size={15} />
              <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

