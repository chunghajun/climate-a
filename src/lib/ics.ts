// Imports events from a calendar subscription link (.ics):
// iPhone/iCloud "공개 캘린더" links and Google "iCal 형식의 비공개 주소".
import { createHash } from "node:crypto";
import ical, { type VEvent } from "node-ical";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase";
import { logEvent, testerRef } from "./data";
import { addDays, kstNow } from "./time";

const ALLOWED_HOSTS = [/\.icloud\.com$/, /^calendar\.google\.com$/, /^outlook\.(live|office365)\.com$/];
const DAYS_AHEAD = 14;
// Titles that suggest an outdoor plan that could be moved.
export const OUTDOOR = /러닝|달리기|조깅|산책|운동|등산|하이킹|자전거|라이딩|축구|풋살|야구|농구|테니스|배드민턴|골프|캠핑|피크닉|소풍|공원|한강|산\b|바다|해변|낚시|야외|페스티벌|축제|run|hike|picnic/i;

export function normalizeIcsUrl(raw: string): string | null {
  const url = raw.trim().replace(/^webcals?:\/\//i, "https://");
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !ALLOWED_HOSTS.some((r) => r.test(u.hostname))) return null;
    return u.toString();
  } catch {
    return null;
  }
}

const kstFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function kst(d: Date) {
  const p = Object.fromEntries(kstFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

const text = (v: unknown) => (typeof v === "string" ? v : ((v as { val?: string })?.val ?? "")).trim();

type Imported = { id: string; uid: string; title: string; date: string; start: string; end: string };

export async function readIcs(url: string): Promise<Imported[]> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`캘린더를 불러오지 못했어요 (${res.status})`);
  const parsed = ical.sync.parseICS(await res.text());

  const today = kstNow().date;
  const from = new Date(`${today}T00:00:00+09:00`);
  const to = new Date(`${addDays(today, DAYS_AHEAD)}T00:00:00+09:00`);
  const out: Imported[] = [];
  for (const item of Object.values(parsed)) {
    if (!item || item.type !== "VEVENT") continue;
    const ev = item as VEvent;
    for (const inst of ical.expandRecurringEvent(ev, { from, to })) {
      if (inst.isFullDay) continue;
      const s = kst(inst.start);
      const e = kst(inst.end ?? inst.start);
      if (s.date < today) continue;
      const uid = String(ev.uid ?? text(inst.summary));
      out.push({
        id: "ics_" + createHash("sha256").update(`${uid}|${inst.start.toISOString()}`).digest("hex").slice(0, 24),
        uid,
        title: (text(inst.summary) || "(제목 없음)").slice(0, 40),
        date: s.date,
        start: s.time,
        // Events that run past midnight are cut at the end of the day.
        end: e.date === s.date ? e.time : "23:59",
      });
    }
  }
  return out;
}

// Upserts the next two weeks of calendar events. Choices the tester made in CliMate
// (실내/야외, 옮길 수 있는지, 장소, 이동 시간) survive later syncs.
export async function syncIcs(code: string, url: string) {
  const items = await readIcs(url);
  const events = testerRef(code).collection("events");
  const tester = (await testerRef(code).get()).data() ?? {};
  const existing = await events.where("source", "==", "ics").get();
  const existingIds = new Set(existing.docs.map((d) => d.id));
  const keep = new Set(items.map((i) => i.id));
  const today = kstNow().date;

  const batch = db().batch();
  for (const it of items) {
    const ref = events.doc(it.id);
    const base = { title: it.title, date: it.date, start: it.start, end: it.end, icsUid: it.uid, updatedAt: FieldValue.serverTimestamp() };
    if (existingIds.has(it.id)) batch.update(ref, base);
    else {
      const outdoor = OUTDOOR.test(it.title);
      batch.set(ref, {
        ...base,
        repeatDays: [],
        skipDates: [],
        placeId: null,
        setting: outdoor ? "outdoor" : "indoor",
        flexible: outdoor,
        travelMin: tester.defaultTravelMin ?? 30,
        source: "ics",
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }
  // Drop future events that were removed from the calendar.
  for (const d of existing.docs) if (!keep.has(d.id) && (d.data().date ?? "") >= today) batch.delete(d.ref);
  batch.update(testerRef(code), { icsLastSync: FieldValue.serverTimestamp(), icsError: null });
  await batch.commit();
  await logEvent(code, "ics_sync", { count: items.length });
  return items.length;
}
