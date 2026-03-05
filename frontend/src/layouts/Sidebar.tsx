import { LayoutGrid, Database, Key, ShieldCheck, Settings, Box } from 'lucide-react';

const navItems = [
  { icon: LayoutGrid, label: 'Overview', href: '/dashboard' },
  { icon: Database, label: 'Buckets', href: '/buckets' },
  { icon: Box, label: 'Objects', href: '/objects' },
  { icon: Key, label: 'Access Keys', href: '/keys' },
  { icon: ShieldCheck, label: 'Security', href: '/security' },
  { icon: Settings, label: 'Settings', href: '/settings' },
];

export const Sidebar = () => {
  return (
    <aside className="w-64 h-screen glass-nav border-r fixed left-0 top-0 flex flex-col p-4 z-50">
      <div className="flex items-center gap-3 px-2 mb-10 mt-2">
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
          <a
            key={item.label}
            href={item.href}
            className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all group"
          >
            <item.icon size={20} className="group-hover:text-indigo-400 transition-colors" />
            <span className="text-sm font-medium">{item.label}</span>
          </a>
        ))}
      </nav>

      <div className="p-4 bg-indigo-600/10 rounded-2xl border border-indigo-500/20">
        <p className="text-xs text-indigo-300 font-medium mb-1">System Health</p>
        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 w-[92%] shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
        </div>
        <p className="text-[10px] text-slate-500 mt-2">92% Operational</p>
      </div>
    </aside>
  );
};
