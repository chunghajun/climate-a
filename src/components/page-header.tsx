import Link from "next/link";
import { TLink } from "./nav-transition";

// Big serif title with a small kicker line, as in the planner design.
export default function PageHeader({
  kicker,
  title,
  count,
  right,
}: {
  kicker: string;
  title: string;
  count?: number;
  right?: React.ReactNode;
}) {
  return (
    <header className="mb-3.5 flex items-end justify-between gap-3">
      <div>
        <p className="text-xs font-bold tracking-[.06em] text-muted">{kicker}</p>
        <h1 className="mt-1 font-serif text-[27px] font-bold leading-tight tracking-tight">
          {title}
          {count !== undefined && <span className="ml-2 text-coral">{count}</span>}
        </h1>
      </div>
      {right ?? <SettingsButton />}
    </header>
  );
}

export function SettingsButton() {
  return (
    <TLink
      href="/settings"
      kind="push"
      aria-label="설정"
      className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-line bg-white text-soft"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </TLink>
  );
}

export function GuideButton() {
  return (
    <TLink
      href="/guide"
      kind="push"
      aria-label="주요 기능"
      className="flex h-10 flex-none items-center gap-1 rounded-full border border-line bg-white px-3 text-[13px] font-bold text-soft"
    >
      <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-navy text-[11px] text-white">?</span>
      기능
    </TLink>
  );
}

export function HeaderButtons() {
  return (
    <div className="flex flex-none gap-1.5">
      <GuideButton />
      <SettingsButton />
    </div>
  );
}

export function NavArrows({ prev, next }: { prev: string; next: string }) {
  const cls = "flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-lg font-bold text-muted";
  return (
    <div className="flex flex-none gap-1.5">
      <Link href={prev} className={cls} aria-label="이전">
        ‹
      </Link>
      <Link href={next} className={cls} aria-label="다음">
        ›
      </Link>
      <SettingsButton />
    </div>
  );
}
