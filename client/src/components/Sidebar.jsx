import { useState } from 'react';
import Avatar from './Avatar';
import { Logo } from './AuthLayout';
import UserSearch from './UserSearch';
import ConversationList from './ConversationList';
import ThemeToggle from './ThemeToggle';

export default function Sidebar({
  me, conversations, loading, error, onRetry, activeId, onSelectConversation,
  onStartConversation, onNewGroup, typing, withPresence, onLogout, className = '',
}) {
  const [query, setQuery] = useState('');

  const startWith = (user) => {
    setQuery('');
    onStartConversation(user);
  };

  return (
    <aside className={`w-full flex-col border-r border-slate-200 bg-surface md:w-80 lg:w-96 ${className}`}>
      <div className="flex items-center justify-between px-4 py-3">
        <Logo />
        <div className="flex items-center gap-1">
          <button
            onClick={onNewGroup}
            title="New group"
            aria-label="New group"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
              <path d="M13 7a3 3 0 11-6 0 3 3 0 016 0zM3 16a6 6 0 0112 0v1H3v-1zm13-7a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
            </svg>
          </button>
          <ThemeToggle />
        </div>
      </div>

      <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
        <Avatar user={{ ...me, isOnline: true }} size="sm" showStatus />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{me.name}</p>
          <p className="truncate text-xs text-slate-500">{me.email}</p>
        </div>
        <button
          onClick={onLogout}
          title="Log out"
          aria-label="Log out"
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h6a1 1 0 110 2H5v10h5a1 1 0 110 2H4a1 1 0 01-1-1V4zm11.3 2.3a1 1 0 011.4 0l3 3a1 1 0 010 1.4l-3 3a1 1 0 01-1.4-1.4L15.58 11H8a1 1 0 110-2h7.58L14.3 7.7a1 1 0 010-1.4z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <UserSearch query={query} onQueryChange={setQuery} onSelect={startWith} withPresence={withPresence} />

      {!query.trim() && (
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto border-t border-slate-100">
          <h2 className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Recent chats</h2>
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onSelect={onSelectConversation}
            loading={loading}
            error={error}
            onRetry={onRetry}
            typing={typing}
            meId={me._id}
            withPresence={withPresence}
          />
        </div>
      )}
    </aside>
  );
}