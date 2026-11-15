"use server";

import { FieldValue } from "firebase-admin/firestore";
import { logEvent, requireTester, testerRef } from "@/lib/data";

// Ticking a bag item packs it; every tick is also an H2 behaviour log.
export async function setPacked(date: string, key: string, packed: boolean) {
  const tester = await requireTester();
  await testerRef(tester.code)
    .collection("bag")
    .doc(date)
    .set({ packed: packed ? FieldValue.arrayUnion(key) : FieldValue.arrayRemove(key), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  logEvent(tester.code, packed ? "bag_packed" : "bag_unpacked", { date, key });
}

// 완료: the tester is done packing for today, possibly with some items left out (also logged for H2).
export async function finishBag(date: string, packed: string[], left: string[]) {
  const tester = await requireTester();
  await testerRef(tester.code).collection("bag").doc(date).set({ finished: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  logEvent(tester.code, "bag_finished", { date, packed, left });
}
