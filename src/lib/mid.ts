// 기상청 중기예보 조회서비스: days 5–10, by region code (AM/PM sky and rain chance, daily min/max).
import { db } from "./firebase";
import { addDays, kstNow } from "./time";

const BASE = "https://apis.data.go.kr/1360000/MidFcstInfoService";

// Representative cities: [name, lat, lon, 육상예보 구역, 기온 구역]. A place uses the nearest one.
const CITIES: [string, number, number, string, string][] = [
  ["서울", 37.57, 126.98, "11B00000", "11B10101"],
  ["인천", 37.46, 126.71, "11B00000", "11B20201"],
  ["수원", 37.26, 127.03, "11B00000", "11B20601"],
  ["파주", 37.76, 126.78, "11B00000", "11B20305"],
  ["춘천", 37.88, 127.73, "11D10000", "11D10301"],
  ["원주", 37.34, 127.92, "11D10000", "11D10401"],
  ["강릉", 37.75, 128.88, "11D20000", "11D20501"],
  ["대전", 36.35, 127.38, "11C20000", "11C20401"],
  ["세종", 36.48, 127.29, "11C20000", "11C20404"],
  ["홍성", 36.6, 126.66, "11C20000", "11C20104"],
  ["청주", 36.64, 127.49, "11C10000", "11C10301"],
  ["전주", 35.82, 127.15, "11F10000", "11F10201"],
  ["광주", 35.16, 126.85, "11F20000", "11F20501"],
  ["목포", 34.81, 126.39, "11F20000", "21F20801"],
  ["여수", 34.76, 127.66, "11F20000", "11F20401"],
  ["대구", 35.87, 128.6, "11H10000", "11H10701"],
  ["안동", 36.57, 128.73, "11H10000", "11H10501"],
  ["포항", 36.02, 129.34, "11H10000", "11H10201"],
  ["부산", 35.18, 129.08, "11H20000", "11H20201"],
  ["울산", 35.54, 129.31, "11H20000", "11H20101"],
  ["창원", 35.23, 128.68, "11H20000", "11H20301"],
  ["제주", 33.5, 126.53, "11G00000", "11G00201"],
  ["서귀포", 33.25, 126.56, "11G00000", "11G00401"],
];

export type MidRegion = { land: string; ta: string };

export function midRegion(lat: number, lon: number): MidRegion {
  let best = CITIES[0];
  let bestD = Infinity;
  for (const c of CITIES) {
    const d = (c[1] - lat) ** 2 + ((c[2] - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return { land: best[3], ta: best[4] };
}

export type MidDay = { wfAm: string; wfPm: string; rnAm: number; rnPm: number; min: number; max: number };

// Issued at 06:00 and 18:00, usable shortly after.
function latestTmFc(now = new Date()) {
  const k = kstNow(new Date(now.getTime() - 30 * 60_000));
  const hour = Math.floor(k.minutes / 60);
  if (hour >= 18) return { date: k.date, tmFc: `${k.date.replaceAll("-", "")}1800` };
  if (hour >= 6) return { date: k.date, tmFc: `${k.date.replaceAll("-", "")}0600` };
  const y = addDays(k.date, -1);
  return { date: y, tmFc: `${y.replaceAll("-", "")}1800` };
}

async function call(op: string, regId: string, tmFc: string) {
  const params = new URLSearchParams({
    serviceKey: process.env.KMA_SERVICE_KEY!.trim(),
    pageNo: "1",
    numOfRows: "10",
    dataType: "JSON",
    regId,
    tmFc,
  });
  const res = await fetch(`${BASE}/${op}?${params}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  const json = await res.json();
  if (json.response?.header?.resultCode !== "00") throw new Error(`KMA ${op}: ${json.response?.header?.resultMsg}`);
  return json.response.body.items.item[0] as Record<string, string | number>;
}

// Cached per region pair in mid/{land_ta}; refetched when a newer forecast is issued.
export async function midForecast(region: MidRegion): Promise<Record<string, MidDay>> {
  const ref = db().collection("mid").doc(`${region.land}_${region.ta}`);
  const { date, tmFc } = latestTmFc();
  const cached = (await ref.get()).data();
  if (cached?.tmFc === tmFc) return cached.days ?? {};
  try {
    const [land, ta] = await Promise.all([call("getMidLandFcst", region.land, tmFc), call("getMidTa", region.ta, tmFc)]);
    const days: Record<string, MidDay> = {};
    for (let n = 4; n <= 10; n++) {
      const am = land[`wf${n}Am`] ?? land[`wf${n}`];
      const max = ta[`taMax${n}`];
      if (am === undefined || max === undefined || am === "") continue;
      days[addDays(date, n)] = {
        wfAm: String(am),
        wfPm: String(land[`wf${n}Pm`] ?? land[`wf${n}`]),
        rnAm: Number(land[`rnSt${n}Am`] ?? land[`rnSt${n}`] ?? 0),
        rnPm: Number(land[`rnSt${n}Pm`] ?? land[`rnSt${n}`] ?? 0),
        min: Number(ta[`taMin${n}`]),
        max: Number(max),
      };
    }
    await ref.set({ tmFc, days });
    return days;
  } catch (e) {
    console.error("mid forecast failed", e);
    return cached?.days ?? {};
  }
}
