import Link from "next/link";
import { listEvents, listPlaces, requireTester } from "@/lib/data";
import { isOutfit, type DaySummary } from "@/lib/advice";
import { eventColor } from "@/lib/colors";
import { eventsOn } from "@/lib/events";
import { weatherDays } from "@/lib/plan";
import { addDays, DOW, dowOf, isoWeek, kstNow, sundayOf, toMinutes } from "@/lib/time";
import type { CalEvent } from "@/lib/types";
import AutoRefresh from "@/components/auto-refresh";
import Fab from "@/components/fab";
import HideableLegend from "@/components/hideable-legend";
import { AdviceBadge, Legend, WeatherIcon } from "@/components/icons";
import PageHeader, { NavArrows } from "@/components/page-header";
import Sheet from "@/components/sheet";
import ViewTabs from "@/components/view-tabs";

const HOUR_PX = 40;

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
  const all = [...byDate.values()].flat();
  const timed = all.filter((e) => !e.untimed);
  const hasUntimed = all.length > timed.length;
  const startH = Math.min(9, ...timed.map((e) => Math.floor(toMinutes(e.start) / 60)));
  const endH = Math.max(19, ...timed.map((e) => Math.ceil(toMinutes(e.end) / 60)));
  const { summaries } = await weatherDays(places, dates[0], dates[6]);

  const [, m1, d1] = dates[0].split("-").map(Number);
  const [, m2, d2] = dates[6].split("-").map(Number);
  const kicker = `${m1}월 ${d1}일 – ${m1 === m2 ? "" : `${m2}월 `}${d2}일 · ${isoWeek(monday)}주차`;
  const title = offset === 0 ? "이번 주 일정" : offset === 1 ? "다음 주 일정" : offset === -1 ? "지난주 일정" : `${isoWeek(monday)}주차 일정`;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pb-28 pt-6">
      <PageHeader kicker={kicker} title={title} count={all.length} right={<NavArrows prev={`/week?w=${offset - 1}`} next={`/week?w=${offset + 1}`} />} />
      <ViewTabs active="week" />

      <section className="rounded-[20px] border border-line bg-white px-2 pb-2.5 pt-3">
        <div className="flex items-center justify-between px-1.5 pb-2.5">
          <b className="text-sm tracking-[.04em] text-soft">WEEK {isoWeek(monday)}</b>
          {places.length > 0 && (
            <Sheet
              label={`${title.replace(" 일정", "")} 날씨 ›`}
              title={`${title.replace(" 일정", "")} 날씨`}
              subtitle={`📍 ${places[0].label}`}
            >
              <WeekWeather dates={dates} today={today} summaries={summaries} />
            </Sheet>
          )}
        </div>

        <div className="grid grid-cols-[22px_repeat(7,minmax(0,1fr))]">
          <div />
          {dates.map((d) => {
            const s = summaries.get(d);
            const isToday = d === today;
            const past = d < today;
            return (
              <div key={d} className={`rounded-[14px] pb-2 pt-1.5 text-center ${isToday ? "bg-navy" : ""} ${past ? "opacity-45" : ""}`}>
                <div className="flex h-7 justify-center">
                  {isToday ? (
                    <span className="rounded-[9px] bg-white">
                      <WeatherIcon kind={s?.kind ?? null} size={28} />
                    </span>
                  ) : (
                    <WeatherIcon kind={s?.kind ?? null} size={28} />
                  )}
                </div>
                <div className="mt-1 flex h-[18px] justify-center gap-0.5">
                  {!past && s?.advice.slice(0, 2).map((k) => <AdviceBadge key={k} k={k} size={18} white={isToday} colder={isOutfit(k) && s.colder} />)}
                </div>
                <p className={`mt-1.5 text-xs font-extrabold ${isToday ? "text-white" : dowOf(d) === 6 ? "text-lo" : dowOf(d) === 0 ? "text-coral" : "text-soft"}`}>{DOW[dowOf(d)]}</p>
                <p className={`text-[11px] font-bold ${isToday ? "text-white" : "text-faint"}`}>{Number(d.slice(8))}</p>
              </div>
            );
          })}

          {hasUntimed && (
            <>
              <div className="flex items-start pt-2 text-[9px] font-bold leading-tight text-faint">미정</div>
              {dates.map((d) => (
                <div key={d} className="space-y-0.5 px-0.5 pt-1.5">
                  {byDate
                    .get(d)!
                    .filter((e) => e.untimed)
                    .map((e) => {
                      const c = eventColor(e.title);
                      return (
                        <Link
                          key={e.id}
                          href={`/events/${e.id}?from=/week`}
                          className="block truncate rounded-md px-1 py-0.5 text-[9.5px] font-extrabold tracking-tight"
                          style={{ background: c.bg, color: c.fg }}
                        >
                          {e.title}
                        </Link>
                      );
                    })}
                </div>
              ))}
            </>
          )}
          <div className="relative mt-1.5" style={{ height: (endH - startH) * HOUR_PX }}>
            {Array.from({ length: endH - startH + 1 }, (_, i) => (
              <span key={i} className="absolute -translate-y-1/2 text-[10px] font-bold text-faint" style={{ top: i * HOUR_PX }}>
                {startH + i}
              </span>
            ))}
          </div>
          {dates.map((d) => (
            <div
              key={d}
              className={`relative mt-1.5 border-l border-dashed border-[#EEE9DF] ${d === today ? "bg-navy/[.035]" : ""}`}
              style={{
                height: (endH - startH) * HOUR_PX,
                backgroundImage: `repeating-linear-gradient(to bottom, #F1EDE5 0 1px, transparent 1px ${HOUR_PX}px)`,
              }}
            >
              {byDate
                .get(d)!
                .filter((e) => !e.untimed)
                .map((e) => (
                  <Block key={e.id} e={e} startH={startH} />
                ))}
              {d === today && now >= startH * 60 && now <= endH * 60 && (
                <div className="absolute -right-px left-0 h-[1.5px] bg-coral" style={{ top: ((now - startH * 60) / 60) * HOUR_PX }}>
                  <i className="absolute -left-1 -top-[3.5px] h-2 w-2 rounded-full bg-coral" />
                </div>
              )}
            </div>
          ))}
        </div>
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

function Block({ e, startH }: { e: CalEvent; startH: number }) {
  const top = ((toMinutes(e.start) - startH * 60) / 60) * HOUR_PX;
  const height = Math.max(((toMinutes(e.end) - toMinutes(e.start)) / 60) * HOUR_PX, 20);
  const c = eventColor(e.title);
  return (
    <Link
      href={`/events/${e.id}?from=/week`}
      className="absolute inset-x-0.5 overflow-hidden rounded-lg px-1 py-1 text-[9.5px] font-extrabold leading-tight tracking-tight"
      style={{ top, height, background: c.bg, color: c.fg }}
    >
      <span className="line-clamp-3 break-all">{e.title}</span>
    </Link>
  );
}

function WeekWeather({ dates, today, summaries }: { dates: string[]; today: string; summaries: Map<string, DaySummary> }) {
  const list = dates.map((d) => summaries.get(d));
  const temps = list.flatMap((s) => (s ? [s.lo, s.hi] : [])).filter((t): t is number => t != null);
  const min = temps.length ? Math.min(...temps) : 0;
  const max = temps.length ? Math.max(...temps) : 1;
  const pct = (t: number) => ((t - min) / Math.max(1, max - min)) * 100;
  return (
    <>
      <div className="rounded-[20px] border border-line bg-white px-3 py-1">
        {dates.map((d) => {
          const s = summaries.get(d);
          const past = d < today;
          const isToday = d === today;
          return (
            <div
              key={d}
              className={`grid grid-cols-[38px_32px_34px_1fr_74px] items-center gap-1.5 border-b border-[#F1EDE5] py-2.5 last:border-0 ${past ? "opacity-45" : ""} ${isToday ? "-mx-3 rounded-[14px] border-transparent bg-[#F3F1EC] px-3" : ""}`}
            >
              <div>
                <b className="block text-[14.5px]">{DOW[dowOf(d)]}</b>
                {isToday ? (
                  <span className="rounded-full bg-navy px-1.5 text-[9.5px] font-extrabold text-white">오늘</span>
                ) : (
                  <span className="text-[10.5px] font-bold text-faint">
                    {Number(d.slice(5, 7))}/{Number(d.slice(8))}
                  </span>
                )}
              </div>
              <WeatherIcon kind={s?.kind ?? null} size={32} />
              <span className="text-center text-[11px] font-extrabold text-lo">{s?.pop != null && s.pop >= 30 && !past ? `${s.pop}%` : ""}</span>
              {s?.hi != null && s.lo != null ? (
                <div className="flex items-center gap-1.5 text-[12.5px] font-extrabold">
                  <span className="w-7 text-right text-lo">{s.lo}°</span>
                  <div className="relative h-1.5 flex-1 rounded-full bg-[#F1EDE5]">
                    <i
                      className="absolute inset-y-0 rounded-full"
                      style={{ left: `${pct(s.lo)}%`, right: `${100 - pct(s.hi)}%`, background: "linear-gradient(90deg,#7F9CC7,#E8B98A 65%,#E2705A)" }}
                    />
                  </div>
                  <span className="w-7 text-hi">{s.hi}°</span>
                </div>
              ) : (
                <span className="text-xs text-faint">{past ? "기록 없음" : "예보 준비 중"}</span>
              )}
              <div className="flex justify-end gap-1">{!past && s?.advice.slice(0, 3).map((k) => <AdviceBadge key={k} k={k} size={22} colder={isOutfit(k) && s.colder} />)}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-2.5">
        <Legend
          long
          extra={
            <span className="inline-flex items-center gap-1.5">
              <b className="text-lo">최저</b>
              <i className="inline-block h-1.5 w-11 rounded-full" style={{ background: "linear-gradient(90deg,#7F9CC7,#E8B98A 65%,#E2705A)" }} />
              <b className="text-hi">최고</b> 기온 · <b className="text-lo">%</b> 비 올 확률
            </span>
          }
        />
      </div>
      <p className="mx-1 mt-2.5 text-[11px] font-semibold leading-relaxed text-muted">
        지난 날은 실제 측정값, 오늘부터는 기상청 예보예요. 오늘 아이콘은 지금부터 밤까지의 날씨예요. 5일 이후는 시·도 단위의 대략적인 예보예요.
      </p>
    </>
  );
}
