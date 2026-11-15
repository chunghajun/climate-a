"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const STALE_MS = 2 * 60_000; // coming back after this long → reload the data
const EVERY_MS = 5 * 60_000; // while open, follow the 5-minute server refresh

// Keeps a view current without a manual reload: quietly re-fetches the page data when
// the app comes back to the foreground (iPhone home-screen apps resume old screens),
// and every five minutes while it stays open. Only shows something when offline.
export default function AutoRefresh() {
  const router = useRouter();
  const last = useRef(0);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    last.current = Date.now(); // the page was just rendered with fresh data
    const refresh = (force = false) => {
      if (document.visibilityState !== "visible") return;
      if (!force && Date.now() - last.current < STALE_MS) return;
      if (!navigator.onLine) {
        setOffline(true);
        return;
      }
      setOffline(false);
      last.current = Date.now();
      router.refresh();
    };
    const onVisible = () => refresh();
    const onShow = (e: PageTransitionEvent) => refresh(e.persisted);
    const onOnline = () => refresh(true);
    const onOffline = () => setOffline(true);
    const timer = window.setInterval(() => refresh(true), EVERY_MS);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onShow);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [router]);

  if (!offline) return null;
  return (
    <p className="fixed inset-x-0 top-2 z-50 mx-auto w-fit rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold text-white shadow-lg">
      인터넷 연결을 확인해 주세요 · 날씨가 최신이 아닐 수 있어요
    </p>
  );
}
