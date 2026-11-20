"use client";

import { useState } from "react";
import { answerSuggestion } from "@/app/actions/suggest";
import { WeatherIcon } from "@/components/icons";
import type { Suggestion } from "@/lib/suggest";

// 비 주의: a movable (유동) plan that may get rain. It only tells; nothing about the plan changes.
// "확인했어요" records that the tester saw it (H3 data), then the card folds into one line.
export default function SuggestionCard({ s, dayLabel }: { s: Suggestion; dayLabel?: string }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const pop = s.pop ?? null;
  const tip = pop !== null && pop >= 60 ? "우산을 꼭 챙기세요." : "접는 우산을 챙기면 좋아요.";

  async function ack() {
    setBusy(true);
    await answerSuggestion(s.id, { kind: "ack" });
    setDone(true);
    setBusy(false);
  }

  if (done)
    return (
      <p className="rounded-[18px] bg-gray px-4 py-3 text-sm text-soft">
        <b className="text-ink">{s.title}</b> 비 소식 확인했어요. 조심히 다녀오세요.
      </p>
    );

  return (
    <section className="rounded-[20px] border-[1.5px] border-sky2 bg-white p-4">
      <p className="text-[12.5px] font-bold text-blue">비 주의{dayLabel ? ` · ${dayLabel}` : ""}</p>
      <h2 className="mt-1.5 text-[17px] font-extrabold leading-snug tracking-[-.02em]">{s.title} 때 비가 올 수 있어요</h2>
      <div className="mt-3 flex items-center gap-3 rounded-[14px] bg-gray px-3.5 py-3">
        <span className="text-[16px] font-extrabold">{s.start}</span>
        <span className="min-w-0 flex-1 border-l-2 border-[#C9C9CE] pl-3">
          <b className="block truncate text-[15px]">{s.title}</b>
          <span className="block text-[12.5px] text-muted">
            {s.start}–{s.end}{s.setting ? ` · ${s.setting === "indoor" ? "실내" : "야외"}` : ""}
          </span>
        </span>
        <span className="flex flex-col items-center">
          <WeatherIcon kind="rain" size={26} />
          <b className="text-[13px] font-extrabold text-blue">비 {pop ?? "-"}%</b>
        </span>
      </div>
      <p className="mx-0.5 mt-2.5 text-[13.5px] text-soft">{tip}</p>
      <button type="button" disabled={busy} onClick={ack} className="mt-3 h-11 w-full rounded-[13px] bg-gray text-[15px] font-extrabold disabled:opacity-50">
        확인했어요
      </button>
    </section>
  );
}
