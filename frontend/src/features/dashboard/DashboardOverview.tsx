import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StatCard, Card } from '../../components/ui/DashboardElements';
import { Modal } from '../../components/ui/Modal';
import { HardDrive, Layers, Activity, Server, ArrowUpRight, Plus, Loader2, Trash2, Globe } from 'lucide-react';
import { getBuckets, createBucket, deleteBucket, getMetrics, updateBucketVisibility } from '../../lib/api';

interface DashboardOverviewProps {
  onSelectBucket: (name: string) => void;
  viewMode?: 'overview' | 'buckets';
}

export function DashboardOverview({ onSelectBucket, viewMode = 'overview' }: DashboardOverviewProps) {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: buckets = [], isLoading: bucketsLoading } = useQuery({
    queryKey: ['buckets'],
    queryFn: getBuckets
  });

  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: getMetrics,
  });

  const createBucketMutation = useMutation({
    mutationFn: createBucket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buckets'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      setIsModalOpen(false);
      setNewBucketName('');
    }
  });

  const deleteBucketMutation = useMutation({
    mutationFn: deleteBucket,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buckets'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      setDeleteConfirmId(null);
    }
  });

  const visibilityMutation = useMutation({
    mutationFn: ({ id, visibility }: { id: string, visibility: 'public' | 'private' }) => updateBucketVisibility(id, visibility),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buckets'] });
    }
  });

  const handleCreateBucket = (e: React.FormEvent) => {
    e.preventDefault();
    if (newBucketName) {
      createBucketMutation.mutate(newBucketName);
    }
  };

  const handleDeleteBucket = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent navigation to bucket
    setDeleteConfirmId(id);
  };

  const toggleVisibility = (e: React.MouseEvent, id: string, current: string) => {
    e.stopPropagation();
    const next = current === 'public' ? 'private' : 'public';
    visibilityMutation.mutate({ id, visibility: next as 'public' | 'private' });
  };

  const isOverview = viewMode === 'overview';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-1">
            {isOverview ? 'Overview' : 'Buckets'}
          </h2>
          <p className="text-slate-400">
            {isOverview 
              ? "Welcome back. Here's what's happening with your storage nodes."
              : "Manage and configure your secure storage buckets."
            }
          </p>
        </div>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Create Bucket
        </button>
      </div>

      {/* Metrics Grid */}
      {isOverview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Total Storage" 
            value={metrics?.totalStorage || '0 GB'} 
            icon={<HardDrive />} 
            trend={{ value: 12, isUp: true }}
            description={`${metrics?.usedPercentage || 0}% of 100GB limit`}
          />
          <StatCard 
            title="Total Buckets" 
            value={metrics?.bucketCount || 0} 
            icon={<Layers />} 
          />
          <StatCard 
            title="Objects Stored" 
            value={metrics?.objectCount || 0} 
            icon={<Server />} 
            trend={{ value: 5, isUp: true }}
          />
          <StatCard 
            title="System Uptime" 
            value={metrics?.uptime || '99.9%'} 
            icon={<Activity />} 
            description="Running for 12 days"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Buckets */}
        <div className={`${isOverview ? "lg:col-span-2" : "lg:col-span-3"} space-y-4`}>
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-semibold text-white">
              {isOverview ? 'Recent Buckets' : 'All Buckets'}
            </h3>
            {isOverview && <button className="text-indigo-400 text-sm hover:underline">View All</button>}
          </div>
          
          <div className="space-y-3">
            {bucketsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
              </div>
            ) : buckets.length > 0 ? (
              buckets.map((bucket: any) => (
                <Card 
                  key={bucket.id} 
                  className="py-4 px-6 hover:bg-slate-700/30 transition-colors cursor-pointer group"
                  onClick={() => onSelectBucket(bucket.name)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${bucket.visibility === 'public' ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-indigo-500 shadow-indigo-500/50'} animate-pulse shadow-[0_0_8px] transition-all group-hover:scale-110`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-white group-hover:text-indigo-300 transition-colors">{bucket.name}</h4>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-tighter flex items-center gap-1 ${
                            bucket.visibility === 'public' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-slate-800 text-slate-500 border border-slate-700'
                          }`}>
                            <Globe size={10} />
                            {bucket.visibility}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">Created: {new Date(bucket.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                         onClick={(e) => toggleVisibility(e, bucket.id, bucket.visibility)}
                         className={`p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-widest border ${
                           bucket.visibility === 'public'
                             ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                             : 'bg-slate-800/50 text-slate-500 border-slate-700 hover:text-slate-300 hover:border-slate-600'
                         }`}
                         title={`Set to ${bucket.visibility === 'public' ? 'Private' : 'Public'}`}
                      >
                         <Globe size={14} />
                         {visibilityMutation.isPending && visibilityMutation.variables?.id === bucket.id ? <Loader2 size={14} className="animate-spin" /> : null}
                      </button>
                      <button 
                        onClick={(e) => handleDeleteBucket(e, bucket.id)}
                        className="p-2 hover:bg-rose-500/20 rounded-lg text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-rose-500/30"
                      >
                        <Trash2 size={16} />
                      </button>
                      <ArrowUpRight size={18} className="text-slate-600 group-hover:text-white transition-all transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <p className="text-center py-10 text-slate-500 italic">No buckets created yet.</p>
            )}
          </div>
        </div>

        {/* Real-time Throughput */}
        {isOverview && (
          <Card className="flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-6">Throughput</h3>
            <div className="flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-xs text-slate-400">Incoming</span>
                  <span className="text-sm font-mono text-emerald-400">{metrics?.throughput?.in || '0 MB/s'}</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-1000 ease-in-out shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                    style={{ width: `${metrics?.throughput?.inPulse || 5}%` }}
                  />
                </div>

                <div className="flex justify-between items-end">
                  <span className="text-xs text-slate-400">Outgoing</span>
                  <span className="text-sm font-mono text-indigo-400">{metrics?.throughput?.out || '0 MB/s'}</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 transition-all duration-1000 ease-in-out shadow-[0_0_10px_rgba(99,102,241,0.3)]" 
                    style={{ width: `${metrics?.throughput?.outPulse || 5}%` }}
                  />
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-700/50">
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">I/O Wait</span>
                    <span className="text-slate-300">0.1ms</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Disk Queue</span>
                    <span className="text-slate-300">0.00</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Create Bucket Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Create New Bucket"
      >
        <form onSubmit={handleCreateBucket} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-slate-400 ml-1">Bucket Name</label>
            <input
              autoFocus
              type="text"
              placeholder="e.g. static-assets"
              value={newBucketName}
              onChange={(e) => setNewBucketName(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            <p className="text-[10px] text-slate-500 px-1">Lower case, numbers, dots and hyphens only.</p>
          </div>
          <button 
            type="submit" 
            disabled={!newBucketName || createBucketMutation.isPending}
            className="btn-primary w-full justify-center mt-2 h-12"
          >
            {createBucketMutation.isPending ? <Loader2 className="animate-spin" /> : 'Create Bucket'}
          </button>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Bucket"
      >
        <div className="space-y-6">
          <p className="text-slate-300 text-sm">
            Are you sure you want to delete this bucket? All objects within it will be permanently removed.
          </p>
          <div className="flex gap-3">
            <button 
              className="btn-secondary flex-1 justify-center"
              onClick={() => setDeleteConfirmId(null)}
            >
              Cancel
            </button>
            <button 
              className="bg-rose-600 hover:bg-rose-500 text-white rounded-lg px-4 py-2 flex-1 font-medium transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20"
              onClick={() => deleteConfirmId && deleteBucketMutation.mutate(deleteConfirmId)}
              disabled={deleteBucketMutation.isPending}
            >
              {deleteBucketMutation.isPending ? <Loader2 className="animate-spin" /> : <Trash2 size={18} />}
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
