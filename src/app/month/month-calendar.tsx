"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { isOutfit, type AdviceKey, type WeatherKind } from "@/lib/advice";
import { DOW, dowOf } from "@/lib/time";
import { AdviceBadge, WeatherIcon } from "@/components/icons";

export type MonthCell = {
  date: string;
  inMonth: boolean;
  kind: WeatherKind | null;
  hi: number | null;
  lo: number | null;
  advice: AdviceKey[];
  colder: boolean;
  events: {
    id: string;
    title: string;
    start: string;
    end: string;
    untimed: boolean;
    place: string;
    outdoor: boolean;
    flexible: boolean;
    repeat: boolean; // 매주 반복
    bg: string;
    fg: string;
    bar: string;
  }[];
};

const HIDE_KEY = "month-hide-repeat";
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const readHide = () => {
  try {
    return localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
};

export default function MonthCalendar({ cells, today, initial }: { cells: MonthCell[]; today: string; initial: string }) {
  const [selected, setSelected] = useState(initial);
  const sel = cells.find((c) => c.date === selected);
  // "반복 일정 빼고 보기" only thins out the grid; tapping a day still lists everything.
  // Remembered on this phone only.
  const hideRepeat = useSyncExternalStore(subscribe, readHide, () => false);
  const toggle = (v: boolean) => {
    try {
      localStorage.setItem(HIDE_KEY, v ? "1" : "0");
    } catch {}
    listeners.forEach((l) => l());
  };
  const shown = (c: MonthCell) => (hideRepeat ? c.events.filter((e) => !e.repeat) : c.events);

  return (
    <>
      <label className="mb-2 flex items-center justify-end gap-1.5 text-[13px] font-semibold text-soft">
        <input type="checkbox" checked={hideRepeat} onChange={(e) => toggle(e.target.checked)} className="h-4 w-4 accent-[#3A6FD8]" />
        반복 일정 빼고 보기
      </label>
      <section className="rounded-[20px] border border-line bg-white px-2 pb-2 pt-2.5">
        <div className="grid grid-cols-7 pb-1.5 text-center text-[11px] font-extrabold text-faint">
          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
            <div key={d} className={d === 6 ? "text-lo" : d === 0 ? "text-coral" : ""}>
              {DOW[d]}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 border-t border-[#F0F0F0]">
          {cells.map((c) => {
            const dow = dowOf(c.date);
            const isToday = c.date === today;
            const past = c.date < today;
            const isSel = c.date === selected;
            return (
              <button
                key={c.date}
                onClick={() => setSelected(c.date)}
                className={`flex h-[68px] flex-col justify-start overflow-hidden border-b border-[#F4F4F5] px-0.5 pt-1 text-left ${c.inMonth ? "" : "opacity-30"} ${isSel ? "rounded-[10px] bg-[#FBF3EC] shadow-[inset_0_0_0_1.5px_var(--color-coral)]" : ""}`}
              >
                <div className="flex h-5 items-center justify-between px-0.5">
                  <b
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-extrabold ${
                      isToday ? "bg-navy text-white" : past ? "text-[#9A9A9A]" : dow === 6 ? "text-lo" : dow === 0 ? "text-coral" : ""
                    }`}
                  >
                    {Number(c.date.slice(8))}
                  </b>
                  <span className={past ? "opacity-45" : ""}>
                    <WeatherIcon kind={c.kind} size={17} />
                  </span>
                </div>
                {shown(c).slice(0, 2).map((e) => (
                  <span
                    key={e.id}
                    className="mx-px mt-[3px] block overflow-hidden whitespace-nowrap rounded px-[3px] py-px text-[9px] font-extrabold tracking-tight"
                    style={{ background: e.bg, color: e.fg }}
                  >
                    {e.title}
                  </span>
                ))}
                {shown(c).length > 2 && <span className="block px-[3px] text-[9px] font-extrabold text-[#9A9A9A]">+{shown(c).length - 2}</span>}
              </button>
            );
          })}
        </div>
      </section>

      {sel && (
        <section className="mt-3 rounded-[20px] border border-line bg-white px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-serif text-[19px] font-bold">
              {Number(sel.date.slice(5, 7))}월 {Number(sel.date.slice(8))}일 {DOW[dowOf(sel.date)]}요일
            </h3>
            <div className="flex items-center gap-1.5 text-xs font-extrabold">
              <WeatherIcon kind={sel.kind} size={26} />
              {sel.hi != null && <span className="text-hi">{sel.hi}°</span>}
              {sel.lo != null && <span className="text-lo">{sel.lo}°</span>}
              {sel.date >= today && sel.advice.map((k) => <AdviceBadge key={k} k={k} size={22} colder={isOutfit(k) && sel.colder} />)}
            </div>
          </div>
          {sel.events.length === 0 ? (
            <p className="pt-2.5 text-sm text-soft">일정이 없어요.</p>
          ) : (
            sel.events.map((e) => (
              <Link key={e.id} href={`/events/${e.id}?from=/month`} className="flex items-stretch gap-2.5 pt-2.5">
                <i className="w-1 flex-none rounded" style={{ background: e.bar }} />
                <span>
                  <b className="text-sm">{e.title}</b>
                  <span className="mt-px block text-[11.5px] font-semibold text-muted">
                    {[e.untimed ? "시간 미정" : `${e.start}–${e.end}`, e.repeat ? "매주" : null, e.place, e.outdoor ? "야외" : "실내", e.flexible ? "옮길 수 있음" : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </Link>
            ))
          )}
          <Link href={`/events/new?from=/month&date=${sel.date}`} className="mt-3 block text-center text-[13px] font-bold text-navy">
            + 이 날 일정 추가
          </Link>
        </section>
      )}
    </>
  );
}
