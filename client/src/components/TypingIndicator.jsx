export default function TypingIndicator({ names }) {
  return (
    <div className="flex items-center gap-2 px-4 pb-2 text-xs text-slate-500" role="status" aria-live="polite">
      <span className="flex gap-0.5" aria-hidden="true">
        {[0, 150, 300].map((d) => (
          <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />
        ))}
      </span>
      {names.join(', ')} {names.length > 1 ? 'are' : 'is'} typing...
    </div>
  );
}