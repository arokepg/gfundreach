import { useEffect } from 'react';
import { X, Download } from 'lucide-react';

/**
 * Simple fullscreen image viewer with download button
 * Props:
 * - open: boolean
 * - src: string (image url or data URL)
 * - alt: string
 * - onClose: () => void
 * - fileName?: string (optional download filename)
 */
const ImageViewer = ({ open, src, alt = 'Image', onClose, fileName = 'image.jpg' }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      {/* Backdrop */}
      <button aria-label="Close" className="absolute inset-0" onClick={onClose} />

      {/* Controls */}
      <div className="absolute top-4 right-4 flex gap-2">
        <a
          href={src}
          download={fileName}
          className="px-3 py-2 rounded-lg bg-white/90 hover:bg-white text-gray-900 text-sm font-medium flex items-center gap-2 shadow"
          onClick={(e) => e.stopPropagation()}
        >
          <Download size={18} /> Download
        </a>
        <button
          onClick={onClose}
          className="p-2 rounded-lg bg-white/90 hover:bg-white text-gray-900 shadow"
          aria-label="Close image viewer"
        >
          <X size={18} />
        </button>
      </div>

      {/* Image */}
      <div className="max-w-[92vw] max-h-[85vh] p-2 bg-black/30 rounded-xl">
        <img src={src} alt={alt} className="max-w-full max-h-[80vh] object-contain" />
      </div>
    </div>
  );
};

export default ImageViewer;
