import { Sidebar } from './Sidebar';
import type { ViewType } from './Sidebar';
import { Bell, Search, User } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
}

export const MainLayout = ({ children, currentView, onNavigate }: MainLayoutProps) => {
  return (
    <div className="min-h-screen flex bg-surface-900">
      <Sidebar currentView={currentView} onNavigate={onNavigate} />
      <main className="flex-1 ml-64 min-h-screen">
        {/* Top Navbar */}
        <header className="h-16 glass-nav flex items-center justify-between px-8 sticky top-0 z-40">
          <div className="flex items-center gap-4 bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-700/50 w-96">
            <Search size={18} className="text-slate-500" />
            <input 
              type="text" 
              placeholder="Search objects, buckets..." 
              className="bg-transparent border-none outline-none text-sm text-slate-300 w-full placeholder:text-slate-600"
            />
          </div>

          <div className="flex items-center gap-6">
            <button className="relative text-slate-400 hover:text-white transition-colors">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full border-2 border-slate-900"></span>
            </button>
            <div className="h-4 w-px bg-slate-700"></div>
            <div className="flex items-center gap-3 pl-2">
              <div className="flex flex-col text-right">
                <span className="text-sm font-medium text-white">Admin User</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Root Account</span>
              </div>
              <div className="w-10 h-10 bg-slate-800 rounded-full border border-slate-700 flex items-center justify-center overflow-hidden">
                <User size={20} className="text-slate-400" />
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
