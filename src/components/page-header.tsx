import Link from "next/link";
import { TLink } from "./nav-transition";

// Big bold title with the date (or a control) on the right, as in the A안 design.
// Settings lives in the bottom tab bar now, so the header has no gear button.
export default function PageHeader({ kicker, title, right }: { kicker?: string; title: string; right?: React.ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <h1 className="text-[28px] font-extrabold leading-tight tracking-[-.03em]">{title}</h1>
      {right ?? (kicker && <span className="pb-1 text-[14px] text-soft">{kicker}</span>)}
    </header>
  );
}

// 달력 tab: 주간 · 월간 switch in the header, then ‹ period ›.
export function CalendarHeader({ view, label, prev, next }: { view: "week" | "month"; label: string; prev: string; next: string }) {
  const seg = (on: boolean) => `rounded-[11px] px-4 py-2 text-[14px] ${on ? "bg-white font-bold text-ink shadow-[0_1px_3px_rgba(0,0,0,.08)]" : "text-[#8a8a8a]"}`;
  const arrow = "flex h-9 w-9 items-center justify-center text-[20px] text-[#8a8a8a]";
  return (
    <>
      <PageHeader
        title="달력"
        right={
          <div className="flex rounded-[14px] bg-gray p-1">
            <TLink href="/week" kind="tab-prev" aria-current={view === "week" ? "page" : undefined} className={seg(view === "week")}>
              주간
            </TLink>
            <TLink href="/month" kind="tab-next" aria-current={view === "month" ? "page" : undefined} className={seg(view === "month")}>
              월간
            </TLink>
          </div>
        }
      />
      <div className="-mt-1 mb-2 flex items-center justify-between">
        <Link href={prev} className={arrow} aria-label="이전">
          ‹
        </Link>
        <b className="text-[15px]">{label}</b>
        <Link href={next} className={arrow} aria-label="다음">
          ›
        </Link>
      </div>
    </>
  );
}

export function GuideButton() {
  return (
    <TLink href="/guide" kind="push" className="pb-1 text-[14px] font-bold text-blue">
      주요 기능
    </TLink>
  );
}
