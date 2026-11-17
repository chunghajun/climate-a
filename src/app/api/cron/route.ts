// Called every 5 minutes by cron-job.org. Sends 기후 알람, 일정 알림 and change suggestions.
import webpush from "web-push";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase";
import { listEvents, listPlaces, logEvent, testerRef } from "@/lib/data";
import { bigRange } from "@/lib/advice";
import { syncIcs } from "@/lib/ics";
import { alarmsOf, ringsOn } from "@/lib/alarms";
import { notifyOf } from "@/lib/notify";
import { DEFAULT_ALERT_PREFS, type CalEvent } from "@/lib/types";
import { gridKey, toGrid, type Grid } from "@/lib/kma";
import { refreshGrid } from "@/lib/weather";
import { composeDaily, composeWeatherOnly } from "@/lib/outing";
import { planDays, suggestionsFor, weatherDays, type PlannedOuting } from "@/lib/plan";
import { openSuggestions } from "@/lib/suggestion-log";
import { eventsOn } from "@/lib/events";
import { addDays, dowOf, fromMinutes, kstNow, toMinutes } from "@/lib/time";

export const maxDuration = 60;

// A late cron run still sends alerts whose time passed up to this many minutes ago.
const CATCH_UP = 15;
const SUGGEST_AHEAD = 2 * 60; // change suggestions only while this much time is left
const QUIET_START = 22 * 60; // no suggestion pushes 22시–7시
const QUIET_END = 7 * 60;
const RECHECK = 30; // minutes: forecast changes (suggestions) are looked at this often

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!.trim(),
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
  process.env.VAPID_PRIVATE_KEY!.trim()
);

function reminderWhen(before: number) {
  if (before === 0) return "지금 시작해요";
  const h = Math.floor(before / 60);
  const m = before % 60;
  return `${h ? `${h}시간 ` : ""}${m ? `${m}분 ` : ""}전이에요`;
}

// Sends one notification to every device of the tester; returns how many took it.
async function pushTo(code: string, payload: { title: string; body: string; tag: string; url: string }) {
  const subs = await testerRef(code).collection("subscriptions").get();
  let delivered = 0;
  for (const s of subs.docs) {
    try {
      await webpush.sendNotification({ endpoint: s.data().endpoint, keys: s.data().keys }, JSON.stringify(payload), { TTL: 30 * 60, urgency: "high" });
      delivered++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await s.ref.delete();
      else console.error("push failed", code, status);
    }
  }
  return delivered;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? new URL(request.url).searchParams.get("key");
  if (!secret || given !== secret) return new Response("unauthorized", { status: 401 });

  const { date, minutes } = kstNow();
  const testers = (await db().collection("testers").get()).docs.filter((d) => d.data().consentAt);
  const summary = { testers: testers.length, idle: 0, due: 0, sent: 0, skipped: 0, reminders: 0, suggestions: 0 };

  // Keep every saved place's forecast fresh, so pages can read the cache without
  // waiting for the KMA. This also keeps the record of forecasts and observations going.
  const placesByCode = new Map(await Promise.all(testers.map(async (t) => [t.id, await listPlaces(t.id)] as const)));
  const grids = new Map<string, Grid>();
  for (const list of placesByCode.values())
    for (const p of list) {
      const g = toGrid(p.lat, p.lon);
      grids.set(gridKey(g), g);
    }
  await Promise.all([...grids.values()].map((g) => refreshGrid(g)));

  await Promise.all(
    testers.map(async (t) => {
      const code = t.id;
      const { icsUrl, icsLastSync } = t.data();
      if (icsUrl && (!icsLastSync || Date.now() - icsLastSync.toDate().getTime() > 55 * 60_000)) {
        await syncIcs(code, icsUrl).catch((e) => testerRef(code).update({ icsError: String(e).slice(0, 200) }));
      }
      // Skip testers with nothing due before their next check (saves Firestore reads;
      // editing events or settings clears cronNextAt so changes are picked up at once).
      const nextAt = t.data().cronNextAt ?? 0;
      if (Date.now() < nextAt) {
        summary.idle++;
        return;
      }
      const places = placesByCode.get(code) ?? [];
      const events = await listEvents(code);
      const tomorrow = addDays(date, 1);
      const sleepUntil = async (times: number[]) => {
        const next = Math.min(minutes + RECHECK, ...times.filter((m) => m > minutes));
        await testerRef(code).update({ cronNextAt: Date.now() + (next - minutes) * 60_000 - 45_000 });
      };
      // 알림 off: nothing is pushed. Look again in a few hours; switching it on wakes the cron at once.
      const notify = notifyOf(t.data());
      if (!notify.on) {
        await testerRef(code).update({ cronNextAt: Date.now() + 6 * 3600_000 });
        summary.idle++;
        return;
      }
      // 기후 알람 times today (and tomorrow, for the next check) — in "정한 시각" mode only.
      const allAlarms = notify.mode === "fixed" ? alarmsOf(t.data()) : [];
      const alarmsToday = allAlarms.filter((a) => ringsOn(a, date, dowOf(date))).map((a) => toMinutes(a.time));
      const alarmsTomorrow = allAlarms.filter((a) => ringsOn(a, tomorrow, dowOf(tomorrow))).map((a) => 1440 + toMinutes(a.time));
      // One-time alarms that have rung switch themselves off (like the phone's).
      const rangOnce = allAlarms.filter((a) => a.on && !a.days.length && a.onceOn === date && toMinutes(a.time) <= minutes - CATCH_UP);
      if (rangOnce.length) await testerRef(code).update({ alarms: allAlarms.map((a) => (rangOnce.includes(a) ? { ...a, on: false } : a)) });
      if (!events.length && !alarmsToday.length) return sleepUntil(alarmsTomorrow);
      const plannedDays = places.length && events.length ? await planDays(events, places, [date, tomorrow]) : new Map<string, PlannedOuting[]>();
      const planned = plannedDays.get(date) ?? [];
      const prefs = { ...DEFAULT_ALERT_PREFS, ...(t.data().alertPrefs ?? {}) };
      // "첫 외출 전" mode: one alert the chosen time before the day's first trip (none without trips).
      const firstAlert = (trips: PlannedOuting[] | undefined) =>
        trips?.length ? [Math.max(0, Math.min(...trips.map((p) => p.outing.depart)) - notify.leadMin)] : [];
      const ringToday = notify.mode === "first" ? firstAlert(planned) : alarmsToday;
      const ringTomorrow = notify.mode === "first" ? firstAlert(plannedDays.get(tomorrow)).map((m) => 1440 + m) : alarmsTomorrow;

      // 일정 알림 due now: today's events, plus tomorrow's early ones whose reminder falls tonight.
      // 시간 미정 events ring at their own time of day (remindAt) instead.
      const remindAtOf = (e: CalEvent) => (e.untimed ? (e.remindAt ? toMinutes(e.remindAt) : null) : e.remindBefore != null ? toMinutes(e.start) - e.remindBefore : null);
      const allReminders = [
        ...eventsOn(events, date).map((e) => ({ e, date, at: remindAtOf(e) })),
        ...eventsOn(events, tomorrow).map((e) => ({ e, date: tomorrow, at: e.untimed ? null : remindAtOf(e) })),
      ]
        .map((r) => ({ ...r, at: r.at === null ? null : r.date === date ? r.at : 1440 + r.at }))
        .filter((r): r is { e: CalEvent; date: string; at: number } => r.at !== null);
      const reminders = allReminders.filter((r) => r.at <= minutes && r.at > minutes - CATCH_UP);
      await sleepUntil([...ringToday, ...ringTomorrow, ...allReminders.map((r) => r.at)]);
      const merged = new Set<string>(); // 일정 알림 sent along with the alarm (none for now)

      // 기후 알람 / 첫 외출 알림: the day's weather and bag — for the trips still ahead,
      // or just the local weather when there are none.
      for (const at of ringToday) {
        if (at > minutes || at <= minutes - CATCH_UP) continue;
        summary.due++;
        const trips = planned.filter((p) => p.outing.back > at && p.a.hasData);
        const day = places.length ? await weatherDays(places, date, date) : null;
        const range = bigRange(date, day?.short[date]);
        const today = day?.summaries.get(date);
        const message = trips.length
          ? composeDaily(trips, { prefs, range })
          : today && today.hi != null
            ? composeWeatherOnly(today, { prefs, range })
            : null;
        // "first" goes out once a day even if the lead time is changed afterwards
        const alertId = notify.mode === "first" ? `${code}_${date}_first` : `${code}_${date}_alarm_${fromMinutes(at).replace(":", "")}`;
        const ref = db().collection("alerts").doc(alertId);
        const worst = [...trips].sort((x, y) => (y.a.pop ?? 0) - (x.a.pop ?? 0))[0];
        try {
          // create() fails if this alarm was already handled today, so it goes out once.
          await ref.create({
            code,
            date,
            kind: notify.mode === "first" ? "first" : "alarm",
            alarm: fromMinutes(at),
            eventIds: trips.flatMap((p) => p.outing.events.map((e) => e.id)),
            titles: trips.flatMap((p) => p.outing.events.map((e) => e.title)),
            level: worst?.a.level ?? null,
            pop: worst?.a.pop ?? today?.pop ?? null,
            hours: worst?.a.hours ?? [],
            prefs,
            sent: !!message,
            title: message?.title ?? null,
            body: message?.body ?? null,
            createdAt: FieldValue.serverTimestamp(),
          });
        } catch {
          continue;
        }
        if (!message) {
          summary.skipped++;
          continue;
        }
        const delivered = await pushTo(code, { ...message, tag: alertId, url: `/a/${alertId}` });
        await ref.update({ delivered, sentAt: FieldValue.serverTimestamp() });
        logEvent(code, "alert_sent", { alertId, kind: notify.mode === "first" ? "first" : "alarm", trips: trips.length, level: worst?.a.level ?? null, delivered });
        summary.sent++;
      }

      // 일정 바꾸기 제안: pushed as soon as one is found (07–22시), once per event,
      // while there are still 2+ hours to change plans.
      if (prefs.suggestion && minutes >= QUIET_END && minutes < QUIET_START) {
        const found = [
          ...suggestionsFor(code, date, planned, minutes),
          ...suggestionsFor(code, tomorrow, plannedDays.get(tomorrow) ?? [], null),
        ].filter((s) => {
          if (s.date !== date) return true;
          const travel = events.find((e) => e.id === s.eventId)?.travelMin ?? 0;
          return toMinutes(s.start) - travel - minutes >= SUGGEST_AHEAD;
        });
        for (const s of found) {
          const ref = db().collection("alerts").doc(`${s.id}_suggest`);
          const answered = (await db().collection("suggestions").doc(s.id).get()).data()?.choice;
          if (answered) continue;
          try {
            await ref.create({ code, date: s.date, kind: "suggestion", eventIds: [s.eventId], titles: [s.title], pop: s.pop, sent: true, createdAt: FieldValue.serverTimestamp() });
          } catch {
            continue;
          }
          await openSuggestions(code, [s], "alert");
          const day = s.date === date ? "오늘" : "내일";
          const message = {
            title: `↻ ${s.title}, 시간을 옮겨 볼까요?`,
            body: `${day} ${s.start} ${s.title}에 비 올 확률이 ${s.pop ?? "-"}%예요. ${
              s.moves.length ? `${s.moves.map((m) => m.start).join(" 또는 ")}엔 비 걱정이 적어요.` : "실내로 바꾸는 것도 방법이에요."
            }`,
          };
          const delivered = await pushTo(code, { ...message, tag: ref.id, url: "/" });
          await ref.update({ title: message.title, body: message.body, delivered, sentAt: FieldValue.serverTimestamp() });
          logEvent(code, "suggestion_pushed", { id: s.id, moves: s.moves.length, delivered });
          summary.suggestions++;
        }
      }

      for (const r of reminders) {
        const id = `${code}_${r.date}_${r.e.id}_${r.e.untimed ? r.e.remindAt : r.e.remindBefore}`;
        const ref = db().collection("reminders").doc(id);
        const trip = planned.find((p) => p.outing.events.some((e) => e.id === r.e.id));
        const rain = r.date === date && trip?.a.pop != null && trip.a.pop >= 30 ? ` · 비 올 확률 ${trip.a.pop}%, 우산 챙기세요` : "";
        const message = r.e.untimed
          ? { title: `⏰ ${r.e.title}`, body: "오늘 일정이에요 (시간 미정). 시간이 정해지면 출발 전에 날씨도 알려 드릴게요." }
          : {
              title: `⏰ ${r.e.title} ${reminderWhen(r.e.remindBefore!)}`,
              body: `${r.date === date ? "오늘" : "내일"} ${r.e.start}–${r.e.end}${rain}`,
            };
        try {
          await ref.create({ code, date: r.date, eventId: r.e.id, title: r.e.title, before: r.e.remindBefore, at: r.e.remindAt, merged: merged.has(r.e.id), createdAt: FieldValue.serverTimestamp() });
        } catch {
          continue;
        }
        if (merged.has(r.e.id)) continue;
        const delivered = await pushTo(code, { ...message, tag: id, url: `/events/${r.e.id}?from=/` });
        await ref.update({ delivered, sentAt: FieldValue.serverTimestamp() });
        logEvent(code, "reminder_sent", { eventId: r.e.id, before: r.e.remindBefore, at: r.e.remindAt, delivered });
        summary.reminders++;
      }    })
  );

  // Heartbeat so the team can see the scheduler is alive.
  await db().collection("system").doc("cron").set({ lastRun: FieldValue.serverTimestamp(), ...summary });
  return Response.json(summary);
}
