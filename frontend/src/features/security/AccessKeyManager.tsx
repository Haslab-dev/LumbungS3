import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui/DashboardElements';
import { Modal } from '../../components/ui/Modal';
import { Key, Plus, Trash2, Copy, Loader2, ShieldCheck, ShieldAlert, Globe, Check } from 'lucide-react';
import api, { getBuckets, getCorsRules, saveCorsRule, deleteCorsRule } from '../../lib/api';

export function AccessKeyManager() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'keys' | 'cors'>('keys');
  const [newKeyData, setNewKeyData] = useState<any>(null);
  
  // CORS states
  const [isCorsModalOpen, setIsCorsModalOpen] = useState(false);
  const [selectedBucketId, setSelectedBucketId] = useState('');
  const [allowedOrigins, setAllowedOrigins] = useState('*');
  const [allowedMethods, setAllowedMethods] = useState<string[]>(['GET']);
  const [allowedHeaders, setAllowedHeaders] = useState('*');
  const [maxAge, setMaxAge] = useState(3600);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Queries
  const { data: keys = [], isLoading: keysLoading } = useQuery({
    queryKey: ['access-keys'],
    queryFn: async () => {
      const res = await api.get('/keys');
      return res.data;
    }
  });

  const { data: buckets = [] } = useQuery({
    queryKey: ['buckets'],
    queryFn: getBuckets
  });

  const { data: corsRules = [], isLoading: corsLoading } = useQuery({
    queryKey: ['cors-rules'],
    queryFn: getCorsRules
  });

  // Mutations
  const createKeyMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/keys');
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['access-keys'] });
      setNewKeyData(data);
    }
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/keys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-keys'] });
    }
  });

  const saveCorsMutation = useMutation({
    mutationFn: saveCorsRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cors-rules'] });
      setIsCorsModalOpen(false);
      triggerToast('CORS rule saved successfully');
      // Reset form
      setSelectedBucketId('');
      setAllowedOrigins('*');
      setAllowedMethods(['GET']);
      setAllowedHeaders('*');
      setMaxAge(3600);
    }
  });

  const deleteCorsMutation = useMutation({
    mutationFn: deleteCorsRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cors-rules'] });
      triggerToast('CORS rule deleted');
    }
  });

  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    triggerToast('Copied to clipboard!');
  };

  const handleMethodToggle = (method: string) => {
    if (allowedMethods.includes(method)) {
      setAllowedMethods(allowedMethods.filter(m => m !== method));
    } else {
      setAllowedMethods([...allowedMethods, method]);
    }
  };

  const handleSaveCors = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBucketId || !allowedOrigins || allowedMethods.length === 0) return;
    
    saveCorsMutation.mutate({
      bucketId: selectedBucketId,
      allowedOrigins,
      allowedMethods: allowedMethods.join(','),
      allowedHeaders,
      maxAge
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Toast */}
      {successToast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 border border-indigo-500/30 text-emerald-400 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 z-50 backdrop-blur-xl">
          <Check size={18} />
          <span className="text-sm font-semibold">{successToast}</span>
        </div>
      )}

      {/* Header Container (Fully Responsive Grid/Flex) */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-1">Security & Access</h2>
          <p className="text-slate-400 text-sm">Manage S3 API credentials and Cross-Origin Resource Sharing (CORS) rules.</p>
        </div>
        
        {activeTab === 'keys' ? (
          <button 
            className="btn-primary w-full sm:w-auto justify-center" 
            onClick={() => createKeyMutation.mutate()}
            disabled={createKeyMutation.isPending}
          >
            {createKeyMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
            Generate New Key
          </button>
        ) : (
          <button 
            className="btn-primary w-full sm:w-auto justify-center" 
            onClick={() => setIsCorsModalOpen(true)}
          >
            <Plus size={18} />
            Add CORS Rule
          </button>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('keys')}
          className={`pb-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'keys'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Access Keys (IAM)
        </button>
        <button
          onClick={() => setActiveTab('cors')}
          className={`pb-4 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'cors'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          CORS Configuration
        </button>
      </div>

      {/* Tab Content: Access Keys */}
      {activeTab === 'keys' && (
        <div className="grid grid-cols-1 gap-6">
          {keysLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-indigo-500" size={40} />
            </div>
          ) : keys.length > 0 ? (
            keys.map((key: any) => (
              <Card key={key.id} className="p-6 border-slate-700/50 hover:border-slate-600/50 transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-4 flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shrink-0">
                        <Key size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Access Key ID</p>
                        <code className="text-sm text-white font-mono block sm:inline break-all">{key.accessKey}</code>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700 shrink-0">
                        <ShieldCheck size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Secret Access Key</p>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <code className="text-sm text-slate-300 font-mono break-all leading-none select-none">
                            ••••••••••••••••••••••••••••••••
                          </code>
                          <span className="text-[9px] text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded italic w-max sm:ml-1">Hidden for security</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-2 border-t border-slate-800/60 md:border-t-0 pt-4 md:pt-0">
                    <span className="text-xs px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full font-bold border border-emerald-500/20 md:mr-4">
                      Active
                    </span>
                    <button 
                      onClick={() => deleteKeyMutation.mutate(key.id)}
                      className="p-3 hover:bg-rose-500/20 rounded-xl text-slate-500 hover:text-rose-400 transition-all border border-transparent hover:border-rose-500/30 cursor-pointer"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center py-20 glass-card rounded-2xl border-dashed border-2 border-slate-700">
              <ShieldAlert size={48} className="mx-auto text-slate-600 mb-4" />
              <h3 className="text-lg font-medium text-white">No access keys found</h3>
              <p className="text-slate-500 text-sm mt-1">Generate a key to start using the S3 API.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: CORS Rules */}
      {activeTab === 'cors' && (
        <div className="grid grid-cols-1 gap-6">
          {corsLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-indigo-500" size={40} />
            </div>
          ) : corsRules.length > 0 ? (
            corsRules.map((rule: any) => {
              const bucket = buckets.find((b: any) => b.id === rule.bucketId);
              return (
                <Card key={rule.id} className="p-6 border-slate-700/50 hover:border-slate-600/50 transition-all">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-4 flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shrink-0">
                          <Globe size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Bucket Scope</p>
                          <span className="text-sm font-semibold text-white">{bucket?.name || 'Unknown Bucket'}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pl-1">
                        <div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Allowed Origins</p>
                          <code className="text-xs text-slate-300 font-mono break-all">{rule.allowedOrigins}</code>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Allowed Methods</p>
                          <span className="text-xs text-indigo-400 font-semibold">{rule.allowedMethods}</span>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Max Age</p>
                          <span className="text-xs text-slate-300 font-mono">{rule.maxAge} seconds</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end border-t border-slate-800/60 lg:border-t-0 pt-4 lg:pt-0">
                      <button 
                        onClick={() => deleteCorsMutation.mutate(rule.id)}
                        className="p-3 hover:bg-rose-500/20 rounded-xl text-slate-500 hover:text-rose-400 transition-all border border-transparent hover:border-rose-500/30 cursor-pointer"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })
          ) : (
            <div className="text-center py-20 glass-card rounded-2xl border-dashed border-2 border-slate-700">
              <Globe size={48} className="mx-auto text-slate-600 mb-4" />
              <h3 className="text-lg font-medium text-white">No CORS rules defined</h3>
              <p className="text-slate-500 text-sm mt-1">Add a CORS rule to allow S3 access from other origins.</p>
            </div>
          )}
        </div>
      )}

      {/* New Key Success Modal */}
      <Modal
        isOpen={!!newKeyData}
        onClose={() => setNewKeyData(null)}
        title="Key Generated Successfully"
      >
        <div className="space-y-6">
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <p className="text-xs text-amber-500 font-bold flex items-center gap-2">
              <ShieldAlert size={14} />
              IMPORTANT: SAVE THIS SECRET KEY
            </p>
            <p className="text-[10px] text-amber-500/80 mt-1 leading-relaxed">
              This is the only time you will see this secret key. We do not store it in plain text.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-500 mb-1 font-bold uppercase">Access Key ID</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-slate-900 p-3 rounded-lg text-indigo-400 font-mono text-sm border border-slate-800 break-all select-all">
                  {newKeyData?.accessKey}
                </code>
                <button 
                  onClick={() => copyToClipboard(newKeyData?.accessKey)}
                  className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all shrink-0 cursor-pointer"
                >
                  <Copy size={18} />
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1 font-bold uppercase">Secret Access Key</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-slate-900 p-3 rounded-lg text-emerald-400 font-mono text-sm border border-slate-800 break-all select-all">
                  {newKeyData?.secretKey}
                </code>
                <button 
                  onClick={() => copyToClipboard(newKeyData?.secretKey)}
                  className="p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all shrink-0 cursor-pointer"
                >
                  <Copy size={18} />
                </button>
              </div>
            </div>
          </div>

          <button 
            className="btn-primary w-full justify-center h-12 cursor-pointer"
            onClick={() => setNewKeyData(null)}
          >
            I have saved the key
          </button>
        </div>
      </Modal>

      {/* CORS Configuration Modal */}
      <Modal
        isOpen={isCorsModalOpen}
        onClose={() => setIsCorsModalOpen(false)}
        title="Add CORS Rule"
      >
        <form onSubmit={handleSaveCors} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Select Bucket</label>
            <select
              required
              value={selectedBucketId}
              onChange={(e) => setSelectedBucketId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="">-- Choose a Bucket --</option>
              {buckets.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Allowed Origins</label>
            <input
              type="text"
              required
              placeholder="e.g. *, https://my-app.com"
              value={allowedOrigins}
              onChange={(e) => setAllowedOrigins(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <p className="text-[10px] text-slate-500 mt-1">Comma-separated list of origins allowed to access the bucket. Use * to allow all.</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Allowed Methods</label>
            <div className="flex flex-wrap gap-2.5">
              {['GET', 'PUT', 'POST', 'DELETE', 'HEAD'].map((method) => {
                const isChecked = allowedMethods.includes(method);
                return (
                  <button
                    type="button"
                    key={method}
                    onClick={() => handleMethodToggle(method)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {method}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Allowed Headers</label>
            <input
              type="text"
              placeholder="e.g. *, Authorization, Content-Type"
              value={allowedHeaders}
              onChange={(e) => setAllowedHeaders(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Max Age (Seconds)</label>
            <input
              type="number"
              placeholder="3600"
              value={maxAge}
              onChange={(e) => setMaxAge(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsCorsModalOpen(false)}
              className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveCorsMutation.isPending || !selectedBucketId || allowedMethods.length === 0}
              className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              {saveCorsMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : null}
              Save Settings
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
