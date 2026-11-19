// Weather card of the 오늘 view: sky-coloured summary, the next six hours, and the 14-hour sheet.
import { ADVICE_LABEL, hourKind, skyLabel, type DaySummary } from "@/lib/advice";
import type { DayWx, HourWx } from "@/lib/kma";
import type { BagItem } from "@/lib/outing";
import { eventColor } from "@/lib/colors";
import { toMinutes } from "@/lib/time";
import type { CalEvent } from "@/lib/types";
import { AdviceBadge, Legend, WeatherIcon } from "@/components/icons";
import Sheet from "@/components/sheet";
import WeekWeather from "@/components/week-weather";
import type { DayWeather } from "@/lib/day-weather";

const hh = (h: number) => String(h).padStart(2, "0");
const tempOf = (w?: HourWx) => {
  const t = w?.oT ?? w?.uT ?? w?.tmp ?? null;
  return t === null ? null : Math.round(t); // 실황 comes with decimals (6.3°)
};

type Props = {
  placeLabel: string;
  nowMin: number;
  summary: DaySummary | undefined;
  today: DayWx | undefined;
  yesterday: DayWx | undefined;
  tomorrow: DayWx | undefined;
  todayEvents: CalEvent[];
  tomorrowEvents: CalEvent[];
  bag: BagItem[];
  week: Record<string, DayWeather>; // today … 6 days ahead
  todayDate: string;
};

export default function TodayWeather(p: Props) {
  const hour = Math.floor(p.nowMin / 60);
  const nowW = p.today?.h[hh(hour)];
  const nowTemp = tempOf(nowW);
  const kind = hourKind(nowW) ?? p.summary?.kind ?? null;
  if (nowTemp === null && !p.summary?.kind) return null;

  const yTemp = tempOf(p.yesterday?.h[hh(hour)]);
  const diff = nowTemp !== null && yTemp !== null ? Math.round(nowTemp - yTemp) : null;
  const diffText = diff === null || diff === 0 ? "어제와 비슷해요" : diff < 0 ? `어제보다 ${-diff}° 낮아요` : `어제보다 ${diff}° 높아요`;

  // Now plus the next 14 hours, continuing into tomorrow after midnight.
  const strip = Array.from({ length: 15 }, (_, i) => {
    const h = hour + i;
    const w = h < 24 ? p.today?.h[hh(h)] : p.tomorrow?.h[hh(h - 24)];
    const events = h < 24 ? p.todayEvents : p.tomorrowEvents;
    const at = (h % 24) * 60;
    const ev = events.find((e) => !e.untimed && toMinutes(e.start) < at + 60 && toMinutes(e.end) > at);
    return { label: i === 0 ? "지금" : `${h % 24}시`, w, ev, first: ev && (i === 0 || Math.floor(toMinutes(ev.start) / 60) === h % 24) };
  });

  // Headline: what the sky is doing now, and for how long.
  const at = (h: number) => (h < 24 ? p.today?.h[hh(h)] : p.tomorrow?.h[hh(h - 24)]);
  const popAt = (h: number) => at(h)?.pop ?? 0;
  const rainingNow = popAt(hour) >= 30 || (nowW?.uPty ?? nowW?.pty ?? 0) > 0;
  let headline: string;
  let rainPop: number | null = null;
  if (kind === "snow") headline = "눈이 와요";
  else if (rainingNow) {
    let end = hour;
    while (end < hour + 12 && popAt(end) >= 30) end++;
    rainPop = Math.max(...Array.from({ length: Math.max(1, end - hour) }, (_, i) => popAt(hour + i)));
    headline = end >= hour + 12 ? "비가 와요 · 밤새 이어져요" : `비가 와요 · ${end % 24}시쯤 그쳐요`;
  } else {
    const start = Array.from({ length: 23 - hour }, (_, i) => hour + 1 + i).find((h) => popAt(h) >= 30);
    if (start !== undefined) {
      rainPop = Math.max(...Array.from({ length: 24 - start }, (_, i) => popAt(start + i)));
      headline = `${start}시부터 비 소식이 있어요`;
    } else headline = { sun: "맑아요", partly: "구름이 조금 있어요", cloud: "흐려요", rain: "비가 와요", shower: "가끔 비가 와요", snow: "눈이 와요" }[kind ?? "partly"];
  }
  // 폭염 takes over the card when the day's 체감온도 reaches 33° and it is not raining now.
  const heat = !rainingNow && p.summary?.feels != null && p.summary.feels >= 33 ? p.summary.feels : null;
  if (heat !== null) headline = `무더워요 · 체감 ${heat}°`;
  const cardIcon = heat !== null ? "heat" : kind;

  return (
    <section className="mb-5">
      <div>
        {/* A안: one quiet weather line — icon, big temperature, then what it means today. */}
        <div className="flex items-center gap-3">
          <WeatherIcon kind={cardIcon} size={44} />
          <p className="text-[34px] font-extrabold leading-none tracking-[-.03em]">{nowTemp ?? "-"}°</p>
          <div className="min-w-0 text-[12.5px] leading-[1.5] text-[#6e6e6e]">
            <p className="truncate">{headline}</p>
            <p>
              {p.summary?.hi != null && <b className="text-ink">최고 {Math.round(p.summary.hi)}°</b>}
              {p.summary?.lo != null && <b className="text-ink"> · 최저 {Math.round(p.summary.lo)}°</b>}
              {rainPop !== null && <span className="font-bold text-blue"> · 비 {rainPop}%</span>} · {diffText}
            </p>
          </div>
        </div>

        {/* The next six hours, always visible. */}
        <div className="mt-4 border-y border-line pb-2 pt-2.5">
          <div className="grid grid-cols-6 text-center">
            {strip.slice(0, 6).map((s, i) => {
              const pop = s.w?.pop ?? null;
              return (
                <div key={i}>
                  <p className={`text-[11px] font-extrabold ${i === 0 ? "text-coral" : "opacity-60"}`}>{s.label}</p>
                  <div className="my-1 flex justify-center">
                    <WeatherIcon kind={hourKind(s.w)} size={26} />
                  </div>
                  <p className="text-[13px] font-extrabold">{tempOf(s.w) ?? "-"}°</p>
                  <p className={`text-[10.5px] font-extrabold ${(pop ?? 0) >= 30 ? "text-lo" : "opacity-40"}`}>{pop ?? "-"}%</p>
                </div>
              );
            })}
          </div>
          {strip.slice(0, 6).some((s) => s.ev) && (
            <div className="mt-1.5 grid grid-cols-6 gap-px px-0.5">
              {strip.slice(0, 6).map((s, i) => {
                const c = s.ev ? eventColor(s.ev.title) : null;
                return (
                  <div key={i} className="relative h-5">
                    {c && (
                      <span className="absolute inset-0 rounded-md" style={{ background: c.bg }}>
                        {s.first && (
                          <span className="absolute left-1 top-0 z-10 whitespace-nowrap text-[10.5px] font-extrabold leading-5" style={{ color: c.fg }}>
                            {s.ev!.title}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* More hours; the bag has its own card above. */}
        <div className="mt-2.5 flex justify-end gap-2 text-ink">
        <Sheet label="이번 주 날씨 ›" title="이번 주 날씨" subtitle={`${p.placeLabel} · 오늘부터 7일`}>
          <WeekWeather weather={p.week} today={p.todayDate} />
        </Sheet>
        <Sheet label="시간별 더 보기 ›" title="오늘 날씨" subtitle={`${p.placeLabel}`}>
          <div className="flex items-center justify-between rounded-[22px] bg-navy px-5 py-4 text-white">
            <div>
              <p className="text-[11.5px] font-bold tracking-[.06em] text-[#C9D0DE]">NOW</p>
              <p className="mt-0.5 font-serif text-5xl font-bold leading-none">{nowTemp ?? "-"}°</p>
              <p className="mt-1.5 text-[13.5px] font-bold">{skyLabel(kind)}</p>
              <p className="mt-1 text-[12.5px] font-bold text-[#C9D0DE]">
                {p.summary?.hi != null && <span className="text-[#F2A08F]">↑{Math.round(p.summary.hi)}°</span>}{" "}
                {p.summary?.lo != null && <span className="text-[#A9C1E6]">↓{Math.round(p.summary.lo)}°</span>} · {diffText}
              </p>
            </div>
            <span className="rounded-[22px] bg-paper p-2">
              <WeatherIcon kind={kind} size={64} />
            </span>
          </div>

          <div className="no-scrollbar mt-2.5 overflow-x-auto rounded-[20px] border border-line bg-white px-1.5 py-3">
            <div className="flex">
              {strip.map((s, i) => {
                const pop = s.w?.pop ?? null;
                const c = s.ev ? eventColor(s.ev.title) : null;
                return (
                  <div key={i} className="w-[50px] flex-none text-center">
                    <p className={`text-[11.5px] font-extrabold ${i === 0 ? "text-coral" : "text-muted"}`}>{s.label}</p>
                    <div className="my-1.5 flex justify-center">
                      <WeatherIcon kind={hourKind(s.w)} size={30} />
                    </div>
                    <p className="text-sm font-extrabold">{tempOf(s.w) ?? "-"}°</p>
                    <div className="mt-1.5 flex h-[18px] items-end justify-center">
                      <i
                        className="block w-4 rounded-t-[5px] rounded-b-sm"
                        style={{ height: Math.max(3, ((pop ?? 0) / 100) * 18), background: (pop ?? 0) >= 30 ? "#7F9CC7" : "#DCE4F0" }}
                      />
                    </div>
                    <p className="text-[10.5px] font-extrabold text-lo">{pop ?? "-"}%</p>
                    <div className="mt-1.5 h-5 px-px">
                      {c && (
                        <span className="block h-5 overflow-hidden whitespace-nowrap rounded-md text-[10px] font-extrabold leading-5" style={{ background: c.bg, color: c.fg }}>
                          {s.first ? s.ev!.title : ""}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2.5 rounded-[20px] border border-line bg-white px-4 py-3">
            <p className="mb-1.5 text-[11px] font-extrabold tracking-[.06em] text-muted">오늘 챙길 것</p>
            {p.bag.length === 0 ? (
              <p className="py-1.5 text-sm text-soft">오늘은 따로 챙길 게 없어요</p>
            ) : (
              p.bag.map((b) => (
                <div key={b.key} className="flex items-center gap-2.5 py-1.5">
                  <AdviceBadge k={b.key} size={30} colder={b.colder} />
                  <b className="text-[13.5px]">{b.key === "range" ? "겉옷 챙기기" : ADVICE_LABEL[b.key]}</b>
                  <span className="ml-auto text-right text-xs font-semibold text-muted">{b.reason}</span>
                </div>
              ))
            )}
          </div>
          <div className="mt-2.5">
            <Legend
              temps
              extra={
                <span className="inline-flex items-center gap-1.5">
                  <i className="inline-block h-2.5 w-2.5 rounded-sm bg-[#7F9CC7]" />비 올 확률
                </span>
              }
            />
          </div>
        </Sheet>
        </div>
      </div>
    </section>
  );
}

