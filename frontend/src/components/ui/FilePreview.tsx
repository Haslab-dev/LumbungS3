import { FileText, Image as ImageIcon, Video, Music, File as FileIcon, X, Download, Share2, Copy, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { presignObject, BASE_URL } from '../../lib/api';

interface FilePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  bucketName: string;
  objectKey: string;
  contentType: string;
  size: number;
}

export const FilePreview = ({ isOpen, onClose, bucketName, objectKey, contentType, size }: FilePreviewProps) => {
  const [presignedUrl, setPresignedUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const downloadUrl = `${BASE_URL}/objects/${bucketName}/${objectKey}`;

  // Reset and fetch preview URL on open
  useEffect(() => {
    if (isOpen) {
      // Use the presign API to get an authenticated URL for the previewer
      setPreviewUrl(null); // Clear old preview
      presignObject(bucketName, objectKey).then(data => {
        // Append view=true to tell backend to send inline disposition
        const url = data.url.includes('?') 
          ? `${data.url}&view=true` 
          : `${data.url}?view=true`;
        setPreviewUrl(url);
      }).catch(err => {
        console.error('Failed to pre-sign for preview', err);
      });
    } else {
      setPreviewUrl(null);
      setPresignedUrl(null);
    }
  }, [isOpen, bucketName, objectKey]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleShare = async () => {
    if (presignedUrl) {
      navigator.clipboard.writeText(presignedUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      return;
    }

    setIsGenerating(true);
    try {
      const data = await presignObject(bucketName, objectKey);
      setPresignedUrl(data.url);
      navigator.clipboard.writeText(data.url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to generate presigned URL', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const renderPreview = () => {
    if (!previewUrl) {
      return (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-800/20 rounded-2xl border border-slate-700/30">
          <Loader2 className="animate-spin text-indigo-500 mb-4" size={40} />
          <p className="text-slate-500 text-sm">Loading preview...</p>
        </div>
      );
    }

    // Attempt to detect correct content type if generic
    let activeContentType = contentType;
    if (activeContentType === 'application/octet-stream') {
        const ext = objectKey.split('.').pop()?.toLowerCase();
        const mimeMap: Record<string, string> = {
            'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'gif': 'image/gif', 'webp': 'image/webp',
            'mp4': 'video/mp4', 'webm': 'video/webm', 'mp3': 'audio/mpeg', 'wav': 'audio/wav',
            'pdf': 'application/pdf', 'txt': 'text/plain'
        };
        if (ext && mimeMap[ext]) activeContentType = mimeMap[ext];
    }

    if (activeContentType.startsWith('image/')) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <img src={previewUrl} alt={objectKey} className="max-h-[80vh] w-auto rounded-lg shadow-2xl" />
        </div>
      );
    }
    
    if (activeContentType.startsWith('video/')) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <video controls className="max-h-[80vh] w-full max-w-4xl rounded-lg shadow-2xl" autoPlay>
            <source src={previewUrl} type={activeContentType} />
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    if (activeContentType.startsWith('audio/')) {
      return (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-800/50 rounded-2xl border border-slate-700/50">
          <div className="w-20 h-20 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mb-6 border border-indigo-500/30">
            <Music size={40} />
          </div>
          <audio controls className="w-full max-w-md" autoPlay>
            <source src={previewUrl} type={activeContentType} />
            Your browser does not support the audio tag.
          </audio>
        </div>
      );
    }

    if (activeContentType === 'application/pdf') {
      return (
        <div className="w-full h-[80vh] rounded-lg overflow-hidden border border-slate-700 bg-slate-900 shadow-2xl">
          <iframe src={`${previewUrl}#toolbar=0`} className="w-full h-full border-none" title="PDF Preview" />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-800/50 rounded-2xl border border-slate-700/50 border-dashed">
        <div className="w-20 h-20 bg-slate-700/50 text-slate-400 rounded-full flex items-center justify-center mb-6 border border-slate-600/50">
          <FileIcon size={40} />
        </div>
        <h4 className="text-white font-medium mb-2">Preview not available</h4>
        <p className="text-slate-500 text-sm mb-6">This file type ({activeContentType}) cannot be previewed in the browser.</p>
        <div className="flex gap-4">
          <a href={downloadUrl} className="btn-primary">
            <Download size={18} />
            Download File
          </a>
          <button onClick={handleShare} className="btn-secondary">
            {isGenerating ? <Loader2 className="animate-spin" size={18} /> : (isCopied ? <Check size={18} /> : <Share2 size={18} />)}
            {isCopied ? 'Copied Link' : 'Share Link'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setPresignedUrl(null); onClose(); }}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-6xl max-h-[90vh] flex flex-col items-center gap-4 z-[120]"
          >
            {/* Header Control */}
            <div className="w-full flex items-center justify-between px-6 py-4 glass-card rounded-2xl mb-2">
              <div className="flex items-center gap-3">
                <div className="text-indigo-400">
                  {contentType.startsWith('image/') && <ImageIcon size={20} />}
                  {contentType.startsWith('video/') && <Video size={20} />}
                  {contentType.startsWith('audio/') && <Music size={20} />}
                  {contentType === 'application/pdf' && <FileText size={20} />}
                  {!contentType.match(/^(image|video|audio|application\/pdf)/) && <FileIcon size={20} />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white truncate max-w-xs md:max-w-md">{objectKey}</h3>
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{formatSize(size)} • {contentType}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShare}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-xs font-bold uppercase tracking-wider ${isCopied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'}`}
                  title="Share Presigned URL"
                >
                  {isGenerating ? <Loader2 size={16} className="animate-spin" /> : (isCopied ? <Check size={16} /> : <Share2 size={16} />)}
                  {isCopied ? 'Link Copied' : 'Share'}
                </button>
                <a 
                  href={downloadUrl}
                  className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all"
                  title="Download"
                >
                  <Download size={20} />
                </a>
                <button
                  onClick={() => { setPresignedUrl(null); onClose(); }}
                  className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all ml-2"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Preview Area */}
            <div className="w-full flex-1 overflow-auto">
              {renderPreview()}
            </div>
            
            {/* Share URL Display if generated */}
            {presignedUrl && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full p-4 glass-card rounded-xl border border-indigo-500/30 flex items-center justify-between gap-4"
              >
                <div className="flex-1 truncate">
                   <p className="text-[10px] text-indigo-400 font-bold uppercase mb-1 tracking-widest">Public Gateway URL (Expires in 1h)</p>
                   <code className="text-xs text-white bg-slate-900/50 px-2 py-1 rounded truncate block">{presignedUrl}</code>
                </div>
                <button 
                  onClick={() => { navigator.clipboard.writeText(presignedUrl); setIsCopied(true); setTimeout(() => setIsCopied(false), 2000); }}
                  className="p-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl transition-all"
                >
                  {isCopied ? <Check size={20} /> : <Copy size={20} />}
                </button>
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
