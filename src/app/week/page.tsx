import Link from "next/link";
import { listEvents, listPlaces, requireTester } from "@/lib/data";
import { isOutfit, type DaySummary } from "@/lib/advice";
import { eventsOn } from "@/lib/events";
import { weatherDays } from "@/lib/plan";
import type { DayWx } from "@/lib/kma";
import { addDays, DOW, dowOf, isoWeek, kstNow, sundayOf, toMinutes } from "@/lib/time";
import type { CalEvent } from "@/lib/types";
import AutoRefresh from "@/components/auto-refresh";
import Fab from "@/components/fab";
import HideableLegend from "@/components/hideable-legend";
import { AdviceBadge, Legend, WeatherIcon } from "@/components/icons";
import { CalendarHeader } from "@/components/page-header";

export default async function WeekPage({ searchParams }: PageProps<"/week">) {
  const tester = await requireTester();
  const offset = Math.max(-52, Math.min(52, Number((await searchParams).w) || 0));
  const [events, places] = await Promise.all([listEvents(tester.code), listPlaces(tester.code)]);

  const { date: today, minutes: now } = kstNow();
  // Weeks run 일 → 토; the week number follows the Monday inside it.
  const sunday = addDays(sundayOf(today), offset * 7);
  const monday = addDays(sunday, 1);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
  const byDate = new Map(dates.map((d) => [d, eventsOn(events, d)]));
  const { summaries, short } = await weatherDays(places, dates[0], dates[6]);
  // one shared scale for the week's 최저~최고 bars
  const temps = dates.flatMap((d) => [summaries.get(d)?.lo, summaries.get(d)?.hi]).filter((t): t is number => t != null);
  const tMin = temps.length ? Math.min(...temps) : 0;
  const tMax = temps.length ? Math.max(...temps) : 1;

  const [, m1, d1] = dates[0].split("-").map(Number);
  const [, m2, d2] = dates[6].split("-").map(Number);
  const kicker = `${m1}월 ${d1}일 – ${m1 === m2 ? "" : `${m2}월 `}${d2}일 · ${isoWeek(monday)}주차`;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pb-28 pt-6">
      <CalendarHeader view="week" label={kicker} prev={`/week?w=${offset - 1}`} next={`/week?w=${offset + 1}`} />

      {/* A안: one row per day — weather, the 최저~최고 bar, what to bring, then that day's plans. */}
      <section>
        {dates.map((d) => (
          <DayRow key={d} date={d} today={today} now={now} s={summaries.get(d)} wx={short[d]} events={byDate.get(d)!} tMin={tMin} tMax={tMax} />
        ))}
        <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
          {places.length ? `📍 ${places[0].label} 기준 · ` : ""}지난 날은 실제 측정값, 오늘부터는 기상청 예보예요. 5일 이후는 시·도 단위의 대략적인 예보예요.
        </p>
      </section>

      <div className="mt-3">
        <HideableLegend>
          <Legend />
        </HideableLegend>
      </div>
      <Fab />
      <AutoRefresh />
    </main>
  );
}

function DayRow(props: { date: string; today: string; now: number; s: DaySummary | undefined; wx: DayWx | undefined; events: CalEvent[]; tMin: number; tMax: number }) {
  const { date: d, today, now, s, wx, events, tMin, tMax } = props;
  const isToday = d === today;
  const past = d < today;
  const pct = (t: number) => ((t - tMin) / Math.max(1, tMax - tMin)) * 100;
  // rain chance during an event: the highest hourly value it spans (short-range forecast only)
  const popOf = (e: CalEvent) => {
    if (past || e.untimed || !wx) return null;
    const from = Math.floor(toMinutes(e.start) / 60);
    const to = Math.max(from, Math.ceil(toMinutes(e.end) / 60) - 1);
    const pops = Array.from({ length: to - from + 1 }, (_, i) => wx.h[String(from + i).padStart(2, "0")]?.pop).filter((p): p is number => p !== undefined);
    return pops.length ? Math.max(...pops) : null;
  };
  const sorted = [...events].sort((x, y) => Number(x.untimed) - Number(y.untimed) || toMinutes(x.start) - toMinutes(y.start));
  return (
    <div className="border-b border-line py-3">
      <div className="flex items-center gap-2">
        <b className={`min-w-[92px] text-[15px] font-extrabold ${isToday ? "text-blue" : past ? "text-[#a8a8a8]" : dowOf(d) === 0 ? "text-hi" : ""}`}>
          {Number(d.slice(8))}일 {DOW[dowOf(d)]}
          {isToday && " · 오늘"}
        </b>
        {!past && s?.advice.length ? (
          <span className="flex gap-1">
            {s.advice.slice(0, 3).map((k) => (
              <AdviceBadge key={k} k={k} size={20} colder={isOutfit(k) && s.colder} />
            ))}
          </span>
        ) : null}
        <span className={`ml-auto flex items-center gap-1.5 text-[12px] text-soft ${past ? "opacity-60" : ""}`}>
          {past && s ? <span className="rounded-[5px] border border-[#e2e2e2] px-1 text-[10.5px] text-muted">기록</span> : <WeatherIcon kind={s?.kind ?? null} size={20} />}
          {s?.lo != null && s.hi != null ? (
            <>
              {s.lo}°
              <span className="relative h-[5px] w-14 rounded-full bg-[#efefef]">
                <i className="absolute inset-y-0 rounded-full" style={{ left: `${pct(s.lo)}%`, right: `${100 - pct(s.hi)}%`, background: "linear-gradient(90deg,#8DB0EE,#F0A27A)" }} />
              </span>
              {s.hi}°
            </>
          ) : (
            <span className="text-faint">{past ? "기록 없음" : "예보 준비 중"}</span>
          )}
          {!past && s?.pop != null && s.pop >= 30 && <b className="text-blue">{s.pop}%</b>}
        </span>
      </div>
      <ul className={`mt-1.5 text-[13.5px] leading-[1.75] ${past ? "text-[#a8a8a8]" : "text-[#4a4a4a]"}`}>
        {sorted.length === 0 && <li className="text-faint">일정 없음</li>}
        {sorted.map((e) => {
          const pop = popOf(e);
          const done = isToday && !e.untimed && toMinutes(e.end) <= now;
          return (
            <li key={e.id}>
              <Link href={`/events/${e.id}?from=/week`} className={done ? "text-[#a8a8a8]" : ""}>
                {e.untimed ? <span className="text-muted">미정</span> : e.start} {e.title}
                {pop !== null && pop >= 30 && <b className="ml-1 text-blue">{pop}%</b>}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
