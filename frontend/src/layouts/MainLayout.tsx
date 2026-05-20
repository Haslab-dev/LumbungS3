import { useState } from 'react';
import { Sidebar } from './Sidebar';
import type { ViewType } from './Sidebar';
import { Bell, Search, User, Menu } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  onLogout?: () => void;
  userRole?: string;
  username?: string;
}

export const MainLayout = ({ children, currentView, onNavigate, onLogout, userRole = 'user', username = '' }: MainLayoutProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-surface-900 overflow-x-hidden">
      {/* Backdrop overlay for mobile drawer */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
        />
      )}

      {/* Sidebar Navigation (responsive drawer) */}
      <Sidebar 
        currentView={currentView} 
        onNavigate={onNavigate} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={onLogout}
        userRole={userRole}
      />

      {/* Main Content Area */}
      <main className="flex-1 ml-0 lg:ml-64 min-h-screen transition-all duration-300 flex flex-col">
        {/* Top Navbar */}
        <header className="h-16 glass-nav flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Drawer Trigger */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <Menu size={20} />
            </button>

            {/* Responsive Search Box */}
            <div className="flex items-center gap-3 bg-slate-800/50 px-3.5 py-2 rounded-xl border border-slate-700/50 w-44 sm:w-64 md:w-96">
              <Search size={16} className="text-slate-500" />
              <input 
                type="text" 
                placeholder="Search objects..." 
                className="bg-transparent border-none outline-none text-xs text-slate-300 w-full placeholder:text-slate-650"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 lg:gap-6">
            <button className="relative text-slate-400 hover:text-white transition-colors cursor-pointer">
              <Bell size={18} />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-indigo-500 rounded-full border border-slate-900"></span>
            </button>
            <div className="h-4 w-px bg-slate-850"></div>
            <div className="flex items-center gap-2.5 pl-1">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-white">{username || 'User'}</span>
                <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">{userRole === 'admin' ? 'Admin' : 'User'}</span>
              </div>
              <div className="w-9 h-9 bg-slate-800 rounded-full border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                <User size={16} className="text-slate-400" />
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Content Panel */}
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto flex-1">
          {children}
        </div>
      </main>
    </div>
  );
};

