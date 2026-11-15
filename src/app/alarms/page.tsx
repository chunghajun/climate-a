import { requireTester } from "@/lib/data";
import AlarmList from "./alarm-list";

// 기후 알람: set times (like phone alarms) for the day's weather and bag notification.
export default async function AlarmsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const tester = await requireTester();
  const sp = await searchParams;
  const from = typeof sp.from === "string" && ["/", "/week", "/month", "/settings"].includes(sp.from) ? sp.from : "/";
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-5">
      <AlarmList initial={tester.alarms} back={from} />
    </main>
  );
}
