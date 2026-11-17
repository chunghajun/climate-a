"use server";

import { revalidatePath } from "next/cache";
import { cleanNotify, type Notify } from "@/lib/notify";
import { logEvent, requireTester, testerRef, wakeCron } from "@/lib/data";

// 알림: the switch, the mode and the lead time are saved together.
export async function saveNotify(next: Notify) {
  const tester = await requireTester();
  wakeCron(tester.code);
  const notify = cleanNotify(next);
  await testerRef(tester.code).update({ notify });
  logEvent(tester.code, "notify_saved", notify);
  revalidatePath("/settings");
  return notify;
}
