"use client";

// Search a place (Kakao), fine-tune it on the map, then hand it to `onPick`.
// Used for 즐겨찾기 장소 in settings and for an event's own place.
import { useCallback, useRef, useState } from "react";
import { searchPlaces, type PlaceResult } from "../actions/settings";
import { btnPrimary, btnSecondary, input } from "@/components/ui";
import { PinIcon } from "@/components/line-icons";
import PlaceMap, { type Spot } from "./place-map";

type Props = {
  jsKey: string;
  confirmLabel: string;
  onPick: (name: string, lat: number, lon: number) => void | Promise<void>;
  compact?: boolean; // inside the event form: just the search box, no "지금 있는 곳" button
  placeholder?: string;
};

export default function PlacePicker({ jsKey, confirmLabel, onPick, compact = false, placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  // Where the map is opened (null = closed), the name that came with it, and where the pin is now.
  const [target, setTarget] = useState<{ lat: number; lon: number; name: string } | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const onMove = useCallback((s: Spot) => setSpot(s), []);

  async function pick(name: string, lat: number, lon: number) {
    setBusy(true);
    await onPick(name, lat, lon);
    setBusy(false);
  }

  function open(lat: number, lon: number, name: string) {
    if (!jsKey) return pick(name, lat, lon); // no map key: take the search result as it is
    setStatus("");
    setSpot(null);
    setTarget({ lat, lon, name });
  }

  // Suggestions follow every keystroke (also while a Korean syllable is still being composed);
  // the previous list stays until the new one arrives, and only the latest answer is shown.
  const latest = useRef(0);
  async function search(q: string) {
    const n = ++latest.current;
    if (!q.trim()) {
      setResults(null);
      setStatus("");
      return;
    }
    const rows = await searchPlaces(q);
    if (n !== latest.current) return;
    setResults(rows);
    setStatus(rows.length || q.trim().length < 2 ? "" : "찾지 못했어요. 장소 이름이나 동 이름(예: 고려대학교, 안암동)으로 검색해 보세요.");
  }
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  function type(q: string) {
    setQuery(q);
    setTarget(null);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(q), 150);
  }

  function here() {
    setBusy(true);
    setStatus("위치를 확인하고 있어요…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        open(pos.coords.latitude, pos.coords.longitude, "");
      },
      () => {
        setBusy(false);
        setStatus("위치 권한이 필요해요. 폰 설정에서 위치 접근을 허용해 주세요.");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  // Keep the searched name unless the pin was moved more than ~150 m away; otherwise use the 동 name.
  const moved = !!target && !!spot && Math.hypot((spot.lat - target.lat) * 111, (spot.lon - target.lon) * 88) > 0.15;
  const placeName = target?.name && !moved ? target.name : spot?.dong || "내 장소";

  return (
    <div>
      {/* Not a <form>: this can sit inside the event form. */}
      <div className="relative">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden>
          <circle cx="11" cy="11" r="6.5" />
          <path d="M20 20l-4.2-4.2" />
        </svg>
        <input
          value={query}
          onChange={(e) => type(e.target.value)}
          onCompositionUpdate={(e) => type(e.currentTarget.value)}
          onCompositionEnd={(e) => type(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              clearTimeout(debounce.current);
              search(query);
            }
          }}
          placeholder={placeholder ?? "예: 고려대학교, 안암역"}
          className={`${input} !pl-10`}
          enterKeyHint="search"
        />
      </div>
      {results && results.length > 0 && !target && (
        <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-white">
          {results.map((r, i) => (
            <li key={i}>
              <button type="button" disabled={busy} onClick={() => open(r.lat, r.lon, r.name)} className="block w-full px-3 py-2.5 text-left">
                <span className="flex items-center gap-1.5">
                  <b className="truncate">{r.name}</b>
                  {r.category && <span className="flex-none rounded-full bg-paper px-1.5 py-0.5 text-[10.5px] font-bold text-muted">{r.category}</span>}
                </span>
                <span className="block truncate text-xs text-muted">{r.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {target ? (
        <div className="mt-2 space-y-2">
          <PlaceMap jsKey={jsKey} lat={target.lat} lon={target.lon} onMove={onMove} />
          <p className="px-0.5 text-sm">
            <b>{placeName}</b>
            <span className="ml-1.5 text-xs text-muted">{spot?.area}</span>
          </p>
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <button type="button" onClick={() => setTarget(null)} className={btnSecondary}>
              취소
            </button>
            {/* Without the map (failed to load) a searched place can still be taken as found. */}
            <button
              type="button"
              disabled={busy || (!spot && !target.name)}
              onClick={() => (spot ? pick(placeName, spot.lat, spot.lon) : pick(target.name, target.lat, target.lon))}
              className={btnPrimary}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      ) : (
        !compact && (
          <button type="button" onClick={here} disabled={busy} className={`${btnSecondary} mt-2`}>
            <span className="inline-flex items-center gap-1.5">
              <PinIcon className="text-blue" />
              지금 있는 곳
            </span>
          </button>
        )
      )}
      {status && <p className="mt-2 text-sm text-muted">{status}</p>}
    </div>
  );
}
