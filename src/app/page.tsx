import Link from "next/link";
import { redirect } from "next/navigation";
import { getBag, getTester, listEvents, listPlaces } from "@/lib/data";
import { bigRange, hourKind } from "@/lib/advice";
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
import PageHeader from "@/components/page-header";
import SuggestionCard from "@/components/suggestion-card";
import { btnPrimary, btnSecondary, card } from "@/components/ui";
import LoginForm from "./login-form";
import TodayBag from "./today-bag";
import TodayWeather from "./today-weather";

export default async function Home() {
  const tester = await getTester();
  if (!tester) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 space-y-8 px-5 pb-10 pt-14">
        <header>
          <p className="text-[15px] font-extrabold text-blue">CliMate</p>
          <h1 className="mt-3.5 text-[30px] font-extrabold leading-[1.3] tracking-[-.03em]">
            내 일정에 맞춘
            <br />
            오늘의 가방
          </h1>
          <p className="mt-3.5 text-[14.5px] leading-relaxed text-soft">일정이 있는 시간과 장소의 날씨를 보고, 챙길 것을 한 번에 알려 드려요.</p>
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
      <PageHeader kicker={`${m}월 ${d}일 ${DOW[dowOf(today)]}`} title="오늘" />

      <div className="space-y-3">
        <NotificationCard mode="home" />
        {places.length === 0 && (
          <section className={card}>
            <h2 className="text-[17px] font-extrabold">날씨를 볼 동네를 알려 주세요</h2>
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
        <section className="px-2 pt-6 text-center">
          <h2 className="text-[17px] font-extrabold">첫 일정을 넣어 볼까요?</h2>
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
        <Timeline events={todayEvents} placeOf={(e) => places.find((p) => p.id === e.placeId)?.label ?? ""} nextTrip={todayPlanned.find((p) => p.outing.depart >= now - 5)} now={now} short={wx.short[today]} />
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

// 타임라인 (A안): one row per event on a thin line — a circle, the time and title, then where and
// how likely rain is in its hours. Finished events are grey, the next one is a filled blue circle.
// The next trip's countdown sits above; 시간 미정 events are listed below as chips.
function Timeline(props: { events: CalEvent[]; placeOf: (e: CalEvent) => string; nextTrip: PlannedOuting | undefined; now: number; short: DayWx | undefined }) {
  const { events, placeOf, nextTrip, now, short } = props;
  const timed = events.filter((e) => !e.untimed);
  const untimed = events.filter((e) => e.untimed);
  const current = timed.find((e) => toMinutes(e.end) > now);

  const weatherOf = (e: CalEvent) => {
    const from = Math.floor(toMinutes(e.start) / 60);
    const to = Math.max(from, Math.ceil(toMinutes(e.end) / 60) - 1);
    const pops = Array.from({ length: to - from + 1 }, (_, i) => short?.h[String(from + i).padStart(2, "0")]?.pop).filter((p): p is number => p !== undefined);
    return { kind: hourKind(short?.h[String(from).padStart(2, "0")]), pop: pops.length ? Math.max(...pops) : null };
  };

  if (events.length === 0) return <p className="rounded-2xl bg-gray px-4 py-5 text-center text-sm text-soft">오늘은 일정이 없어요. 여유로운 하루 보내세요 🙂</p>;

  return (
    <section>
      {nextTrip && nextTrip.outing.depart >= now - 5 && (
        <span className="mb-3.5 inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-sky px-3 py-1.5 text-[12.5px] font-bold text-blue">
          ⏱ {nextTrip.outing.events[0].title} · <Countdown departMin={nextTrip.outing.depart} initialNow={now} />
        </span>
      )}
      {timed.length > 0 && (
        <ol className="relative">
          <i className="absolute bottom-4 left-[10px] top-3 w-0.5 bg-[#E6E6E6]" aria-hidden />
          {timed.map((e) => {
            const done = toMinutes(e.end) <= now;
            const w = weatherOf(e);
            const place = placeOf(e);
            return (
              <li key={e.id} className="relative pb-5">
                <Link href={`/events/${e.id}?from=/`} className="flex gap-4">
                  <i
                    className={`relative z-[1] mt-px h-[22px] w-[22px] flex-none rounded-full border-[2.5px] ${e === current ? "border-blue bg-blue" : "border-[#A8A8A8] bg-white"}`}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <b className={`block text-[16px] font-extrabold tracking-[-.01em] ${done ? "text-[#A0A0A0]" : ""}`}>
                      {e.start} {e.title}
                    </b>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
                      {place && <span>{place}</span>}
                      {place && (w.pop !== null || e.setting === "outdoor") && <span>·</span>}
                      {e.setting === "outdoor" && <span className="rounded-md bg-sky px-1.5 text-[11px] font-bold text-blue">야외</span>}
                      {w.pop !== null && <WeatherIcon kind={w.kind} size={18} />}
                      {w.pop !== null && <span className={w.pop >= 30 ? "font-bold text-blue" : ""}>비 {w.pop}%</span>}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      {untimed.length > 0 && (
        <>
          <p className="mb-2 text-[12.5px] font-bold text-muted">시간 미정</p>
          <div className="flex flex-wrap gap-2">
            {untimed.map((e) => (
              <Link key={e.id} href={`/events/${e.id}?from=/`} className="rounded-[10px] bg-gray px-3 py-2 text-[13px] font-semibold text-[#4a4a4a]">
                {e.title}
                {e.remindAt && <span className="ml-1 text-muted">· ⏰ {e.remindAt}</span>}
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
