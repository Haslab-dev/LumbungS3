import { useState, useEffect } from 'react';
import { 
  FileIcon, 
  ImageIcon, 
  Video, 
  Music, 
  FileText, 
  Download, 
  Loader2, 
  ShieldAlert, 
  Clock, 
  Calendar, 
  Database,
  ArrowRight,
  Sparkles,
  Lock
} from 'lucide-react';
import { getPublicShare } from '../../lib/api';

interface PublicShareViewProps {
  shareId: string;
}

export function PublicShareView({ shareId }: PublicShareViewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [fileData, setFileData] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setIsExpired(false);
    
    getPublicShare(shareId)
      .then((data) => {
        setFileData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load shared file:', err);
        const status = err.response?.status;
        if (status === 410) {
          setIsExpired(true);
          setError('This share link has expired.');
        } else if (status === 404) {
          setError('This share link was not found or has been revoked.');
        } else {
          setError(err.response?.data?.error || 'Failed to load the shared file. Please try again.');
        }
        setLoading(false);
      });
  }, [shareId]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (contentType: string, key: string) => {
    let type = contentType;
    if (type === 'application/octet-stream') {
      const ext = key.split('.').pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'gif': 'image/gif', 'webp': 'image/webp',
        'mp4': 'video/mp4', 'webm': 'video/webm', 'mp3': 'audio/mpeg', 'wav': 'audio/wav',
        'pdf': 'application/pdf', 'txt': 'text/plain'
      };
      if (ext && mimeMap[ext]) type = mimeMap[ext];
    }

    if (type.startsWith('image/')) return <ImageIcon size={48} className="text-sky-400" />;
    if (type.startsWith('video/')) return <Video size={48} className="text-amber-400" />;
    if (type.startsWith('audio/')) return <Music size={48} className="text-emerald-400" />;
    if (type === 'application/pdf') return <FileText size={48} className="text-rose-400" />;
    return <FileIcon size={48} className="text-indigo-400" />;
  };

  const renderPreview = () => {
    if (!fileData) return null;

    let activeContentType = fileData.contentType;
    if (activeContentType === 'application/octet-stream') {
      const ext = fileData.key.split('.').pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'gif': 'image/gif', 'webp': 'image/webp',
        'mp4': 'video/mp4', 'webm': 'video/webm', 'mp3': 'audio/mpeg', 'wav': 'audio/wav',
        'pdf': 'application/pdf', 'txt': 'text/plain'
      };
      if (ext && mimeMap[ext]) activeContentType = mimeMap[ext];
    }

    // Since our backend endpoint creates a fully signed temporary URL including signature
    const previewUrl = fileData.downloadUrl;

    if (activeContentType.startsWith('image/')) {
      return (
        <div className="flex items-center justify-center p-4 bg-slate-950/40 rounded-2xl border border-slate-800/80 overflow-hidden max-h-[500px]">
          <img 
            src={previewUrl} 
            alt={fileData.key} 
            className="max-h-[460px] w-auto rounded-xl object-contain shadow-2xl hover:scale-[1.01] transition-transform duration-300"
          />
        </div>
      );
    }
    
    if (activeContentType.startsWith('video/')) {
      return (
        <div className="flex items-center justify-center bg-slate-950/40 rounded-2xl border border-slate-800/80 overflow-hidden max-h-[500px] w-full">
          <video controls className="max-h-[460px] w-full rounded-xl shadow-2xl" autoPlay muted={false}>
            <source src={previewUrl} type={activeContentType} />
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    if (activeContentType.startsWith('audio/')) {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-6 bg-slate-950/30 rounded-2xl border border-slate-800/80">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mb-4 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
            <Music size={32} />
          </div>
          <audio controls className="w-full max-w-md">
            <source src={previewUrl} type={activeContentType} />
            Your browser does not support the audio tag.
          </audio>
        </div>
      );
    }

    if (activeContentType === 'application/pdf') {
      return (
        <div className="w-full h-[600px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl">
          <iframe 
            src={`${previewUrl}#toolbar=0`} 
            className="w-full h-full border-none" 
            title="PDF Preview" 
          />
        </div>
      );
    }

    // Default file icon preview fallback
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 bg-slate-950/20 rounded-2xl border border-slate-850 border-dashed">
        <div className="w-20 h-20 bg-slate-800/50 text-slate-400 rounded-2xl flex items-center justify-center mb-4 border border-slate-700/50">
          <FileIcon size={40} className="text-slate-500" />
        </div>
        <h4 className="text-white font-semibold mb-1 text-sm">Preview not available</h4>
        <p className="text-slate-500 text-xs text-center max-w-xs">
          This {activeContentType || 'unknown'} file type cannot be previewed in the browser. You can still download the file below.
        </p>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-900 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-indigo-500 mx-auto" size={48} />
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">Retrieving Shared File</h3>
            <p className="text-slate-500 text-sm">Connecting securely and fetching file metadata...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || isExpired) {
    return (
      <div className="min-h-screen bg-surface-900 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md glass-card rounded-3xl p-8 border border-rose-500/20 shadow-2xl shadow-rose-950/10">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20 text-rose-400 shadow-inner">
              <ShieldAlert size={48} className="animate-pulse" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">
                {isExpired ? 'Share Link Expired' : 'Access Denied'}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {error || 'This link is no longer valid, has been deleted, or may have expired.'}
              </p>
            </div>

            <div className="w-full h-px bg-slate-800/80 my-2"></div>

            <div className="space-y-3 w-full">
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900/40 p-3 rounded-xl border border-slate-800/80 text-left">
                <Lock size={14} className="text-slate-600 shrink-0" />
                <span>Links can expire based on custom rules set by the owner, or be revoked instantly at any time.</span>
              </div>
              
              <a 
                href="/"
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-700/50"
              >
                Go to LumbungS3
                <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const fileName = fileData.key.split('/').pop();

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col p-4 md:p-8">
      {/* Top Header Logo */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-4 mb-6">
        <div className="flex items-center gap-3 cursor-pointer">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Database className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight text-white flex items-center gap-1.5">
              LumbungS3
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-indigo-500/20">
                Shared Space
              </span>
            </h1>
            <p className="text-[10px] text-slate-500">Secure Peer-to-Peer Cloud Storage</p>
          </div>
        </div>
      </header>

      {/* Main Shared Content Container */}
      <main className="max-w-4xl w-full mx-auto flex-1 flex flex-col justify-center py-6">
        <div className="glass-card rounded-3xl overflow-hidden border border-slate-800/80 shadow-2xl flex flex-col">
          {/* Top Decorative bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
          
          <div className="p-6 md:p-8 space-y-6">
            {/* File Info Block */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-6 rounded-2xl border border-slate-800/80">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-slate-850 rounded-xl border border-slate-700/30 shadow-md">
                  {getFileIcon(fileData.contentType, fileData.key)}
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-white break-all line-clamp-2" title={fileName}>
                    {fileName}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                    <span>{formatSize(fileData.size)}</span>
                    <span className="w-1.5 h-1.5 bg-slate-700 rounded-full"></span>
                    <span className="uppercase tracking-wider text-[10px] text-indigo-400 font-bold">{fileData.contentType.split(';')[0]}</span>
                  </div>
                </div>
              </div>

              {/* Grand Action Button */}
              <a 
                href={fileData.downloadUrl}
                download={fileName}
                className="btn-primary py-3 px-6 h-12 md:self-center font-bold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 border border-indigo-500/20 shadow-xl shadow-indigo-600/20 active:scale-95 transition-all text-white flex items-center justify-center gap-2.5 rounded-xl shrink-0"
              >
                <Download size={18} />
                Download File
              </a>
            </div>

            {/* In-Browser Preview Window */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                <Sparkles size={14} className="text-indigo-400" />
                Live Secure Preview
              </h3>
              {renderPreview()}
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Timeline Info */}
              <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-800/50 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-500" />
                  Link History
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-850/50">
                    <span className="text-slate-500">Shared On</span>
                    <span className="text-slate-300 font-medium">{new Date(fileData.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Expiration</span>
                    <span className="text-slate-300 font-medium">
                      {fileData.expiresAt ? (
                        <span className="text-amber-400 flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(fileData.expiresAt).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-bold">Never Expires</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bucket Security Info */}
              <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-800/50 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock size={14} className="text-slate-500" />
                  Security Details
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-850/50">
                    <span className="text-slate-500">Node Identifier</span>
                    <span className="text-indigo-400 font-bold uppercase tracking-wider">{fileData.bucketName}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Access Type</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <Sparkles size={12} className="text-emerald-400 animate-pulse" />
                      Temporary Signed Token
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-6xl w-full mx-auto text-center py-6 text-[10px] text-slate-600 border-t border-slate-850 mt-8">
        <p>© 2026 LumbungS3 - Premium Serverless Object Storage. Powering high performance data dissemination.</p>
      </footer>
    </div>
  );
}
