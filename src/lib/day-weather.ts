import type { AdviceKey, DaySummary, WeatherKind } from "./advice";
import type { DayWx } from "./kma";
import { addDays } from "./time";

// One forecast day as the calendar and the week-weather sheet show it.
export type DayWeather = { kind: WeatherKind; hi: number | null; lo: number | null; pop: number | null; mm: number | null; advice: AdviceKey[]; colder: boolean; mid: boolean };

const round = (t: number | null) => (t == null ? null : Math.round(t));

// from … to (inclusive), skipping days the forecast does not reach.
export function dayWeather(summaries: Map<string, DaySummary>, short: Record<string, DayWx>, from: string, to: string) {
  const out: Record<string, DayWeather> = {};
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const s = summaries.get(d);
    if (!s?.kind) continue;
    // 예상 강수량: the day's hourly amounts, where the short-range forecast has them
    const mm = short[d] ? Math.round(Object.values(short[d].h).reduce((t, h) => t + (h.pcp ?? 0), 0)) : null;
    out[d] = { kind: s.kind, hi: round(s.hi), lo: round(s.lo), pop: s.pop, mm, advice: s.advice, colder: s.colder, mid: s.source === "mid" };
  }
  return out;
}
