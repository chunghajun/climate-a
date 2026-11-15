// Day-level weather summary and the advice icons shown in the views.
import type { DayWx, HourWx } from "./kma";
import type { MidDay } from "./mid";
import { addDays } from "./time";

// Agreed thresholds (adjust here only).
export const RULES = {
  umbrellaPop: 60, // or ≥ 1mm/h
  foldingPop: 30,
  colderBy: 5, // 어제보다 이만큼 추우면 옷 아이콘에 ↓ 표시
  range: 10, // 최고 − 최저 (기상청 관례)
  heatFeels: 33, // 체감온도 (기상청 폭염주의보 기준)
};

export type WeatherKind = "sun" | "partly" | "cloud" | "rain" | "shower" | "snow";
export type OutfitKey = "o1" | "o2" | "o3" | "o4" | "o5" | "o6";
export type AdviceKey = "umbrella" | "folding" | "range" | "heat" | OutfitKey;

// What to wear by the temperature itself (a simplified 기온별 옷차림 table, not an official one).
export const OUTFITS: { key: OutfitKey; min: number; label: string; range: string }[] = [
  { key: "o1", min: 28, label: "민소매", range: "28° 이상" },
  { key: "o2", min: 23, label: "반팔", range: "23~27°" },
  { key: "o3", min: 17, label: "긴팔", range: "17~22°" },
  { key: "o4", min: 12, label: "가벼운 겉옷", range: "12~16°" },
  { key: "o5", min: 5, label: "두꺼운 겉옷", range: "5~11°" },
  { key: "o6", min: -99, label: "패딩", range: "4° 이하" },
];

export function outfitFor(temp: number): OutfitKey {
  return OUTFITS.find((o) => Math.round(temp) >= o.min)!.key;
}

// Outfits that already are an outer layer. On such days the 일교차 "겉옷 챙기기" advice
// says nothing new (the tester is wearing one anyway), so it is left out.
const OUTER: AdviceKey[] = ["o4", "o5", "o6"];
export const isOuter = (k: AdviceKey) => OUTER.includes(k);
export const rangeMatters = (dressTemp: number | null | undefined) => dressTemp == null || !isOuter(outfitFor(dressTemp));

export const ADVICE_LABEL: Record<AdviceKey, string> = {
  umbrella: "우산",
  folding: "접이식 우산",
  range: "일교차 큼",
  heat: "폭염",
  ...(Object.fromEntries(OUTFITS.map((o) => [o.key, o.label])) as Record<OutfitKey, string>),
};

export const isOutfit = (k: AdviceKey): k is OutfitKey => k.startsWith("o");

export type DaySummary = {
  date: string;
  kind: WeatherKind | null;
  hi: number | null;
  lo: number | null;
  pop: number | null;
  rainFrom: number | null; // first hour with a real chance of rain
  feels: number | null; // highest summer 체감온도 of the day
  dressTemp: number | null; // temperature the outfit is chosen for (morning, 7–9시)
  colder: boolean; // much colder than yesterday
  advice: AdviceKey[];
  source: "short" | "mid" | null;
};

const temp = (w: HourWx) => w.oT ?? w.uT ?? w.tmp;

// 기상청 여름철 체감온도 (기온 + 습도, Stull 습구온도). Only meaningful in warm weather.
export function feelsLike(t: number, rh: number) {
  const tw =
    t * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(t + rh) -
    Math.atan(rh - 1.67633) +
    0.00391838 * rh ** 1.5 * Math.atan(0.023101 * rh) -
    4.686035;
  return -0.2442 + 0.55399 * tw + 0.45535 * t - 0.0022 * tw * tw + 0.00278 * tw * t + 3.0;
}

export function hourFeels(w: HourWx | undefined) {
  const t = w ? temp(w) : undefined;
  if (t === undefined || w?.reh === undefined || t < 25) return null;
  return Math.round(feelsLike(t, w.reh));
}

export function hourKind(w: HourWx | undefined): WeatherKind | null {
  if (!w) return null;
  const pty = w.oPty || w.uPty || w.pty || 0;
  if (pty === 3) return "snow";
  if (pty > 0 || (w.pop ?? 0) >= RULES.umbrellaPop) return pty === 4 ? "shower" : "rain";
  if ((w.pop ?? 0) >= RULES.foldingPop) return "shower";
  if (w.sky === 4) return "cloud";
  if (w.sky === 3) return "partly";
  if (w.sky === 1) return "sun";
  return null;
}

function midKind(text: string): WeatherKind {
  if (text.includes("눈")) return "snow";
  if (text.includes("소나기")) return "shower";
  if (text.includes("비")) return "rain";
  if (text.includes("흐림")) return "cloud";
  if (text.includes("구름")) return "partly";
  return "sun";
}

export function skyLabel(kind: WeatherKind | null) {
  return { sun: "맑음", partly: "구름 조금", cloud: "흐림", rain: "비", shower: "가끔 비", snow: "눈" }[kind ?? "partly"];
}

// Weather picture for a stretch of hours: rain/snow wins, otherwise the most common sky.
function pictureOf(hours: HourWx[], rainy: boolean): WeatherKind | null {
  const kinds = hours.map(hourKind).filter((k): k is WeatherKind => k !== null);
  if (kinds.includes("snow")) return "snow";
  if (rainy || kinds.includes("rain")) return "rain";
  if (kinds.includes("shower")) return "shower";
  if (!kinds.length) return null;
  const count = (k: WeatherKind) => kinds.filter((x) => x === k).length;
  return (["sun", "partly", "cloud"] as const).reduce((a, b) => (count(b) > count(a) ? b : a), "sun");
}

// Today's picture, rain chance and umbrella cover only what is left of the day (this hour to midnight),
// so they follow the weather instead of hours that have already passed.
export function restOfDay(s: DaySummary, day: DayWx, fromHour: number) {
  const rest = Object.entries(day.h)
    .filter(([h]) => Number(h) >= fromHour)
    .map(([, w]) => w);
  if (!rest.length) return;
  const rainy = rest.some((w) => (w.oPty || w.uPty || w.pty || 0) > 0);
  const pops = rest.map((w) => w.pop).filter((p): p is number => p !== undefined);
  s.kind = pictureOf(rest, rainy) ?? s.kind;
  s.pop = pops.length ? Math.max(...pops) : null;
  const umbrella = s.kind === "rain" || (s.pop ?? 0) >= RULES.umbrellaPop;
  const folding = !umbrella && (s.pop ?? 0) >= RULES.foldingPop;
  s.advice = [...(umbrella ? ["umbrella" as const] : folding ? ["folding" as const] : []), ...s.advice.filter((k) => k !== "umbrella" && k !== "folding")];
}

type Base = Omit<DaySummary, "advice" | "colder">;

function fromShort(date: string, day: DayWx): Base | null {
  const hours = Object.entries(day.h).sort(([a], [b]) => a.localeCompare(b));
  if (!hours.length) return null;
  const temps = hours.map(([, w]) => temp(w)).filter((t): t is number => t !== undefined);
  const daytime = hours.filter(([h]) => Number(h) >= 6 && Number(h) <= 23).map(([, w]) => w);
  const pops = daytime.map((w) => w.pop).filter((p): p is number => p !== undefined);
  const pop = pops.length ? Math.max(...pops) : null;
  const rainy = daytime.some((w) => (w.oPty || w.uPty || w.pty || 0) > 0 || Math.max(w.pcp ?? 0, w.uRn1 ?? 0, w.oRn1 ?? 0) >= 1);
  const rainHour = hours.find(([h, w]) => Number(h) >= 6 && ((w.pop ?? 0) >= RULES.foldingPop || (w.uPty || w.pty || 0) > 0));
  const morning = hours.filter(([h]) => Number(h) >= 7 && Number(h) <= 9).map(([, w]) => temp(w)).filter((t): t is number => t !== undefined);
  const feels = hours.map(([, w]) => hourFeels(w)).filter((f): f is number => f !== null);

  const kind = pictureOf(daytime, rainy);
  const lo = temps.length ? Math.min(...temps, day.tmn ?? 99) : (day.tmn ?? null);
  return {
    date,
    kind,
    hi: temps.length ? Math.max(...temps, day.tmx ?? -99) : (day.tmx ?? null),
    lo,
    pop,
    rainFrom: rainHour ? Number(rainHour[0]) : null,
    feels: feels.length ? Math.max(...feels) : null,
    dressTemp: morning.length ? Math.min(...morning) : lo,
    source: "short",
  };
}

function fromMid(date: string, m: MidDay): Base {
  return {
    date,
    kind: midKind(m.wfPm.includes("비") || m.wfPm.includes("눈") ? m.wfPm : m.wfAm.includes("비") ? m.wfAm : m.wfPm),
    hi: m.max,
    lo: m.min,
    pop: Math.max(m.rnAm, m.rnPm),
    rainFrom: null,
    // No humidity in the mid-term forecast: treat a very hot high as heat.
    feels: m.max >= RULES.heatFeels ? m.max : null,
    dressTemp: m.min,
    source: "mid",
  };
}

// The day's high/low when the swing is big enough to call out (일교차), else null.
export function bigRange(date: string, day: DayWx | undefined) {
  const s = day ? fromShort(date, day) : null;
  if (s?.hi == null || s.lo == null || s.hi - s.lo < RULES.range) return null;
  return { hi: s.hi, lo: s.lo };
}

// Highest 체감온도 of a day when it reaches 폭염 level, else null.
export function heatOf(date: string, day: DayWx | undefined) {
  const f = day ? fromShort(date, day)?.feels : null;
  return f != null && f >= RULES.heatFeels ? f : null;
}

// Summaries for `dates` (consecutive). The day before the first date is read too,
// so the first day can be compared with yesterday.
export function summarizeDays(dates: string[], short: Record<string, DayWx>, mid: Record<string, MidDay>): Map<string, DaySummary> {
  const out = new Map<string, DaySummary>();
  if (!dates.length) return out;
  let prev: Base | null = null;
  for (const date of [addDays(dates[0], -1), ...dates]) {
    // A day mostly covered by the short-term forecast beats the coarser mid-term one.
    const s = short[date] ? fromShort(date, short[date]) : null;
    const hours = short[date] ? Object.keys(short[date].h).length : 0;
    // A handful of hours (the far end of a forecast) would give a misleading high/low.
    const base = s && hours >= 12 ? s : mid[date] ? fromMid(date, mid[date]) : s && hours >= 8 ? s : null;
    if (date !== addDays(dates[0], -1)) {
      const advice: AdviceKey[] = [];
      let colder = false;
      if (base) {
        const rainHeavy = base.kind === "rain" || (base.pop ?? 0) >= RULES.umbrellaPop;
        if (rainHeavy) advice.push("umbrella");
        else if ((base.pop ?? 0) >= RULES.foldingPop) advice.push("folding");
        if (base.feels != null && base.feels >= RULES.heatFeels) advice.push("heat");
        if (base.dressTemp != null) advice.push(outfitFor(base.dressTemp));
        if (base.hi != null && base.lo != null && base.hi - base.lo >= RULES.range && rangeMatters(base.dressTemp)) advice.push("range");
        colder = prev?.dressTemp != null && base.dressTemp != null && prev.dressTemp - base.dressTemp >= RULES.colderBy;
      }
      out.set(
        date,
        base
          ? { ...base, advice, colder }
          : { date, kind: null, hi: null, lo: null, pop: null, rainFrom: null, feels: null, dressTemp: null, colder, advice, source: null }
      );
    }
    prev = base;
  }
  return out;
}
