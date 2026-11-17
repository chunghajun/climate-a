"use client";

// 달력 (iPhone-calendar style): one continuous calendar that you stretch from a month overview
// into a week view — dots → bars → titled blocks → blocks with time and place. Pinch with two
// fingers (or drag the weekday bar, or Ctrl + wheel); on release it settles on the nearest level,
// and the touched week stays where it is. The forecast days carry a weather icon under the date;
// details (기온, 비, 강수량) and things to bring open in sheets.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ADVICE_LABEL, isOutfit, skyLabel, type AdviceKey, type WeatherKind } from "@/lib/advice";
import { DOW, dowOf } from "@/lib/time";
import { AdviceBadge } from "@/components/icons";
import { TLink } from "@/components/nav-transition";
import WxIcon, { wxKind } from "@/components/wx-icons";

export type CalEvt = {
  id: string;
  title: string;
  start: string;
  end: string;
  place: string;
  outdoor: boolean;
  repeat: boolean;
  pop: number | null;
};
export type CalDay = { date: string; events: CalEvt[] };
export type CalWeather = {
  kind: WeatherKind;
  hi: number | null;
  lo: number | null;
  pop: number | null;
  mm: number | null;
  advice: AdviceKey[];
  colder: boolean;
  mid: boolean;
};

const LEVELS = [70, 100, 142, 210]; // 촘촘 · 막대 · 블록 · 주간 — 주간 grows to fit the busiest day
const levelOf = (rh: number) => (rh < 85 ? 0 : rh < 121 ? 1 : rh < 176 ? 2 : 3);
const LABEL_H = 28; // month label row
const SMOOTH = "cubic-bezier(.2,.8,.2,1)";
// 매주 수업 blue, 한 번 일정 green, 시간 미정 amber
const colorOf = (e: CalEvt) => (!e.start ? "#E0912F" : e.repeat ? "#3A6FD8" : "#22A06B");

// small localStorage-backed preference, read without a setState-in-effect
function usePref(key: string, fallback: string) {
  const subscribe = useCallback(
    (l: () => void) => {
      window.addEventListener("storage", l);
      window.addEventListener(`pref:${key}`, l);
      return () => {
        window.removeEventListener("storage", l);
        window.removeEventListener(`pref:${key}`, l);
      };
    },
    [key],
  );
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },
    () => fallback,
  );
  const set = (v: string) => {
    try {
      localStorage.setItem(key, v);
    } catch {}
    window.dispatchEvent(new Event(`pref:${key}`));
  };
  return [value, set] as const;
}

const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`;

export default function CalendarView({ days, weather, today, place }: { days: CalDay[]; weather: Record<string, CalWeather>; today: string; place: string }) {
  const sc = useRef<HTMLDivElement>(null);
  const rh = useRef(LEVELS[0]);
  const levels = useRef([...LEVELS]);
  const anim = useRef(0);
  const [title, setTitle] = useState(today.slice(0, 7));
  const [sheet, setSheet] = useState<{ kind: "day"; date: string } | { kind: "wx" } | null>(null);
  const [shown, setShown] = useState(false);
  const [hideRepeat, setHideRepeat] = usePref("cal-hide-repeat", "0");
  const [savedLevel, setSavedLevel] = usePref("cal-level", "0");

  const weeks = useMemo(() => {
    const out: CalDay[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [days]);
  const shownEvents = (d: CalDay) => (hideRepeat === "1" ? d.events.filter((e) => !e.repeat) : d.events);

  // ---- zoom: everything below works on the DOM directly so a pinch never re-renders React ----
  const apply = useCallback((h: number) => {
    const el = sc.current;
    if (!el) return;
    rh.current = h;
    el.style.setProperty("--rh", `${h}px`);
    el.dataset.lv = String(levelOf(h));
  }, []);

  const updateTitle = useCallback(() => {
    const el = sc.current;
    if (!el) return;
    // the month of the week a third of the way down, where today's week sits when opened
    const y = el.scrollTop + el.clientHeight / 3;
    let m = "";
    el.querySelectorAll<HTMLElement>("[data-wk]").forEach((w) => {
      if (w.offsetTop <= y || !m) m = w.dataset.wk!;
    });
    if (m) setTitle(m);
  }, []);

  // zoom around a point (px from the scroller's top) so the week under it stays put
  const zoomTo = useCallback(
    (h: number, anchor: number) => {
      const el = sc.current;
      if (!el) return;
      const lv = levels.current;
      h = Math.max(lv[0] - 10, Math.min(lv[3] + 50, h));
      const y = el.scrollTop + anchor;
      const labels = [...el.querySelectorAll<HTMLElement>("[data-month]")].filter((l) => l.offsetTop < y).length * LABEL_H;
      const rows = (y - labels) / rh.current;
      apply(h);
      el.scrollTop = rows * h + labels - anchor;
    },
    [apply],
  );

  const todayAnchor = useCallback(() => {
    const el = sc.current;
    const t = el?.querySelector<HTMLElement>("[data-today]");
    if (!el || !t) return 0;
    const r = t.getBoundingClientRect();
    const s = el.getBoundingClientRect();
    return Math.max(0, Math.min(s.height, r.top - s.top + rh.current / 2));
  }, []);

  const settle = useCallback(
    (target: number | null, anchor: number) => {
      cancelAnimationFrame(anim.current);
      const lv = levels.current;
      const to = target ?? lv.reduce((a, b) => (Math.abs(b - rh.current) < Math.abs(a - rh.current) ? b : a));
      const from = rh.current;
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / 360);
        zoomTo(from + (to - from) * (1 - Math.pow(1 - k, 3)), anchor);
        if (k < 1) anim.current = requestAnimationFrame(step);
        else {
          updateTitle();
          setSavedLevel(String(lv.indexOf(to)));
        }
      };
      anim.current = requestAnimationFrame(step);
    },
    [zoomTo, updateTitle, setSavedLevel],
  );

  // the 주간 level is as tall as the busiest day needs, so no plan is ever cut off
  const fit = useCallback(() => {
    const el = sc.current;
    if (!el) return;
    const keepLv = el.dataset.lv;
    el.dataset.lv = "3";
    el.querySelectorAll<HTMLElement>(".cal-wk").forEach((w) => (w.style.height = "auto"));
    let need = 0;
    el.querySelectorAll<HTMLElement>(".cal-c").forEach((c) => (need = Math.max(need, c.scrollHeight)));
    el.querySelectorAll<HTMLElement>(".cal-wk").forEach((w) => (w.style.height = ""));
    el.dataset.lv = keepLv;
    levels.current[3] = Math.max(LEVELS[3], need + 10);
  }, []);

  // first paint: the remembered level, today's week a third of the way down
  useLayoutEffect(() => {
    const el = sc.current;
    if (!el) return;
    fit();
    const i = Math.max(0, Math.min(3, Number(savedLevel) || 0));
    apply(levels.current[i]);
    const t = el.querySelector<HTMLElement>("[data-today]");
    if (t) el.scrollTop = (t.parentElement as HTMLElement).offsetTop - el.clientHeight / 3;
    updateTitle();
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // hiding 반복 일정 changes how tall the busiest day is
  useLayoutEffect(() => {
    fit();
    if (rh.current > levels.current[3] || levelOf(rh.current) === 3) apply(levels.current[3]);
  }, [hideRepeat, fit, apply]);

  // pinch (two fingers) and Ctrl + wheel / trackpad pinch on the calendar
  useEffect(() => {
    const el = sc.current;
    if (!el) return;
    let pinch: { dist: number; rh: number; anchor: number } | null = null;
    const spread = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      cancelAnimationFrame(anim.current);
      const top = el.getBoundingClientRect().top;
      pinch = {
        dist: spread(e.touches),
        rh: rh.current,
        anchor: (e.touches[0].clientY + e.touches[1].clientY) / 2 - top,
      };
      e.preventDefault();
    };
    const onMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      zoomTo(pinch.rh * (spread(e.touches) / pinch.dist), pinch.anchor);
    };
    const onEnd = (e: TouchEvent) => {
      if (pinch && e.touches.length < 2) {
        const a = pinch.anchor;
        pinch = null;
        settle(null, a);
      }
    };
    let wheelT: ReturnType<typeof setTimeout>;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      cancelAnimationFrame(anim.current);
      const a = e.clientY - el.getBoundingClientRect().top;
      zoomTo(rh.current * Math.exp(-e.deltaY / 120), a);
      clearTimeout(wheelT);
      wheelT = setTimeout(() => settle(null, a), 160);
    };
    const noPageZoom = (e: Event) => e.preventDefault(); // iOS Safari's own pinch-to-zoom
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", noPageZoom);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", noPageZoom);
      clearTimeout(wheelT);
    };
  }, [zoomTo, settle]);

  // one finger: drag the weekday bar down to stretch, up to shrink
  const drag = useRef<{ y: number; rh: number; anchor: number } | null>(null);
  const onBarDown = (e: React.PointerEvent) => {
    cancelAnimationFrame(anim.current);
    drag.current = { y: e.clientY, rh: rh.current, anchor: todayAnchor() };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onBarMove = (e: React.PointerEvent) => {
    if (drag.current) zoomTo(drag.current.rh * Math.exp((e.clientY - drag.current.y) / 210), drag.current.anchor);
  };
  const onBarUp = () => {
    if (!drag.current) return;
    const a = drag.current.anchor;
    drag.current = null;
    settle(null, a);
  };
  const nextLevel = () => {
    const lv = levels.current;
    const i = lv.indexOf(lv.reduce((a, b) => (Math.abs(b - rh.current) < Math.abs(a - rh.current) ? b : a)));
    settle(lv[(i + 1) % lv.length], todayAnchor());
  };
  const goToday = () => {
    const el = sc.current;
    const t = el?.querySelector<HTMLElement>("[data-today]");
    if (el && t)
      el.scrollTo({
        top: (t.parentElement as HTMLElement).offsetTop - el.clientHeight / 3,
        behavior: "smooth",
      });
  };

  // ---- sheets ----
  const open = (s: NonNullable<typeof sheet>) => {
    setSheet(s);
    requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
  };
  const close = () => {
    setShown(false);
    setTimeout(() => setSheet(null), 300);
  };
  useEffect(() => {
    document.body.style.overflow = sheet ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheet]);

  const [y, m] = title.split("-").map(Number);
  const todayWx = weather[today];
  const iconBtn = "flex h-9 w-9 items-center justify-center rounded-full text-[#5b606a] active:bg-black/5";

  return (
    <div className="flex h-[calc(100dvh-60px-env(safe-area-inset-bottom))] flex-col">
      <header className="flex flex-none items-end justify-between px-5 pb-2.5 pt-6">
        <h1 className="text-[26px] font-extrabold leading-none tracking-[-.02em]">
          {m}월<span className="ml-1.5 text-[14px] font-semibold text-muted">{y}</span>
        </h1>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={nextLevel} className={iconBtn} aria-label="달력 크기 바꾸기">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
              <rect x="4" y="4.5" width="16" height="6.5" rx="2" />
              <rect x="4" y="13" width="16" height="6.5" rx="2" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setHideRepeat(hideRepeat === "1" ? "0" : "1")}
            aria-pressed={hideRepeat === "1"}
            className={`${iconBtn} ${hideRepeat === "1" ? "!bg-sky !text-blue" : ""}`}
            aria-label="반복 일정 숨기기"
            title="반복 일정 숨기기"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 2.5l3 3-3 3" />
              <path d="M4 11v-1.5a4 4 0 0 1 4-4h12" />
              <path d="M7 21.5l-3-3 3-3" />
              <path d="M20 13v1.5a4 4 0 0 1-4 4H4" />
              {hideRepeat === "1" && <path d="M3 3l18 18" />}
            </svg>
          </button>
          <button
            type="button"
            onClick={() => open({ kind: "wx" })}
            className="ml-1 flex h-9 items-center gap-1 rounded-full bg-white px-3 text-[13px] font-bold text-ink shadow-[0_1px_2px_rgba(0,0,0,.06)]"
          >
            <WxIcon kind="partly" size={18} />
            날씨
          </button>
        </div>
      </header>

      <div className="mx-2.5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[22px] bg-white">
        <div
          onPointerDown={onBarDown}
          onPointerMove={onBarMove}
          onPointerUp={onBarUp}
          onPointerCancel={onBarUp}
          className="relative flex-none cursor-ns-resize touch-none select-none pb-1.5 pt-3"
          aria-label="끌어서 달력 크기 바꾸기"
        >
          <div className="grid grid-cols-7 text-center text-[11.5px] font-semibold text-[#8a8f99]">
            {DOW.map((d, i) => (
              <span key={d} className={i === 0 ? "text-[#E5484D]" : i === 6 ? "text-blue" : ""}>
                {d}
              </span>
            ))}
          </div>
          <i className="absolute bottom-0 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-[#E3E5EA]" />
        </div>

        <div
          ref={sc}
          onScroll={updateTitle}
          data-lv="0"
          className="cal-sc min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-28 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {weeks.map((wk) => {
            const first = wk.findIndex((d) => d.date.endsWith("-01"));
            return (
              <div key={wk[0].date}>
                {first >= 0 && (
                  <div className="cal-ml" data-month={wk[first].date.slice(0, 7)}>
                    <span style={{ gridColumn: first + 1 }} className="pl-2">
                      {Number(wk[first].date.slice(5, 7))}월
                    </span>
                  </div>
                )}
                <div className="cal-wk" data-wk={(wk.find((d) => d.date.endsWith("-01")) ?? wk[3]).date.slice(0, 7)}>
                  {wk.map((d) => {
                    const w = weather[d.date];
                    const evs = shownEvents(d);
                    const dow = dowOf(d.date);
                    const cls = [
                      "cal-c",
                      d.date === today && "today",
                      d.date < today && "past",
                      dow === 0 && "sun",
                      dow === 6 && "sat",
                      sheet?.kind === "day" && sheet.date === d.date && "sel",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <div key={d.date} className={cls} data-today={d.date === today ? "" : undefined} onClick={() => open({ kind: "day", date: d.date })}>
                        <span className="cal-n">{Number(d.date.slice(8))}</span>
                        <div className="cal-w">{w && <WxIcon kind={wxKind(w.kind, w.mm)} size={22} />}</div>
                        <div className="cal-dots">
                          {evs.slice(0, 3).map((e) => (
                            <i key={e.id} style={{ background: colorOf(e) }} />
                          ))}
                        </div>
                        <div className="cal-bars">
                          {evs.slice(0, 4).map((e) => (
                            <i key={e.id} style={{ background: colorOf(e) }} />
                          ))}
                        </div>
                        <div className="cal-blocks">
                          {evs.map((e) => (
                            <div
                              key={e.id}
                              className="cal-blk"
                              style={{
                                background: `${colorOf(e)}1f`,
                                color: colorOf(e),
                              }}
                            >
                              {e.title}
                              <small>
                                {e.start ? e.start : "미정"}
                                {e.place ? ` · ${e.place}` : ""}
                              </small>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 오늘 · 오늘 챙길 것 — above the tab bar, left of the + button */}
      <div className="pointer-events-none fixed bottom-[calc(80px+env(safe-area-inset-bottom))] left-1/2 z-30 flex w-full max-w-md -translate-x-1/2 gap-2 px-5">
        <button
          type="button"
          onClick={goToday}
          className="pointer-events-auto h-10 rounded-full bg-white px-4 text-[14px] font-bold shadow-[0_4px_14px_rgba(0,0,0,.1)]"
        >
          오늘
        </button>
        {todayWx && (
          <button
            type="button"
            onClick={() => open({ kind: "day", date: today })}
            className="pointer-events-auto flex h-10 items-center gap-1.5 rounded-full bg-sky px-3.5 text-[13.5px] font-bold text-blue shadow-[0_4px_14px_rgba(0,0,0,.08)]"
          >
            오늘 챙길 것 {todayWx.advice.length}
            <span className="flex -space-x-1">
              {todayWx.advice.slice(0, 3).map((k) => (
                <AdviceBadge key={k} k={k} size={20} />
              ))}
            </span>
          </button>
        )}
      </div>

      {sheet &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="닫기"
              onClick={close}
              className="fixed inset-0 z-[45] bg-black/30"
              style={{
                opacity: shown ? 1 : 0,
                transition: "opacity .25s ease",
              }}
            />
            <div
              className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[82dvh] w-full max-w-md overflow-y-auto rounded-t-[22px] bg-white px-5 pb-[calc(28px+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,.15)]"
              style={{
                transform: shown ? "none" : "translateY(100%)",
                transition: `transform .36s ${SMOOTH}`,
              }}
            >
              <div className="sticky top-0 -mx-5 bg-white px-5 pb-1 pt-2">
                <div className="mx-auto h-[5px] w-9 rounded-full bg-[#DADADA]" />
              </div>
              {sheet.kind === "day" ? (
                <DaySheet day={days.find((d) => d.date === sheet.date)!} w={weather[sheet.date]} today={today} hideRepeat={hideRepeat === "1"} />
              ) : (
                <WeatherSheet weather={weather} today={today} place={place} />
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

function DaySheet({ day, w, today, hideRepeat }: { day: CalDay; w: CalWeather | undefined; today: string; hideRepeat: boolean }) {
  const d = day.date;
  const evs = hideRepeat ? day.events.filter((e) => !e.repeat) : day.events;
  return (
    <div>
      <h3 className="mt-2 text-[19px] font-extrabold">
        {md(d)} {DOW[dowOf(d)]}요일
        {d === today && <span className="text-blue"> · 오늘</span>}
      </h3>
      {w ? (
        <>
          <div className="mt-3 flex items-center gap-3">
            <WxIcon kind={wxKind(w.kind, w.mm)} size={46} />
            <span className="text-[32px] font-extrabold leading-none tracking-[-.02em]">{w.hi ?? "-"}°</span>
            <span className="text-[13px] leading-[1.5] text-[#6e6e6e]">
              {skyLabel(w.kind)} · 최저 {w.lo ?? "-"}°
              <br />비 {w.pop ?? 0}%{w.mm ? ` · ${w.mm}mm` : ""}
              {w.mid && " · 대략적인 예보"}
            </span>
          </div>
          <p className="mb-2 mt-4 text-[12.5px] font-bold text-muted">챙길 것</p>
          {w.advice.length ? (
            <div className="flex flex-wrap gap-2">
              {w.advice.map((k) => (
                <div key={k} className="flex min-w-[68px] flex-col items-center gap-1.5 rounded-[14px] bg-[#F4F5F7] px-2 pb-2 pt-2.5">
                  <AdviceBadge k={k} size={34} colder={isOutfit(k) && w.colder} />
                  <span className="text-[11.5px] font-semibold text-[#4a4a4a]">{k === "range" ? "겉옷" : ADVICE_LABEL[k]}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted">따로 챙길 건 없어요</p>
          )}
        </>
      ) : (
        <p className="mt-3 rounded-[12px] bg-[#F4F5F7] px-3.5 py-3 text-[13px] text-[#6e6e6e]">
          {d < today ? "지난 날이에요." : "아직 예보가 없어요. 날씨는 오늘부터 10일 뒤까지 나와요."}
        </p>
      )}

      <p className="mb-1 mt-5 text-[12.5px] font-bold text-muted">일정</p>
      {evs.length === 0 && <p className="py-2 text-[13px] text-muted">일정이 없어요</p>}
      {evs.map((e) => (
        <TLink
          key={e.id}
          href={`/events/${e.id}?from=/calendar`}
          kind="push"
          className="grid grid-cols-[46px_3px_1fr_auto] items-start gap-x-2.5 border-b border-[#F1F2F4] py-2.5 last:border-0"
        >
          <span className="text-right text-[12.5px] leading-[1.35] tabular-nums">
            {e.start || "미정"}
            {e.end && <small className="block text-[11px] text-muted">{e.end}</small>}
          </span>
          <i className="self-stretch rounded-full" style={{ background: colorOf(e) }} />
          <span className="min-w-0">
            <b className="block truncate text-[15px] font-semibold">{e.title}</b>
            <small className="block text-[12px] text-muted">
              {e.place || "장소 없음"}
              {e.outdoor && " · 야외"}
              {e.repeat && " · 매주"}
            </small>
          </span>
          {e.pop !== null && e.pop >= 30 ? (
            <span className="flex items-center gap-0.5 text-[12px] font-bold text-blue">
              <WxIcon kind="rain" size={16} />
              {e.pop}%
            </span>
          ) : (
            <span />
          )}
        </TLink>
      ))}
      <TLink
        href={`/events/new?date=${d}&from=/calendar`}
        kind="push"
        className="mt-3 block rounded-[12px] bg-[#F4F5F7] py-3 text-center text-[14px] font-bold text-blue"
      >
        + 이 날 일정 추가
      </TLink>
    </div>
  );
}

function WeatherSheet({ weather, today, place }: { weather: Record<string, CalWeather>; today: string; place: string }) {
  const dates = Object.keys(weather).sort();
  const temps = dates.flatMap((d) => [weather[d].lo, weather[d].hi]).filter((t): t is number => t != null);
  const tMin = temps.length ? Math.min(...temps) : 0;
  const tMax = temps.length ? Math.max(...temps) : 1;
  const pct = (t: number) => ((t - tMin) / Math.max(1, tMax - tMin)) * 100;
  return (
    <div>
      <h3 className="mt-2 text-[19px] font-extrabold">날씨 자세히</h3>
      <p className="mb-2 mt-1 text-[12.5px] text-muted">{place ? `📍 ${place} · ` : ""}오늘부터 10일 · 4일 뒤부터는 중기예보라 대략적이에요</p>
      {dates.length === 0 && <p className="py-3 text-[13px] text-muted">설정에서 장소를 저장하면 날씨가 보여요.</p>}
      {dates.map((d) => {
        const w = weather[d];
        return (
          <div
            key={d}
            className={`grid grid-cols-[52px_30px_38px_30px_1fr_30px_46px] items-center gap-1 py-1.5 text-[13px] tabular-nums ${w.mid ? "opacity-80" : ""}`}
          >
            <b className={d === today ? "text-blue" : ""}>{d === today ? "오늘" : `${Number(d.slice(8))}일 ${DOW[dowOf(d)]}`}</b>
            <WxIcon kind={wxKind(w.kind, w.mm)} size={26} />
            <span className={`text-right text-[12px] font-bold ${(w.pop ?? 0) >= 30 ? "text-blue" : "text-muted"}`}>{w.pop ?? 0}%</span>
            <span className="text-right text-[#8a8f99]">{w.lo ?? "-"}°</span>
            <span className="relative h-[5px] rounded-full bg-[#EEF0F3]">
              {w.lo != null && w.hi != null && (
                <i
                  className="absolute inset-y-0 rounded-full bg-[linear-gradient(90deg,#7FB2FF,#FFB15E)]"
                  style={{
                    left: `${pct(w.lo)}%`,
                    right: `${100 - pct(w.hi)}%`,
                  }}
                />
              )}
            </span>
            <span>{w.hi ?? "-"}°</span>
            <span className="text-right text-[11.5px] text-muted">{w.mm ? `${w.mm}mm` : ""}</span>
          </div>
        );
      })}
      <p className="mt-2 text-[12px] text-muted">% 비 올 확률 · mm 예상 강수량 (3일 뒤까지)</p>
    </div>
  );
}
