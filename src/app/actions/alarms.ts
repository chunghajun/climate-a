"use server";

import { revalidatePath } from "next/cache";
import { cleanAlarms, type Alarm } from "@/lib/alarms";
import { logEvent, requireTester, testerRef, wakeCron } from "@/lib/data";

// 기후 알람: the whole list is saved at once (add, edit, switch on/off, delete).
export async function saveAlarms(list: Alarm[]) {
  const tester = await requireTester();
  wakeCron(tester.code);
  const alarms = cleanAlarms(list);
  await testerRef(tester.code).update({ alarms });
  logEvent(tester.code, "alarms_saved", { alarms: alarms.map((a) => ({ time: a.time, days: a.days, on: a.on })) });
  revalidatePath("/alarms");
}
