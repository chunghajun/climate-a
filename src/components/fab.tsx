"use client";

import { useRef, useState } from "react";
import { TLink } from "./nav-transition";
import { usePathname } from "next/navigation";

const EASE = "cubic-bezier(.4,0,.2,1)";
const OUT = "cubic-bezier(.2,.8,.2,1)";

// The "+" button: every way of adding plans lives here, and each returns to the current view.
// Opening: the + turns into × (0.38s), the backdrop fades in, the menu rises from the button
// and its items appear one after another. Closing is a little quicker.
export default function Fab({ date }: { date?: string }) {
  const [open, setOpen] = useState(false);
  const [dim, setDim] = useState(false);
  const hide = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toggle = (v: boolean) => {
    clearTimeout(hide.current);
    if (v) setDim(true);
    else hide.current = setTimeout(() => setDim(false), 240); // after the fade-out
    setOpen(v);
  };
  const from = usePathname() || "/";
  const q = new URLSearchParams({ from, ...(date ? { date } : {}) }).toString();
  const items = [
    { href: `/events/new?${q}`, title: "일정 추가", sub: "한 번 또는 매주 반복" },
    { href: `/timetable?from=${encodeURIComponent(from)}`, title: "캡처로 넣기", sub: "에브리타임 시간표 · 다른 달력 앱 화면" },
    { href: `/alarms?from=${encodeURIComponent(from)}`, title: "기후 알람", sub: "날씨와 챙길 것을 알려 줄 시각" },
  ];

  return (
    <>
      {/* The backdrop is taken out of the page once it has faded, so no dimmed strip can linger
          (iPhone home-screen apps did not repaint the status-bar area under an invisible layer). */}
      {dim && (
        <button
          aria-label="닫기"
          className="fixed inset-0 z-30 bg-ink/30"
          style={{ opacity: open ? 1 : 0, transition: `opacity ${open ? ".28s" : ".2s"} ease`, animation: open ? "fab-dim .28s ease" : undefined }}
          onClick={() => toggle(false)}
        />
      )}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-5">
        <div
          aria-hidden={!open}
          className={`mb-3 ml-auto w-64 origin-bottom-right overflow-hidden rounded-[20px] border border-line bg-white shadow-xl ${open ? "pointer-events-auto" : ""}`}
          style={{
            opacity: open ? 1 : 0,
            transform: open ? "none" : "translateY(10px) scale(.96)",
            transition: open ? `opacity .22s ${EASE}, transform .28s ${OUT}` : `opacity .16s ${EASE}, transform .2s ${OUT}`,
          }}
        >
          {items.map((it, i) => (
            <TLink
              key={it.title}
              href={it.href}
              kind="push"
              tabIndex={open ? 0 : -1}
              className="block border-b border-line px-4 py-3 last:border-0"
              style={{
                opacity: open ? 1 : 0,
                transform: open ? "none" : "translateY(6px)",
                transition: `opacity .2s ease, transform .26s ${OUT}`,
                transitionDelay: open ? `${0.05 + i * 0.04}s` : "0s",
              }}
              onClick={() => toggle(false)}
            >
              <span className="block text-[15px] font-bold">{it.title}</span>
              <span className="block text-xs text-muted">{it.sub}</span>
            </TLink>
          ))}
        </div>
        <button
          onClick={() => toggle(!open)}
          aria-label={open ? "메뉴 닫기" : "일정 추가 메뉴"}
          className="pointer-events-auto ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white shadow-[0_10px_22px_rgba(31,29,26,.3)] transition-transform duration-150 active:scale-95"
        >
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ transform: open ? "rotate(135deg)" : "none", transition: `transform ${open ? ".38s" : ".3s"} ${EASE}` }}
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
    </>
  );
}
