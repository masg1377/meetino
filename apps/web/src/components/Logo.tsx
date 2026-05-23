export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 40 40"
        aria-hidden="true"
        className="h-9 w-9 text-brand-600 dark:text-brand-400"
      >
        <rect x="3" y="9" width="24" height="22" rx="5" fill="currentColor" />
        <path d="M27 17l9-5v16l-9-5z" fill="currentColor" opacity="0.7" />
      </svg>
      <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
        میتینو
      </span>
    </div>
  );
}
