import { restOfDay, summarizeDays, type DaySummary } from "./advice";
import { eventsOn } from "./events";
import { gridKey, toGrid, type DayWx } from "./kma";
import { midForecast, midRegion } from "./mid";
import { assess, buildOutings, type Assessment, type Outing } from "./outing";
import { findSuggestion, type Suggestion } from "./suggest";
import { addDays, kstNow } from "./time";
import type { CalEvent, Place } from "./types";
import { readRange, refreshGrid, weatherFor } from "./weather";

export type PlannedOuting = { outing: Outing; a: Assessment; wx?: DayWx };

// Outings with weather for each requested date (each compared with the day before).
export async function planDays(
  events: CalEvent[],
  places: Place[],
  dates: string[],
  refresh: "always" | "if-missing" = "if-missing"
) {
  const outingsByDate = new Map(dates.map((d) => [d, buildOutings(eventsOn(events, d), places)]));

  const neededDates = [...new Set(dates.flatMap((d) => [addDays(d, -1), d]))];
  const grids = new Map<string, ReturnType<typeof toGrid>>();
  for (const list of outingsByDate.values())
    for (const o of list) if (o.place) grids.set(o.place.id, toGrid(o.place.lat, o.place.lon));

  const wxByGrid = new Map<string, Record<string, DayWx>>();
  await Promise.all(
    [...new Set([...grids.values()].map(gridKey))].map(async (key) => {
      const [nx, ny] = key.split("_").map(Number);
      wxByGrid.set(key, await weatherFor({ nx, ny }, neededDates, refresh).catch(() => ({})));
    })
  );

  const result = new Map<string, PlannedOuting[]>();
  for (const [date, list] of outingsByDate) {
    result.set(
      date,
      list.map((outing) => {
        const grid = outing.place ? grids.get(outing.place.id) : undefined;
        const wx = grid ? wxByGrid.get(gridKey(grid)) : undefined;
        return { outing, a: assess(outing, wx?.[date], wx?.[addDays(date, -1)]), wx: wx?.[date] };
      })
    );
  }
  return result;
}

// Day-by-day weather at the tester's default place (first saved place) for a date range:
// cached observations/short-term forecasts, then the mid-term forecast further out.
export async function weatherDays(places: Place[], from: string, to: string) {
  const empty = { summaries: new Map<string, DaySummary>(), short: {} as Record<string, DayWx> };
  const home = places[0];
  if (!home) return empty;
  const grid = toGrid(home.lat, home.lon);
  const { date: today, minutes: now } = kstNow();
  let short = await readRange(grid, addDays(from, -1), to);
  if (from <= today && today <= to && !short[today]) {
    await refreshGrid(grid).catch(() => {});
    short = await readRange(grid, addDays(from, -1), to);
  }
  const needsMid = to > addDays(today, 3);
  const mid = needsMid ? await midForecast(midRegion(home.lat, home.lon)) : {};
  const dates: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
  const summaries = summarizeDays(dates, short, mid);
  // Today shows the rest of the day (now → midnight), so it moves with the weather.
  const todaySummary = summaries.get(today);
  if (todaySummary && short[today]) restOfDay(todaySummary, short[today], Math.floor(now / 60));
  return { summaries, short };
}

// Change suggestions for the flexible outdoor plans among the planned outings.
export function suggestionsFor(code: string, date: string, planned: PlannedOuting[], nowMin: number | null) {
  const dayEvents = planned.flatMap((p) => p.outing.events);
  return planned.flatMap((p) =>
    p.outing.events
      .map((e) => findSuggestion(code, e, date, p.a, p.wx, dayEvents, nowMin))
      .filter((s): s is Suggestion => s !== null)
  );
}
