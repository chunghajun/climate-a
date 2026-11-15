"use client";

import { useState } from "react";
import { saveEvent } from "../actions/events";
import SubmitButton from "@/components/submit-button";
import { card, chip, fieldLabel, input } from "@/components/ui";
import { DOW } from "@/lib/time";
import type { CalEvent, Place } from "@/lib/types";
import PlacePicker from "../settings/place-picker";

// 정각, then every 5 minutes up to 3 hours.
const REMIND_OPTIONS = Array.from({ length: 37 }, (_, i) => i * 5);

type Props = {
  event?: CalEvent;
  places: Place[];
  defaultDate: string;
  upcoming?: string[]; // next dates of a saved repeating event, for marking days off
  from?: string; // view to return to after saving
  jsKey: string; // Kakao map key for the place search
};

export default function EventForm({ event, places, defaultDate, upcoming = [], from = "/", jsKey }: Props) {
  const [mode, setMode] = useState<"once" | "repeat">(event && !event.date ? "repeat" : "once");
  const [untimed, setUntimed] = useState(!!event?.untimed);
  const [remind, setRemind] = useState(event?.remindBefore != null || event?.remindAt != null);

  return (
    <form action={saveEvent} className="space-y-4">
      <input type="hidden" name="id" value={event?.id ?? ""} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="from" value={from} />

      <section className={`${card} space-y-4`}>
        <div>
          <label htmlFor="title" className={fieldLabel}>
            무슨 일정인가요?
          </label>
          <input id="title" name="title" required maxLength={40} defaultValue={event?.title} placeholder="예: 한강 러닝, 전공 수업" className={input} />
        </div>

        <div>
          <span className={fieldLabel}>언제인가요?</span>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#F0F0F0] p-1 text-sm font-semibold">
            {(["once", "repeat"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-lg py-2 ${mode === m ? "bg-white shadow-sm" : "text-muted"}`}
              >
                {m === "once" ? "한 번" : "매주 반복"}
              </button>
            ))}
          </div>
          <div className="mt-3">
            {mode === "once" ? (
              <input type="date" name="date" required defaultValue={event?.date ?? defaultDate} className={input} />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                  <label key={d} className={chip}>
                    <input type="checkbox" name="days" value={d} defaultChecked={event?.repeatDays.includes(d)} className="sr-only" />
                    {DOW[d]}
                  </label>
                ))}
              </div>
            )}
            {mode === "repeat" && upcoming.length > 0 && (
              <div className="mt-4">
                <span className={fieldLabel}>쉬는 날 (휴강 등) — 고른 날은 알림이 가지 않아요</span>
                <div className="flex flex-wrap gap-1.5">
                  {upcoming.map((d) => (
                    <label key={d} className={chip}>
                      <input type="checkbox" name="skip" value={d} defaultChecked={event?.skipDates.includes(d)} className="sr-only" />
                      {Number(d.slice(5, 7))}/{Number(d.slice(8))}({DOW[new Date(`${d}T00:00:00Z`).getUTCDay()]})
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className={`${fieldLabel} mb-0`}>시간</span>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-soft">
              <input type="checkbox" checked={untimed} onChange={(e) => setUntimed(e.target.checked)} className="h-4 w-4 accent-[#3A6FD8]" />
              시간 미정
            </label>
          </div>
          <input type="hidden" name="untimed" value={untimed ? "1" : "0"} />
          <div className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 ${untimed ? "opacity-40" : ""}`}>
            <input
              type="time"
              name="start"
              aria-label="시작"
              required={!untimed}
              disabled={untimed}
              defaultValue={event?.start || "09:00"}
              className={`${input} min-w-0`}
            />
            <span className="text-muted">~</span>
            <input
              type="time"
              name="end"
              aria-label="끝"
              required={!untimed}
              disabled={untimed}
              defaultValue={event?.end || "10:00"}
              className={`${input} min-w-0`}
            />
          </div>
          {untimed && <p className="mt-1.5 text-xs text-muted">시간이 정해지면 장소·날씨 알림을 정할 수 있어요. 그 전에는 아래에서 일정 알림 시각을 정할 수 있어요.</p>}
        </div>

        <div className="rounded-2xl border border-line bg-paper px-3.5 py-3">
          <label className="flex items-center justify-between gap-3">
            <span>
              <b className="block text-[14.5px]">⏰ 일정 알림</b>
              <span className="block text-xs text-muted">
                {untimed ? "날씨와 상관없이, 그날 정한 시각에 알려 드려요" : "날씨와 상관없이, 시작 몇 분 전에 알려 드려요"}
              </span>
            </span>
            <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} className="peer sr-only" />
            <span className="relative h-7 w-12 flex-none rounded-full bg-[#E4E4E4] transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-navy peer-checked:after:translate-x-5" />
          </label>
          <input type="hidden" name="remind" value={remind ? "1" : "0"} />
          {remind && untimed && (
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-sm font-semibold text-soft">그날</span>
              <input type="time" name="remindAt" step={300} required defaultValue={event?.remindAt ?? "09:00"} className={`${input} !w-auto flex-none py-2`} />
              <span className="text-sm font-semibold text-soft">에 알림</span>
            </div>
          )}
          {remind && !untimed && (
            <div className="mt-2.5 flex items-center gap-2">
              <span className="text-sm font-semibold text-soft">시작</span>
              <select name="remindBefore" defaultValue={event?.remindBefore ?? 30} className={`${input} !w-auto flex-none py-2`}>
                {REMIND_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? "정각" : m % 60 === 0 ? `${m / 60}시간 전` : m > 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분 전` : `${m}분 전`}
                  </option>
                ))}
              </select>
              <span className="text-sm font-semibold text-soft">에 알림</span>
            </div>
          )}
        </div>
      </section>

      {/* 시간 미정: no departure, so place/indoor/flexible/alert timing do nothing yet. The card is
          hidden (its fields stay in the form, so saved values are kept for when a time is set). */}
      <section className={`${card} space-y-4 ${untimed ? "hidden" : ""}`}>
        <div>
          <span className={fieldLabel}>어디에서 하나요?</span>
          <div className="flex gap-1.5">
            <label className={chip}>
              <input type="radio" name="setting" value="indoor" defaultChecked={event?.setting !== "outdoor"} className="sr-only" />
              실내
            </label>
            <label className={chip}>
              <input type="radio" name="setting" value="outdoor" defaultChecked={event?.setting === "outdoor"} className="sr-only" />
              야외
            </label>
          </div>
        </div>

        <div>
          <span className={fieldLabel}>날씨가 나쁘면 시간을 옮길 수 있나요?</span>
          <div className="flex gap-1.5">
            <label className={chip}>
              <input type="radio" name="flexible" value="0" defaultChecked={!event?.flexible} className="sr-only" />
              아니요, 고정이에요
            </label>
            <label className={chip}>
              <input type="radio" name="flexible" value="1" defaultChecked={event?.flexible} className="sr-only" />
              옮길 수 있어요
            </label>
          </div>
        </div>

        <PlaceField places={places} current={event?.placeId ?? null} jsKey={jsKey} />
      </section>

      <SubmitButton>저장</SubmitButton>
    </form>
  );
}

const Pin = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </svg>
);

// 장소: tap a 즐겨찾기 place (managed in 설정), or search any place on the map for this event only.
function PlaceField({ places, current, jsKey }: { places: Place[]; current: string | null; jsKey: string }) {
  const favorites = places.filter((p) => p.favorite);
  const own = places.find((p) => p.id === current && !p.favorite); // this event's earlier searched place
  const [placeId, setPlaceId] = useState(current ?? "");
  const [found, setFound] = useState<{ name: string; lat: number; lon: number } | null>(null);
  const [round, setRound] = useState(0); // remounts the search box after a pick

  const chipCls = (on: boolean) => `inline-flex items-center gap-1 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${on ? "border-navy bg-navy text-white" : "border-line bg-white"}`;
  const others = [...(own ? [{ id: own.id, label: own.label }] : []), ...(found ? [{ id: "new", label: found.name }] : [])];

  return (
    <div>
      <span className={fieldLabel}>장소</span>
      <input type="hidden" name="placeId" value={placeId} />
      {placeId === "new" && found && (
        <>
          <input type="hidden" name="newPlaceName" value={found.name} />
          <input type="hidden" name="newPlaceLat" value={found.lat} />
          <input type="hidden" name="newPlaceLon" value={found.lon} />
        </>
      )}
      {favorites.length > 0 && (
        <>
          <p className="mb-1.5 text-[11px] font-extrabold tracking-[.06em] text-muted">즐겨찾기</p>
          <div className="flex flex-wrap gap-1.5">
            {favorites.map((p, i) => {
              const id = i === 0 && !current ? "" : p.id;
              return (
                <button key={p.id} type="button" onClick={() => setPlaceId(id)} className={chipCls(placeId === id)}>
                  {p.label}
                  {i === 0 && <span className="text-[11px] font-bold opacity-60">기본</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
      {others.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {others.map((o) => (
            <button key={o.id} type="button" onClick={() => setPlaceId(o.id)} className={chipCls(placeId === o.id)}>
              <Pin />
              {o.label}
            </button>
          ))}
        </div>
      )}
      {/* Searching another place is always right there — no extra button to open it. */}
      <div className="mt-2">
        <PlacePicker
          key={round}
          compact
          jsKey={jsKey}
          placeholder="다른 장소 검색 (예: 안암역 스타벅스)"
          confirmLabel="이 장소로 정하기"
          onPick={(name, lat, lon) => {
            setFound({ name, lat, lon });
            setPlaceId("new");
            setRound((r) => r + 1);
          }}
        />
      </div>
    </div>
  );
}
