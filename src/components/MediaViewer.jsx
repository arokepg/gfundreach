import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { default as X } from '@mui/icons-material/Close';
import { default as Download } from '@mui/icons-material/Download';
import { default as ChevronLeft } from '@mui/icons-material/ChevronLeft';
import { default as ChevronRight } from '@mui/icons-material/ChevronRight';

const MediaViewer = ({ media, currentIndex, onClose, onNavigate }) => {
  

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < media.length - 1) {
        onNavigate(currentIndex + 1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, media.length, onClose, onNavigate]);

  const currentMedia = media[currentIndex];
  if (!currentMedia) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentMedia.url;
    link.download = `media-${currentMedia.id || Date.now()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBackgroundClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 flex items-center justify-center bg-black/95 animate-fadeIn"
      style={{ zIndex: 1000 }}
      onClick={handleBackgroundClick}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="p-3 rounded-full bg-gray-800/80 hover:bg-gray-700 text-white transition-all hover:scale-110"
        style={{ position: 'fixed', top: 16, right: 16, zIndex: 1001 }}
        aria-label="Close"
      >
        <X size={24} />
      </button>

      {/* Download button */}
      <button
        onClick={handleDownload}
        className="p-3 rounded-full bg-gray-800/80 hover:bg-gray-700 text-white transition-all hover:scale-110"
        style={{ position: 'fixed', top: 16, right: 80, zIndex: 1001 }}
        aria-label="Download"
      >
        <Download size={24} />
      </button>

      {/* Navigation buttons */}
      {media.length > 1 && (
        <>
          {currentIndex > 0 && (
            <button
              onClick={() => onNavigate(currentIndex - 1)}
              className="p-3 rounded-full bg-gray-800/80 hover:bg-gray-700 text-white transition-all hover:scale-110 -translate-y-1/2"
              style={{ position: 'fixed', left: 16, top: '50%', zIndex: 1001 }}
              aria-label="Previous"
            >
              <ChevronLeft size={32} />
            </button>
          )}
          {currentIndex < media.length - 1 && (
            <button
              onClick={() => onNavigate(currentIndex + 1)}
              className="p-3 rounded-full bg-gray-800/80 hover:bg-gray-700 text-white transition-all hover:scale-110 -translate-y-1/2"
              style={{ position: 'fixed', right: 16, top: '50%', zIndex: 1001 }}
              aria-label="Next"
            >
              <ChevronRight size={32} />
            </button>
          )}
        </>
      )}

      {/* Media counter */}
      {media.length > 1 && (
  <div className="px-4 py-2 rounded-full bg-gray-800/80 text-white text-sm font-medium -translate-x-1/2"
        style={{ position: 'fixed', top: 16, left: '50%', zIndex: 1001 }}>
          {currentIndex + 1} / {media.length}
        </div>
      )}

      {/* Media content */}
      <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center">
        {currentMedia.type === 'image' ? (
          <img
            src={currentMedia.url}
            alt="Media"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onError={(e) => {
              e.target.src = '';
              e.target.alt = '[Image failed to load]';
            }}
          />
        ) : currentMedia.type === 'video' ? (
          <video
            src={currentMedia.url}
            controls
            autoPlay
            className="max-w-full max-h-[90vh] rounded-lg"
          >
            Your browser does not support the video element.
          </video>
        ) : null}
      </div>

      {/* Sender info */}
      {currentMedia.senderName && (
  <div className="px-4 py-2 rounded-full bg-gray-800/80 text-white text-sm -translate-x-1/2"
        style={{ position: 'fixed', bottom: 16, left: '50%', zIndex: 1001 }}>
          Shared by {currentMedia.senderName}
        </div>
      )}
    </div>
  , document.body);
};

export default MediaViewer;
