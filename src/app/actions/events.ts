"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FieldValue } from "firebase-admin/firestore";
import { logEvent, requireTester, testerRef, wakeCron } from "@/lib/data";
import { OUTDOOR } from "@/lib/ics";
import type { Setting } from "@/lib/types";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Where to go back to after saving: one of the app's own views only.
const VIEWS = ["/", "/week", "/month", "/events"];
function backTo(v: unknown) {
  const s = String(v ?? "");
  return VIEWS.includes(s) ? s : "/";
}


export async function saveEvent(formData: FormData) {
  const tester = await requireTester();
  wakeCron(tester.code);
  const id = String(formData.get("id") ?? "");
  const repeat = formData.get("mode") === "repeat";
  const title = String(formData.get("title") ?? "").trim().slice(0, 40);
  const untimed = formData.get("untimed") === "1";
  const start = untimed ? "" : String(formData.get("start") ?? "");
  const end = untimed ? "" : String(formData.get("end") ?? "");
  const date = String(formData.get("date") ?? "");
  const repeatDays = formData
    .getAll("days")
    .map(Number)
    .filter((d) => d >= 0 && d <= 6);

  if (!title || (!untimed && (!TIME.test(start) || !TIME.test(end)))) throw new Error("입력값을 확인해 주세요");
  if (repeat ? repeatDays.length === 0 : !DATE.test(date)) throw new Error("날짜나 요일을 골라 주세요");

  const skipDates = formData
    .getAll("skip")
    .map(String)
    .filter((d) => DATE.test(d));

  // 일정 알림: timed events 0–180 minutes before in 5-minute steps; 시간 미정 events at a set time of day.
  const remind = formData.get("remind") === "1";
  const remindRaw = Number(formData.get("remindBefore"));
  const remindBefore = !untimed && remind && Number.isFinite(remindRaw) ? Math.min(180, Math.max(0, Math.round(remindRaw / 5) * 5)) : null;
  const remindAtRaw = String(formData.get("remindAt") ?? "");
  const remindAt = untimed && remind && TIME.test(remindAtRaw) ? remindAtRaw : null;

  // A place searched on the map is saved for this event only (즐겨찾기 are managed in 설정).
  let placeId = String(formData.get("placeId") ?? "") || null;
  if (placeId === "new") {
    const name = String(formData.get("newPlaceName") ?? "").trim().slice(0, 20);
    const lat = Number(formData.get("newPlaceLat"));
    const lon = Number(formData.get("newPlaceLon"));
    if (name && lat > 32 && lat < 39.5 && lon > 124 && lon < 132) {
      const ref = await testerRef(tester.code)
        .collection("places")
        .add({ label: name, lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)), favorite: false, createdAt: FieldValue.serverTimestamp() });
      placeId = ref.id;
      logEvent(tester.code, "place_add", { label: name, favorite: false, via: "event" });
    } else placeId = null;
  }

  const doc = {
    title,
    start,
    end,
    untimed,
    remindBefore,
    remindAt,
    date: repeat ? null : date,
    repeatDays: repeat ? repeatDays : [],
    skipDates: repeat ? skipDates : [],
    placeId,
    setting: (formData.get("setting") === "outdoor" ? "outdoor" : "indoor") as Setting,
    flexible: formData.get("flexible") === "1",
    updatedAt: FieldValue.serverTimestamp(),
  };

  // Travel time is no longer asked; new events get the default (used for the weather on the way).
  const events = testerRef(tester.code).collection("events");
  if (id) {
    await events.doc(id).update(doc);
    await logEvent(tester.code, "event_update", { id });
  } else {
    const ref = await events.add({ ...doc, travelMin: tester.defaultTravelMin, source: "manual", createdAt: FieldValue.serverTimestamp() });
    await logEvent(tester.code, "event_create", { id: ref.id, setting: doc.setting, flexible: doc.flexible, repeat });
  }
  redirect(backTo(formData.get("from")));
}

// "이번만 쉬어요" for one date of a repeating event (휴강 등).
export async function skipOnce(id: string, date: string) {
  const tester = await requireTester();
  wakeCron(tester.code);
  if (!DATE.test(date)) return;
  await testerRef(tester.code).collection("events").doc(id).update({ skipDates: FieldValue.arrayUnion(date) });
  await logEvent(tester.code, "event_skip", { id, date });
  revalidatePath("/");
}

export async function deleteEvent(id: string, from = "/") {
  const tester = await requireTester();
  wakeCron(tester.code);
  await testerRef(tester.code).collection("events").doc(id).delete();
  await logEvent(tester.code, "event_delete", { id });
  redirect(backTo(from));
}

export type TimetableRow = {
  title: string;
  days: number[];
  start: string;
  end: string;
  placeId: string | null;
};

export type DatedRow = { title: string; date: string; start: string; end: string };

// One-off events read from another calendar app's screenshot.
export async function saveDatedEvents(rows: DatedRow[]) {
  const tester = await requireTester();
  wakeCron(tester.code);
  // A row is timed only when both times are valid; otherwise it is saved as 시간 미정.
  const valid = rows
    .filter((r) => r.title.trim() && DATE.test(r.date))
    .map((r) => (TIME.test(r.start) && TIME.test(r.end) && r.end > r.start ? r : { ...r, start: "", end: "" }));
  if (valid.length === 0) return { ok: false, error: "제목과 날짜가 있는 일정을 골라 주세요" };

  const events = testerRef(tester.code).collection("events");
  // Skip ones that are already in the app (same day, title and start).
  const dates = [...new Set(valid.map((r) => r.date))];
  const seen = new Set<string>();
  for (let i = 0; i < dates.length; i += 30) {
    const snap = await events.where("date", "in", dates.slice(i, i + 30)).get();
    snap.docs.forEach((d) => seen.add(`${d.data().date}|${d.data().title}|${d.data().start}`));
  }
  const batch = events.firestore.batch();
  let added = 0;
  for (const r of valid) {
    const title = r.title.trim().slice(0, 40);
    const key = `${r.date}|${title}|${r.start}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const outdoor = OUTDOOR.test(title);
    batch.set(events.doc(), {
      title,
      start: r.start,
      end: r.end,
      untimed: !r.start,
      date: r.date,
      repeatDays: [],
      skipDates: [],
      placeId: null,
      setting: outdoor ? "outdoor" : "indoor",
      flexible: outdoor,
      travelMin: tester.defaultTravelMin,
      source: "image",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    added++;
  }
  await batch.commit();
  logEvent(tester.code, "calendar_image_save", { count: added, skipped: valid.length - added });
  return { ok: true, added, skipped: valid.length - added };
}

export async function saveTimetable(rows: TimetableRow[]) {
  const tester = await requireTester();
  wakeCron(tester.code);
  const valid = rows.filter(
    (r) => r.title.trim() && r.days.length > 0 && TIME.test(r.start) && TIME.test(r.end)
  );
  if (valid.length === 0) return { ok: false, error: "과목 이름, 요일, 시간을 채워 주세요" };

  const events = testerRef(tester.code).collection("events");
  const batch = events.firestore.batch();
  for (const r of valid) {
    batch.set(events.doc(), {
      title: r.title.trim().slice(0, 40),
      start: r.start,
      end: r.end,
      date: null,
      repeatDays: r.days.filter((d) => d >= 0 && d <= 6),
      skipDates: [],
      placeId: r.placeId || null,
      setting: "indoor",
      flexible: false,
      travelMin: tester.defaultTravelMin,
      source: "timetable",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  await logEvent(tester.code, "timetable_save", { count: valid.length });
  return { ok: true };
}
