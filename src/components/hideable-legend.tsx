"use client";

import { useSyncExternalStore } from "react";

// The icon legend at the bottom of 오늘 / 이번 주 / 이번 달 can be hidden once for all three.
// Remembered on this phone (localStorage), so it stays hidden after the app is closed.
const KEY = "legend-hidden";
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};
const write = (hidden: boolean) => {
  try {
    localStorage.setItem(KEY, hidden ? "1" : "0");
  } catch {}
  listeners.forEach((l) => l());
};

export default function HideableLegend({ children }: { children: React.ReactNode }) {
  const hidden = useSyncExternalStore(subscribe, read, () => false);
  if (hidden) {
    return (
      <button type="button" onClick={() => write(false)} className="mx-auto block py-1 text-xs font-bold text-muted underline">
        아이콘 설명 보기
      </button>
    );
  }
  return (
    <div className="relative">
      {children}
      <button type="button" onClick={() => write(true)} className="absolute right-3 top-2.5 text-[11px] font-bold text-muted underline">
        숨기기
      </button>
    </div>
  );
}
