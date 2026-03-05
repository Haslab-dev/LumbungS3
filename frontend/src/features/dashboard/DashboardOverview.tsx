import { StatCard, Card } from '../../components/ui/DashboardElements';
import { HardDrive, Layers, Activity, Server, ArrowUpRight, Plus } from 'lucide-react';

export function DashboardOverview() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-1">Overview</h2>
          <p className="text-slate-400">Welcome back. Here's what's happening with your storage nodes.</p>
        </div>
        <button className="btn-primary">
          <Plus size={18} />
          Create Bucket
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Storage" 
          value="16.8 GB" 
          icon={<HardDrive />} 
          trend={{ value: 12, isUp: true }}
          description="45% of 100GB limit"
        />
        <StatCard 
          title="Total Buckets" 
          value="3" 
          icon={<Layers />} 
        />
        <StatCard 
          title="Objects Stored" 
          value="181" 
          icon={<Server />} 
          trend={{ value: 5, isUp: true }}
        />
        <StatCard 
          title="System Uptime" 
          value="99.9%" 
          icon={<Activity />} 
          description="Running for 12 days"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Buckets */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-semibold text-white">Recent Buckets</h3>
            <button className="text-indigo-400 text-sm hover:underline">View All</button>
          </div>
          
          <div className="space-y-3">
            {[
              { name: 'telemetry-data', objects: 124, size: '1.2 GB', color: 'bg-emerald-500' },
              { name: 'application-assets', objects: 45, size: '256 MB', color: 'bg-indigo-500' },
              { name: 'backups', objects: 12, size: '15.4 GB', color: 'bg-amber-500' }
            ].map((bucket) => (
              <Card key={bucket.name} className="py-4 px-6 hover:bg-slate-700/30 transition-colors cursor-pointer group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${bucket.color} animate-pulse shadow-[0_0_8px] shadow-current`} />
                    <div>
                      <h4 className="font-medium text-white group-hover:text-indigo-300 transition-colors">{bucket.name}</h4>
                      <p className="text-xs text-slate-500">{bucket.objects} objects • {bucket.size}</p>
                    </div>
                  </div>
                  <ArrowUpRight size={18} className="text-slate-600 group-hover:text-white transition-all transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Real-time Throughput / Placeholder for Chart */}
        <Card className="flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-6">Throughput</h3>
          <div className="flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-xs text-slate-400">Incoming</span>
                <span className="text-sm font-mono text-emerald-400">12.4 MB/s</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[30%]" />
              </div>

              <div className="flex justify-between items-end">
                <span className="text-xs text-slate-400">Outgoing</span>
                <span className="text-sm font-mono text-indigo-400">45.1 MB/s</span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 w-[65%]" />
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-700/50">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">I/O Wait</span>
                  <span className="text-slate-300">0.2ms</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Disk Queue</span>
                  <span className="text-slate-300">0.01</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
