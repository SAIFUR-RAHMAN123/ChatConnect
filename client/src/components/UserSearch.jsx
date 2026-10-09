import useUserSearch from '../hooks/useUserSearch';
import Avatar from './Avatar';
import { inputClass } from './AuthLayout';

export default function UserSearch({ query, onQueryChange, onSelect, withPresence }) {
  const { results, loading, error } = useUserSearch(query);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="relative px-4 pb-3">
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search users by name or email"
          aria-label="Search users"
          className={`${inputClass} pl-9`}
        />
        <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-7 top-2.5 h-4 w-4 text-slate-400" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.48l4.31 4.3a1 1 0 01-1.42 1.42l-4.3-4.31A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
      </div>

      {query.trim() && (
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto" aria-live="polite">
          {loading && <p className="px-4 py-6 text-center text-sm text-slate-500">Searching users...</p>}
          {!loading && error && <p className="px-4 py-6 text-center text-sm text-red-600">{error}</p>}
          {!loading && !error && results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-slate-500">No users found</p>
          )}
          {!loading &&
            !error &&
            results.map((raw) => {
              const u = withPresence(raw);
              return (
                <button
                  key={u._id}
                  onClick={() => onSelect(u)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                >
                  <Avatar user={u} showStatus />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{u.name}</span>
                    <span className="block truncate text-xs text-slate-500">{u.email}</span>
                  </span>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}