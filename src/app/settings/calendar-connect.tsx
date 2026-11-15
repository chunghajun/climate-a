"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { connectCalendar, disconnectCalendar, syncCalendarNow } from "../actions/settings";
import { btnPrimary, btnSecondary, input } from "@/components/ui";

export default function CalendarConnect({ url, lastSync }: { url: string | null; lastSync: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [guide, setGuide] = useState<"iphone" | "google">("iphone");

  async function run(fn: () => Promise<{ ok: boolean; count?: number; error?: string } | void>, done: string) {
    setBusy(true);
    setStatus("");
    const r = await fn();
    setBusy(false);
    if (r && !r.ok) setStatus(r.error ?? "실패했어요");
    else {
      setStatus(r && r.count !== undefined ? `${done} 앞으로 2주 일정 ${r.count}개를 가져왔어요.` : done);
      setValue("");
      router.refresh();
    }
  }

  if (url) {
    return (
      <div className="mt-3 space-y-2">
        <p className="text-sm">
          <span className="font-semibold text-indigo">✓ 연결됨</span>
          <span className="text-muted">
            {" "}
            · {new URL(url).hostname.includes("google") ? "구글 캘린더" : "아이폰(iCloud) 캘린더"}
            {lastSync && ` · 마지막 동기화 ${new Date(lastSync).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit", month: "numeric", day: "numeric" })}`}
          </span>
        </p>
        <p className="text-xs text-muted">한 시간마다 자동으로 다시 가져와요. 가져온 일정의 실내/야외, 옮길 수 있는지는 일정을 눌러 바꿀 수 있어요.</p>
        <div className="grid grid-cols-2 gap-2">
          <button disabled={busy} onClick={() => run(syncCalendarNow, "동기화했어요.")} className={btnSecondary}>
            지금 동기화
          </button>
          <button disabled={busy} onClick={() => run(disconnectCalendar, "연결을 끊고 가져온 일정을 지웠어요.")} className={btnSecondary}>
            연결 끊기
          </button>
        </div>
        {status && <p className="text-sm text-muted">{status}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#F1EDE5] p-1 text-sm font-semibold">
        {(["iphone", "google"] as const).map((g) => (
          <button key={g} onClick={() => setGuide(g)} className={`rounded-lg py-2 ${guide === g ? "bg-white shadow-sm" : "text-muted"}`}>
            {g === "iphone" ? "아이폰 캘린더" : "구글 캘린더"}
          </button>
        ))}
      </div>
      {guide === "iphone" ? (
        <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed">
          <li>
            아이폰 <b>캘린더 앱</b> → 아래 <b>캘린더</b>를 눌러요
          </li>
          <li>
            가져올 캘린더 옆 <b>ⓘ</b>를 눌러요 (iCloud 캘린더만 돼요)
          </li>
          <li>
            맨 아래 <b>공개 캘린더</b>를 켜고 <b>링크 공유… → 복사</b>
          </li>
          <li>아래 칸에 붙여넣기</li>
          <li className="list-none text-xs text-muted">
            ⚠️ 공개 캘린더 링크는 링크를 아는 사람이면 누구나 볼 수 있어요. 테스트가 끝나면 공개를 꺼 주세요.
          </li>
        </ol>
      ) : (
        <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed">
          <li>
            컴퓨터에서 <b>calendar.google.com</b> → 오른쪽 위 ⚙️ <b>설정</b>
          </li>
          <li>
            왼쪽 <b>내 캘린더의 설정</b>에서 캘린더를 골라요
          </li>
          <li>
            <b>캘린더 통합 → iCal 형식의 비공개 주소</b>를 복사해요
          </li>
          <li>아래 칸에 붙여넣기 (비공개 주소라 다른 사람은 볼 수 없어요)</li>
        </ol>
      )}
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="webcal:// 또는 https:// 로 시작하는 링크" className={input} />
      <button disabled={busy || !value.trim()} onClick={() => run(() => connectCalendar(value), "연결했어요!")} className={btnPrimary}>
        {busy ? "가져오는 중…" : "캘린더 연결하기"}
      </button>
      {status && <p className="text-sm text-muted">{status}</p>}
    </div>
  );
}
