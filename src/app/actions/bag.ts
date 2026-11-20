"use server";

import { FieldValue } from "firebase-admin/firestore";
import { logEvent, requireTester, testerRef, type BagExtra } from "@/lib/data";

// Ticking a bag item packs it; every tick is also an H2 behaviour log.
export async function setPacked(date: string, key: string, packed: boolean) {
  const tester = await requireTester();
  await testerRef(tester.code)
    .collection("bag")
    .doc(date)
    .set({ packed: packed ? FieldValue.arrayUnion(key) : FieldValue.arrayRemove(key), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  logEvent(tester.code, packed ? "bag_packed" : "bag_unpacked", { date, key });
}

// Things the tester added to the bag by hand (+ 추가): the whole day's list is saved, and each
// change is logged (H2: what people choose to carry beyond the app's suggestions).
export type ExtraChange = { action: "add" | "remove" | "pack" | "unpack"; name: string };
export async function saveBagExtras(date: string, extras: BagExtra[], change: ExtraChange) {
  const tester = await requireTester();
  const clean = extras
    .filter((x) => x && typeof x.id === "string" && typeof x.name === "string")
    .slice(0, 8)
    .map((x) => ({ id: x.id.slice(0, 20), name: x.name.trim().slice(0, 12), done: !!x.done }));
  await testerRef(tester.code).collection("bag").doc(date).set({ extras: clean, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  logEvent(tester.code, `bag_extra_${change.action}`, { date, name: change.name.slice(0, 12) });
}

// 완료: the tester is done packing for today, possibly with some items left out (also logged for H2).
export async function finishBag(date: string, packed: string[], left: string[]) {
  const tester = await requireTester();
  await testerRef(tester.code).collection("bag").doc(date).set({ finished: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  logEvent(tester.code, "bag_finished", { date, packed, left });
}
