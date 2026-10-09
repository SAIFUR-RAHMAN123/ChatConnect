import ThemeToggle from './ThemeToggle';

export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-surface px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-100';

export function Logo({ className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z" />
        </svg>
      </span>
      <span className="text-xl font-semibold tracking-tight">ChatConnect</span>
    </div>
  );
}

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="relative flex min-h-full items-center justify-center px-4 py-10">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-md">
        <Logo className="mb-6 justify-center" />
        <div className="rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-6 text-center text-sm text-slate-600">{footer}</p>
      </div>
    </div>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
      {message}
    </div>
  );
}

export function SubmitButton({ loading, children, loadingText }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
      {loading ? loadingText : children}
    </button>
  );
}