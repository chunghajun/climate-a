import Link from "next/link";
import { redirect } from "next/navigation";
import { getBag, getTester, listEvents, listPlaces } from "@/lib/data";
import { bigRange, hourKind } from "@/lib/advice";
import { eventColor } from "@/lib/colors";
import type { DayWx } from "@/lib/kma";
import { eventsOn } from "@/lib/events";
import { todayBag } from "@/lib/outing";
import { planDays, suggestionsFor, weatherDays, type PlannedOuting } from "@/lib/plan";
import { openSuggestions } from "@/lib/suggestion-log";
import { addDays, DOW, dowOf, kstNow, toMinutes } from "@/lib/time";
import type { CalEvent } from "@/lib/types";
import AutoRefresh from "@/components/auto-refresh";
import Countdown from "@/components/countdown";
import Fab from "@/components/fab";
import HideableLegend from "@/components/hideable-legend";
import { Legend, WeatherIcon } from "@/components/icons";
import NotificationCard from "@/components/notification-card";
import PageHeader, { HeaderButtons } from "@/components/page-header";
import SuggestionCard from "@/components/suggestion-card";
import { btnPrimary, btnSecondary, card } from "@/components/ui";
import ViewTabs from "@/components/view-tabs";
import LoginForm from "./login-form";
import TodayBag from "./today-bag";
import TodayWeather from "./today-weather";

export default async function Home() {
  const tester = await getTester();
  if (!tester) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 space-y-6 px-5 py-10">
        <header>
          <p className="text-xs font-bold tracking-[.06em] text-muted">CLIMATE</p>
          <h1 className="mt-1 font-serif text-[28px] font-bold leading-snug">
            내 일정에 맞춘
            <br />
            날씨 알림
          </h1>
        </header>
        <LoginForm />
      </main>
    );
  }
  if (!tester.consentAt) redirect("/consent");

  const { date: today, minutes: now } = kstNow();
  const [events, places, bagState] = await Promise.all([listEvents(tester.code), listPlaces(tester.code), getBag(tester.code, today)]);
  const tomorrow = addDays(today, 1);
  const todayEvents = eventsOn(events, today);
  const [planned, wx] = await Promise.all([
    places.length && events.length ? planDays(events, places, [today, tomorrow]) : new Map<string, PlannedOuting[]>(),
    weatherDays(places, today, tomorrow),
  ]);
  const todayPlanned = planned.get(today) ?? [];
  const summary = wx.summaries.get(today);
  const range = bigRange(today, wx.short[today]);
  const bag = todayBag(todayPlanned.filter((p) => p.outing.back > now), range, summary?.dressTemp ?? null);
  const suggestions = await openSuggestions(
    tester.code,
    [...suggestionsFor(tester.code, today, todayPlanned, now), ...suggestionsFor(tester.code, tomorrow, planned.get(tomorrow) ?? [], null)],
    "home"
  );

  const [, m, d] = today.split("-").map(Number);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pb-28 pt-6">
      <PageHeader kicker={`${m}월 ${d}일 · ${DOW[dowOf(today)]}요일`} title="오늘의 일정" count={todayEvents.length} right={<HeaderButtons />} />
      <ViewTabs active="today" />

      <div className="space-y-3">
        <NotificationCard mode="home" />
        {places.length === 0 && (
          <section className={card}>
            <h2 className="font-serif text-lg font-bold">날씨를 볼 동네를 알려 주세요</h2>
            <p className="mt-1 text-sm text-soft">집이나 학교처럼 자주 가는 곳을 하나 저장하면 그 동네 날씨로 알려 드려요.</p>
            <Link href="/settings#places" className={`${btnPrimary} mt-4`}>
              장소 저장하기
            </Link>
          </section>
        )}
      </div>

      {places.length > 0 && (
        <div className="mt-3">
          <TodayBag key={today} date={today} bag={bag} packed={bagState.packed} finished={bagState.finished} />
          <TodayWeather
            placeLabel={places[0].label}
            nowMin={now}
            summary={summary}
            today={wx.short[today]}
            yesterday={wx.short[addDays(today, -1)]}
            tomorrow={wx.short[tomorrow]}
            todayEvents={todayEvents}
            tomorrowEvents={eventsOn(events, tomorrow)}
            bag={bag}
          />
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mb-4 space-y-3">
          {suggestions.map((s) => (
            <SuggestionCard key={s.id} s={s} dayLabel={s.date === today ? "오늘" : "내일"} />
          ))}
        </div>
      )}

      {events.length === 0 ? (
        <section className={card}>
          <h2 className="font-serif text-lg font-bold">첫 일정을 넣어 볼까요?</h2>
          <p className="mt-1 text-sm text-soft">일정을 알려 주시면, 기후 알람 시각에 그날 일정의 날씨와 챙길 것을 알려 드릴게요.</p>
          <div className="mt-4 space-y-2">
            <Link href="/timetable?from=/" className={btnPrimary}>
              수업 시간표 넣기 (캡처로 한 번에)
            </Link>
            <Link href="/events/new?from=/" className={btnSecondary}>
              일정 하나 추가하기
            </Link>
          </div>
        </section>
      ) : (
        <Timeline events={todayEvents} nextTrip={todayPlanned.find((p) => p.outing.depart >= now - 5)} now={now} short={wx.short[today]} />
      )}

      <div className="mt-4">
        <HideableLegend>
          <Legend temps />
        </HideableLegend>
      </div>
      <Fab />
      <AutoRefresh />
    </main>
  );
}

const HOUR_PX = 42;
const MIN_BLOCK = 46; // short events still fit their title and time

// 타임라인: one block per event, as tall as it lasts, with the weather and rain chance of its hours.
// The next trip's countdown sits next to the heading; 시간 미정 events are listed above the grid.
function Timeline(props: { events: CalEvent[]; nextTrip: PlannedOuting | undefined; now: number; short: DayWx | undefined }) {
  const { events, nextTrip, now, short } = props;
  const timed = events.filter((e) => !e.untimed);
  const untimed = events.filter((e) => e.untimed);
  const nextEvent = timed.find((e) => toMinutes(e.start) > now);

  const startH = timed.length ? Math.max(0, Math.floor(Math.min(...timed.map((e) => toMinutes(e.start))) / 60) - 1) : 0;
  const endH = timed.length ? Math.min(24, Math.ceil(Math.max(...timed.map((e) => toMinutes(e.end))) / 60)) : 0;
  const y = (min: number) => ((min - startH * 60) / 60) * HOUR_PX;
  // Tall enough for the last block too (a short event is drawn MIN_BLOCK high).
  const gridHeight = Math.max(y(endH * 60), ...timed.map((e) => y(toMinutes(e.start)) + MIN_BLOCK)) + 4;

  // Overlapping events share the width side by side.
  const lanes: { e: CalEvent; lane: number; lanes: number }[] = [];
  let cluster: typeof lanes = [];
  let clusterEnd = -1;
  for (const e of timed) {
    if (toMinutes(e.start) >= clusterEnd) {
      cluster.forEach((x) => (x.lanes = Math.max(...cluster.map((c) => c.lane)) + 1));
      cluster = [];
    }
    const used = cluster.filter((x) => toMinutes(x.e.end) > toMinutes(e.start)).map((x) => x.lane);
    const item = { e, lane: [0, 1, 2, 3].find((l) => !used.includes(l)) ?? 0, lanes: 1 };
    cluster.push(item);
    lanes.push(item);
    clusterEnd = Math.max(clusterEnd, toMinutes(e.end));
  }
  cluster.forEach((x) => (x.lanes = Math.max(...cluster.map((c) => c.lane)) + 1));

  const weatherOf = (e: CalEvent) => {
    const from = Math.floor(toMinutes(e.start) / 60);
    const to = Math.max(from, Math.ceil(toMinutes(e.end) / 60) - 1);
    const pops = Array.from({ length: to - from + 1 }, (_, i) => short?.h[String(from + i).padStart(2, "0")]?.pop).filter((p): p is number => p !== undefined);
    return { kind: hourKind(short?.h[String(from).padStart(2, "0")]), pop: pops.length ? Math.max(...pops) : null };
  };

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-2 px-0.5">
        <b className="text-[15px]">타임라인</b>
        {nextTrip && nextTrip.outing.depart >= now - 5 && (
          <span className="truncate rounded-full bg-coral px-2.5 py-1 text-[11.5px] font-extrabold text-white">
            {nextTrip.outing.events[0].title} · <Countdown departMin={nextTrip.outing.depart} initialNow={now} />
          </span>
        )}
      </div>
      {events.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white px-4 py-5 text-center text-sm text-soft">오늘은 일정이 없어요. 여유로운 하루 보내세요 🙂</p>
      ) : (
        <>
          {untimed.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {untimed.map((e) => {
                const c = eventColor(e.title);
                return (
                  <Link key={e.id} href={`/events/${e.id}?from=/`} className="rounded-xl px-3 py-1.5 text-[13px] font-extrabold" style={{ background: c.bg, color: c.fg }}>
                    {e.title}
                    <span className="ml-1.5 text-[11px] font-bold opacity-70">{e.remindAt ? `시간 미정 · ⏰ ${e.remindAt}` : "시간 미정"}</span>
                  </Link>
                );
              })}
            </div>
          )}
          {timed.length > 0 && (
            <div className="relative ml-[34px] border-l border-[#E4DED3]" style={{ height: gridHeight }}>
              {Array.from({ length: endH - startH + 1 }, (_, i) => (
                <div key={i}>
                  <span className="absolute -left-[34px] w-[26px] -translate-y-1/2 text-right text-[10.5px] font-extrabold text-faint" style={{ top: i * HOUR_PX }}>
                    {startH + i}
                  </span>
                  {i > 0 && <i className="absolute left-0 right-0 h-px bg-[#F1EDE5]" style={{ top: i * HOUR_PX }} />}
                </div>
              ))}
              {lanes.map(({ e, lane, lanes: n }) => {
                const c = eventColor(e.title);
                const done = toMinutes(e.end) <= now;
                const w = weatherOf(e);
                const height = Math.max(y(toMinutes(e.end)) - y(toMinutes(e.start)) - 2, MIN_BLOCK);
                return (
                  <Link
                    key={e.id}
                    href={`/events/${e.id}?from=/`}
                    className={`absolute flex items-start justify-between gap-1.5 overflow-hidden rounded-[14px] py-2 pl-3 pr-2 ${done ? "opacity-45" : ""} ${e === nextEvent ? "shadow-[0_0_0_2px_var(--color-coral)]" : ""}`}
                    style={{
                      top: y(toMinutes(e.start)) + 1,
                      height,
                      left: `calc(8px + (100% - 8px) * ${lane / n})`,
                      width: `calc((100% - 8px) / ${n} - ${n > 1 ? 4 : 0}px)`,
                      background: c.bg,
                      color: c.fg,
                    }}
                  >
                    <span className="min-w-0">
                      <b className="block truncate text-[14px] leading-tight">{e.title}</b>
                      <span className="mt-0.5 block text-[11px] font-bold opacity-75">
                        {e.start}–{e.end}
                      </span>
                    </span>
                    <span className="flex flex-none items-center gap-0.5 rounded-[11px] bg-white/80 py-0.5 pl-0.5 pr-2">
                      <WeatherIcon kind={w.kind} size={30} />
                      {w.pop !== null && <em className={`text-[13px] font-extrabold not-italic ${w.pop >= 30 ? "text-lo" : "text-[#A39C90]"}`}>{w.pop}%</em>}
                    </span>
                  </Link>
                );
              })}
              {now >= startH * 60 && now <= endH * 60 && (
                <div className="absolute -left-[5px] right-0 z-10 h-[2px] bg-coral" style={{ top: y(now) }}>
                  <i className="absolute -left-px -top-1 h-2.5 w-2.5 rounded-full bg-coral" />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
