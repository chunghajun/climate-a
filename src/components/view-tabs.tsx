import { TLink } from "./nav-transition";

const TABS = [
  { key: "today", href: "/", label: "오늘" },
  { key: "week", href: "/week", label: "이번 주" },
  { key: "month", href: "/month", label: "이번 달" },
] as const;

export default function ViewTabs({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <nav className="mb-4 flex gap-6 border-b border-line">
      {TABS.map((t, i) => (
        <TLink
          key={t.key}
          href={t.href}
          kind={i > TABS.findIndex((x) => x.key === active) ? "tab-next" : "tab-prev"}
          aria-current={active === t.key ? "page" : undefined}
          className={`relative pb-2.5 text-[15px] font-bold ${active === t.key ? "text-ink" : "text-faint"}`}
        >
          {t.label}
          {active === t.key && <span className="absolute inset-x-0 -bottom-px h-[2.5px] rounded bg-ink" />}
        </TLink>
      ))}
    </nav>
  );
}
