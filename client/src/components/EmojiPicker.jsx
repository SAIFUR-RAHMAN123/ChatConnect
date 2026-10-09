import { useEffect, useRef } from 'react';
import { EMOJIS } from '../utils/emoji';

export default function EmojiPicker({ onPick, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => {
      // the toggle button handles its own clicks
      if (!ref.current?.contains(e.target) && !e.target.closest('[data-emoji-toggle]')) onClose();
    };
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Emoji picker"
      className="absolute bottom-full left-3 z-20 mb-2 w-72 rounded-xl bg-surface p-2 shadow-lg ring-1 ring-slate-200"
    >
      <div className="grid max-h-48 grid-cols-8 gap-0.5 overflow-y-auto">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onPick(e)}
            className="rounded-md p-1 text-xl transition hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}