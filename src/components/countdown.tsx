"use client";

import { useEffect, useState } from "react";

function kstMinutes() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value])
  );
  return Number(p.hour) * 60 + Number(p.minute);
}

// "39분 후 출발" that keeps counting down on the phone, without asking the server.
export default function Countdown({ departMin, initialNow }: { departMin: number; initialNow: number }) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    // Sync once on mount (the page may have been rendered a while ago), then every 30 s.
    const tick = () => setNow(kstMinutes());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);

  const left = departMin - now;
  return <>{left <= 0 ? "지금 출발하세요" : left >= 60 ? `${Math.floor(left / 60)}시간 ${left % 60}분 후 출발` : `${left}분 후 출발`}</>;
}
