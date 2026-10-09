import { initials } from '../utils/format';

const COLORS = [
  'bg-indigo-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500',
  'bg-sky-500', 'bg-violet-500', 'bg-teal-500', 'bg-pink-500',
];

const colorFor = (name = '') => COLORS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORS.length];

const SIZES = { sm: 'h-9 w-9 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-12 w-12 text-base' };

export default function Avatar({ user, size = 'md', showStatus = false, isGroup = false }) {
  return (
    <div className="relative shrink-0">
      <div
        className={`flex items-center justify-center rounded-full font-semibold text-white ${SIZES[size]} ${isGroup ? 'bg-indigo-600' : colorFor(user?.name)}`}
        aria-hidden="true"
      >
        {isGroup ? (
          <svg viewBox="0 0 20 20" className="h-1/2 w-1/2" fill="currentColor">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zm8 0a3 3 0 11-6 0 3 3 0 016 0zM1 16a5 5 0 0110 0v1H1v-1zm9 1v-1a6.97 6.97 0 00-1.2-3.9A5 5 0 0119 16v1h-9z" />
          </svg>
        ) : (
          initials(user?.name)
        )}
      </div>
      {showStatus && !isGroup && (
        <span
          title={user?.isOnline ? 'Online' : 'Offline'}
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-surface ${user?.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}
        />
      )}
    </div>
  );
}