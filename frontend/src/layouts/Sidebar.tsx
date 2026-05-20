import { LayoutGrid, Database, Key, ShieldCheck, Settings, Box, Link2 } from 'lucide-react';
import { clsx } from 'clsx';

export type ViewType = 'overview' | 'buckets' | 'objects' | 'keys' | 'security' | 'settings' | 'shares';

interface SidebarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
}

const navItems = [
  { id: 'overview' as ViewType, icon: LayoutGrid, label: 'Overview' },
  { id: 'buckets' as ViewType, icon: Database, label: 'Buckets' },
  { id: 'objects' as ViewType, icon: Box, label: 'Objects' },
  { id: 'keys' as ViewType, icon: Key, label: 'Access Keys' },
  { id: 'shares' as ViewType, icon: Link2, label: 'Shared Links' },
  { id: 'security' as ViewType, icon: ShieldCheck, label: 'Security' },
  { id: 'settings' as ViewType, icon: Settings, label: 'Settings' },
];

export const Sidebar = ({ currentView, onNavigate }: SidebarProps) => {
  return (
    <aside className="w-64 h-screen glass-nav border-r fixed left-0 top-0 flex flex-col p-4 z-50">
      <div className="flex items-center gap-3 px-2 mb-10 mt-2 cursor-pointer" onClick={() => onNavigate('overview')}>
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
          <Database className="text-white" size={24} />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">LumbungS3</h1>
          <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Storage</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={clsx(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
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

      <div className="p-4 bg-indigo-600/10 rounded-2xl border border-indigo-500/20">
        <p className="text-xs text-indigo-300 font-medium mb-1">System Health</p>
        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 w-[92%] shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
        </div>
        <p className="text-[10px] text-slate-500 mt-2">Local Instance OK</p>
      </div>
    </aside>
  );
};
