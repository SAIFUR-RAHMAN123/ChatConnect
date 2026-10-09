import { useEffect, useRef, useState } from 'react';
import { formatTime } from '../utils/format';
import { REACTIONS } from '../utils/emoji';
import { AuthImage, FileCard } from './Attachment';

const STATUS = {
  sending: { icon: '…', label: 'Sending...' },
  sent: { icon: '✓', label: 'Sent', cls: '' },
  delivered: { icon: '✓✓', label: 'Delivered', cls: '' },
  read: { icon: '✓✓', label: 'Read', cls: 'text-sky-300' },
};

export default function MessageBubble({
  message: m, own, senderName, nameOf, onReact, onEdit, onDelete, onRetry, onOpenImage,
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const wrapRef = useRef(null);

  const failed = m.status === 'failed';
  const deleted = m.deleted;
  const persisted = !m.tempId || m._id !== m.tempId; // optimistic/uploading messages have no server id yet
  const canAct = persisted && !deleted && !failed;
  const s = STATUS[m.status];

  useEffect(() => {
    if (!open) return undefined;
    const close = () => {
      setOpen(false);
      setConfirming(false);
    };
    const onDown = (e) => !wrapRef.current?.contains(e.target) && close();
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // group reactions by emoji: { emoji, users: [ids] }
  const reactionGroups = Object.values(
    (m.reactions || []).reduce((acc, r) => {
      (acc[r.emoji] ||= { emoji: r.emoji, users: [] }).users.push(r.user);
      return acc;
    }, {})
  );

  const bubbleTone = own
    ? failed
      ? 'rounded-br-md bg-red-100 text-red-900'
      : 'rounded-br-md bg-indigo-600 text-white'
    : 'rounded-bl-md bg-surface text-slate-900 ring-1 ring-slate-200';
  const metaTone = own ? (failed ? 'text-red-600' : 'text-indigo-200') : 'text-slate-400';

  const meta = (
    <span className={`inline-flex select-none items-center gap-1 whitespace-nowrap text-[11px] ${metaTone}`}>
      {m.edited && !deleted && <span>edited</span>}
      {formatTime(m.createdAt)}
      {own && !deleted && s && (
        <span className={s.cls} title={s.label} aria-label={s.label}>{s.icon}</span>
      )}
    </span>
  );

  const trigger = canAct && (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-label="Message actions"
      aria-expanded={open}
      className="self-center rounded-full px-1.5 text-slate-400 opacity-0 transition hover:bg-slate-200/60 hover:text-slate-700 focus:opacity-100 focus:outline-none group-hover:opacity-100 [@media(hover:none)]:opacity-100"
    >
      ⋯
    </button>
  );

  return (
    <div className={`group flex ${own ? 'justify-end' : 'justify-start'}`} ref={wrapRef}>
      <div className={`flex max-w-[85%] flex-col sm:max-w-[72%] ${own ? 'items-end' : 'items-start'}`}>
        <div className={`flex gap-1 ${own ? 'flex-row-reverse' : ''}`}>
          <div className={`min-w-0 rounded-2xl px-3.5 py-2 text-sm shadow-sm ${bubbleTone}`}>
            {senderName && <p className="mb-0.5 text-xs font-semibold text-accent">{senderName}</p>}

            {deleted ? (
              <span className="italic opacity-70">🚫 This message was deleted</span>
            ) : (
              <>
                {m.type === 'image' && <div className="mb-1"><AuthImage message={m} onOpen={onOpenImage} /></div>}
                {m.type === 'file' && <div className="mb-1"><FileCard message={m} own={own} /></div>}
                {m.content && <span className="whitespace-pre-wrap break-words">{m.content}</span>}
              </>
            )}

            {m.type === 'text' || deleted ? (
              <span className="ml-2 translate-y-0.5 inline-block">{meta}</span>
            ) : (
              <div className="mt-0.5 flex justify-end">{meta}</div>
            )}
          </div>
          {trigger}
        </div>

        {open && canAct && (
          <div
            role="menu"
            aria-label="Message actions"
            className="mt-1 flex flex-wrap items-center gap-1 rounded-full bg-surface px-2 py-1 text-sm shadow ring-1 ring-slate-200"
          >
            {REACTIONS.map((e) => (
              <button
                key={e}
                role="menuitem"
                onClick={() => {
                  onReact(m, e);
                  setOpen(false);
                }}
                aria-label={`React ${e}`}
                className="rounded-full px-1 text-lg transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                {e}
              </button>
            ))}
            {own && m.type === 'text' && (
              <button
                role="menuitem"
                onClick={() => {
                  onEdit(m);
                  setOpen(false);
                }}
                className="rounded-full px-2 py-0.5 font-medium text-slate-700 hover:bg-slate-100"
              >
                Edit
              </button>
            )}
            {own &&
              (confirming ? (
                <span className="flex items-center gap-1 px-1">
                  <span className="text-slate-600">Delete for everyone?</span>
                  <button
                    onClick={() => {
                      onDelete(m);
                      setOpen(false);
                      setConfirming(false);
                    }}
                    className="rounded-full px-2 py-0.5 font-semibold text-red-600 hover:bg-red-50"
                  >
                    Yes
                  </button>
                  <button onClick={() => setConfirming(false)} className="rounded-full px-2 py-0.5 text-slate-600 hover:bg-slate-100">
                    No
                  </button>
                </span>
              ) : (
                <button
                  role="menuitem"
                  onClick={() => setConfirming(true)}
                  className="rounded-full px-2 py-0.5 font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              ))}
          </div>
        )}

        {reactionGroups.length > 0 && !deleted && (
          <div className="mt-1 flex flex-wrap gap-1">
            {reactionGroups.map((g) => (
              <button
                key={g.emoji}
                type="button"
                onClick={() => canAct && onReact(m, g.emoji)}
                title={g.users.map(nameOf).join(', ')}
                aria-label={`${g.emoji} ${g.users.length}`}
                className="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100"
              >
                <span>{g.emoji}</span>
                <span className="text-slate-600">{g.users.length}</span>
              </button>
            ))}
          </div>
        )}

        {failed && (
          <button onClick={() => onRetry(m)} className="mt-1 text-xs font-medium text-red-600 hover:underline">
            Failed to send · Retry
          </button>
        )}
      </div>
    </div>
  );
}