import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { createShare } from '../../lib/api';
import { Link2, Copy, Check, Calendar, Clock, Loader2, Sparkles } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  bucketName: string;
  objectKey: string;
}

export function ShareModal({ isOpen, onClose, bucketName, objectKey }: ShareModalProps) {
  const queryClient = useQueryClient();
  const [expiryOption, setExpiryOption] = useState('never');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  const shareMutation = useMutation({
    mutationFn: () => {
      let expiresAt: string | undefined;
      const now = new Date();
      if (expiryOption === '1h') {
        expiresAt = new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString();
      } else if (expiryOption === '24h') {
        expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      } else if (expiryOption === '7d') {
        expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      }
      return createShare(bucketName, objectKey, expiresAt);
    },
    onSuccess: (data) => {
      const shareUrl = `${window.location.origin}/share/${data.id}`;
      setGeneratedLink(shareUrl);
      queryClient.invalidateQueries({ queryKey: ['shares'] });
    }
  });

  const handleGenerate = () => {
    shareMutation.mutate();
  };

  const handleCopy = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetAndClose = () => {
    setGeneratedLink('');
    setExpiryOption('never');
    setCopied(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title="Share File">
      <div className="space-y-6">
        <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-4 flex gap-3 items-start">
          <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
            <Sparkles size={18} />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Shareable Link</h4>
            <p className="text-xs text-slate-400 line-clamp-1 break-all">
              {objectKey.split('/').pop()}
            </p>
          </div>
        </div>

        {!generatedLink ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 ml-1">
                <Clock size={14} />
                Link Expiration
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'never', label: 'Never' },
                  { id: '1h', label: '1 Hour' },
                  { id: '24h', label: '24 Hours' },
                  { id: '7d', label: '7 Days' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setExpiryOption(opt.id)}
                    className={`py-3 px-4 rounded-xl border text-sm font-medium transition-all ${
                      expiryOption === opt.id
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-600/10'
                        : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={shareMutation.isPending}
              className="btn-primary w-full justify-center h-12 mt-2 gap-2"
            >
              {shareMutation.isPending ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Link2 size={18} />
              )}
              {shareMutation.isPending ? 'Generating...' : 'Create Share Link'}
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 ml-1">
                <Calendar size={14} />
                Your Share Link is Ready!
              </label>
              <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700/50 rounded-xl p-2 pl-4">
                <span className="text-xs font-mono text-slate-400 select-all truncate flex-1">
                  {generatedLink}
                </span>
                <button
                  onClick={handleCopy}
                  className={`p-2.5 rounded-lg transition-all border flex items-center justify-center gap-1 text-xs font-bold ${
                    copied
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setGeneratedLink('')}
                className="btn-secondary flex-1 justify-center h-11"
              >
                Create Another
              </button>
              <button
                onClick={resetAndClose}
                className="btn-primary flex-1 justify-center h-11"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
