// Small line icons (no emoji). They take the text colour, so a parent's `text-blue` colours them.
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
type P = { size?: number; className?: string };

export function CheckIcon({ size = 14, className }: P) {
  return (
    <svg {...base} strokeWidth={3.2} width={size} height={size} className={className} aria-hidden>
      <path d="M5 12.5 10 17 19 7.5" />
    </svg>
  );
}

export function CloseIcon({ size = 22, className }: P) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 18, className }: P) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function PinIcon({ size = 18, className }: P) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden>
      <path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2.2" />
    </svg>
  );
}

export function BellIcon({ size = 24, className }: P) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function CameraIcon({ size = 24, className }: P) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export function InfoIcon({ size = 22, className }: P) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.6v.01" strokeWidth={2.8} />
    </svg>
  );
}

export function PlusIcon({ size = 18, className }: P) {
  return (
    <svg {...base} strokeWidth={2.4} width={size} height={size} className={className} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
