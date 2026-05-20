import { LayoutGrid, Database, ShieldCheck, Settings, Box, Link2, LogOut, X, Users } from 'lucide-react';
import { clsx } from 'clsx';

export type ViewType = 'overview' | 'buckets' | 'objects' | 'security' | 'settings' | 'shares' | 'users';

interface SidebarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  isOpen?: boolean;
  onClose?: () => void;
  onLogout?: () => void;
  userRole?: string;
}

export const Sidebar = ({ currentView, onNavigate, isOpen = false, onClose, onLogout, userRole = 'user' }: SidebarProps) => {
  const navItems = [
    { id: 'overview' as ViewType, icon: LayoutGrid, label: 'Overview' },
    { id: 'buckets' as ViewType, icon: Database, label: 'Buckets' },
    { id: 'objects' as ViewType, icon: Box, label: 'Objects' },
    { id: 'shares' as ViewType, icon: Link2, label: 'Shared Links' },
    { id: 'security' as ViewType, icon: ShieldCheck, label: 'Security' },
    { id: 'settings' as ViewType, icon: Settings, label: 'Settings' },
  ];

  if (userRole === 'admin') {
    navItems.splice(5, 0, { id: 'users' as ViewType, icon: Users, label: 'Users' });
  }
  return (
    <aside className={clsx(
      "w-64 h-screen glass-nav border-r fixed left-0 top-0 flex flex-col p-4 z-50 transition-transform duration-300 ease-in-out lg:translate-x-0",
      isOpen ? "translate-x-0 shadow-2xl shadow-black/85" : "-translate-x-full"
    )}>
      {/* Brand Header / Close Controls */}
      <div className="flex items-center gap-3 px-2 mb-10 mt-2 relative">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => { onNavigate('overview'); onClose?.(); }}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Database className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">LumbungS3</h1>
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Storage</span>
          </div>
        </div>

        {/* Close Button on Mobile Drawer */}
        <button 
          onClick={onClose}
          className="lg:hidden p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all absolute -right-1 cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              onNavigate(item.id);
              onClose?.();
            }}
            className={clsx(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group cursor-pointer",
              currentView === item.id 
                ? "text-white bg-white/10 shadow-lg" 
                : "text-slate-400 hover:text-white hover:bg-white/5"
            )}
          >
            <item.icon size={20} className={clsx(
              "transition-colors",
              currentView === item.id ? "text-indigo-400" : "group-hover:text-indigo-400"
            )} />
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer block: Health & Logout */}
      <div className="space-y-3 mt-auto">
        <div className="p-4 bg-indigo-600/10 rounded-2xl border border-indigo-500/20">
          <p className="text-xs text-indigo-300 font-medium mb-1">System Health</p>
          <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 w-[92%] shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Local Instance OK</p>
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 group border border-transparent hover:border-rose-500/20 cursor-pointer"
          >
            <LogOut size={18} className="group-hover:text-rose-400 transition-colors" />
            <span className="text-sm font-medium">Log Out</span>
          </button>
        )}
      </div>
    </aside>
  );
};

