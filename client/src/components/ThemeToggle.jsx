import { useState } from 'react';

const KEY = 'chatconnect_theme';

export default function ThemeToggle({ className = '' }) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem(KEY, next ? 'dark' : 'light');
    } catch (_) {
      /* storage unavailable: theme just won't persist */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${className}`}
    >
      {dark ? (
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.46 4.95l.71.7a1 1 0 001.41-1.41l-.7-.71a1 1 0 00-1.42 1.42zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.46A1 1 0 106.46 5.05l-.7-.71a1 1 0 00-1.42 1.42l.71.7zm-.7 8.49a1 1 0 001.41 1.41l.71-.7a1 1 0 00-1.42-1.42l-.7.71zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path d="M17.29 13.29A8 8 0 016.71 2.71a8 8 0 1010.58 10.58z" />
        </svg>
      )}
    </button>
  );
}