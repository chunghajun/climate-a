import { listEvents, listPlaces, requireTester } from "@/lib/data";
import { eventColor } from "@/lib/colors";
import { eventsOn } from "@/lib/events";
import { weatherDays } from "@/lib/plan";
import { addDays, kstNow, sundayOf } from "@/lib/time";
import AutoRefresh from "@/components/auto-refresh";
import Fab from "@/components/fab";
import HideableLegend from "@/components/hideable-legend";
import { Legend } from "@/components/icons";
import { CalendarHeader } from "@/components/page-header";
import MonthCalendar, { type MonthCell } from "./month-calendar";


export default async function MonthPage({ searchParams }: PageProps<"/month">) {
  const tester = await requireTester();
  const offset = Math.max(-24, Math.min(24, Number((await searchParams).m) || 0));
  const [events, places] = await Promise.all([listEvents(tester.code), listPlaces(tester.code)]);
  const today = kstNow().date;

  // First day of the shown month, then a Sunday-start grid (일 → 토) of whole weeks around it.
  const base = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  base.setUTCMonth(base.getUTCMonth() + offset);
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth() + 1;
  const first = base.toISOString().slice(0, 10);
  const nextMonth = new Date(base);
  nextMonth.setUTCMonth(month);
  const last = addDays(nextMonth.toISOString().slice(0, 10), -1);
  const gridStart = sundayOf(first);
  const gridEnd = addDays(sundayOf(last), 6);
  const dates: string[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) dates.push(d);

  // Weather exists from the start of our records to about ten days ahead.
  const wxFrom = gridStart;
  const wxTo = gridEnd < addDays(today, 10) ? gridEnd : addDays(today, 10);
  const { summaries } = wxFrom <= wxTo ? await weatherDays(places, wxFrom, wxTo) : { summaries: new Map() };

  const cells: MonthCell[] = dates.map((d) => {
    const s = summaries.get(d);
    return {
      date: d,
      inMonth: d.slice(0, 7) === first.slice(0, 7),
      kind: s?.kind ?? null,
      hi: s?.hi ?? null,
      lo: s?.lo ?? null,
      advice: s?.advice ?? [],
      colder: s?.colder ?? false,
      events: eventsOn(events, d).map((e) => {
        const c = eventColor(e.title);
        return {
          id: e.id,
          title: e.title,
          start: e.start,
          end: e.end,
          untimed: e.untimed,
          place: places.find((p) => p.id === e.placeId)?.label ?? places[0]?.label ?? "",
          outdoor: e.setting === "outdoor",
          flexible: e.flexible,
          repeat: !e.date,
          ...c,
        };
      }),
    };
  });

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pb-28 pt-6">
      <CalendarHeader view="month" label={`${year}년 ${month}월`} prev={`/month?m=${offset - 1}`} next={`/month?m=${offset + 1}`} />
      <MonthCalendar cells={cells} today={today} initial={offset === 0 ? today : first} />
      <div className="mt-3">
        <HideableLegend>
          <Legend temps />
        </HideableLegend>
      </div>
      <Fab />
      <AutoRefresh />
    </main>
  );
}
