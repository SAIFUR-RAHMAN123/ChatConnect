import Avatar from './Avatar';
import { formatListTime, previewText } from '../utils/format';

export default function ConversationList({
  conversations, activeId, onSelect, loading, error, onRetry, typing, meId, withPresence,
}) {
  if (loading) return <p className="px-4 py-8 text-center text-sm text-slate-500">Loading conversations...</p>;
  if (error) {
    return (
      <div className="px-4 py-8 text-center text-sm">
        <p className="text-red-600">{error}</p>
        <button onClick={onRetry} className="mt-2 font-medium text-accent hover:underline">Try again</button>
      </div>
    );
  }
  if (!conversations.length) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="font-medium text-slate-700">No conversations yet</p>
        <p className="mt-1 text-sm text-slate-500">Search for a user above, or create a group.</p>
      </div>
    );
  }

  return (
    <ul>
      {conversations.map((c) => {
        const isGroup = c.isGroup;
        const user = isGroup ? { name: c.name } : withPresence(c.participant);
        const last = c.lastMessage;
        const active = c._id === activeId;
        const typists = Object.values(typing[c._id] || {});
        const nameOf = (id) => c.participants.find((p) => p._id === id)?.name || 'Former member';
        return (
          <li key={c._id}>
            <button
              onClick={() => onSelect(c._id)}
              aria-current={active ? 'true' : undefined}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition focus:outline-none focus-visible:bg-slate-100 ${
                active ? 'bg-indigo-50' : 'hover:bg-slate-50'
              }`}
            >
              <Avatar user={user} isGroup={isGroup} showStatus />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{user.name}</span>
                  {last && <span className="shrink-0 text-xs text-slate-400">{formatListTime(last.createdAt)}</span>}
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p className={`truncate text-sm ${typists.length ? 'italic text-accent' : c.unreadCount ? 'font-medium text-slate-800' : 'text-slate-500'}`}>
                    {typists.length
                      ? isGroup
                        ? `${typists.join(', ')} typing...`
                        : 'typing...'
                      : previewText(last, meId, nameOf, isGroup)}
                  </p>
                  {c.unreadCount > 0 && (
                    <span
                      className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-semibold text-white"
                      aria-label={`${c.unreadCount} unread messages`}
                    >
                      {c.unreadCount > 99 ? '99+' : c.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}