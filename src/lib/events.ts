import type { CalEvent } from "./types";
import { addDays, dowOf, fromMinutes, toMinutes } from "./time";

export function occursOn(e: CalEvent, date: string) {
  if (e.date) return e.date === date;
  return e.repeatDays.includes(dowOf(date)) && !e.skipDates.includes(date);
}

// Untimed (시간 미정) events first, then by start time.
export function eventsOn(events: CalEvent[], date: string) {
  return events
    .filter((e) => occursOn(e, date))
    .sort((a, b) => Number(b.untimed) - Number(a.untimed) || a.start.localeCompare(b.start));
}

export function departureTime(e: CalEvent) {
  return e.untimed ? "" : fromMinutes(toMinutes(e.start) - e.travelMin);
}

export function timeLabel(e: CalEvent) {
  return e.untimed ? "시간 미정" : `${e.start}–${e.end}`;
}

// Upcoming dates of a repeating event, ignoring skips (for choosing days off).
export function upcomingDates(e: CalEvent, from: string, days = 14) {
  if (e.date) return [];
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    if (e.repeatDays.includes(dowOf(d))) out.push(d);
  }
  return out;
}
