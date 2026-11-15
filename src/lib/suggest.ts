// H3: for an outdoor plan that can move, find drier times the same day.
import type { DayWx } from "./kma";
import { FOLDING_POP, type Assessment } from "./outing";
import { fromMinutes, toMinutes } from "./time";
import type { CalEvent } from "./types";

export type MoveOption = { start: string; end: string; pop: number };

export type Suggestion = {
  id: string; // `${code}_${date}_${eventId}`
  eventId: string;
  date: string;
  title: string;
  start: string;
  end: string;
  pop: number | null;
  moves: MoveOption[];
};

const EARLIEST = 6 * 60;
const LATEST_END = 23 * 60;
const STEP = 30;

export function findSuggestion(
  code: string,
  e: CalEvent,
  date: string,
  a: Assessment,
  wx: DayWx | undefined,
  dayEvents: CalEvent[],
  nowMin: number | null // minutes now if `date` is today
): Suggestion | null {
  if (!e.flexible || e.setting !== "outdoor" || a.level === "none" || !wx) return null;
  const start = toMinutes(e.start);
  const duration = toMinutes(e.end) - start;
  if (duration <= 0) return null;
  // Too late to change once the tester should already have left.
  if (nowMin !== null && start - e.travelMin < nowMin) return null;

  const others = dayEvents.filter((o) => o.id !== e.id);
  const free = (from: number, to: number) =>
    others.every((o) => to <= toMinutes(o.start) - o.travelMin || from >= toMinutes(o.end) + o.travelMin);

  // Worst rain probability over the trip there, the activity and the way back.
  const worstPop = (s: number) => {
    let worst = 0;
    for (let h = Math.floor((s - e.travelMin) / 60); h <= Math.floor((s + duration + e.travelMin - 1) / 60); h++) {
      const w = wx.h[String(h).padStart(2, "0")];
      if (!w || w.pop === undefined) return null; // no forecast → don't suggest
      if ((w.pcp ?? 0) >= 1 || (w.uPty ?? 0) > 0 || (w.uRn1 ?? 0) >= 1) return 100;
      worst = Math.max(worst, w.pop);
    }
    return worst;
  };

  const options: (MoveOption & { distance: number })[] = [];
  for (let s = EARLIEST; s + duration <= LATEST_END; s += STEP) {
    if (s === start) continue;
    if (nowMin !== null && s - e.travelMin - 20 < nowMin) continue;
    if (!free(s - e.travelMin, s + duration + e.travelMin)) continue;
    const pop = worstPop(s);
    if (pop === null || pop >= FOLDING_POP) continue;
    options.push({ start: fromMinutes(s), end: fromMinutes(s + duration), pop, distance: Math.abs(s - start) });
  }
  // The closest drier time before and after the original.
  const before = options.filter((o) => toMinutes(o.start) < start).sort((x, y) => x.distance - y.distance)[0];
  const after = options.filter((o) => toMinutes(o.start) > start).sort((x, y) => x.distance - y.distance)[0];
  const moves = [before, after].filter((o): o is MoveOption & { distance: number } => !!o).map(({ start, end, pop }) => ({ start, end, pop }));

  return { id: `${code}_${date}_${e.id}`, eventId: e.id, date, title: e.title, start: e.start, end: e.end, pop: a.pop, moves };
}
