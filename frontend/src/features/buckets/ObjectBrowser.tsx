import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../../components/ui/DashboardElements';
import { File as FileIcon, Folder, MoreVertical, Search, Upload, Download, Trash2, Loader2, Plus, ArrowLeft, Eye, Settings } from 'lucide-react';
import { getObjects, uploadObject, deleteObject, BASE_URL } from '../../lib/api';
import { FilePreview } from '../../components/ui/FilePreview';

const compressImage = (file: File, quality: number, maxDimension: number): Promise<File> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (maxDimension > 0 && (width > maxDimension || height > maxDimension)) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const outputType = file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/webp'
          ? (file.type === 'image/png' ? 'image/jpeg' : file.type)
          : 'image/jpeg';

        let name = file.name;
        if (file.type === 'image/png' && outputType === 'image/jpeg') {
          name = name.replace(/\.png$/i, '.jpg');
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            if (blob.size < file.size) {
              const compressedFile = new File([blob], name, {
                type: outputType,
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          outputType,
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

interface ObjectBrowserProps {
  bucketName: string;
  onBack: () => void;
}

export function ObjectBrowser({ bucketName, onBack }: ObjectBrowserProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [previewObject, setPreviewObject] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [compressImages, setCompressImages] = useState(false);
  const [compressionQuality, setCompressionQuality] = useState(0.75);
  const [maxImageDimension, setMaxImageDimension] = useState(2048);
  const [showUploadSettings, setShowUploadSettings] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  const { data: objects = [], isLoading } = useQuery({
    queryKey: ['objects', bucketName, currentPrefix],
    queryFn: () => getObjects(bucketName, currentPrefix)
  });

  const uploadMutation = useMutation({
    mutationFn: ({ key, file }: { key: string; file: File }) => {
      const fullKey = currentPrefix ? `${currentPrefix}${key}` : key;
      return uploadObject(bucketName, fullKey, file, (p) => setUploadProgress(p));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objects', bucketName] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      setUploadProgress(0);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => deleteObject(bucketName, key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objects', bucketName] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (file) {
      if (compressImages && file.type.startsWith('image/')) {
        setIsCompressing(true);
        try {
          file = await compressImage(file, compressionQuality, maxImageDimension);
        } catch (err) {
          console.error('Failed to compress image:', err);
        } finally {
          setIsCompressing(false);
        }
      }
      setUploadProgress(1); // Set initial state
      uploadMutation.mutate({ key: file.name, file });
    }
  };

  // Group objects by their virtual "folders" based on the current prefix
  const processedItems = (() => {
    const folders = new Set<string>();
    const files: any[] = [];
    
    objects.forEach((obj: any) => {
      const relativeKey = obj.key.slice(currentPrefix.length);
      const parts = relativeKey.split('/');
      
      if (parts.length > 1) {
        // This object is inside a subfolder
        folders.add(parts[0]);
      } else {
        // This object is in the current directory
        files.push(obj);
      }
    });

    const folderItems = Array.from(folders).map(folder => ({
      id: `folder-${folder}`,
      key: folder,
      type: 'folder'
    }));

    const fileItems = files.map(file => ({ ...file, type: 'file' }));

    return [...folderItems, ...fileItems].filter(item => 
      item.key.toLowerCase().includes(searchTerm.toLowerCase())
    );
  })();

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const navigateToFolder = (folderName: string) => {
    setCurrentPrefix(currentPrefix + folderName + '/');
  };

  const navigateToBreadcrumb = (index: number) => {
    const parts = currentPrefix.split('/').filter(p => p);
    const newPrefix = parts.slice(0, index).join('/');
    setCurrentPrefix(newPrefix ? `${newPrefix}/` : '');
  };

  const breadcrumbs = currentPrefix.split('/').filter(p => p);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-white tracking-tight">{bucketName}</h2>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider self-center border border-indigo-500/30">Bucket</span>
            </div>
            
            <div className="flex items-center gap-1 mt-1">
              <button 
                onClick={() => setCurrentPrefix('')}
                className={`text-xs hover:text-white transition-colors flex items-center gap-1.5 ${!currentPrefix ? 'text-indigo-400 font-bold' : 'text-slate-500'}`}
              >
                Root
              </button>
              {breadcrumbs.map((part, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-slate-700 text-xs">/</span>
                  <button 
                    onClick={() => navigateToBreadcrumb(i + 1)}
                    className={`text-xs hover:text-white transition-colors ${i === breadcrumbs.length - 1 ? 'text-indigo-400 font-bold' : 'text-slate-500'}`}
                  >
                    {part}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-slate-800/20 p-4 rounded-2xl border border-slate-700/30">
        <div className="flex items-center gap-3 bg-slate-900/50 px-4 py-2.5 rounded-xl border border-slate-700/50 w-full md:w-96">
          <Search size={18} className="text-slate-500" />
          <input 
            type="text" 
            placeholder="Search items..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-slate-300 w-full placeholder:text-slate-600"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <input 
            type="file" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload}
          />
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 md:flex-none">
            {(uploadMutation.isPending || isCompressing) && (
              <div className="flex flex-col gap-1 w-full sm:w-32 sm:mr-2">
                <div className="flex justify-between sm:justify-end text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                  <span className="sm:hidden">{isCompressing ? 'Compressing' : 'Uploading'}</span>
                  <span>{isCompressing ? '...' : `${uploadProgress}%`}</span>
                </div>
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${isCompressing ? 'bg-indigo-400 animate-pulse w-full' : 'bg-indigo-500'}`} 
                    style={isCompressing ? {} : { width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
            <button 
              className="btn-secondary w-full sm:w-auto justify-center cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending || isCompressing}
            >
              {uploadMutation.isPending || isCompressing ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
              {isCompressing ? 'Compressing...' : uploadMutation.isPending ? 'Uploading...' : 'Upload'}
            </button>
          </div>
          <button 
            type="button"
            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
              showUploadSettings 
                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' 
                : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-white'
            }`}
            onClick={() => setShowUploadSettings(!showUploadSettings)}
            title="Upload Settings"
          >
            <Settings size={18} className={showUploadSettings ? 'animate-spin' : ''} />
          </button>
          <button className="btn-primary w-full sm:w-auto justify-center cursor-pointer">
            <Plus size={18} />
            Create Folder
          </button>
        </div>
      </div>

      {showUploadSettings && (
        <div className="bg-slate-800/20 p-4 rounded-2xl border border-slate-700/30 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-semibold text-white">Image Compression</h4>
              <p className="text-xs text-slate-500 mt-0.5">Automatically compress large JPEG, PNG, or WebP images before uploading to save storage.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={compressImages} 
                onChange={(e) => setCompressImages(e.target.checked)} 
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-slate-400 peer-checked:after:bg-indigo-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600/30 border border-slate-700 peer-checked:border-indigo-500/40"></div>
            </label>
          </div>

          {compressImages && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-slate-800/60 animate-in fade-in duration-200">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs font-semibold text-slate-400">Compression Quality</label>
                  <span className="text-xs font-bold text-indigo-400">{Math.round(compressionQuality * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0.1" 
                  max="1.0" 
                  step="0.05" 
                  value={compressionQuality} 
                  onChange={(e) => setCompressionQuality(parseFloat(e.target.value))} 
                  className="w-full accent-indigo-500 bg-slate-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-600 font-bold uppercase">
                  <span>Small Size</span>
                  <span>Balanced</span>
                  <span>Best Quality</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400">Max Resolution (Dimension)</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Original', value: 0 },
                    { label: '2K (2048px)', value: 2048 },
                    { label: 'HD (1080px)', value: 1080 }
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setMaxImageDimension(opt.value)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                        maxImageDimension === opt.value
                          ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                          : 'bg-slate-900/40 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Images larger than this will be resized proportionally.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Desktop Table View (Hidden on mobile) */}
      <Card className="p-0 overflow-hidden border-slate-700/30 bg-slate-900/30 hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/30">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Size</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Last Modified</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin text-indigo-500 mx-auto" size={32} />
                  </td>
                </tr>
              ) : processedItems.length > 0 ? (
                processedItems.map((item: any) => (
                  <tr 
                    key={item.id} 
                    className="hover:bg-slate-700/20 transition-colors group cursor-pointer"
                    onClick={() => item.type === 'folder' ? navigateToFolder(item.key) : setPreviewObject(item)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all border ${
                          item.type === 'folder' 
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 group-hover:bg-amber-500/20 shadow-lg shadow-amber-500/10' 
                            : 'bg-slate-800 text-indigo-400 border-slate-700 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/30'
                        }`}>
                          {item.type === 'folder' ? <Folder size={16} fill="currentColor" fillOpacity={0.2} /> : <FileIcon size={16} />}
                        </div>
                        <span className="text-sm font-medium text-white">{item.key}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400 font-mono">
                      {item.type === 'file' ? formatSize(item.size) : '--'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 text-xs">
                      {item.type === 'file' ? new Date(item.createdAt).toLocaleString() : '--'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.type === 'file' ? (
                          <>
                            <button 
                              className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); setPreviewObject(item); }}
                            >
                              <Eye size={16} />
                            </button>
                            <a 
                              href={`${BASE_URL}/objects/${bucketName}/${item.key}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download size={16} />
                            </a>
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(item.key); }}
                              className="p-2 hover:bg-rose-500/20 rounded-lg text-slate-400 hover:text-rose-400 transition-all border border-transparent hover:border-rose-500/30 cursor-pointer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        ) : (
                          <MoreVertical size={16} className="text-slate-600" />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500 italic text-sm">
                    No items found in this {currentPrefix ? 'folder' : 'bucket'}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile Card List View (Visible only on mobile/tablet) */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
          </div>
        ) : processedItems.length > 0 ? (
          processedItems.map((item: any) => (
            <Card 
              key={item.id} 
              className="p-4 border-slate-700/40 hover:border-indigo-500/25 transition-all bg-slate-900/30 group cursor-pointer"
              onClick={() => item.type === 'folder' ? navigateToFolder(item.key) : setPreviewObject(item)}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all border shrink-0 ${
                    item.type === 'folder' 
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-lg shadow-amber-500/10' 
                      : 'bg-slate-800 text-indigo-400 border-slate-700'
                  }`}>
                    {item.type === 'folder' ? <Folder size={16} fill="currentColor" fillOpacity={0.2} /> : <FileIcon size={16} />}
                  </div>
                  <span className="text-sm font-semibold text-white break-all" title={item.key}>
                    {item.key}
                  </span>
                </div>

                {item.type === 'file' && (
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button 
                      className="p-2 hover:bg-slate-750 bg-slate-800/80 rounded-lg text-slate-400 hover:text-white transition-all border border-slate-700/40 cursor-pointer"
                      onClick={() => setPreviewObject(item)}
                    >
                      <Eye size={14} />
                    </button>
                    <a 
                      href={`${BASE_URL}/objects/${bucketName}/${item.key}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 hover:bg-slate-750 bg-slate-800/80 rounded-lg text-slate-400 hover:text-white transition-all border border-slate-700/40 cursor-pointer"
                    >
                      <Download size={14} />
                    </a>
                    <button 
                      onClick={() => deleteMutation.mutate(item.key)}
                      className="p-2 bg-slate-800/80 hover:bg-rose-500/20 rounded-lg text-slate-400 hover:text-rose-400 transition-all border border-slate-700/40 hover:border-rose-500/30 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              {item.type === 'file' && (
                <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs pt-3 mt-3 border-t border-slate-800/60">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Size</p>
                    <p className="text-slate-300 font-mono mt-0.5">{formatSize(item.size)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Last Modified</p>
                    <p className="text-slate-400 mt-0.5 font-medium">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              )}
            </Card>
          ))
        ) : (
          <div className="text-center py-12 glass-card rounded-2xl border-dashed border-2 border-slate-700">
            <Folder size={36} className="mx-auto text-slate-600 mb-2" />
            <h4 className="text-sm font-semibold text-slate-300">No items found</h4>
            <p className="text-xs text-slate-500 mt-1">This directory is empty.</p>
          </div>
        )}
      </div>

      <FilePreview 
        isOpen={!!previewObject}
        onClose={() => setPreviewObject(null)}
        bucketName={bucketName}
        objectKey={previewObject?.key || ''}
        contentType={previewObject?.contentType || 'application/octet-stream'}
        size={previewObject?.size || 0}
      />
    </div>
  );
}
