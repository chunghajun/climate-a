// The several-day forecast as a list (오늘 탭's 이번 주 날씨), and the 최저–최고 bar it uses,
// which the calendar's day sheet shows too.
import { DOW, dowOf } from "@/lib/time";
import type { DayWeather } from "@/lib/day-weather";
import WxIcon, { wxKind } from "./wx-icons";

// Where the days' lows and highs sit, so every bar shares one scale.
export function tempRange(weather: Record<string, DayWeather>) {
  const temps = Object.values(weather)
    .flatMap((w) => [w.lo, w.hi])
    .filter((t): t is number => t != null);
  return { min: temps.length ? Math.min(...temps) : 0, max: temps.length ? Math.max(...temps) : 1 };
}

export function TempBar({ lo, hi, min, max }: { lo: number | null; hi: number | null; min: number; max: number }) {
  const pct = (t: number) => ((t - min) / Math.max(1, max - min)) * 100;
  return (
    <span className="relative block h-[5px] rounded-full bg-[#EEF0F3]">
      {lo != null && hi != null && (
        <i className="absolute inset-y-0 rounded-full bg-[linear-gradient(90deg,#7FB2FF,#FFB15E)]" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
      )}
    </span>
  );
}

export default function WeekWeather({ weather, today }: { weather: Record<string, DayWeather>; today: string }) {
  const dates = Object.keys(weather).sort();
  const { min, max } = tempRange(weather);
  if (!dates.length) return <p className="py-3 text-[13px] text-muted">설정에서 장소를 저장하면 날씨가 보여요.</p>;
  return (
    <div>
      {dates.map((d) => {
        const w = weather[d];
        return (
          <div key={d} className={`grid grid-cols-[52px_30px_38px_30px_1fr_30px_46px] items-center gap-1 py-1.5 text-[13px] tabular-nums ${w.mid ? "opacity-80" : ""}`}>
            <b className={d === today ? "text-blue" : ""}>{d === today ? "오늘" : `${Number(d.slice(8))}일 ${DOW[dowOf(d)]}`}</b>
            <WxIcon kind={wxKind(w.kind, w.mm)} size={26} />
            <span className={`text-right text-[12px] font-bold ${(w.pop ?? 0) >= 30 ? "text-blue" : "text-muted"}`}>{w.pop ?? 0}%</span>
            <span className="text-right text-[#8a8f99]">{w.lo ?? "-"}°</span>
            <TempBar lo={w.lo} hi={w.hi} min={min} max={max} />
            <span>{w.hi ?? "-"}°</span>
            <span className="text-right text-[11.5px] text-muted">{w.mm ? `${w.mm}mm` : ""}</span>
          </div>
        );
      })}
      <p className="mt-2 text-[12px] text-muted">% 비 올 확률 · mm 예상 강수량 (3일 뒤까지) · 4일 뒤부터는 대략적인 예보예요</p>
    </div>
  );
}
