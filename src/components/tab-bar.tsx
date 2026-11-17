"use client";

// Bottom tab bar (A안): 오늘 · 달력 · 설정. 달력 covers both the week and the month view.
// It lives in the root layout, outside the page transition, so it stays still while pages change.
import { usePathname } from "next/navigation";
import { TLink } from "./nav-transition";

const TABS = [
  { href: "/", label: "오늘", match: (p: string) => p === "/" },
  { href: "/calendar", label: "달력", match: (p: string) => p === "/calendar" },
  { href: "/settings", label: "설정", match: (p: string) => p === "/settings" },
];

export default function TabBar() {
  const path = usePathname() || "/";
  const active = TABS.findIndex((t) => t.match(path));
  if (active < 0) return null; // screens opened from a tab (일정 추가, 기후 알람 …) have a back button instead
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] transition-[filter] duration-300 [body[data-menu-open]_&]:pointer-events-none [body[data-menu-open]_&]:brightness-[.62]">
      <div className="mx-auto flex h-[60px] max-w-md">
        {TABS.map((t, i) => (
          <TLink
            key={t.href}
            href={t.href}
            kind={i > active ? "tab-next" : "tab-prev"}
            aria-current={i === active ? "page" : undefined}
            className={`relative flex flex-1 items-center justify-center text-[15px] ${i === active ? "font-bold text-ink" : "text-muted"}`}
          >
            {t.label}
            {i === active && <span className="absolute bottom-2.5 h-[2.5px] w-11 rounded bg-blue" />}
          </TLink>
        ))}
      </div>
    </nav>
  );
}
