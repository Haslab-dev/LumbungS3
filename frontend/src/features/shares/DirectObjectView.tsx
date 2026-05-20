import { useState, useEffect } from 'react';
import { 
  FileIcon, 
  ImageIcon, 
  Video, 
  Music, 
  FileText, 
  Download, 
  Loader2, 
  Database,
  Lock
} from 'lucide-react';
import axios from 'axios';

interface DirectObjectViewProps {
  bucketName: string;
  objectKey: string;
}

export function DirectObjectView({ bucketName, objectKey }: DirectObjectViewProps) {
  const [loading, setLoading] = useState(true);
  const [fileData, setFileData] = useState<{ size: number; contentType: string } | null>(null);

  // Preserve any authentication/presigned query parameters that were on the URL
  const searchParams = new URLSearchParams(window.location.search);
  searchParams.set('raw', 'true'); // Ensure we don't cause an infinite redirect loop
  const rawDownloadUrl = `${window.location.origin}/objects/${bucketName}/${objectKey}?${searchParams.toString()}`;

  useEffect(() => {
    // Perform a HEAD request to fetch the object metadata (size and content-type)
    axios.head(rawDownloadUrl)
      .then((res) => {
        setFileData({
          size: parseInt(res.headers['content-length'] || '0', 10),
          contentType: res.headers['content-type'] || 'application/octet-stream',
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load object metadata:', err);
        setLoading(false);
      });
  }, [rawDownloadUrl]);

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
    const ext = objectKey.split('.').pop()?.toLowerCase();

    if (activeContentType === 'application/octet-stream' && ext) {
      const mimeMap: Record<string, string> = {
        'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'gif': 'image/gif', 'webp': 'image/webp',
        'mp4': 'video/mp4', 'webm': 'video/webm', 'mp3': 'audio/mpeg', 'wav': 'audio/wav',
        'pdf': 'application/pdf', 'txt': 'text/plain'
      };
      if (mimeMap[ext]) activeContentType = mimeMap[ext];
    }

    if (activeContentType.startsWith('image/')) {
      return (
        <div className="flex items-center justify-center p-4 w-full h-full bg-transparent overflow-hidden">
          <img 
            src={rawDownloadUrl} 
            alt={objectKey} 
            className="max-h-full max-w-full w-auto object-contain shadow-2xl hover:scale-[1.01] transition-transform duration-300"
          />
        </div>
      );
    }
    
    if (activeContentType.startsWith('video/')) {
      return (
        <div className="flex items-center justify-center w-full h-full bg-black overflow-hidden">
          <video controls className="max-h-full max-w-full w-full shadow-2xl" autoPlay>
            <source src={rawDownloadUrl} type={activeContentType} />
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    if (activeContentType.startsWith('audio/')) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full">
          <div className="w-24 h-24 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mb-8 border border-emerald-500/20 shadow-lg shadow-emerald-500/5 pulse">
            <Music size={48} />
          </div>
          <audio controls className="w-full max-w-xl">
            <source src={rawDownloadUrl} type={activeContentType} />
            Your browser does not support the audio tag.
          </audio>
        </div>
      );
    }

    if (activeContentType === 'application/pdf') {
      return (
        <div className="w-full h-full bg-slate-900 relative">
          <iframe 
            src={`${rawDownloadUrl}#toolbar=0`} 
            className="w-full h-full border-none relative z-10" 
            title="PDF Preview" 
          />
        </div>
      );
    }

    const isOffice = ext && ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);
    if (isOffice) {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      if (isLocalhost) {
        return (
          <div className="flex flex-col items-center justify-center w-full h-full p-6 text-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mb-6 border border-amber-500/20 shadow-lg shadow-amber-500/10">
              <FileText size={32} />
            </div>
            <h4 className="text-white font-bold text-lg mb-2">💻 Local Dev Preview Mode</h4>
            <p className="text-slate-400 text-xs leading-relaxed mb-6 max-w-md">
              Microsoft Office Web Viewer requires a publicly accessible internet URL to render this file. 
              <br />
              <span className="text-slate-500 italic mt-1.5 block font-medium">When deployed in production, this Word/Excel document will load and render automatically!</span>
            </p>
          </div>
        );
      }
      
      const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(rawDownloadUrl)}`;
      return (
        <div className="w-full h-full bg-slate-950 relative">
          <iframe 
            src={officeUrl} 
            className="w-full h-full border-none relative z-10 bg-white" 
            title="Office Document Preview" 
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center w-full h-full p-6">
        <div className="w-20 h-20 bg-slate-800/50 text-slate-400 rounded-2xl flex items-center justify-center mb-6 border border-slate-700/50">
          <FileIcon size={40} className="text-slate-500" />
        </div>
        <h4 className="text-white font-semibold mb-2 text-lg">Preview not available</h4>
        <p className="text-slate-500 text-sm text-center max-w-sm">
          This {activeContentType || 'unknown'} file type cannot be previewed natively in the browser.
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
            <h3 className="text-lg font-bold text-white">Opening Viewer</h3>
            <p className="text-slate-500 text-sm">Fetching object metadata...</p>
          </div>
        </div>
      </div>
    );
  }

  const fileName = objectKey.split('/').pop() || 'Unknown File';

  return (
    <div className="h-screen w-full bg-slate-950 flex flex-col overflow-hidden font-sans">
      {/* Sleek, minimalist top header bar */}
      <header className="flex items-center justify-between px-4 md:px-6 py-3 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80 shrink-0 z-20">
        <div className="flex items-center gap-4 overflow-hidden">
          <div 
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/50 cursor-pointer transition-all shadow-md group shrink-0"
            onClick={() => window.location.href = '/'}
            title="Back to LumbungS3"
          >
            <Database className="text-indigo-400 group-hover:scale-110 transition-transform" size={18} />
          </div>
          
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-slate-800/50 rounded-lg border border-slate-700/30 shrink-0">
              {fileData && getFileIcon(fileData.contentType, objectKey)}
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-sm font-semibold text-slate-200 truncate pr-4" title={decodeURIComponent(fileName)}>
                {decodeURIComponent(fileName)}
              </h1>
              {fileData && (
                <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                  <span className="uppercase tracking-wider text-indigo-400/80">{fileData.contentType.split(';')[0]}</span>
                  <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                  <span>{formatSize(fileData.size)}</span>
                  <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                  <span className="flex items-center gap-1 text-emerald-500/80">
                    <Lock size={10} /> Public
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <a 
            href={rawDownloadUrl}
            download={decodeURIComponent(fileName)}
            className="flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Download</span>
          </a>
        </div>
      </header>

      {/* Main Full-Screen Preview Area */}
      <main className="flex-1 w-full relative bg-slate-950 flex items-center justify-center overflow-hidden">
        {/* Subtle background glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="w-full h-full relative z-10 flex flex-col">
          {renderPreview()}
        </div>
      </main>
    </div>
  );
}
