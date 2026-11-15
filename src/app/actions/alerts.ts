"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase";
import { logEvent, requireTester } from "@/lib/data";

export type Reaction = "packed" | "had" | "skip";

export async function reactToAlert(alertId: string, reaction: Reaction) {
  const tester = await requireTester();
  const ref = db().collection("alerts").doc(alertId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.code !== tester.code) return;
  await ref.update({ reaction, reactedAt: FieldValue.serverTimestamp() });
  await logEvent(tester.code, "alert_reaction", { alertId, reaction });
  revalidatePath(`/a/${alertId}`);
}
