"use client";

// 달력 (iPhone-calendar style): one continuous calendar that you stretch from a month overview
// into a week view — dots → bars → titled blocks → blocks with times. Pinch with two fingers
// (or drag the weekday bar, or Ctrl + wheel); on release it settles on the nearest level, and the
// touched week stays where it is. Stretch a week past 3/4 of the screen and it snaps to fill it as
// a 시간표: 0–24시 at the same hour height every week, scrolled inside, swiped sideways from week
// to week; pinching in brings the calendar back. Forecast days carry a weather icon under the
// date; tapping a day opens its weather, things to bring and plans.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ADVICE_LABEL, isOutfit, skyLabel } from "@/lib/advice";
import { DOW, dowOf, toMinutes } from "@/lib/time";
import { AdviceBadge } from "@/components/icons";
import { TLink } from "@/components/nav-transition";
import WxIcon, { wxKind } from "@/components/wx-icons";
import { TempBar, tempRange } from "@/components/week-weather";
import type { DayWeather } from "@/lib/day-weather";

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
const LEVELS = [70, 100, 142, 210]; // 촘촘 · 막대 · 블록 · 주간 — 주간 grows to fit the busiest day
// which look a row height gets: halfway between two levels it switches to the next one
const levelOf = (rh: number, lv: number[]) => (rh < (lv[0] + lv[1]) / 2 ? 0 : rh < (lv[1] + lv[2]) / 2 ? 1 : rh < (lv[2] + lv[3]) / 2 ? 2 : 3);
const LABEL_H = 28; // month label row
const SNAP = 0.75; // a week taller than this share of the screen becomes the 시간표
const SMOOTH = "cubic-bezier(.2,.8,.2,1)";
const ease = (k: number) => 1 - Math.pow(1 - k, 3);

// one soft colour per title, like a timetable app (the same everywhere: dots, blocks, 시간표, list)
const PALETTE = [
  ["#E3ECFF", "#2F5BB8"],
  ["#E2F5EC", "#1F7A52"],
  ["#F1E8FF", "#6B46C1"],
  ["#FFF0DC", "#A85F0A"],
  ["#FDE6EC", "#B0365A"],
  ["#E0F4F7", "#17707D"],
  ["#EDEFF3", "#4B5563"],
];
function colorOf(title: string) {
  let h = 0;
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [bg, fg] = PALETTE[h % PALETTE.length];
  return { bg, fg };
}

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
  const set = useCallback(
    (v: string) => {
      try {
        localStorage.setItem(key, v);
      } catch {}
      window.dispatchEvent(new Event(`pref:${key}`));
    },
    [key],
  );
  return [value, set] as const;
}

function readPref(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePref(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {}
}

const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`;
const overnight = (e: CalEvt) => !!e.start && !!e.end && e.end < e.start;

export default function CalendarView({ days, weather, today }: { days: CalDay[]; weather: Record<string, DayWeather>; today: string }) {
  const sc = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);
  const rh = useRef(LEVELS[0]);
  const levels = useRef([...LEVELS]);
  const anim = useRef(0);
  const [title, setTitle] = useState(today.slice(0, 7));
  const [sheet, setSheet] = useState<{ kind: "day"; date: string } | null>(null);
  const [shown, setShown] = useState(false);
  const [hideRepeat, setHideRepeat] = usePref("cal-hide-repeat", "0");
  const [savedLevel, setSavedLevel] = usePref("cal-level", "0");
  // 시간표 mode: which week fills the screen (null = the calendar)
  const [ttWeek, setTtWeek] = useState<number | null>(null);
  const tt = ttWeek !== null;
  const ttRef = useRef(false);
  const [toast, setToast] = useState("");
  const swipe = useRef<{ x: number; y: number; dx: number; on: boolean; id: number; t: number } | null>(null);
  const suppressClick = useRef(false);
  // now (KST minutes) for the red line in the 시간표; set once when the page opens
  const [nowMin] = useState(() => {
    const k = new Date(Date.now() + 9 * 3600e3);
    return k.getUTCHours() * 60 + k.getUTCMinutes();
  });

  const weeks = useMemo(() => {
    const out: CalDay[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [days]);
  const shownEvents = useCallback((d: CalDay) => (hideRepeat === "1" ? d.events.filter((e) => !e.repeat) : d.events), [hideRepeat]);

  // ---- zoom: everything below works on the DOM directly so a pinch never re-renders React ----
  const gestureOn = useRef(false); // a finger, mouse or wheel gesture is in progress
  const locked = useRef(false); // an animation owns the calendar
  const hold = useRef(false); // this gesture already snapped one way; it ends without doing more

  // Zooming touches the page as little as possible: positions come from arithmetic (week index ×
  // row height + the month labels above), never from measuring, and nothing is written twice.
  const labelsUpTo = useMemo(() => {
    let n = 0;
    return weeks.map((wk) => (wk.some((d) => d.date.endsWith("-01")) ? ++n : n));
  }, [weeks]);
  const weekTop = useCallback((i: number, h: number) => i * h + labelsUpTo[i] * LABEL_H, [labelsUpTo]);
  // which week a y position (in scroll coordinates) falls in, and how far down it
  const rowAt = useCallback(
    (y: number, h: number) => {
      let i = 0;
      while (i + 1 < labelsUpTo.length && weekTop(i + 1, h) <= y) i++;
      return { i, frac: Math.max(0, Math.min(1, (y - weekTop(i, h)) / h)) };
    },
    [labelsUpTo, weekTop],
  );
  const viewH = useRef(600); // the scroller's height, kept current on resize so frames never measure it
  // the week rows, collected after every render so a frame only writes their heights
  const rows = useRef<HTMLElement[]>([]);
  useLayoutEffect(() => {
    rows.current = sc.current ? [...sc.current.querySelectorAll<HTMLElement>(".cal-wk")] : [];
    const px = `${rh.current}px`;
    for (const w of rows.current) if (w.style.height !== px) w.style.setProperty("height", px);
  });
  const shownLv = useRef(-1);
  const hintOn = useRef(false);
  const apply = useCallback((h: number) => {
    const el = sc.current;
    if (!el) return;
    rh.current = h;
    // each week gets its own height: a value on the scroller would restyle every element inside it
    const px = `${h}px`;
    for (const w of rows.current) w.style.setProperty("height", px);
    const lv = levelOf(h, levels.current);
    if (lv !== shownLv.current) {
      shownLv.current = lv;
      el.dataset.lv = String(lv);
    }
    // between 주간 and the snap, a small bar shows how much further to pull
    const p = (h - levels.current[3]) / (Math.round(viewH.current * SNAP) - levels.current[3]);
    const on = !ttRef.current && gestureOn.current && p > 0.08;
    if (on !== hintOn.current) {
      hintOn.current = on;
      hint.current?.classList.toggle("opacity-100", on);
      hint.current?.classList.toggle("opacity-0", !on);
    }
    if (on) hint.current?.style.setProperty("--p", `${Math.max(0, Math.min(1, p)) * 100}%`);
  }, []);

  // the month of the week a third of the way down (where today's week sits when opened), once a frame
  const titleFrame = useRef(0);
  const updateTitle = useCallback(() => {
    if (titleFrame.current) return;
    titleFrame.current = requestAnimationFrame(() => {
      titleFrame.current = 0;
      const el = sc.current;
      if (!el || ttRef.current) return;
      const wk = weeks[rowAt(el.scrollTop + viewH.current / 3, rh.current).i];
      if (wk) setTitle((wk.find((d) => d.date.endsWith("-01")) ?? wk[3]).date.slice(0, 7));
    });
  }, [weeks, rowAt]);

  // zoom around a point (px from the scroller's top) so the week under it stays put
  const zoomTo = useCallback(
    (h: number, anchor: number) => {
      const el = sc.current;
      if (!el) return;
      h = Math.max(levels.current[0] - 10, Math.min(Math.round(viewH.current * SNAP) + 2, h));
      // read first, then write: the week under the anchor keeps the same spot after the resize
      const { i, frac } = rowAt(el.scrollTop + anchor, rh.current);
      apply(h);
      el.scrollTop = weekTop(i, h) + frac * h - anchor;
    },
    [apply, rowAt, weekTop],
  );

  const todayAnchor = useCallback(() => {
    const el = sc.current;
    const t = el?.querySelector<HTMLElement>("[data-today]");
    if (!el || !t) return 0;
    const r = t.getBoundingClientRect();
    const s = el.getBoundingClientRect();
    return Math.max(0, Math.min(s.height, r.top - s.top + Math.min(rh.current, 60) / 2));
  }, []);

  const settle = useCallback(
    (target: number | null, anchor: number) => {
      cancelAnimationFrame(anim.current);
      const lv = levels.current;
      const to = target ?? lv.reduce((a, b) => (Math.abs(b - rh.current) < Math.abs(a - rh.current) ? b : a));
      const from = rh.current;
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / 340);
        zoomTo(from + (to - from) * ease(k), anchor);
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

  // the 주간 level is as tall as the busiest day needs (but stays clear of the 시간표 snap)
  const fit = useCallback(() => {
    const el = sc.current;
    if (!el || ttRef.current) return;
    const keepLv = el.dataset.lv;
    el.dataset.lv = "3";
    el.classList.add("measuring");
    el.querySelectorAll<HTMLElement>(".cal-wk").forEach((w) => (w.style.height = "auto"));
    let need = 0;
    el.querySelectorAll<HTMLElement>(".cal-c").forEach((c) => (need = Math.max(need, c.scrollHeight)));
    el.querySelectorAll<HTMLElement>(".cal-wk").forEach((w) => (w.style.height = `${rh.current}px`));
    el.classList.remove("measuring");
    el.dataset.lv = keepLv;
    levels.current[3] = Math.max(170, Math.min(need + 10, Math.round(el.clientHeight * SNAP) - 40));
  }, []);

  // about 13 hours of the 시간표 fit on screen, the same in every week
  const setHourHeight = useCallback(() => {
    const el = sc.current;
    if (!el) return;
    viewH.current = el.clientHeight;
    el.style.setProperty("--hpx", `${Math.max(34, Math.round((el.clientHeight - 80) / 13))}px`);
  }, []);

  // ---- into and out of the 시간표 ----
  const weekEl = (i: number) => sc.current?.querySelector<HTMLElement>(`[data-wi="${i}"]`) ?? null;
  const hourScroll = useRef<number | null>(null); // the hours in view, carried from week to week
  const pending = useRef<{ kind: "enter" | "leave"; i: number; from: number; target: number; done?: () => void; restore?: boolean } | null>(null);
  // remember the 시간표 (which week, which hours) so reopening the app comes back to it
  const hpx = () => parseFloat(sc.current?.style.getPropertyValue("--hpx") || "40");
  const rememberWeek = (i: number) => writePref("cal-tt-week", weeks[i]?.[0].date ?? "");
  const hourSave = useRef<ReturnType<typeof setTimeout>>(undefined);
  const rememberHours = (top: number) => {
    clearTimeout(hourSave.current);
    hourSave.current = setTimeout(() => writePref("cal-tt-hour", (top / hpx()).toFixed(2)), 250);
  };

  // first paint: the remembered level, today's week a third of the way down
  useLayoutEffect(() => {
    const el = sc.current;
    if (!el) return;
    setHourHeight();
    fit();
    const stored = Number(readPref("cal-level") ?? savedLevel) || 0;
    const t = el.querySelector<HTMLElement>("[data-today]");
    if (stored === 4) {
      // the week left open, unless it is already over — then this week
      const todayWeek = weeks.findIndex((w) => w.some((d) => d.date === today));
      const keptWeek = weeks.findIndex((w) => w[0].date === readPref("cal-tt-week"));
      const i = keptWeek >= todayWeek ? keptWeek : todayWeek;
      if (i >= 0) {
        const h = Number(readPref("cal-tt-hour"));
        hourScroll.current = Number.isFinite(h) && h > 0 ? h * hpx() : null;
        pending.current = { kind: "enter", i, from: 0, target: 0, restore: true };
        ttRef.current = true;
        apply(el.clientHeight);
        requestAnimationFrame(() => setTtWeek(i));
        return;
      }
    }
    apply(levels.current[Math.max(0, Math.min(3, stored))]);
    if (t) el.scrollTop = (t.parentElement as HTMLElement).offsetTop - el.clientHeight / 3;
    updateTitle();
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // hiding 반복 일정 changes how tall the busiest day is
  useLayoutEffect(() => {
    if (ttRef.current) return;
    fit();
    if (rh.current > levels.current[3] || levelOf(rh.current, levels.current) === 3) apply(levels.current[3]);
  }, [hideRepeat, fit, apply]);
  useEffect(() => {
    const onResize = () => {
      setHourHeight();
      const el = sc.current;
      if (el && ttRef.current) {
        const i = Math.round(el.scrollTop / rh.current);
        apply(el.clientHeight);
        el.scrollTop = i * el.clientHeight;
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [apply, setHourHeight]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? "" : t)), 1600);
  };


  // past 3/4: the week under the fingers jumps to fill the area — top line to the top, bottom line to the bottom
  const snapToTimetable = useCallback(
    (anchor: number) => {
      const el = sc.current;
      if (!el) return;
      locked.current = true;
      hold.current = gestureOn.current;
      cancelAnimationFrame(anim.current);
      const y = el.scrollTop + anchor;
      const wk = [...el.querySelectorAll<HTMLElement>(".cal-wk")].find((w) => w.offsetTop + w.offsetHeight > y) ?? el.querySelector<HTMLElement>(".cal-wk");
      if (!wk) return;
      wk.classList.add("snapping");
      navigator.vibrate?.(8);
      const i = Number(wk.dataset.wi);
      const startH = rh.current;
      const startY = wk.offsetTop - el.scrollTop;
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / 200);
        apply(startH + (el.clientHeight - startH) * ease(k));
        el.scrollTop = wk.offsetTop - startY * (1 - ease(k));
        if (k < 1) {
          anim.current = requestAnimationFrame(step);
          return;
        }
        wk.classList.remove("snapping");
        pending.current = { kind: "enter", i, from: 0, target: 0 };
        ttRef.current = true;
        setTtWeek(i);
      };
      anim.current = requestAnimationFrame(step);
    },
    [apply],
  );

  // the way back mirrors the way in: the 시간표 fades, the week eases down to 주간 size while the
  // weeks around it and the month labels come back, then its plans fade in
  const leaveTimetable = useCallback((target: number, done?: () => void) => {
    const el = sc.current;
    if (!el || !ttRef.current) return;
    locked.current = true;
    hold.current = gestureOn.current;
    cancelAnimationFrame(anim.current);
    const i = Math.round(el.scrollTop / rh.current);
    const wk = weekEl(i);
    const gs = wk?.querySelector<HTMLElement>(".cal-gs");
    if (gs) hourScroll.current = gs.scrollTop;
    wk?.querySelector(".cal-tt")?.classList.add("leaving");
    const from = rh.current;
    setTimeout(() => {
      pending.current = { kind: "leave", i, from, target, done };
      ttRef.current = false;
      setTtWeek(null);
    }, 110);
  }, []);

  // after React has swapped the week's contents, finish the move with the new layout
  useLayoutEffect(() => {
    const el = sc.current;
    const p = pending.current;
    if (!el || !p) return;
    // wait for the render that actually shows (or hides) the 시간표
    if ((p.kind === "enter") !== (ttWeek !== null)) return;
    pending.current = null;
    const wk = weekEl(p.i);
    if (!wk) {
      locked.current = false;
      return;
    }
    if (p.kind === "enter") {
      apply(el.clientHeight);
      el.scrollTop = wk.offsetTop;
      const gs = wk.querySelector<HTMLElement>(".cal-gs");
      const top = hourScroll.current ?? parseFloat(el.style.getPropertyValue("--hpx")) * 8;
      // set again once the new week has been laid out (on a reopen the first set can land too early)
      if (gs) {
        gs.scrollTop = top;
        requestAnimationFrame(() => requestAnimationFrame(() => (gs.scrollTop = top)));
      }
      locked.current = false;
      setSavedLevel("4");
      rememberWeek(p.i);
      if (!p.restore) showToast("좌우로 밀면 지난주 · 다음 주");
      return;
    }
    // leave: keep the week's top where it is, then shrink it to the calendar level
    wk.classList.add("snapping");
    apply(p.from);
    el.scrollTop = wk.offsetTop;
    const endY = Math.max(0, Math.min(el.clientHeight * 0.28, el.clientHeight - p.target - 20));
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 300);
      apply(p.from + (p.target - p.from) * ease(k));
      el.scrollTop = wk.offsetTop - endY * ease(k);
      updateTitle();
      if (k < 1) {
        anim.current = requestAnimationFrame(step);
        return;
      }
      wk.classList.remove("snapping");
      locked.current = false;
      setSavedLevel(String(levels.current.indexOf(p.target)));
      p.done?.();
    };
    anim.current = requestAnimationFrame(step);
    // runs when the week shown changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttWeek === null]);

  // one gesture step (pinch, weekday-bar drag or Ctrl + wheel)
  const gesture = useCallback(
    (h: number, anchor: number) => {
      const el = sc.current;
      if (!el || locked.current || hold.current) return;
      if (ttRef.current) {
        // a little pinch-in squeezes the 시간표; past 86% it hands back to the calendar
        const wk = weekEl(Math.round(el.scrollTop / rh.current));
        if (h >= el.clientHeight) return apply(el.clientHeight);
        if (h > el.clientHeight * 0.86) {
          apply(h);
          if (wk) el.scrollTop = wk.offsetTop;
          return;
        }
        return leaveTimetable(levels.current[3]);
      }
      if (h >= Math.round(el.clientHeight * SNAP)) return snapToTimetable(anchor);
      zoomTo(h, anchor);
    },
    [apply, leaveTimetable, snapToTimetable, zoomTo],
  );
  // gesture steps are gathered and applied once per animation frame
  const queued = useRef<{ h: number; a: number } | null>(null);
  const queueFrame = useRef(0);
  const queue = useCallback((h: number, a: number) => {
    queued.current = { h, a };
    if (queueFrame.current) return;
    queueFrame.current = requestAnimationFrame(() => {
      queueFrame.current = 0;
      const q = queued.current;
      queued.current = null;
      if (q) gesture(q.h, q.a);
    });
  }, [gesture]);
  const flushQueue = useCallback(() => {
    cancelAnimationFrame(queueFrame.current);
    queueFrame.current = 0;
    const q = queued.current;
    queued.current = null;
    if (q) gesture(q.h, q.a);
  }, [gesture]);
  const gestureEnd = useCallback(
    (anchor: number) => {
      const el = sc.current;
      flushQueue();
      gestureOn.current = false;
      const held = hold.current;
      hold.current = false;
      apply(rh.current); // hides the pull hint
      if (!el || locked.current || held) return;
      if (ttRef.current) {
        // let go after a small squeeze: spring back to the full week
        if (rh.current < el.clientHeight) {
          const wk = weekEl(Math.round(el.scrollTop / rh.current));
          apply(el.clientHeight);
          if (wk) el.scrollTop = wk.offsetTop;
        }
        return;
      }
      settle(null, anchor);
    },
    [apply, settle, flushQueue],
  );

  // pinch (two fingers) and Ctrl + wheel / trackpad pinch
  useEffect(() => {
    const el = sc.current;
    if (!el) return;
    let pinch: { dist: number; rh: number; anchor: number } | null = null;
    const spread = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1;
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      cancelAnimationFrame(anim.current);
      gestureOn.current = true;
      swipe.current = null;
      const top = el.getBoundingClientRect().top;
      pinch = { dist: spread(e.touches), rh: rh.current, anchor: ttRef.current ? 0 : (e.touches[0].clientY + e.touches[1].clientY) / 2 - top };
      e.preventDefault();
    };
    const onMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      queue(pinch.rh * (spread(e.touches) / pinch.dist), pinch.anchor);
    };
    const onEnd = (e: TouchEvent) => {
      if (pinch && e.touches.length < 2) {
        const a = pinch.anchor;
        pinch = null;
        gestureEnd(a);
      }
    };
    let wheelT: ReturnType<typeof setTimeout>;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      cancelAnimationFrame(anim.current);
      gestureOn.current = true;
      const a = ttRef.current ? 0 : e.clientY - el.getBoundingClientRect().top;
      queue((queued.current?.h ?? rh.current) * Math.exp(-e.deltaY / 120), a);
      clearTimeout(wheelT);
      wheelT = setTimeout(() => gestureEnd(a), 170);
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
  }, [queue, gestureEnd]);

  // one finger: drag the weekday bar down to stretch, up to shrink
  const drag = useRef<{ y: number; rh: number; anchor: number } | null>(null);
  const onBarDown = (e: React.PointerEvent) => {
    cancelAnimationFrame(anim.current);
    gestureOn.current = true;
    drag.current = { y: e.clientY, rh: rh.current, anchor: ttRef.current ? 0 : todayAnchor() };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onBarMove = (e: React.PointerEvent) => {
    if (drag.current) queue(drag.current.rh * Math.exp((e.clientY - drag.current.y) / 210), drag.current.anchor);
  };
  const onBarUp = () => {
    if (!drag.current) return;
    const a = drag.current.anchor;
    drag.current = null;
    gestureEnd(a);
  };

  // 시간표: slide to the week before or after, keeping the hours in view
  const sliding = useRef(false);
  const goWeek = useCallback((dir: number) => {
    const el = sc.current;
    if (!el || !ttRef.current || sliding.current || locked.current) return;
    const i = Math.round(el.scrollTop / rh.current);
    const cur = weekEl(i)?.querySelector<HTMLElement>(".cal-tt");
    const next = weekEl(i + dir);
    if (!cur) return;
    if (!next) {
      cur.classList.add("slide");
      cur.style.transform = "";
      return;
    }
    sliding.current = true;
    hourScroll.current = weekEl(i)?.querySelector<HTMLElement>(".cal-gs")?.scrollTop ?? hourScroll.current;
    const w = el.clientWidth;
    cur.classList.add("slide");
    cur.style.transform = `translateX(${-dir * w}px)`;
    setTimeout(() => {
      cur.classList.remove("slide");
      cur.style.transform = "";
      el.scrollTop = next.offsetTop;
      const gs = next.querySelector<HTMLElement>(".cal-gs");
      if (gs && hourScroll.current !== null) gs.scrollTop = hourScroll.current;
      const tt2 = next.querySelector<HTMLElement>(".cal-tt");
      if (tt2) {
        tt2.style.transform = `translateX(${dir * w}px)`;
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            tt2.classList.add("slide");
            tt2.style.transform = "";
            setTimeout(() => {
              tt2.classList.remove("slide");
              sliding.current = false;
            }, 270);
          }),
        );
      } else sliding.current = false;
      setTtWeek(i + dir);
      writePref("cal-tt-week", weeks[i + dir]?.[0].date ?? "");
    }, 200);
  }, [weeks]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ttRef.current && (e.key === "ArrowLeft" || e.key === "ArrowRight")) goWeek(e.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goWeek]);

  // one finger sideways on the 시간표 drags the week; up and down scrolls the hours
  const onScPointerDown = (e: React.PointerEvent) => {
    if (!ttRef.current || sliding.current || locked.current || !e.isPrimary) return;
    swipe.current = { x: e.clientX, y: e.clientY, dx: 0, on: false, id: e.pointerId, t: performance.now() };
  };
  const onScPointerMove = (e: React.PointerEvent) => {
    const s = swipe.current;
    const el = sc.current;
    if (!s || !el || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.on) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      s.on = true;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {}
    }
    s.dx = dx;
    const cur = weekEl(Math.round(el.scrollTop / rh.current))?.querySelector<HTMLElement>(".cal-tt");
    if (cur) cur.style.transform = `translateX(${dx}px)`;
  };
  const onScPointerUp = () => {
    const s = swipe.current;
    const el = sc.current;
    swipe.current = null;
    if (!s?.on || !el) return;
    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 60);
    const fast = Math.abs(s.dx) / (performance.now() - s.t) > 0.5;
    if (Math.abs(s.dx) > el.clientWidth * 0.22 || (fast && Math.abs(s.dx) > 30)) return goWeek(s.dx < 0 ? 1 : -1);
    const cur = weekEl(Math.round(el.scrollTop / rh.current))?.querySelector<HTMLElement>(".cal-tt");
    if (cur) {
      cur.classList.add("slide");
      cur.style.transform = "";
      setTimeout(() => cur.classList.remove("slide"), 270);
    }
  };

  const nextLevel = () => {
    if (locked.current) return;
    if (ttRef.current) return leaveTimetable(levels.current[0] === rh.current ? levels.current[3] : levels.current[0]);
    const lv = levels.current;
    const i = lv.indexOf(lv.reduce((a, b) => (Math.abs(b - rh.current) < Math.abs(a - rh.current) ? b : a)));
    if (i === lv.length - 1) return snapToTimetable(todayAnchor());
    settle(lv[i + 1], todayAnchor());
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
    if (suppressClick.current) return;
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
  const ttDays = tt ? weeks[ttWeek] : null;

  return (
    <div className="flex h-[calc(100dvh-60px-env(safe-area-inset-bottom))] flex-col">
      <header className="flex flex-none items-end justify-between px-5 pb-2.5 pt-6">
        {ttDays ? (
          <div className="flex min-w-0 items-center gap-0.5">
            <button type="button" onClick={() => goWeek(-1)} className="-ml-2 flex h-8 w-8 items-center justify-center text-[22px] text-[#5b606a]" aria-label="지난주">
              ‹
            </button>
            <h1 className="truncate text-[22px] font-extrabold leading-none tracking-[-.02em] tabular-nums">
              {md(ttDays[0].date)} – {ttDays[0].date.slice(5, 7) === ttDays[6].date.slice(5, 7) ? `${Number(ttDays[6].date.slice(8))}일` : md(ttDays[6].date)}
            </h1>
            <button type="button" onClick={() => goWeek(1)} className="flex h-8 w-8 items-center justify-center text-[22px] text-[#5b606a]" aria-label="다음 주">
              ›
            </button>
          </div>
        ) : (
          <h1 className="text-[26px] font-extrabold leading-none tracking-[-.02em]">
            {m}월<span className="ml-1.5 text-[14px] font-semibold text-muted">{y}</span>
          </h1>
        )}
        <div className="flex flex-none items-center gap-0.5">
          <button type="button" onClick={nextLevel} className={`${iconBtn} ${tt ? "!bg-sky !text-blue" : ""}`} aria-label="달력 크기 바꾸기">
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
        </div>
      </header>

      <div className="relative mx-2.5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[22px] bg-white">
        <div
          onPointerDown={onBarDown}
          onPointerMove={onBarMove}
          onPointerUp={onBarUp}
          onPointerCancel={onBarUp}
          className="relative flex-none cursor-ns-resize touch-none select-none border-b border-[#F1F2F4] pb-1.5 pt-3"
          aria-label="끌어서 달력 크기 바꾸기"
        >
          <div className="grid grid-cols-7 text-center text-[11.5px] font-semibold text-[#8a8f99]">
            {DOW.map((d, i) => (
              <span key={d} className={i === 0 ? "text-[#E5484D]" : i === 6 ? "text-blue" : ""}>
                {d}
              </span>
            ))}
          </div>
          <i className="absolute bottom-0.5 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-[#E3E5EA]" />
        </div>

        {/* pull hint: between 주간 and the 시간표 snap */}
        <div
          ref={hint}
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-12 z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-[rgba(25,25,25,.84)] px-3 py-2 text-[12.5px] font-semibold text-white opacity-0 transition-opacity duration-150"
        >
          조금 더 당기면 시간표
          <i className="relative block h-1 w-[54px] overflow-hidden rounded-sm bg-white/25 after:absolute after:inset-y-0 after:left-0 after:w-[var(--p,0%)] after:rounded-sm after:bg-white" />
        </div>
        {toast && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-[rgba(25,25,25,.86)] px-3 py-1.5 text-[12.5px] font-semibold text-white">
            {toast}
          </div>
        )}

        <div
          ref={sc}
          onScroll={updateTitle}
          onPointerDown={onScPointerDown}
          onPointerMove={onScPointerMove}
          onPointerUp={onScPointerUp}
          onPointerCancel={onScPointerUp}
          data-lv="0"
          className={`cal-sc relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${tt ? "ttmode" : "pb-28"}`}
        >
          {weeks.map((wk, wi) => {
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
                <div className="cal-wk" data-wi={wi} data-wk={(wk.find((d) => d.date.endsWith("-01")) ?? wk[3]).date.slice(0, 7)}>
                  {tt ? (
                    <WeekTable
                      wk={wk}
                      prev={wi > 0 ? weeks[wi - 1][6] : null}
                      weather={weather}
                      today={today}
                      shownEvents={shownEvents}
                      onDay={(date) => open({ kind: "day", date })}
                      nowMin={nowMin}
                      onHours={rememberHours}
                    />
                  ) : (
                    wk.map((d) => {
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
                              <i key={e.id} style={{ background: colorOf(e.title).fg }} />
                            ))}
                          </div>
                          <div className="cal-bars">
                            {evs.slice(0, 4).map((e) => (
                              <i key={e.id} style={{ background: colorOf(e.title).fg }} />
                            ))}
                          </div>
                          <div className="cal-blocks">
                            {evs.map((e) => (
                              <div key={e.id} className="cal-blk" style={{ background: colorOf(e.title).bg, color: colorOf(e.title).fg }}>
                                {e.title}
                                <small>{e.start || "미정"}</small>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 오늘 · 오늘 챙길 것 — above the tab bar, left of the + button (not over the 시간표) */}
      {!tt && (
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
      )}

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
              <DaySheet
                day={days.find((d) => d.date === sheet.date)!}
                w={weather[sheet.date]}
                today={today}
                hideRepeat={hideRepeat === "1"}
                range={tempRange(weather)}
              />
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

// The 시간표 of one week: the same date row as the calendar (so nothing jumps at the switch),
// a row for 시간 미정 plans if any, then 0–24시 scrolled inside. Overlapping plans cascade to the
// right with a white edge; a plan past midnight runs to 24시 and continues from 0시 the next day.
function WeekTable({
  wk,
  prev,
  weather,
  today,
  shownEvents,
  onDay,
  nowMin,
  onHours,
}: {
  wk: CalDay[];
  prev: CalDay | null;
  weather: Record<string, DayWeather>;
  today: string;
  shownEvents: (d: CalDay) => CalEvt[];
  onDay: (date: string) => void;
  nowMin: number;
  onHours: (top: number) => void;
}) {
  const at = (min: number) => `calc(var(--hpx) * ${(min / 60).toFixed(4)})`;
  const untimed = wk.map((d) => shownEvents(d).filter((e) => !e.start));
  const hasUntimed = untimed.some((l) => l.length);

  type Block = CalEvt & { from: number; to: number; cont: boolean; lane: number; lanes: number };
  const blocksOn = (d: CalDay, before: CalDay | null): Block[] => {
    const list: Block[] = [
      ...(before ? shownEvents(before).filter(overnight) : []).map((e) => ({ ...e, from: 0, to: toMinutes(e.end), cont: true, lane: 0, lanes: 1 })),
      ...shownEvents(d)
        .filter((e) => e.start)
        .map((e) => ({ ...e, from: toMinutes(e.start), to: overnight(e) ? 1440 : toMinutes(e.end || e.start), cont: false, lane: 0, lanes: 1 })),
    ]
      .map((b) => ({ ...b, to: Math.max(b.to, b.from + 15) }))
      .sort((a, b) => a.from - b.from || b.to - a.to);
    // overlapping plans take lanes; each later lane is drawn shifted right over the earlier one
    let group: Block[] = [];
    let end = -1;
    const close = () => group.forEach((g) => (g.lanes = Math.max(...group.map((x) => x.lane)) + 1));
    for (const b of list) {
      if (b.from >= end) {
        close();
        group = [];
      }
      const used = group.filter((g) => g.to > b.from).map((g) => g.lane);
      b.lane = [0, 1, 2, 3].find((l) => !used.includes(l)) ?? 0;
      group.push(b);
      end = Math.max(end, b.to);
    }
    close();
    return list;
  };

  return (
    <div className="cal-tt">
      <div className="grid flex-none grid-cols-7">
        {wk.map((d) => {
          const w = weather[d.date];
          const dow = dowOf(d.date);
          const cls = ["cal-c", d.date === today && "today", d.date < today && "past", dow === 0 && "sun", dow === 6 && "sat"].filter(Boolean).join(" ");
          return (
            <div key={d.date} className={cls} data-today={d.date === today ? "" : undefined} onClick={() => onDay(d.date)}>
              <span className="cal-n">{Number(d.date.slice(8))}</span>
              <div className="cal-w">{w && <WxIcon kind={wxKind(w.kind, w.mm)} size={22} />}</div>
            </div>
          );
        })}
      </div>
      {hasUntimed && (
        <div className="cal-band">
          {wk.map((d, i) => (
            <div key={d.date}>
              {untimed[i].map((e) => (
                <span key={e.id} onClick={() => onDay(d.date)}>
                  {e.title}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="cal-gs" onScroll={(e) => onHours(e.currentTarget.scrollTop)}>
        <div className="cal-grid">
          {wk.map((d, i) => (
            <div key={d.date} className={`cal-tc ${d.date === today ? "today" : ""}`}>
              {blocksOn(d, i > 0 ? wk[i - 1] : prev).map((b) => {
                const c = colorOf(b.title);
                const dur = b.to - b.from;
                const size = dur < 75 ? "short" : dur < 100 ? "mid" : "";
                return (
                  <div
                    key={`${b.id}${b.cont ? "-cont" : ""}`}
                    className={`cal-ev ${size} ${b.cont ? "cont" : ""} ${b.lane ? "lap" : ""}`}
                    onClick={() => onDay(d.date)}
                    style={
                      {
                        top: at(b.from),
                        height: `calc(${at(dur)} - 2px)`,
                        "--lane": b.lane,
                        "--lanes": b.lanes,
                        background: c.bg,
                        color: c.fg,
                      } as React.CSSProperties
                    }
                  >
                    <b>{b.title}</b>
                    {b.cont ? (
                      <span className="note">어제부터 이어짐</span>
                    ) : (
                      overnight(b) && <span className="note">~새벽 {b.end.replace(/^0/, "")}</span>
                    )}
                    {!b.cont && b.pop !== null && b.pop >= 30 && <span className="rain">☂{b.pop}%</span>}
                  </div>
                );
              })}
              {d.date === today && <i className="cal-now" style={{ top: at(nowMin) }} />}
            </div>
          ))}
          {Array.from({ length: 23 }, (_, k) => (
            <span key={k}>
              <i className="cal-gl" style={{ top: at((k + 1) * 60) }} />
              <span className="cal-hl" style={{ top: at((k + 1) * 60) }}>
                {k + 1}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DaySheet({
  day,
  w,
  today,
  hideRepeat,
  range,
}: {
  day: CalDay;
  w: DayWeather | undefined;
  today: string;
  hideRepeat: boolean;
  range: { min: number; max: number };
}) {
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
            <span className="min-w-0 flex-1">
              <b className="block text-[15px]">{skyLabel(w.kind)}</b>
              <span className="block text-[12.5px] text-[#6e6e6e]">
                비 {w.pop ?? 0}%{w.mm ? ` · ${w.mm}mm` : ""}
                {w.mid && " · 대략적인 예보"}
              </span>
            </span>
          </div>
          {/* 최저–최고 on the same scale as the other forecast days */}
          <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-[12px] bg-[#F4F5F7] px-3.5 py-3 text-[13px] tabular-nums">
            <span className="text-[#8a8f99]">
              최저 <b className="text-[15px] text-ink">{w.lo ?? "-"}°</b>
            </span>
            <TempBar lo={w.lo} hi={w.hi} min={range.min} max={range.max} />
            <span className="text-[#8a8f99]">
              최고 <b className="text-[15px] text-ink">{w.hi ?? "-"}°</b>
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
          <i className="self-stretch rounded-full" style={{ background: colorOf(e.title).fg }} />
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
