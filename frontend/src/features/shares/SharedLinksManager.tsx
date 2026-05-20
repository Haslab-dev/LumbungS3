import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui/DashboardElements';
import { getShares, revokeShare } from '../../lib/api';
import { Link2, Trash2, Check, Loader2, File, ShieldAlert, Clock } from 'lucide-react';

export function SharedLinksManager() {
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: shares = [], isLoading } = useQuery({
    queryKey: ['shares'],
    queryFn: getShares
  });

  const revokeMutation = useMutation({
    mutationFn: revokeShare,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shares'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    }
  });

  const handleCopy = (id: string) => {
    const link = `${window.location.origin}/share/${id}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white mb-1">Shared Links</h2>
        <p className="text-slate-400">View and manage all active file sharing links generated for your storage nodes.</p>
      </div>

      <Card className="p-0 overflow-hidden border-slate-700/30 bg-slate-900/30">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/30">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">File Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Size</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Bucket</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Expires At</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Created</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-36"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin text-indigo-500 mx-auto" size={32} />
                  </td>
                </tr>
              ) : shares.length > 0 ? (
                shares.map((share: any) => (
                  <tr key={share.id} className="hover:bg-slate-700/10 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center border bg-slate-800 text-indigo-400 border-slate-700 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/30 transition-all">
                          <File size={16} />
                        </div>
                        <span className="text-sm font-medium text-white truncate max-w-xs" title={share.key}>
                          {share.key.split('/').pop()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400 font-mono">
                      {formatSize(share.size)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-indigo-500/20">
                        {share.bucketName}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {share.expiresAt ? (
                        <span className="flex items-center gap-1.5 text-xs text-amber-400">
                          <Clock size={14} />
                          {new Date(share.expiresAt).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-400 font-medium">Never</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 text-xs">
                      {new Date(share.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopy(share.id)}
                          className={`p-2 rounded-lg transition-all border ${
                            copiedId === share.id
                              ? 'bg-emerald-500/25 text-emerald-400 border-emerald-500/30'
                              : 'hover:bg-slate-700 text-slate-400 hover:text-white border-transparent'
                          }`}
                          title="Copy Shareable Link"
                        >
                          {copiedId === share.id ? <Check size={16} /> : <Link2 size={16} />}
                        </button>
                        <button
                          onClick={() => revokeMutation.mutate(share.id)}
                          disabled={revokeMutation.isPending && revokeMutation.variables === share.id}
                          className="p-2 hover:bg-rose-500/20 rounded-lg text-slate-500 hover:text-rose-400 transition-all border border-transparent hover:border-rose-500/30"
                          title="Revoke Shareable Link"
                        >
                          {revokeMutation.isPending && revokeMutation.variables === share.id ? (
                            <Loader2 className="animate-spin" size={16} />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
                      <div className="p-4 bg-slate-800/40 rounded-full border border-slate-700/50">
                        <ShieldAlert size={36} className="text-slate-600" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-base font-semibold text-slate-300">No Shared Links</h4>
                        <p className="text-xs text-slate-500">Shared files will appear here. Share any file inside your buckets to get started.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
