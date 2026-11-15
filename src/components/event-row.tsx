import Link from "next/link";
import { departureTime, timeLabel } from "@/lib/events";
import type { Assessment } from "@/lib/outing";
import type { CalEvent, Place } from "@/lib/types";

export default function EventRow({ event: e, place, wx }: { event: CalEvent; place?: Place; wx?: Assessment }) {
  return (
    <Link href={`/events/${e.id}`} className="block rounded-xl border border-line p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-bold">{e.title}</p>
        <p className="shrink-0 text-sm font-semibold text-muted">
          {timeLabel(e)}
        </p>
      </div>
      {wx?.hasData && <WeatherLine a={wx} />}
      <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-semibold">
        <span className={`rounded-full px-2 py-0.5 ${e.setting === "outdoor" ? "bg-green-100 text-green-800" : "bg-[#F0F0F0] text-muted"}`}>
          {e.setting === "outdoor" ? "야외" : "실내"}
        </span>
        <span className={`rounded-full px-2 py-0.5 ${e.flexible ? "bg-indigo/10 text-indigo" : "bg-[#F0F0F0] text-muted"}`}>
          {e.flexible ? "옮길 수 있음" : "시간 고정"}
        </span>
        <span className="rounded-full bg-[#F0F0F0] px-2 py-0.5 text-muted">
          {e.untimed ? "출발 알림 없음" : `${departureTime(e)} 출발 · 이동 ${e.travelMin}분`}
        </span>
        {place && <span className="rounded-full bg-[#F0F0F0] px-2 py-0.5 text-muted">{place.label}</span>}
      </div>
    </Link>
  );
}

function WeatherLine({ a }: { a: Assessment }) {
  const rain =
    a.level === "umbrella" ? `☔ 비 ${a.pop ?? "-"}%` : a.level === "folding" ? `🌂 비 ${a.pop}%` : "☀️ 비 소식 없음";
  return (
    <p className={`mt-1 text-sm font-semibold ${a.level === "none" ? "text-muted" : "text-indigo"}`}>
      {rain}
      {a.temp !== null && <span className="font-normal text-muted"> · {a.temp}°</span>}
      {a.coatDrop && <span className="text-orange-600"> · 어제보다 {a.coatDrop}° 쌀쌀</span>}
    </p>
  );
}
