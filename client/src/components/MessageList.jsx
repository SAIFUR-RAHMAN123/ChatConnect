import { Fragment, useLayoutEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import { formatDay } from '../utils/format';

const keyOf = (m) => m.tempId || m._id;
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

export default function MessageList({
  conversationId, messages, meId, isGroup, nameOf, loading, error, hasMore, loadingMore,
  onLoadMore, onRetry, onReact, onEdit, onDelete, onOpenImage,
}) {
  const ref = useRef(null);
  const prev = useRef({ convId: null, first: null, last: null, height: 0 });

  // Scroll handling: jump to bottom on open, keep position when older messages are
  // prepended, follow new messages only if the user is near the bottom (or sent them).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const p = prev.current;
    const first = messages[0] && keyOf(messages[0]);
    const last = messages.length ? keyOf(messages[messages.length - 1]) : null;
    const lastMsg = messages[messages.length - 1];

    if (p.convId !== conversationId || p.last === null) {
      el.scrollTop = el.scrollHeight;
    } else if (first !== p.first && last === p.last) {
      el.scrollTop += el.scrollHeight - p.height; // older messages prepended
    } else if (last !== p.last) {
      const nearBottom = p.height - el.scrollTop - el.clientHeight < 160;
      if (nearBottom || (lastMsg && lastMsg.sender === meId)) el.scrollTop = el.scrollHeight;
    }
    prev.current = { convId: conversationId, first, last, height: el.scrollHeight };
  }, [messages, conversationId, meId]);

  return (
    <div ref={ref} className="scroll-thin flex-1 overflow-y-auto bg-slate-50 px-3 py-4 sm:px-6">
      {loading && <p className="py-10 text-center text-sm text-slate-500">Loading messages...</p>}

      {!loading && error && (
        <div className="py-10 text-center text-sm">
          <p className="text-red-600">{error}</p>
          <button onClick={() => onRetry()} className="mt-2 font-medium text-accent hover:underline">Try again</button>
        </div>
      )}

      {!loading && !error && messages.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-500">No messages yet. Say hello 👋</p>
      )}

      {!loading && hasMore && (
        <div className="mb-4 text-center">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="rounded-full bg-surface px-4 py-1.5 text-xs font-medium text-accent shadow-sm ring-1 ring-slate-200 transition hover:bg-indigo-50 disabled:opacity-60"
          >
            {loadingMore ? 'Loading...' : 'Load earlier messages'}
          </button>
        </div>
      )}

      {!loading && (
        <div className="space-y-1.5">
          {messages.map((m, i) => {
            const own = m.sender === meId;
            const prevSame = i > 0 && messages[i - 1].sender === m.sender && sameDay(messages[i - 1].createdAt, m.createdAt);
            return (
              <Fragment key={keyOf(m)}>
                {(i === 0 || !sameDay(messages[i - 1].createdAt, m.createdAt)) && (
                  <div className="flex justify-center py-2">
                    <span className="rounded-full bg-slate-200/70 px-3 py-0.5 text-xs text-slate-600">{formatDay(m.createdAt)}</span>
                  </div>
                )}
                <MessageBubble
                  message={m}
                  own={own}
                  senderName={isGroup && !own && !prevSame ? nameOf(m.sender) : null}
                  nameOf={nameOf}
                  onReact={onReact}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onRetry={onRetry}
                  onOpenImage={onOpenImage}
                />
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}