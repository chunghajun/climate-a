"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase";
import { getEvent, logEvent, requireTester, testerRef, wakeCron } from "@/lib/data";
import type { CalEvent } from "@/lib/types";

// "ack" = 비 주의 card read ("확인했어요"); nothing about the plan changes. move/indoor stay for old data.
export type Choice = { kind: "move"; start: string; end: string } | { kind: "indoor" } | { kind: "keep" } | { kind: "ack" };

// Applies the tester's answer to a change suggestion. A repeating event is changed
// for that one day only: the day is skipped and a one-off copy is made.
export async function answerSuggestion(suggestionId: string, choice: Choice) {
  const tester = await requireTester();
  wakeCron(tester.code);
  const ref = db().collection("suggestions").doc(suggestionId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.code !== tester.code || snap.data()!.choice) return;
  const { eventId, date } = snap.data()!;

  if (choice.kind === "move" || choice.kind === "indoor") {
    const event = await getEvent(tester.code, eventId);
    if (!event) return;
    const patch: Partial<CalEvent> =
      choice.kind === "move" ? { start: choice.start, end: choice.end } : { setting: "indoor" };
    const events = testerRef(tester.code).collection("events");
    if (event.date) {
      await events.doc(eventId).update({ ...patch, updatedAt: FieldValue.serverTimestamp() });
    } else {
      const { id: _id, ...rest } = event;
      void _id;
      await events.doc(eventId).update({ skipDates: FieldValue.arrayUnion(date) });
      await events.add({
        ...rest,
        ...patch,
        date,
        repeatDays: [],
        skipDates: [],
        source: "suggestion",
        parentId: eventId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }

  await ref.update({ choice: choice.kind, chosen: choice, answeredAt: FieldValue.serverTimestamp() });
  await logEvent(tester.code, "suggestion_answer", { id: suggestionId, choice: choice.kind });
  revalidatePath("/", "layout");
}
