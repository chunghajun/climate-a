import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { alarmsOf } from "./alarms";
import { notifyOf } from "./notify";
import { db } from "./firebase";
import { DEFAULT_ALERT_PREFS, type CalEvent, type Place, type Tester } from "./types";

export const SESSION_COOKIE = "cm_code";

export function testerRef(code: string) {
  return db().collection("testers").doc(code);
}

export async function getTester(): Promise<Tester | null> {
  const code = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!code) return null;
  const snap = await testerRef(code).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return {
    code,
    label: d.label ?? "",
    consentAt: d.consentAt ? d.consentAt.toDate().toISOString() : null,
    defaultTravelMin: d.defaultTravelMin ?? 30,
    alertPrefs: { ...DEFAULT_ALERT_PREFS, ...(d.alertPrefs ?? {}) },
    icsUrl: d.icsUrl ?? null,
    icsLastSync: d.icsLastSync ? d.icsLastSync.toDate().toISOString() : null,
    alarms: alarmsOf(d),
    notify: notifyOf(d),
  };
}

// For pages and actions that need a signed-in tester who has agreed to the consent form.
export async function requireTester({ consent = true } = {}) {
  const tester = await getTester();
  if (!tester) redirect("/");
  if (consent && !tester.consentAt) redirect("/consent");
  return tester;
}

export async function listEvents(code: string): Promise<CalEvent[]> {
  const snap = await testerRef(code).collection("events").get();
  return snap.docs.map((doc) => toEvent(doc.id, doc.data()));
}

export async function getEvent(code: string, id: string): Promise<CalEvent | null> {
  const snap = await testerRef(code).collection("events").doc(id).get();
  return snap.exists ? toEvent(snap.id, snap.data()!) : null;
}

function toEvent(id: string, d: DocumentData): CalEvent {
  return {
    id,
    title: d.title,
    start: d.untimed ? "" : (d.start ?? ""),
    end: d.untimed ? "" : (d.end ?? ""),
    untimed: !!d.untimed || !d.start,
    remindBefore: typeof d.remindBefore === "number" ? d.remindBefore : null,
    remindAt: typeof d.remindAt === "string" && d.untimed ? d.remindAt : null,
    date: d.date ?? null,
    repeatDays: d.repeatDays ?? [],
    skipDates: d.skipDates ?? [],
    placeId: d.placeId ?? null,
    setting: d.setting,
    flexible: !!d.flexible,
    travelMin: d.travelMin ?? 30,
    source: d.source ?? "manual",
  };
}

// Favourites first (the first one is the default place for weather), then places that were
// only picked for a single event.
export async function listPlaces(code: string): Promise<Place[]> {
  const snap = await testerRef(code).collection("places").orderBy("createdAt").get();
  const all = snap.docs.map((doc) => ({
    id: doc.id,
    label: doc.data().label,
    lat: doc.data().lat,
    lon: doc.data().lon,
    favorite: doc.data().favorite !== false,
  }));
  return [...all.filter((p) => p.favorite), ...all.filter((p) => !p.favorite)];
}

// After events, places or alert settings change, the cron looks at this tester again on its next run.
export function wakeCron(code: string) {
  after(() => testerRef(code).update({ cronNextAt: 0 }));
}

export type BagExtra = { id: string; name: string; done: boolean };

// The day's bag (testers/{code}/bag/{date}): items ticked as packed, whether 완료 was pressed,
// and the things the tester added by hand (with their own ticks).
export async function getBag(code: string, date: string): Promise<{ packed: string[]; finished: boolean; extras: BagExtra[] }> {
  const d = (await testerRef(code).collection("bag").doc(date).get()).data();
  const extras: BagExtra[] = Array.isArray(d?.extras)
    ? d.extras.filter((x: BagExtra) => !!x && typeof x.id === "string" && typeof x.name === "string" && typeof x.done === "boolean")
    : [];
  return { packed: d?.packed ?? [], finished: !!d?.finished, extras };
}

// Research event log: one document per user action, analysed after the test.
// Written after the response is sent so it never slows a tap down.
export function logEvent(code: string, type: string, data: Record<string, unknown> = {}) {
  after(() => db().collection("logs").add({ code, type, data, at: FieldValue.serverTimestamp() }));
}
