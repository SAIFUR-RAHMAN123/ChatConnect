import { useState } from 'react';
import useUserSearch from '../hooks/useUserSearch';
import Avatar from './Avatar';
import { inputClass } from './AuthLayout';

// Search box + result list used to pick people for a group
export default function UserPicker({ excludeIds = [], onPick, label = 'Search users' }) {
  const [query, setQuery] = useState('');
  const { results, loading, error } = useUserSearch(query);
  const visible = results.filter((u) => !excludeIds.includes(u._id));

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or email"
        aria-label={label}
        className={inputClass}
      />
      {query.trim() && (
        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200" aria-live="polite">
          {loading && <p className="px-3 py-4 text-center text-sm text-slate-500">Searching users...</p>}
          {!loading && error && <p className="px-3 py-4 text-center text-sm text-red-600">{error}</p>}
          {!loading && !error && visible.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-slate-500">No users found</p>
          )}
          {!loading &&
            !error &&
            visible.map((u) => (
              <button
                key={u._id}
                type="button"
                onClick={() => {
                  onPick(u);
                  setQuery('');
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
              >
                <Avatar user={u} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{u.name}</span>
                  <span className="block truncate text-xs text-slate-500">{u.email}</span>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}