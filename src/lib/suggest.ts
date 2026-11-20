// H3 비 주의: a plan the tester marked as movable (유동, indoor or outdoor) with rain in its forecast.
// The tester is only told (no other times are offered any more), so `moves` stays empty; the type
// keeps it for older saved suggestions.
import type { DayWx } from "./kma";
import type { Assessment } from "./outing";
import { toMinutes } from "./time";
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
  setting?: "indoor" | "outdoor"; // missing on suggestions saved before 비 주의
  moves: MoveOption[];
};

export function findSuggestion(
  code: string,
  e: CalEvent,
  date: string,
  a: Assessment,
  wx: DayWx | undefined,
  dayEvents: CalEvent[],
  nowMin: number | null // minutes now if `date` is today
): Suggestion | null {
  if (!e.flexible || a.level === "none" || !wx) return null;
  const start = toMinutes(e.start);
  const duration = toMinutes(e.end) - start;
  if (duration <= 0) return null;
  // No use once the tester should already have left.
  if (nowMin !== null && start - e.travelMin < nowMin) return null;

  void dayEvents; // kept in the signature for plan.ts
  return { id: `${code}_${date}_${e.id}`, eventId: e.id, date, title: e.title, start: e.start, end: e.end, pop: a.pop, setting: e.setting, moves: [] };
}
