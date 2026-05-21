import { FileText, Image as ImageIcon, Video, Music, File as FileIcon, X, Download, Share2, Copy, Check, Loader2, ZoomIn, ZoomOut, RotateCw, RefreshCw, Eye, Link, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [shareDropdownOpen, setShareDropdownOpen] = useState(false);
  const shareDropdownRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const downloadUrl = `${BASE_URL}/objects/${bucketName}/${objectKey}`;
  const viewerUrl = `${window.location.origin}/objects/${bucketName}/${objectKey}?viewer=true`;
  const directUrl = `${window.location.origin}/objects/${bucketName}/${objectKey}`;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (shareDropdownRef.current && !shareDropdownRef.current.contains(e.target as Node)) {
        setShareDropdownOpen(false);
      }
    };
    if (shareDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [shareDropdownOpen]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setShareDropdownOpen(false);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleShareViewer = () => copyToClipboard(viewerUrl);
  const handleShareLink = () => copyToClipboard(directUrl);

  // Reset and fetch preview URL on open
  useEffect(() => {
    if (isOpen) {
      setPreviewUrl(null); // Clear old preview
      setZoom(1);
      setRotation(0);
      setIsPlaying(false);
      setPlaybackRate(1);

      presignObject(bucketName, objectKey).then(data => {
        // Append view=true to tell backend to send inline disposition
        const url = data.url.includes('?') 
          ? `${data.url}&view=true&raw=true` 
          : `${data.url}?view=true&raw=true`;
        setPreviewUrl(url);
      }).catch(err => {
        console.error('Failed to pre-sign for preview', err);
      });
    } else {
      setPreviewUrl(null);
      setIsPlaying(false);
    }
  }, [isOpen, bucketName, objectKey]);

  // Adjust playback speed when playback rate changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, previewUrl]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => { setZoom(1); setRotation(0); };

  const renderPreview = () => {
    if (!previewUrl) {
      return (
        <div className="flex flex-col items-center justify-center py-20 bg-slate-800/20 rounded-2xl border border-slate-700/30">
          <Loader2 className="animate-spin text-indigo-500 mb-4" size={40} />
          <p className="text-slate-500 text-sm">Loading preview...</p>
        </div>
      );
    }

    // Detect exact content type by extension
    let activeContentType = contentType;
    const ext = objectKey.split('.').pop()?.toLowerCase() || '';
    
    const mimeMap: Record<string, string> = {
        'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'gif': 'image/gif', 'webp': 'image/webp', 'svg': 'image/svg+xml',
        'mp4': 'video/mp4', 'webm': 'video/webm', 'ogg': 'video/ogg', 'mov': 'video/quicktime',
        'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'flac': 'audio/flac', 'aac': 'audio/aac',
        'pdf': 'application/pdf',
        'txt': 'text/plain', 'json': 'application/json', 'js': 'application/javascript', 'css': 'text/css', 'html': 'text/html', 'md': 'text/markdown',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'doc': 'application/msword',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'xls': 'application/vnd.ms-excel',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'ppt': 'application/vnd.ms-powerpoint'
    };
    if (ext && mimeMap[ext]) {
        activeContentType = mimeMap[ext];
    }

    // 1. Zoomable/Rotatable Image Viewer
    if (activeContentType.startsWith('image/')) {
      return (
        <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
          {/* Ambient Zoom/Rotation Controls */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900/95 px-4 py-2 rounded-full border border-slate-800 shadow-2xl backdrop-blur-md z-30">
            <button 
              onClick={handleZoomIn} 
              disabled={zoom >= 3}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
            <span className="text-xs font-mono text-slate-400 min-w-[45px] text-center font-bold">{Math.round(zoom * 100)}%</span>
            <button 
              onClick={handleZoomOut} 
              disabled={zoom <= 0.5}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <div className="w-px h-4 bg-slate-800 mx-1"></div>
            <button 
              onClick={handleRotate} 
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Rotate 90°"
            >
              <RotateCw size={16} />
            </button>
            <button 
              onClick={handleReset} 
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Reset View"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="w-full h-full flex items-center justify-center overflow-auto p-4 md:p-8">
            <div 
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)'
              }}
              className="flex items-center justify-center select-none"
            >
              <img 
                src={previewUrl} 
                alt={objectKey} 
                className="max-h-[75vh] max-w-[85vw] object-contain rounded-lg shadow-2xl pointer-events-none" 
              />
            </div>
          </div>
        </div>
      );
    }
    
    // 2. Custom Video Player with Speeds & Shadow Ambient Glow
    if (activeContentType.startsWith('video/')) {
      return (
        <div className="flex flex-col items-center justify-center gap-6 w-full h-full max-w-4xl mx-auto p-4">
          <div className="relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-black shadow-2xl flex items-center justify-center aspect-video group">
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none z-10"></div>
            <video 
              ref={videoRef}
              controls 
              className="w-full h-full max-h-[70vh] object-contain relative z-20" 
              autoPlay
              onPlay={() => {
                if (videoRef.current) videoRef.current.playbackRate = playbackRate;
              }}
            >
              <source src={previewUrl} type={activeContentType} />
              Your browser does not support the video tag.
            </video>
          </div>

          {/* Speed Controls */}
          <div className="flex items-center gap-3 bg-slate-900/90 px-4 py-2 rounded-xl border border-slate-800 shadow-lg backdrop-blur-sm">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Speed:</span>
            <div className="flex gap-1.5">
              {[0.5, 1.0, 1.5, 2.0].map((rate) => (
                <button
                  key={rate}
                  onClick={() => {
                    setPlaybackRate(rate);
                    if (videoRef.current) videoRef.current.playbackRate = rate;
                  }}
                  className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${playbackRate === rate ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                >
                  {rate === 1.0 ? 'Normal' : `${rate}x`}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // 3. Immersive Turntable Audio Deck with Equalizer Waves
    if (activeContentType.startsWith('audio/')) {
      return (
        <div className="flex flex-col items-center justify-center p-6 md:p-12 bg-slate-900/40 rounded-3xl border border-slate-800 shadow-2xl w-full max-w-xl mx-auto relative overflow-hidden backdrop-blur-md">
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes equalizerBounce {
              0% { transform: scaleY(0.15); }
              100% { transform: scaleY(1); }
            }
            @keyframes diskSpin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}} />

          {/* Turntable Disc */}
          <div className="relative mb-8">
            <div 
              className={`w-32 h-32 md:w-44 md:h-44 rounded-full bg-slate-950 border-[6px] border-slate-850 shadow-2xl flex items-center justify-center relative ${isPlaying ? 'shadow-indigo-500/10' : ''}`}
              style={{
                animation: isPlaying ? 'diskSpin 8s linear infinite' : 'none',
                transition: 'box-shadow 0.5s ease'
              }}
            >
              <div className="absolute inset-2 rounded-full border border-slate-800/40 opacity-40"></div>
              <div className="absolute inset-4 rounded-full border border-slate-800/30 opacity-40"></div>
              <div className="absolute inset-8 rounded-full border border-slate-800/20 opacity-40"></div>
              
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-indigo-650 flex items-center justify-center border-4 border-slate-950 relative">
                <Music className="text-indigo-100 animate-pulse" size={20} />
                <div className="w-2.5 h-2.5 rounded-full bg-slate-950 absolute inset-0 m-auto"></div>
              </div>
            </div>
            
            {/* Tone arm mechanism */}
            <div 
              className="absolute -top-4 -right-4 w-12 h-20 origin-top-left transition-transform duration-700 pointer-events-none"
              style={{
                transform: isPlaying ? 'rotate(18deg)' : 'rotate(-10deg)'
              }}
            >
              <div className="w-1 h-16 bg-slate-650 rounded-full ml-4 shadow-lg"></div>
              <div className="w-3 h-3 bg-slate-750 rounded-sm ml-3 -mt-1 shadow-md"></div>
            </div>
          </div>

          {/* Equalizer Waves */}
          <div className="flex items-end gap-1.5 h-16 justify-center w-full mb-8 px-6">
            {[...Array(18)].map((_, i) => (
              <div 
                key={i} 
                className="w-1 bg-indigo-500 rounded-full transition-all duration-300"
                style={{
                  height: '100%',
                  animation: isPlaying ? `equalizerBounce ${0.4 + Math.random() * 0.7}s ease-in-out infinite alternate` : 'none',
                  animationDelay: `${i * 0.04}s`,
                  transformOrigin: 'bottom',
                  transform: isPlaying ? 'scaleY(1)' : 'scaleY(0.15)'
                }}
              />
            ))}
          </div>

          {/* Standard HTML Audio controls hook */}
          <audio 
            ref={audioRef}
            src={previewUrl} 
            className="w-full max-w-md bg-slate-850 rounded-xl px-2 py-1 border border-slate-750" 
            controls 
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            autoPlay
          />
        </div>
      );
    }

    // 4. Word / Excel Spreadsheet / PowerPoint Web Viewer
    const isOffice = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);
    if (isOffice) {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      
      if (isLocalhost) {
        return (
          <div className="flex flex-col items-center justify-center py-12 md:py-16 bg-slate-900/80 rounded-2xl border border-slate-800 p-6 text-center max-w-xl mx-auto backdrop-blur-md shadow-2xl">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mb-6 border border-amber-500/20 shadow-lg shadow-amber-500/10">
              <FileText size={32} />
            </div>
            <h4 className="text-white font-bold text-lg mb-2">💻 Local Dev Preview Mode</h4>
            <p className="text-slate-400 text-xs leading-relaxed mb-6">
              Microsoft Office Web Viewer requires a publicly accessible internet URL to render this file. 
              <br />
              <span className="text-slate-500 italic mt-1.5 block font-medium">When deployed in production, this Word/Excel document will load and render automatically!</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
              <a href={downloadUrl} className="btn-primary justify-center">
                <Download size={16} />
                Download Document
              </a>
              <button onClick={handleShareViewer} className="btn-secondary justify-center">
                {isCopied ? <Check size={16} /> : <Eye size={16} />}
                {isCopied ? 'Link Copied' : 'Share with Viewer'}
              </button>
            </div>
          </div>
        );
      }
      
      // Production - Pass encrypted presigned token directly to Microsoft Live Embed
      const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`;
      return (
        <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-800/85 bg-slate-950 shadow-2xl flex flex-col relative">
          <iframe 
            src={officeUrl} 
            className="w-full h-full border-none relative z-10" 
            title="Office Document Preview" 
          />
        </div>
      );
    }

    // 5. Standard PDF viewer
    if (activeContentType === 'application/pdf') {
      return (
        <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl flex flex-col relative">
          <iframe src={`${previewUrl}#toolbar=0`} className="w-full h-full border-none relative z-10 bg-slate-900" title="PDF Preview" />
        </div>
      );
    }

    // Generic Fallback
    return (
      <div className="flex flex-col items-center justify-center py-12 md:py-20 bg-slate-800/50 rounded-2xl border border-slate-700/50 border-dashed p-6 text-center">
        <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-700/50 text-slate-400 rounded-full flex items-center justify-center mb-4 md:mb-6 border border-slate-600/50">
          <FileIcon size={32} />
        </div>
        <h4 className="text-white font-medium mb-2">Preview not available</h4>
        <p className="text-slate-500 text-sm mb-6 max-w-xs sm:max-w-md">This file type ({activeContentType}) cannot be previewed in the browser.</p>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <a href={downloadUrl} className="btn-primary justify-center">
            <Download size={18} />
            Download File
          </a>
          <button onClick={handleShareViewer} className="btn-secondary justify-center">
            {isCopied ? <Check size={18} /> : <Eye size={18} />}
            {isCopied ? 'Copied Link' : 'Share with Viewer'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 1.01 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed inset-0 z-[9999] flex flex-col bg-slate-950/98 backdrop-blur-xl w-screen h-screen overflow-hidden"
        >
          {/* Top Bar */}
          <div className="w-full h-16 bg-slate-900/90 border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between shrink-0 z-50 backdrop-blur-md">
            <div className="flex items-center gap-3 min-w-0">
              <div className="text-indigo-400 shrink-0">
                {contentType.startsWith('image/') && <ImageIcon size={20} />}
                {contentType.startsWith('video/') && <Video size={20} />}
                {contentType.startsWith('audio/') && <Music size={20} />}
                {contentType === 'application/pdf' && <FileText size={20} />}
                {!contentType.match(/^(image|video|audio|application\/pdf)/) && <FileIcon size={20} />}
              </div>
              <div className="min-w-0 flex-grow">
                <h3 className="text-sm font-bold text-white truncate max-w-[180px] xs:max-w-[260px] sm:max-w-md md:max-w-xl" title={objectKey}>{objectKey}</h3>
                <p className="text-[10px] text-slate-400 font-medium tracking-wide">{formatSize(size)} • {contentType}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative" ref={shareDropdownRef}>
                <button
                  onClick={() => setShareDropdownOpen(!shareDropdownOpen)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-xs font-bold uppercase tracking-wider cursor-pointer ${
                    isCopied
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 border border-indigo-500/10'
                  }`}
                  title="Share"
                >
                  {isCopied ? <Check size={14} /> : <Share2 size={14} />}
                  <span className="hidden sm:inline">{isCopied ? 'Copied!' : 'Share'}</span>
                  {!isCopied && <ChevronDown size={12} className={`transition-transform ${shareDropdownOpen ? 'rotate-180' : ''}`} />}
                </button>
                <AnimatePresence>
                  {shareDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-[60]"
                    >
                      <button
                        onClick={handleShareViewer}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/80 transition-colors cursor-pointer group"
                      >
                        <div className="p-2 bg-indigo-500/15 rounded-lg border border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500/25 transition-colors">
                          <Eye size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white">Media Viewer</p>
                          <p className="text-[11px] text-slate-500 truncate">{viewerUrl}</p>
                        </div>
                        <Copy size={14} className="text-slate-600 group-hover:text-slate-400 shrink-0" />
                      </button>
                      <div className="h-px bg-slate-800/80 mx-3"></div>
                      <button
                        onClick={handleShareLink}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/80 transition-colors cursor-pointer group"
                      >
                        <div className="p-2 bg-emerald-500/15 rounded-lg border border-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/25 transition-colors">
                          <Link size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white">Direct Link</p>
                          <p className="text-[11px] text-slate-500 truncate">{directUrl}</p>
                        </div>
                        <Copy size={14} className="text-slate-600 group-hover:text-slate-400 shrink-0" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <a 
                href={downloadUrl}
                className="p-2 hover:bg-slate-800 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 hover:text-white transition-all flex items-center justify-center animate-none"
                title="Download"
              >
                <Download size={18} />
              </a>
              <button
                onClick={onClose}
                className="p-2 hover:bg-red-500/20 border border-transparent hover:border-red-500/30 rounded-lg text-slate-400 hover:text-red-400 transition-all flex items-center justify-center cursor-pointer ml-1"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Preview Workspace Area */}
          <div className="flex-1 w-full flex items-center justify-center p-4 md:p-8 overflow-hidden relative">
            {renderPreview()}
          </div>
          
        </motion.div>
      )}
    </AnimatePresence>
  );
};
