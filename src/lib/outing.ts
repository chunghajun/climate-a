// Turns a day's events plus hourly weather into "outings" and decides what to bring.
import type { DayWx, HourWx } from "./kma";
import { ADVICE_LABEL, hourFeels, outfitFor, rangeMatters, RULES, type AdviceKey, type DaySummary } from "./advice";
import type { AlertPrefs, CalEvent, Place } from "./types";
import { toMinutes } from "./time";

// Rules agreed with the team.
export const UMBRELLA_POP = 60; // or ≥ 1mm/h
export const FOLDING_POP = 30;
export const COAT_DROP = 5; // °C colder than yesterday at the same hours
const SAME_OUTING_GAP = 60; // events this close at the same place are one trip

export type Outing = {
  events: CalEvent[];
  place: Place | undefined;
  depart: number; // minutes after midnight, KST
  back: number; // estimated arrival home
};

export function buildOutings(dayEvents: CalEvent[], places: Place[]): Outing[] {
  const placeOf = (e: CalEvent) => places.find((p) => p.id === e.placeId) ?? places[0];
  const outings: Outing[] = [];
  // 시간 미정 events have no departure, so they never form a trip or an alert.
  for (const e of dayEvents.filter((x) => !x.untimed)) {
    const prev = outings.at(-1);
    const last = prev?.events.at(-1);
    if (prev && last && placeOf(e) === prev.place && toMinutes(e.start) - toMinutes(last.end) <= SAME_OUTING_GAP) {
      prev.events.push(e);
      prev.back = Math.max(prev.back, toMinutes(e.end) + e.travelMin);
      continue;
    }
    outings.push({
      events: [e],
      place: placeOf(e),
      depart: toMinutes(e.start) - e.travelMin,
      back: toMinutes(e.end) + e.travelMin,
    });
  }
  return outings;
}

export type SegmentKind = "go" | "stay" | "back";
export type Level = "umbrella" | "folding" | "none";

export type Assessment = {
  level: Level;
  pop: number | null; // highest rain probability on the trip
  mm: number;
  peakHour: number | null;
  peakKind: SegmentKind | null;
  peakTitle: string;
  goPop: number | null; // highest probability while heading out
  coatDrop: number | null; // set when it is COAT_DROP°C+ colder than yesterday
  coolRise: number | null; // set when it is COAT_DROP°C+ warmer than yesterday
  temp: number | null; // coldest forecast temperature on the trip
  feels: number | null; // hottest 체감온도 on the trip (warm weather only)
  hours: { h: number; pop: number | null; temp: number | null }[];
  hasData: boolean;
};

const fcstTemp = (w?: HourWx) => w?.uT ?? w?.tmp ?? null;
const pastTemp = (w?: HourWx) => w?.oT ?? w?.uT ?? w?.tmp ?? null;
const hh = (h: number) => String(h).padStart(2, "0");

function hoursIn(from: number, to: number) {
  const out: number[] = [];
  for (let h = Math.max(0, Math.floor(from / 60)); h <= Math.min(23, Math.floor((to - 1) / 60)); h++) out.push(h);
  return out;
}

export function assess(o: Outing, today?: DayWx, yesterday?: DayWx): Assessment {
  const first = o.events[0];
  const last = o.events.at(-1)!;
  // Indoor time doesn't matter for rain; only the trips and any outdoor events do.
  const segments: { kind: SegmentKind; from: number; to: number; title: string }[] = [
    { kind: "go", from: o.depart, to: toMinutes(first.start), title: first.title },
    ...o.events
      .filter((e) => e.setting === "outdoor")
      .map((e) => ({ kind: "stay" as const, from: toMinutes(e.start), to: toMinutes(e.end), title: e.title })),
    { kind: "back", from: toMinutes(last.end), to: o.back, title: last.title },
  ];

  let pop: number | null = null;
  let mm = 0;
  let raining = false;
  let peakHour: number | null = null;
  let peakKind: SegmentKind | null = null;
  let peakTitle = first.title;
  let goPop: number | null = null;
  let hasData = false;

  for (const s of segments) {
    for (const h of hoursIn(s.from, s.to)) {
      const w = today?.h[hh(h)];
      if (!w) continue;
      hasData = true;
      const p = w.pop ?? null;
      mm = Math.max(mm, w.pcp ?? 0, w.uRn1 ?? 0);
      if ((w.uPty ?? 0) > 0) raining = true;
      if (s.kind === "go" && p !== null) goPop = Math.max(goPop ?? 0, p);
      if (p !== null && (pop === null || p > pop)) {
        pop = p;
        peakHour = h;
        peakKind = s.kind;
        peakTitle = s.title;
      }
    }
  }

  const level: Level =
    (pop ?? 0) >= UMBRELLA_POP || mm >= 1 || raining ? "umbrella" : (pop ?? 0) >= FOLDING_POP ? "folding" : "none";

  // Compare the whole trip with the same hours yesterday.
  const tripHours = hoursIn(o.depart, o.back);
  const pairs = tripHours
    .map((h) => [fcstTemp(today?.h[hh(h)]), pastTemp(yesterday?.h[hh(h)])] as const)
    .filter((p): p is readonly [number, number] => p[0] !== null && p[1] !== null);
  let coatDrop: number | null = null;
  let coolRise: number | null = null;
  if (pairs.length) {
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const drop = Math.round(avg(pairs.map((p) => p[1])) - avg(pairs.map((p) => p[0])));
    if (drop >= COAT_DROP) coatDrop = drop;
    if (-drop >= COAT_DROP) coolRise = -drop;
  }
  const temps = tripHours.map((h) => fcstTemp(today?.h[hh(h)])).filter((t): t is number => t !== null);
  const feelsList = tripHours.map((h) => hourFeels(today?.h[hh(h)])).filter((f): f is number => f !== null);

  return {
    level,
    pop,
    mm,
    peakHour,
    peakKind,
    peakTitle,
    goPop,
    coatDrop,
    coolRise,
    temp: temps.length ? Math.min(...temps) : null,
    feels: feelsList.length ? Math.max(...feelsList) : null,
    hours: tripHours.map((h) => ({ h, pop: today?.h[hh(h)]?.pop ?? null, temp: fcstTemp(today?.h[hh(h)]) })),
    hasData,
  };
}

function where(a: Assessment) {
  const at = a.peakHour !== null ? `${a.peakHour}시쯤 ` : "";
  if (a.peakKind === "back") return `${at}돌아오는 길`;
  if (a.peakKind === "stay") return `${at}${a.peakTitle} 하는 동안`;
  return `${at}가는 길`;
}

// Advice icons for one trip: rain, heat, then what to wear for its coldest hour.
export function outingAdvice(a: Assessment): AdviceKey[] {
  const out: AdviceKey[] = [];
  if (a.level === "umbrella") out.push("umbrella");
  if (a.level === "folding") out.push("folding");
  if (a.feels != null && a.feels >= RULES.heatFeels) out.push("heat");
  if (a.temp != null) out.push(outfitFor(a.temp));
  return out;
}

type MessageOptions = {
  prefs: AlertPrefs;
  range: { hi: number; lo: number } | null; // the day's big temperature swing, if any
  suggestionHint: boolean;
};

// Push message in the agreed soft tone, limited to the alert types the tester kept on.
// The outfit is mentioned on its own only when it is much colder than yesterday.
// null = nothing worth a notification.
export function composeMessage(o: Outing, a: Assessment, opts: MessageOptions): { title: string; body: string } | null {
  const { prefs } = opts;
  const name = o.events[0].title;
  const rain = (a.level === "umbrella" && prefs.umbrella) || (a.level === "folding" && prefs.folding) ? a.level : null;
  const heat = prefs.heat && a.feels != null && a.feels >= RULES.heatFeels ? a.feels : null;
  const colder = prefs.outfit ? a.coatDrop : null;
  const range = prefs.range && rangeMatters(a.temp) ? opts.range : null;
  if (!rain && !heat && !colder && !range) return null;

  const wear = a.temp != null ? ADVICE_LABEL[outfitFor(a.temp)] : null;
  const extras: string[] = [];
  if (heat) extras.push(`체감 ${heat}°로 무더워요. 물을 챙기고 그늘로 다니세요.`);
  if (colder) extras.push(`어제보다 ${colder}도 쌀쌀해요${wear ? ` · ${wear} 추천` : ""}.`);
  if (range) extras.push(`일교차가 ${range.hi - range.lo}도라 겉옷 하나 챙기세요.`);
  if (opts.suggestionHint && prefs.suggestion) extras.push("일정별 비 소식은 앱에서 확인하세요.");

  let title: string;
  let lead: string;
  if (rain) {
    const calmNow = a.peakKind === "back" && (a.goPop ?? 0) < FOLDING_POP ? "지금은 괜찮지만, " : "";
    if (rain === "umbrella") {
      title = `☔ ${name} 가기 전에 우산 챙기세요`;
      lead = `${calmNow}${where(a)}에 ${a.pop !== null ? `비 올 확률이 ${a.pop}%예요` : "비 소식이 있어요"}. 우산 꼭 챙겨 가세요!`;
    } else {
      title = `🌂 ${name} 다녀올 때 비가 올 수도 있어요`;
      lead = `${calmNow}${where(a)}에 비 올 확률이 ${a.pop}%라서, 가방에 접이식 우산 하나 넣어두면 든든할 거예요.`;
    }
  } else if (heat) {
    title = `🥵 ${name} 가는 길, 폭염이에요`;
    lead = extras.shift()!;
  } else if (colder) {
    title = `🧥 ${name} 가는 길, 어제보다 쌀쌀해요`;
    lead = `어제 이맘때보다 ${colder}도 낮아요${a.temp !== null ? ` (${a.temp}°)` : ""}.${wear ? ` ${wear}을(를) 챙겨 입으세요!` : ""}`;
    extras.shift();
  } else {
    title = `🌡 ${name} 다녀올 때 일교차가 커요`;
    lead = `오늘 최고 ${range!.hi}° · 최저 ${range!.lo}°라 겉옷 하나 챙기세요.`;
    extras.shift();
  }
  return { title, body: [lead, ...extras].join(" ") };
}

// 기후 알람 on a day with events: covers every trip still ahead, even when nothing is wrong.
export function composeDaily(
  trips: { outing: Outing; a: Assessment }[],
  opts: { prefs: AlertPrefs; range: { hi: number; lo: number } | null }
): { title: string; body: string } {
  const { prefs } = opts;
  const first = trips[0].outing.events[0].title;
  const rainy = trips
    .filter((x) => (x.a.level === "umbrella" && prefs.umbrella) || (x.a.level === "folding" && prefs.folding))
    .sort((x, y) => (y.a.level === "umbrella" ? 1 : 0) - (x.a.level === "umbrella" ? 1 : 0) || (y.a.pop ?? 0) - (x.a.pop ?? 0))[0];
  const temps = trips.map((x) => x.a.temp).filter((t): t is number => t !== null);
  const temp = temps.length ? Math.min(...temps) : null;
  const feels = Math.max(-99, ...trips.map((x) => x.a.feels ?? -99));
  const colder = Math.max(0, ...trips.map((x) => x.a.coatDrop ?? 0));
  const wear = temp !== null ? ADVICE_LABEL[outfitFor(temp)] : null;

  const lines: string[] = [];
  if (rainy) {
    const on = rainy === trips[0] ? "" : `${rainy.outing.events[0].title} 때 `;
    lines.push(
      rainy.a.level === "umbrella"
        ? `${on}${where(rainy.a)}에 비 올 확률이 ${rainy.a.pop ?? "-"}%예요. 우산 꼭 챙기세요!`
        : `${on}${where(rainy.a)}에 비 올 확률이 ${rainy.a.pop}%라 접이식 우산 하나 넣어 두세요.`
    );
  } else if (prefs.umbrella || prefs.folding) lines.push("오늘 일정 동안 비 소식은 없어요.");
  const heat = prefs.heat && feels >= RULES.heatFeels;
  if (heat) lines.push(`체감 ${feels}°로 무더워요. 물을 챙기고 그늘로 다니세요.`);
  if (prefs.outfit && wear) lines.push(colder ? `어제보다 ${colder}도 쌀쌀해요 · ${wear} 추천해요.` : `옷은 ${wear} 정도면 좋아요 (최저 ${temp}°).`);
  if (prefs.range && opts.range && rangeMatters(temp)) lines.push(`일교차가 ${opts.range.hi - opts.range.lo}도라 겉옷 하나 챙기세요.`);

  const title = rainy
    ? rainy.a.level === "umbrella"
      ? "☔ 오늘은 우산 챙기세요"
      : "🌂 오늘은 접이식 우산 하나 챙기세요"
    : heat
      ? "🥵 오늘은 무더워요"
      : prefs.outfit && colder
        ? "🧥 오늘은 어제보다 쌀쌀해요"
        : `🎒 ${first} ${trips[0].outing.events[0].start} 시작이에요`;
  const lead = title.startsWith("🎒") ? [] : [`${first} ${trips[0].outing.events[0].start} 시작이에요.`];
  return { title, body: [...lead, ...lines].join(" ") || "오늘의 가방을 확인해 보세요." };
}

// 기후 알람 on a day without events: the local weather for the day.
export function composeWeatherOnly(s: DaySummary, opts: { prefs: AlertPrefs; range: { hi: number; lo: number } | null }): { title: string; body: string } {
  const { prefs } = opts;
  const pop = s.pop ?? 0;
  const umbrella = prefs.umbrella && (s.kind === "rain" || pop >= RULES.umbrellaPop);
  const folding = !umbrella && prefs.folding && pop >= RULES.foldingPop;
  const heat = prefs.heat && s.feels != null && s.feels >= RULES.heatFeels;
  const wear = s.dressTemp != null ? ADVICE_LABEL[outfitFor(s.dressTemp)] : null;
  const temps = s.hi != null && s.lo != null ? ` 최고 ${Math.round(s.hi)}° · 최저 ${Math.round(s.lo)}°예요.` : "";
  const when = s.rainFrom != null ? `${s.rainFrom}시쯤부터 ` : "";

  const sky = { sun: "맑아요", partly: "구름이 조금 있어요", cloud: "흐려요", rain: "비가 와요", shower: "가끔 비가 와요", snow: "눈이 와요" }[s.kind ?? "partly"];
  const lines = [`오늘은 ${sky}.${temps}`];
  if (umbrella) lines.push(`${when}비 올 확률이 ${pop}%예요. 나갈 땐 우산 챙기세요.`);
  else if (folding) lines.push(`${when}비 올 확률이 ${pop}%라 접이식 우산이 있으면 좋아요.`);
  if (heat) lines.push(`체감 ${s.feels}°로 무더워요. 물을 챙기고 그늘로 다니세요.`);
  if (prefs.outfit && wear) lines.push(s.colder ? `어제보다 쌀쌀해요 · ${wear} 추천해요.` : `옷은 ${wear} 정도면 좋아요.`);
  if (prefs.range && opts.range && rangeMatters(s.dressTemp)) lines.push(`일교차가 ${opts.range.hi - opts.range.lo}도라 겉옷 하나 챙기세요.`);

  const title = umbrella ? "☔ 오늘은 우산 챙기세요" : folding ? "🌂 오늘은 접이식 우산 하나 챙기세요" : heat ? "🥵 오늘은 무더워요" : "🌤 오늘 날씨예요";
  return { title, body: lines.join(" ") };
}

// `short` is the few words that fit under a bag tile; `reason` is the full line for the sheet.
export type BagItem = { key: AdviceKey; reason: string; short: string; colder?: boolean };

// What to pack/wear today: rain, heat and outfit for the trips still ahead, plus the day's swing.
export function todayBag(
  list: { outing: Outing; a: Assessment }[],
  range: { hi: number; lo: number } | null,
  fallbackTemp: number | null // morning temperature when no trip is left today
): BagItem[] {
  const items: BagItem[] = [];
  const rain = list
    .filter((x) => x.a.level !== "none")
    .sort((x, y) => (y.a.level === "umbrella" ? 1 : 0) - (x.a.level === "umbrella" ? 1 : 0) || (y.a.pop ?? 0) - (x.a.pop ?? 0))[0];
  if (rain) {
    items.push({
      key: rain.a.level === "umbrella" ? "umbrella" : "folding",
      reason: `${rain.outing.events[0].title} · ${where(rain.a)} 비 ${rain.a.pop ?? "-"}%`,
      short: `비 ${rain.a.pop ?? "-"}%`,
    });
  }
  const feels = Math.max(-99, ...list.map((x) => x.a.feels ?? -99));
  if (feels >= RULES.heatFeels) items.push({ key: "heat", reason: `체감 ${feels}° · 물 챙기고 그늘로`, short: `체감 ${feels}°` });
  const temps = list.map((x) => x.a.temp).filter((t): t is number => t !== null);
  const dress = temps.length ? Math.min(...temps) : fallbackTemp;
  if (dress != null) {
    const colder = list.some((x) => x.a.coatDrop);
    items.push({
      key: outfitFor(dress),
      reason: `${temps.length ? "외출 시간" : "아침"} 최저 ${Math.round(dress)}°${colder ? " · 어제보다 쌀쌀해요" : ""}`,
      short: colder ? "어제보다 추워요" : `최저 ${Math.round(dress)}°`,
      colder,
    });
  }
  if (range && rangeMatters(dress)) items.push({ key: "range", reason: `최고 ${range.hi}° · 최저 ${range.lo}°`, short: `${range.lo}~${range.hi}°` });
  return items;
}