import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui/DashboardElements';
import { Modal } from '../../components/ui/Modal';
import { Key, Plus, Trash2, Copy, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import api from '../../lib/api';

export function AccessKeyManager() {
  const queryClient = useQueryClient();
  const [newKeyData, setNewKeyData] = useState<any>(null);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['access-keys'],
    queryFn: async () => {
      const res = await api.get('/keys');
      return res.data;
    }
  });

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white mb-1">Access Keys</h2>
          <p className="text-slate-400">Manage credentials for S3 API access. Keep your secret keys safe.</p>
        </div>
        <button 
          className="btn-primary" 
          onClick={() => createKeyMutation.mutate()}
          disabled={createKeyMutation.isPending}
        >
          {createKeyMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
          Generate New Key
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-indigo-500" size={40} />
          </div>
        ) : keys.length > 0 ? (
          keys.map((key: any) => (
            <Card key={key.id} className="p-6 border-slate-700/50 hover:border-slate-600/50 transition-all">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                      <Key size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Access Key ID</p>
                      <code className="text-sm text-white font-mono">{key.accessKey}</code>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700">
                      <ShieldCheck size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Secret Access Key</p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm text-slate-300 font-mono">
                          ••••••••••••••••••••••••••••••••
                        </code>
                        <span className="text-[10px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded italic">Hidden for security</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <span className="text-xs px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full font-bold border border-emerald-500/20 mr-4">
                    Active
                  </span>
                  <button 
                    onClick={() => deleteKeyMutation.mutate(key.id)}
                    className="p-3 hover:bg-rose-500/20 rounded-xl text-slate-500 hover:text-rose-400 transition-all border border-transparent hover:border-rose-500/30"
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
            <p className="text-[10px] text-amber-500/80 mt-1">
              This is the only time you will see this secret key. We do not store it in plain text.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-500 mb-1 font-bold uppercase">Access Key ID</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-slate-900 p-3 rounded-lg text-indigo-400 font-mono text-sm border border-slate-800">
                  {newKeyData?.accessKey}
                </code>
                <button 
                  onClick={() => copyToClipboard(newKeyData?.accessKey)}
                  className="p-3 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all"
                >
                  <Copy size={18} />
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1 font-bold uppercase">Secret Access Key</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-slate-900 p-3 rounded-lg text-emerald-400 font-mono text-sm border border-slate-800 break-all">
                  {newKeyData?.secretKey}
                </code>
                <button 
                  onClick={() => copyToClipboard(newKeyData?.secretKey)}
                  className="p-3 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all"
                >
                  <Copy size={18} />
                </button>
              </div>
            </div>
          </div>

          <button 
            className="btn-primary w-full justify-center h-12"
            onClick={() => setNewKeyData(null)}
          >
            I have saved the key
          </button>
        </div>
      </Modal>
    </div>
  );
}
