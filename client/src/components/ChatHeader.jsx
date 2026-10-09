import { useEffect, useState } from 'react';
import Avatar from './Avatar';
import { formatLastSeen } from '../utils/format';

export default function ChatHeader({ conversation, participant, members, meId, onBack, onOpenInfo }) {
  const [, tick] = useState(0);
  // re-render every 30s so "Last seen 5 min ago" stays fresh
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const isGroup = conversation.isGroup;
  const online = members.filter((u) => u._id === meId || u.isOnline).length;

  const identity = isGroup ? (
    <>
      <Avatar user={{ name: conversation.name }} isGroup />
      <div className="min-w-0 flex-1 text-left">
        <h2 className="truncate text-base font-semibold leading-tight">{conversation.name}</h2>
        <p className="truncate text-xs text-slate-500">
          {members.length} members · {online} online
        </p>
      </div>
    </>
  ) : (
    <>
      <Avatar user={participant} showStatus />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-semibold leading-tight">{participant.name}</h2>
        <p className={`truncate text-xs ${participant.isOnline ? 'text-emerald-600' : 'text-slate-500'}`}>
          {participant.isOnline ? '🟢 Online' : formatLastSeen(participant.lastSeen)}
        </p>
      </div>
    </>
  );

  return (
    <header className="flex items-center gap-3 border-b border-slate-200 bg-surface px-3 py-3 sm:px-4">
      <button
        onClick={onBack}
        aria-label="Back to conversations"
        className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 md:hidden"
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M12.7 5.3a1 1 0 010 1.4L9.42 10l3.3 3.3a1 1 0 11-1.42 1.4l-4-4a1 1 0 010-1.4l4-4a1 1 0 011.4 0z" clipRule="evenodd" />
        </svg>
      </button>
      {isGroup ? (
        <button
          onClick={onOpenInfo}
          aria-label="Group info"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {identity}
        </button>
      ) : (
        identity
      )}
    </header>
  );
}