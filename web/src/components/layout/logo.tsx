export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="7"
        className="fill-surface-2 stroke-border"
        strokeWidth="1.5"
      />
      <ellipse cx="16" cy="9.5" rx="8" ry="3" className="stroke-mint fill-none" strokeWidth="1.8" />
      <path
        d="M8 9.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"
        className="stroke-mint fill-none"
        strokeWidth="1.8"
      />
      <path d="M8 15.5v6c0 1.7 3.6 3 8 3" className="stroke-mint fill-none" strokeWidth="1.8" />
      <path
        d="M20.5 20.5l2.2 2.2 4-4.4"
        className="stroke-foreground fill-none"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
