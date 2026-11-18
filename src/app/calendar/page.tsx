import { listEvents, listPlaces, requireTester } from "@/lib/data";
import { eventsOn } from "@/lib/events";
import { weatherDays } from "@/lib/plan";
import { addDays, kstNow, sundayOf, toMinutes } from "@/lib/time";
import AutoRefresh from "@/components/auto-refresh";
import Fab from "@/components/fab";
import { dayWeather } from "@/lib/day-weather";
import CalendarView, { type CalDay } from "./calendar-view";

// How far the KMA forecast reaches (단기예보 to 3일 뒤, 중기예보 to 10일 뒤).
const FORECAST_DAYS = 10;

// 달력: one scrolling calendar (last month → three months ahead) that stretches from a month
// overview into a week view, with the weather of the forecast days next to each date.
export default async function CalendarPage() {
  const tester = await requireTester();
  const [events, places] = await Promise.all([listEvents(tester.code), listPlaces(tester.code)]);
  const today = kstNow().date;

  const firstOfLastMonth = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  firstOfLastMonth.setUTCMonth(firstOfLastMonth.getUTCMonth() - 1);
  const endOfRange = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  endOfRange.setUTCMonth(endOfRange.getUTCMonth() + 4);
  const from = sundayOf(firstOfLastMonth.toISOString().slice(0, 10));
  const to = addDays(sundayOf(addDays(endOfRange.toISOString().slice(0, 10), -1)), 6);

  const last = addDays(today, FORECAST_DAYS);
  const { summaries, short } = await weatherDays(places, today, last);

  const days: CalDay[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wx = short[d];
    // rain chance during an event: the highest hourly value it spans (short-range days only)
    const popOf = (start: string, end: string) => {
      if (!wx) return null;
      const a = Math.floor(toMinutes(start) / 60);
      const b = Math.max(a, Math.ceil(toMinutes(end) / 60) - 1);
      const pops = Array.from({ length: b - a + 1 }, (_, i) => wx.h[String(a + i).padStart(2, "0")]?.pop).filter((p): p is number => p !== undefined);
      return pops.length ? Math.max(...pops) : null;
    };
    days.push({
      date: d,
      events: eventsOn(events, d).map((e) => ({
        id: e.id,
        title: e.title,
        start: e.untimed ? "" : e.start,
        end: e.untimed ? "" : e.end,
        place: places.find((p) => p.id === e.placeId)?.label ?? "",
        outdoor: e.setting === "outdoor",
        repeat: !e.date,
        pop: e.untimed || d < today ? null : popOf(e.start, e.end),
      })),
    });
  }

  const weather = dayWeather(summaries, short, today, last);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col bg-[#F4F5F7]">
      <CalendarView days={days} weather={weather} today={today} />
      <Fab date={today} />
      <AutoRefresh />
    </main>
  );
}
