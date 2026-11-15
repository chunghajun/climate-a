"use client";

import { useState } from "react";
import { answerSuggestion, type Choice } from "@/app/actions/suggest";
import type { Suggestion } from "@/lib/suggest";

export default function SuggestionCard({ s, dayLabel }: { s: Suggestion; dayLabel?: string }) {
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  async function answer(choice: Choice, message: string) {
    setBusy(true);
    await answerSuggestion(s.id, choice);
    setDone(message);
    setBusy(false);
  }

  if (done) return <p className="rounded-[20px] border border-line bg-white p-4 text-sm font-semibold text-navy">{done}</p>;

  const btn = "w-full rounded-xl border border-line bg-paper px-3 py-3 text-left font-semibold disabled:opacity-50";
  return (
    <section className="rounded-[20px] border border-line border-l-4 border-l-coral bg-white p-4">
      <p className="text-[11px] font-extrabold tracking-[.06em] text-coral">일정 바꿔 보기{dayLabel ? ` · ${dayLabel}` : ""}</p>
      <h2 className="mt-1.5 font-serif text-lg font-bold leading-snug">
        {s.title}({s.start}) 할 때 비 올 확률이 {s.pop ?? "-"}%예요
      </h2>
      <p className="mt-1 text-sm text-muted">
        {s.moves.length ? "비를 피할 수 있는 시간을 찾아봤어요. 이렇게 바꿔 볼까요?" : "오늘은 비를 피할 시간이 마땅치 않아요. 실내에서 해 보는 건 어때요?"}
      </p>
      <div className="mt-3 space-y-2">
        {s.moves.map((m) => (
          <button
            key={m.start}
            disabled={busy}
            className={btn}
            onClick={() => answer({ kind: "move", start: m.start, end: m.end }, `${m.start}로 옮겼어요. 그 시간 기준으로 다시 알려 드릴게요!`)}
          >
            🕒 {m.start}–{m.end}로 옮기기 <span className="font-normal text-muted">· 비 {m.pop}%</span>
          </button>
        ))}
        <button disabled={busy} className={btn} onClick={() => answer({ kind: "indoor" }, "실내 일정으로 바꿨어요. 비 걱정 없이 다녀오세요!")}>
          🏠 실내에서 하기
        </button>
        <button
          disabled={busy}
          className="w-full py-2 text-sm text-muted underline"
          onClick={() => answer({ kind: "keep" }, "그대로 둘게요. 우산 꼭 챙기세요 ☔")}
        >
          그대로 할게요
        </button>
      </div>
    </section>
  );
}
