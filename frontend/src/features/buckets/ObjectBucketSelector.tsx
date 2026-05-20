import { useQuery } from '@tanstack/react-query';
import { getBuckets } from '../../lib/api';
import { Card } from '../../components/ui/DashboardElements';
import { FolderOpen, ArrowRight, Loader2, Globe, Lock } from 'lucide-react';

interface ObjectBucketSelectorProps {
  onSelectBucket: (name: string) => void;
}

export function ObjectBucketSelector({ onSelectBucket }: ObjectBucketSelectorProps) {
  const { data: buckets = [], isLoading } = useQuery({
    queryKey: ['buckets'],
    queryFn: getBuckets
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white mb-1">Objects Browser</h2>
        <p className="text-slate-400">Select a bucket below to browse, upload, and manage your stored files.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-indigo-500" size={40} />
        </div>
      ) : buckets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {buckets.map((bucket: any) => (
            <Card 
              key={bucket.id} 
              className="p-6 hover:bg-slate-700/20 transition-all cursor-pointer group hover:border-indigo-500/40 relative overflow-hidden"
              onClick={() => onSelectBucket(bucket.name)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 transition-all group-hover:bg-indigo-500 group-hover:text-white group-hover:scale-110">
                    <FolderOpen size={24} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg text-white group-hover:text-indigo-300 transition-colors">
                      {bucket.name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Created: {new Date(bucket.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 border ${
                  bucket.visibility === 'public'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-slate-800 text-slate-500 border-slate-700'
                }`}>
                  {bucket.visibility === 'public' ? <Globe size={10} /> : <Lock size={10} />}
                  {bucket.visibility}
                </span>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-700/50 flex justify-between items-center text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-indigo-400 transition-colors">
                <span>Browse Objects</span>
                <ArrowRight size={16} className="transform transition-transform group-hover:translate-x-1.5" />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 glass-card rounded-2xl border-dashed border-2 border-slate-700 max-w-lg mx-auto">
          <FolderOpen size={48} className="mx-auto text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-white">No buckets created yet</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-xs mx-auto">
            You must create a storage bucket before you can upload or browse objects.
          </p>
        </div>
      )}
    </div>
  );
}
