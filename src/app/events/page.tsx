import Link from "next/link";
import { listEvents, listPlaces, requireTester } from "@/lib/data";
import { DOW } from "@/lib/time";
import EventRow from "@/components/event-row";
import { card } from "@/components/ui";

export default async function AllEventsPage() {
  const tester = await requireTester();
  const [events, places] = await Promise.all([listEvents(tester.code), listPlaces(tester.code)]);
  const repeating = events.filter((e) => !e.date).sort((a, b) => a.start.localeCompare(b.start));
  const once = events.filter((e) => e.date).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));

  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 py-6">
      <header className="flex items-center gap-3">
        <Link href="/" className="text-2xl text-muted" aria-label="뒤로">
          ‹
        </Link>
        <h1 className="text-xl font-extrabold">전체 일정</h1>
      </header>
      <section className={card}>
        <h2 className="font-extrabold">매주 반복</h2>
        {repeating.length === 0 && <p className="mt-2 text-sm text-muted">없어요.</p>}
        <ul className="mt-3 space-y-2">
          {repeating.map((e) => (
            <li key={e.id}>
              <p className="mb-1 text-xs font-bold text-indigo">매주 {[0, 1, 2, 3, 4, 5, 6].filter((d) => e.repeatDays.includes(d)).map((d) => DOW[d]).join("·")}</p>
              <EventRow event={e} place={places.find((p) => p.id === e.placeId)} />
            </li>
          ))}
        </ul>
      </section>
      <section className={card}>
        <h2 className="font-extrabold">한 번</h2>
        {once.length === 0 && <p className="mt-2 text-sm text-muted">없어요.</p>}
        <ul className="mt-3 space-y-2">
          {once.map((e) => (
            <li key={e.id}>
              <p className="mb-1 text-xs font-bold text-indigo">{e.date}</p>
              <EventRow event={e} place={places.find((p) => p.id === e.placeId)} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
