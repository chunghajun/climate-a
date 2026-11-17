"use client";

import { useState, useTransition } from "react";
import { TLink } from "@/components/nav-transition";
import Wheel from "@/components/wheel";
import { daysLabel, nextOnce, type Alarm } from "@/lib/alarms";
import { DOW } from "@/lib/time";
import { saveAlarms } from "../actions/alarms";

const SMOOTH = "cubic-bezier(.2,.8,.2,1)";
const parts = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return { pm: h >= 12, h: h % 12 || 12, m };
};

export default function AlarmList({ initial, back }: { initial: Alarm[]; back: string }) {
  const [alarms, setAlarms] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState<{ index: number; draft: Alarm } | null>(null);
  const [shown, setShown] = useState(false); // sheet slid in
  const [, start] = useTransition();
  const [pick, setPick] = useState({ pm: 0, h: 0, m: 0 }); // wheel positions

  const sorted = [...alarms].sort((a, b) => a.time.localeCompare(b.time));
  const persist = (next: Alarm[]) => {
    setAlarms(next);
    start(() => saveAlarms(next));
  };

  function open(index: number) {
    const draft = index >= 0 ? { ...alarms[index], days: [...alarms[index].days] } : { id: `a${Date.now().toString(36)}`, time: "07:30", days: [], on: true };
    const p = parts(draft.time);
    setPick({ pm: p.pm ? 1 : 0, h: p.h - 1, m: p.m });
    setSheet({ index, draft });
    requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
  }
  function close() {
    setShown(false);
    setTimeout(() => setSheet(null), 380);
  }
  function save() {
    if (!sheet) return;
    const h = ((pick.h + 1) % 12) + (pick.pm ? 12 : 0);
    const time = `${String(h).padStart(2, "0")}:${String(pick.m).padStart(2, "0")}`;
    // no repeat days: rings once, the next time this time comes
    const draft = { ...sheet.draft, time, on: true, onceOn: sheet.draft.days.length ? null : nextOnce(time) };
    persist(sheet.index >= 0 ? alarms.map((a, i) => (i === sheet.index ? draft : a)) : [...alarms, draft]);
    close();
  }

  return (
    <>
      <div className="flex h-10 items-center justify-between">
        <TLink href={back} kind="pop" className="-ml-1 px-1 text-base font-bold text-navy" aria-label="뒤로">
          ‹ 뒤로
        </TLink>
        <span className="flex items-center gap-4">
          <button type="button" onClick={() => setEditing((v) => !v)} className="text-base font-bold text-navy">
            {editing ? "완료" : "편집"}
          </button>
          <button type="button" onClick={() => open(-1)} className="text-[28px] font-light leading-none text-navy" aria-label="알람 추가">
            +
          </button>
        </span>
      </div>
      <h1 className="mb-1 mt-1.5 font-serif text-[32px] font-bold">기후 알람</h1>
      <p className="mb-2.5 text-[13px] font-semibold text-muted">정한 시각에 내 위치의 날씨와 그날 챙길 것을 알려 드려요.</p>

      <div className="border-t border-line">
        {sorted.length === 0 && <p className="py-8 text-center text-sm text-muted">알람이 없어요. 오른쪽 위 +로 추가해 보세요.</p>}
        {sorted.map((a) => {
          const i = alarms.indexOf(a);
          const p = parts(a.time);
          return (
            <div key={a.id} className="flex items-center gap-3 border-b border-line py-3.5">
              {editing && (
                <button
                  type="button"
                  onClick={() => persist(alarms.filter((_, j) => j !== i))}
                  className="h-6 w-6 flex-none rounded-full bg-[#D9534F] font-black leading-6 text-white"
                  aria-label="삭제"
                >
                  −
                </button>
              )}
              <button type="button" onClick={() => open(i)} className={`min-w-0 flex-1 text-left transition-colors ${a.on ? "" : "text-faint"}`}>
                <span className="block text-[50px] font-light leading-[1.05] tracking-[-.02em] tabular-nums">
                  <small className="mr-1 text-[22px] font-normal">{p.pm ? "오후" : "오전"}</small>
                  {p.h}:{String(p.m).padStart(2, "0")}
                </span>
                <span className={`block text-sm font-semibold ${a.on ? "text-soft" : ""}`}>{daysLabel(a.days)}</span>
              </button>
              {!editing && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={a.on}
                  aria-label={`${a.time} 알람 ${a.on ? "끄기" : "켜기"}`}
                  onClick={() => persist(alarms.map((x, j) => (j === i ? { ...x, on: !x.on, onceOn: !x.on && !x.days.length ? nextOnce(x.time) : x.onceOn } : x)))}
                  className={`relative h-8 w-[52px] flex-none rounded-full transition-colors duration-200 ${a.on ? "bg-navy" : "bg-[#E4E4E4]"}`}
                >
                  <span
                    className="absolute left-0.5 top-0.5 h-7 w-7 rounded-full bg-white shadow"
                    style={{ transform: a.on ? "translateX(20px)" : "none", transition: `transform .25s cubic-bezier(.3,1.4,.5,1)` }}
                  />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {sheet && (
        <>
          <button
            type="button"
            aria-label="닫기"
            onClick={close}
            className="fixed inset-0 z-40 bg-ink/30"
            style={{ opacity: shown ? 1 : 0, transition: "opacity .25s ease" }}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] w-full max-w-md flex-col rounded-t-[22px] bg-paper pb-6 shadow-[0_-10px_30px_rgba(31,29,26,.2)]"
            style={{ transform: shown ? "none" : "translateY(100%)", transition: `transform .38s ${SMOOTH}` }}
          >
            <div className="flex h-12 items-center justify-between px-4">
              <button type="button" onClick={close} className="text-base font-bold text-navy">
                취소
              </button>
              <b className="text-base">{sheet.index >= 0 ? "알람 편집" : "알람 추가"}</b>
              <button type="button" onClick={save} className="text-base font-extrabold text-navy">
                저장
              </button>
            </div>
            <div className="relative mx-4 mb-1.5 mt-2 flex h-[216px] justify-center gap-1.5 overflow-hidden">
              <div className="pointer-events-none absolute inset-x-2 top-[90px] h-9 rounded-[10px] bg-[#ECECEC]" />
              <Wheel items={["오전", "오후"]} index={pick.pm} onPick={(i) => setPick((x) => ({ ...x, pm: i }))} wide />
              <Wheel items={Array.from({ length: 12 }, (_, i) => String(i + 1))} index={pick.h} onPick={(i) => setPick((x) => ({ ...x, h: i }))} />
              <Wheel items={Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"))} index={pick.m} onPick={(i) => setPick((x) => ({ ...x, m: i }))} />
              <div className="pointer-events-none absolute inset-0 z-[2] bg-[linear-gradient(var(--color-paper),rgba(255,255,255,0)_38%,rgba(255,255,255,0)_62%,var(--color-paper))]" />
            </div>
            <div className="mx-4 mt-2.5 rounded-2xl border border-line bg-white px-3.5 py-3">
              <span className="text-[15px] font-semibold">반복</span>
              <div className="mt-2 flex gap-1.5">
                {DOW.map((d, i) => {
                  const on = sheet.draft.days.includes(i);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        setSheet((s) => s && { ...s, draft: { ...s.draft, days: on ? s.draft.days.filter((x) => x !== i) : [...s.draft.days, i] } })
                      }
                      className={`h-9 w-9 rounded-full border text-[13px] font-extrabold ${on ? "border-navy bg-navy text-white" : `border-line bg-white ${i === 0 ? "text-coral" : "text-soft"}`}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs font-semibold text-muted">{daysLabel(sheet.draft.days)}</p>
            </div>
            {sheet.index >= 0 && (
              <button
                type="button"
                onClick={() => {
                  persist(alarms.filter((_, j) => j !== sheet.index));
                  close();
                }}
                className="mx-4 mt-3 rounded-2xl border border-line bg-white py-3 text-[15px] font-bold text-[#D9534F]"
              >
                알람 삭제
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
