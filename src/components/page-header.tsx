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

export function GuideButton() {
  return (
    <TLink href="/guide" kind="push" className="pb-1 text-[14px] font-bold text-blue">
      주요 기능
    </TLink>
  );
}
