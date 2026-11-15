// 기상청 단기예보 조회서비스 (VilageFcstInfoService_2.0) client.
import { kstNow } from "./time";

const BASE = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";

export type Grid = { nx: number; ny: number };

// Values merged per hour. vil* = 단기예보, u* = 초단기예보, o* = 초단기실황 (observed).
export type HourWx = {
  pop?: number; // 강수확률 %
  pcp?: number; // 1시간 강수량 mm
  pty?: number; // 강수형태 0 없음 1 비 2 비/눈 3 눈 4 소나기
  tmp?: number; // 기온
  sky?: number; // 하늘상태 1 맑음 3 구름많음 4 흐림
  reh?: number; // 습도 % (for 체감온도)
  uT?: number;
  uRn1?: number;
  uPty?: number;
  oT?: number;
  oRn1?: number;
  oPty?: number;
};

export type DayWx = { h: Record<string, HourWx>; tmn?: number; tmx?: number };
export type WxPatch = Record<string, { h?: Record<string, HourWx>; tmn?: number; tmx?: number }>;

// Lat/lon → KMA 5km grid (Lambert conformal conic, from the KMA guide).
export function toGrid(lat: number, lon: number): Grid {
  const RE = 6371.00877 / 5.0;
  const DEGRAD = Math.PI / 180;
  const slat1 = 30 * DEGRAD;
  const slat2 = 60 * DEGRAD;
  const olon = 126 * DEGRAD;
  const olat = 38 * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (RE * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (RE * sf) / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;
  return {
    nx: Math.floor(ra * Math.sin(theta) + 43 + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + 136 + 0.5),
  };
}

export const gridKey = (g: Grid) => `${g.nx}_${g.ny}`;

type Base = { baseDate: string; baseTime: string };

function kstAt(msAgo: number, now: Date) {
  const k = kstNow(new Date(now.getTime() - msAgo));
  return { ymd: k.date.replaceAll("-", ""), hour: Math.floor(k.minutes / 60) };
}

// 단기예보: issued 02,05,…,23시, available about 10 minutes later.
export function vilageBase(now = new Date()): Base {
  const k = kstAt(10 * 60_000, now);
  const hour = [23, 20, 17, 14, 11, 8, 5, 2].find((h) => h <= k.hour);
  if (hour === undefined) return { baseDate: kstAt(10 * 60_000 + 24 * 3_600_000, now).ymd, baseTime: "2300" };
  return { baseDate: k.ymd, baseTime: `${String(hour).padStart(2, "0")}00` };
}

// 초단기예보: issued every hour at HH30, available about 15 minutes later.
export function ultraFcstBase(now = new Date()): Base {
  const k = kstAt(45 * 60_000, now);
  return { baseDate: k.ymd, baseTime: `${String(k.hour).padStart(2, "0")}30` };
}

// 초단기실황: every hour at HH00, available about 40 minutes later.
export function ncstBase(now = new Date()): Base {
  const k = kstAt(40 * 60_000, now);
  return { baseDate: k.ymd, baseTime: `${String(k.hour).padStart(2, "0")}00` };
}

export const baseId = (b: Base) => `${b.baseDate}${b.baseTime}`;

async function call(op: string, base: Base, grid: Grid) {
  const params = new URLSearchParams({
    serviceKey: process.env.KMA_SERVICE_KEY!.trim(),
    pageNo: "1",
    // 단기예보 now runs about five days ahead (~1,100 rows); ask for all of it.
    numOfRows: "3000",
    dataType: "JSON",
    base_date: base.baseDate,
    base_time: base.baseTime,
    nx: String(grid.nx),
    ny: String(grid.ny),
  });
  const res = await fetch(`${BASE}/${op}?${params}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    // Key or quota errors come back as XML.
    throw new Error(`KMA ${op}: ${text.slice(0, 200)}`);
  }
  const header = json.response?.header;
  if (header?.resultCode !== "00") throw new Error(`KMA ${op}: ${header?.resultCode} ${header?.resultMsg}`);
  return json.response.body.items.item as Record<string, string>[];
}

// "강수없음" → 0, "1mm 미만" → 0.5, "30.0~50.0mm" → 30
export function parseMm(v: string) {
  if (v.includes("없음")) return 0;
  if (v.includes("미만")) return 0.5;
  const m = v.match(/[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}

const isoDate = (ymd: string) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;

function put(patch: WxPatch, ymd: string, hhmm: string, values: HourWx) {
  const day = (patch[isoDate(ymd)] ??= { h: {} });
  const hh = hhmm.slice(0, 2);
  day.h![hh] = { ...day.h![hh], ...values };
}

export async function fetchVilage(grid: Grid, base: Base): Promise<WxPatch> {
  const patch: WxPatch = {};
  for (const it of await call("getVilageFcst", base, grid)) {
    const v = it.fcstValue;
    switch (it.category) {
      case "POP": put(patch, it.fcstDate, it.fcstTime, { pop: Number(v) }); break;
      case "PCP": put(patch, it.fcstDate, it.fcstTime, { pcp: parseMm(v) }); break;
      case "PTY": put(patch, it.fcstDate, it.fcstTime, { pty: Number(v) }); break;
      case "TMP": put(patch, it.fcstDate, it.fcstTime, { tmp: Number(v) }); break;
      case "SKY": put(patch, it.fcstDate, it.fcstTime, { sky: Number(v) }); break;
      case "REH": put(patch, it.fcstDate, it.fcstTime, { reh: Number(v) }); break;
      case "TMN": (patch[isoDate(it.fcstDate)] ??= { h: {} }).tmn = Number(v); break;
      case "TMX": (patch[isoDate(it.fcstDate)] ??= { h: {} }).tmx = Number(v); break;
    }
  }
  return patch;
}

export async function fetchUltraFcst(grid: Grid, base: Base): Promise<WxPatch> {
  const patch: WxPatch = {};
  for (const it of await call("getUltraSrtFcst", base, grid)) {
    const v = it.fcstValue;
    switch (it.category) {
      case "T1H": put(patch, it.fcstDate, it.fcstTime, { uT: Number(v) }); break;
      case "RN1": put(patch, it.fcstDate, it.fcstTime, { uRn1: parseMm(v) }); break;
      case "PTY": put(patch, it.fcstDate, it.fcstTime, { uPty: Number(v) }); break;
    }
  }
  return patch;
}

export async function fetchNcst(grid: Grid, base: Base): Promise<WxPatch> {
  const patch: WxPatch = {};
  for (const it of await call("getUltraSrtNcst", base, grid)) {
    const v = Number(it.obsrValue);
    switch (it.category) {
      case "T1H": put(patch, it.baseDate, it.baseTime, { oT: v }); break;
      case "RN1": put(patch, it.baseDate, it.baseTime, { oRn1: v }); break;
      case "PTY": put(patch, it.baseDate, it.baseTime, { oPty: v }); break;
    }
  }
  return patch;
}
