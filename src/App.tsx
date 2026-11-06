import React, { useState } from 'react';
import { LayoutDashboard, Package, Wrench, AlertTriangle, LogOut, User, Users, ClipboardCheck, Gauge, ArrowLeft, Settings, Layers, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, Stethoscope, FolderArchive, Sun, Moon } from 'lucide-react';
import { AppProvider, useAppStore } from './store';
import LoginView from './views/LoginView';
import DashboardView from './views/DashboardView';
import EquipmentView from './views/EquipmentView';
import RepairView from './views/RepairView';
import UserManagementView from './views/UserManagementView';
import MaintenanceView from './views/MaintenanceView';
import CalibrationView from './views/CalibrationView';
import PoolView from './views/PoolView';
import EditProfileModal from './components/EditProfileModal';
import DownloadZipModal from './components/DownloadZipModal';

type ViewType = 'dashboard' | 'equipment' | 'repairs' | 'monthly-summary' | 'yearly-summary' | 'users' | 'decommission' | 'maintenance' | 'calibration' | 'pool';

function MainLayout() {
  const { logout, currentUser, userRole, currentFacility, users, isDarkMode, toggleDarkMode } = useAppStore();
  const isAdmin = userRole === 'Super Admin' || userRole === 'Admin';
  const defaultHomeView: ViewType = isAdmin ? 'dashboard' : 'equipment';
  
  const currentUserObj = users.find(
    u => u.username.toLowerCase() === (currentUser || '').toLowerCase()
  );
  
  const [currentView, setCurrentView] = useState<ViewType>(defaultHomeView);
  const [history, setHistory] = useState<ViewType[]>([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isZipModalOpen, setIsZipModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleNavigate = (newView: ViewType) => {
    if (newView !== currentView) {
      setHistory(prev => [...prev, currentView]);
      setCurrentView(newView);
    }
  };

  const handleGoBack = () => {
    if (history.length > 0) {
      const prevView = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
      setCurrentView(prevView);
    } else if (currentView !== defaultHomeView) {
      setCurrentView(defaultHomeView);
    }
  };

  const canGoBack = history.length > 0 || currentView !== defaultHomeView;

  const navItems = [
    ...(isAdmin ? [{ id: 'dashboard' as const, label: 'ภาพรวมระบบ', icon: LayoutDashboard }] : []),
    { id: 'equipment' as const, label: 'ทะเบียนเครื่องมือ', icon: Package },
    { id: 'repairs' as const, label: 'งานซ่อม', icon: Wrench },
    { id: 'maintenance' as const, label: 'การบำรุงรักษา', icon: ClipboardCheck },
    { id: 'calibration' as const, label: 'การสอบเทียบ', icon: Gauge },
    { id: 'pool' as const, label: 'งานเบิกจ่ายเครื่องมือ', icon: Layers },
    ...(isAdmin ? [{ id: 'users' as const, label: 'จัดการผู้ใช้งาน', icon: Users }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className={`bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 ease-in-out shrink-0 ${
        isSidebarCollapsed ? 'w-full md:w-20' : 'w-full md:w-64'
      }`}>
        {/* Sidebar Header */}
        <div className={`border-b border-slate-800/80 relative transition-all ${
          isSidebarCollapsed ? 'py-3.5 px-2 flex flex-col items-center justify-center min-h-[68px]' : 'p-4 pt-3.5 flex items-center justify-between min-h-[68px]'
        }`}>
          {!isSidebarCollapsed ? (
            <div className="overflow-hidden pr-8">
              <h1 className="text-[15px] font-bold text-white tracking-wide leading-snug">
                ระบบบริหารจัดการเครื่องมือแพทย์
              </h1>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">By PHONMAT</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center group" title="ระบบบริหารจัดการเครื่องมือแพทย์ (By PHONMAT)">
              <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
                <Stethoscope size={18} />
              </div>
            </div>
          )}

          {/* Toggle Collapse Button in Sidebar Header (Flushed to Top-Right Corner) */}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:flex absolute top-1.5 right-1.5 w-[24px] h-[26px] items-center justify-center pr-[3px] p-0 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors cursor-pointer shrink-0 z-20"
            title={isSidebarCollapsed ? 'ขยายเมนูด้านซ้าย' : 'ย่อเมนูเข้าด้านซ้าย'}
          >
            {isSidebarCollapsed ? (
              <ChevronRight size={18} strokeWidth={2.5} className="text-slate-200 hover:text-white" />
            ) : (
              <ChevronLeft size={18} strokeWidth={2.5} className="text-slate-200 hover:text-white" />
            )}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className={`flex-1 flex md:block overflow-x-auto md:overflow-x-visible gap-1.5 md:space-y-1.5 py-2.5 md:py-4 ${isSidebarCollapsed ? 'px-2' : 'px-3'}`}>
          {navItems.map((item) => {
            const isActive = currentView === item.id || 
              ((currentView === 'decommission' || currentView === 'monthly-summary' || currentView === 'yearly-summary') && item.id === 'repairs');
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                title={isSidebarCollapsed ? item.label : undefined}
                className={`shrink-0 md:w-full flex items-center rounded-xl transition-all duration-200 cursor-pointer ${
                  isSidebarCollapsed
                    ? 'justify-center p-3'
                    : 'space-x-2 md:space-x-3 px-3 md:px-3.5 py-2 md:py-2.5'
                } ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-medium'
                    : 'hover:bg-slate-800 hover:text-white text-slate-400'
                }`}
              >
                <item.icon size={20} className={isActive ? 'text-white shrink-0' : 'text-slate-400 group-hover:text-slate-200 shrink-0'} />
                {!isSidebarCollapsed && (
                  <span className="font-medium text-xs md:text-sm whitespace-nowrap truncate">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className={`hidden md:block border-t border-slate-800 transition-all ${
          isSidebarCollapsed ? 'p-2 py-4' : 'p-4 space-y-2.5'
        }`}>
          <button
            onClick={logout}
            title={isSidebarCollapsed ? 'ออกจากระบบ' : undefined}
            className={`w-full flex items-center justify-center bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 text-slate-300 rounded-xl transition-colors cursor-pointer ${
              isSidebarCollapsed ? 'p-3' : 'space-x-2 px-4 py-2.5'
            }`}
          >
            <LogOut size={17} className="shrink-0" />
            {!isSidebarCollapsed && (
              <span className="font-medium text-xs">ออกจากระบบ</span>
            )}
          </button>
          {!isSidebarCollapsed && (
            <div className="text-[11px] text-center text-slate-500 font-mono">
              v1.0.0
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-0 md:h-screen overflow-hidden">
        {/* Header bar for Back Button & User Profile */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-xs z-10 shrink-0">
          {/* Left: Back Button & Database Status */}
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleGoBack}
              disabled={!canGoBack}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                canGoBack
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 cursor-pointer border border-slate-200 shadow-2xs'
                  : 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed opacity-60'
              }`}
              title={canGoBack ? 'ย้อนกลับไปยังหน้าก่อนหน้า' : 'ไม่มีหน้าก่อนหน้า'}
            >
              <ArrowLeft size={15} />
              <span>ย้อนกลับ</span>
            </button>
          </div>

          {/* Right: User Profile & Settings */}
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={toggleDarkMode}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer active:scale-95 ${
                isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
              title={isDarkMode ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
              aria-label={isDarkMode ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
            >
              {isDarkMode ? (
                <>
                  <Sun size={15} className="text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">โหมดสว่าง</span>
                </>
              ) : (
                <>
                  <Moon size={15} className="text-slate-600 shrink-0" />
                  <span className="hidden sm:inline">โหมดมืด</span>
                </>
              )}
            </button>

            <div 
              className={`flex flex-col text-right ${isAdmin ? 'cursor-pointer group' : ''}`}
              onClick={() => isAdmin && setIsProfileModalOpen(true)}
              title={isAdmin ? 'แก้ไขโปรไฟล์ผู้ใช้งาน' : undefined}
            >
              <span className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{currentUser || 'User'}</span>
              <span className="text-[11px] text-slate-500">
                {userRole || 'User'} {currentFacility ? `• ${currentFacility}` : ''}
              </span>
            </div>
            
            <button
              type="button"
              onClick={() => isAdmin && setIsProfileModalOpen(true)}
              className={`relative w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 transition-colors border border-blue-200 overflow-hidden ${
                isAdmin ? 'hover:bg-blue-200 cursor-pointer active:scale-95' : 'cursor-default'
              }`}
              title={isAdmin ? 'คลิกเพื่อแก้ไขโปรไฟล์' : currentUser || 'User'}
            >
              {currentUserObj?.avatar ? (
                <img
                  src={currentUserObj.avatar}
                  alt={currentUser || 'Avatar'}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User size={20} />
              )}
              {isAdmin && (
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-slate-800 border-2 border-white rounded-full flex items-center justify-center text-white">
                  <Settings size={9} />
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="w-full max-w-[1500px] mx-auto pb-10">
            {currentView === 'dashboard' && <DashboardView onNavigate={handleNavigate} />}
            {currentView === 'equipment' && <EquipmentView />}
            {currentView === 'pool' && <PoolView />}
            {currentView === 'repairs' && <RepairView />}
            {currentView === 'monthly-summary' && <RepairView initialTab="monthly-summary" />}
            {currentView === 'yearly-summary' && <RepairView initialTab="yearly-summary" />}
            {currentView === 'maintenance' && <MaintenanceView />}
            {currentView === 'calibration' && <CalibrationView />}
            {currentView === 'decommission' && <RepairView initialTab="decommission" />}
            {currentView === 'users' && <UserManagementView />}
          </div>
        </div>
      </main>

      {/* Download Zip Modal */}
      {isZipModalOpen && (
        <DownloadZipModal
          isOpen={isZipModalOpen}
          onClose={() => setIsZipModalOpen(false)}
        />
      )}

      {/* Edit Profile Modal */}
      {isProfileModalOpen && (
        <EditProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
        />
      )}
    </div>
  );
}

function AppContent() {
  const { isAuthenticated } = useAppStore();

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return <MainLayout />;
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
