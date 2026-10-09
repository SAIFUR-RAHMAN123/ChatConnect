import { useEffect, useState } from 'react';
import { getFileUrl, downloadFile } from '../services/files';
import { formatSize } from '../utils/format';

export function AuthImage({ message, onOpen }) {
  const [src, setSrc] = useState(message.localUrl || null);
  const [failed, setFailed] = useState(false);
  const pending = message.status === 'sending';

  useEffect(() => {
    if (message.localUrl) return setSrc(message.localUrl);
    let alive = true;
    getFileUrl(message._id)
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [message._id, message.localUrl]);

  if (failed) {
    return <div className="flex h-24 w-48 items-center justify-center rounded-xl bg-slate-200/60 text-xs text-slate-500">Image unavailable</div>;
  }
  if (!src) return <div className="h-40 w-52 animate-pulse rounded-xl bg-slate-200/60" aria-label="Loading image" />;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !pending && onOpen(message)}
        className="block overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        aria-label={`Open image ${message.attachment?.originalName || ''}`}
      >
        <img
          src={src}
          alt={message.attachment?.originalName || 'Image'}
          className={`max-h-64 w-full max-w-[16rem] object-cover ${pending ? 'opacity-60' : ''}`}
        />
      </button>
      {pending && (
        <span className="absolute inset-0 flex items-center justify-center text-sm font-medium text-white drop-shadow">
          {message.progress ?? 0}%
        </span>
      )}
    </div>
  );
}

export function FileCard({ message, own }) {
  const att = message.attachment || {};
  const pending = message.status === 'sending';
  return (
    <div className={`flex min-w-52 items-center gap-3 rounded-xl p-2 ${own ? 'bg-white/15' : 'bg-slate-100'}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/10 text-xl" aria-hidden="true">📄</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{att.originalName}</span>
        <span className="block text-xs opacity-70">
          {pending ? `Uploading ${message.progress ?? 0}%` : formatSize(att.size)}
        </span>
      </span>
      {!pending && message.status !== 'failed' && (
        <button
          type="button"
          onClick={() => downloadFile(message)}
          aria-label={`Download ${att.originalName}`}
          title="Download"
          className="rounded-lg p-2 transition hover:bg-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          ⬇
        </button>
      )}
    </div>
  );
}