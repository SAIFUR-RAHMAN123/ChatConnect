import { useEffect, useState } from 'react';
import { getFileUrl, downloadFile } from '../services/files';

export default function Lightbox({ message, onClose }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let alive = true;
    getFileUrl(message._id).then((url) => alive && setSrc(url)).catch(() => {});
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      alive = false;
      document.removeEventListener('keydown', onKey);
    };
  }, [message._id, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <div className="absolute right-4 top-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => downloadFile(message)}
          className="rounded-lg bg-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Download
        </button>
        <button
          onClick={onClose}
          aria-label="Close preview"
          className="rounded-lg bg-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          ✕
        </button>
      </div>
      {src ? (
        <img src={src} alt={message.attachment?.originalName || 'Image'} className="max-h-[85dvh] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
      ) : (
        <p className="text-white/80">Loading image...</p>
      )}
      {message.content && <p className="mt-3 max-w-xl text-center text-sm text-white/90">{message.content}</p>}
    </div>
  );
}