"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveDatedEvents, type DatedRow } from "../actions/events";
import { btnPrimary, input } from "@/components/ui";
import { DOW, dowOf } from "@/lib/time";

type Row = DatedRow & { on: boolean; tbd: boolean };

// Review list for events read from another calendar app: each is a one-off, dated event.
// Everything starts ticked and 시간 미정; any time the AI read is kept ready
// in case the tester unticks 시간 미정.
export default function CalendarReview({ initial, back, onError }: { initial: DatedRow[]; back: string; onError: (e: string) => void }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(
    initial.map((r) => ({ ...r, end: r.end || (r.start ? plusHour(r.start) : ""), on: true, tbd: true }))
  );
  const [busy, setBusy] = useState(false);
  const chosen = rows.filter((r) => r.on);

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function save() {
    setBusy(true);
    onError("");
    const result = await saveDatedEvents(
      chosen.map(({ title, date, start, end, tbd }) => (tbd ? { title, date, start: "", end: "" } : { title, date, start, end }))
    );
    if (result.ok) router.push(back);
    else {
      onError(result.error ?? "저장 실패");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <section key={i} className={`rounded-[20px] border border-line bg-white p-3.5 transition-opacity ${r.on ? "" : "opacity-50"}`}>
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={r.on}
              onChange={(e) => update(i, { on: e.target.checked })}
              aria-label="이 일정 넣기"
              className="h-5 w-5 flex-none accent-[#3A6FD8]"
            />
            <input value={r.title} onChange={(e) => update(i, { title: e.target.value })} maxLength={40} aria-label="제목" className={`${input} min-w-0 py-2.5`} />
          </div>

          <div className="mt-2.5 flex items-center gap-2 pl-[30px]">
            <input type="date" value={r.date} onChange={(e) => update(i, { date: e.target.value })} aria-label="날짜" className={`${input} min-w-0 flex-1 py-2.5`} />
            <span className="flex-none text-[13px] font-bold text-soft">{r.date ? `${DOW[dowOf(r.date)]}요일` : ""}</span>
          </div>

          <div className="mt-2.5 pl-[30px]">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-bold text-muted">
                시간{r.tbd && r.start ? <span className="ml-1 font-semibold">(캡처에서 읽은 시간: {r.start})</span> : null}
              </span>
              <label className="flex items-center gap-1.5 text-[13px] font-semibold text-soft">
                <input
                  type="checkbox"
                  checked={r.tbd}
                  onChange={(e) => update(i, e.target.checked ? { tbd: true } : { tbd: false, start: r.start || "09:00", end: r.end || "10:00" })}
                  className="h-4 w-4 accent-[#3A6FD8]"
                />
                시간 미정
              </label>
            </div>
            <div className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 ${r.tbd ? "opacity-40" : ""}`}>
              <input
                type="time"
                value={r.tbd ? "" : r.start}
                disabled={r.tbd}
                onChange={(e) => update(i, { start: e.target.value, end: r.end && r.end > e.target.value ? r.end : plusHour(e.target.value) })}
                aria-label="시작"
                className={`${input} min-w-0 py-2.5`}
              />
              <span className="text-muted">~</span>
              <input
                type="time"
                value={r.tbd ? "" : r.end}
                disabled={r.tbd}
                onChange={(e) => update(i, { end: e.target.value })}
                aria-label="끝"
                className={`${input} min-w-0 py-2.5`}
              />
            </div>
          </div>
        </section>
      ))}
      <p className="px-1 text-xs leading-relaxed text-muted">시간 미정 일정도 저장돼요. 시간을 정하면 날씨 알림도 드려요.</p>
      <button type="button" onClick={save} disabled={busy || chosen.length === 0} className={btnPrimary}>
        {busy ? "저장 중…" : `${chosen.length}개 일정 넣기`}
      </button>
    </div>
  );
}

function plusHour(t: string) {
  if (!/^\d{2}:\d{2}$/.test(t)) return "";
  const [h, m] = t.split(":").map(Number);
  return h >= 23 ? "23:59" : `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
