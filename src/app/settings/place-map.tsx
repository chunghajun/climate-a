"use client";

import { useEffect, useRef, useState } from "react";

// The small slice of the Kakao Maps SDK we use.
type LatLng = { getLat(): number; getLng(): number };
type KakaoMap = { getCenter(): LatLng; setCenter(p: LatLng): void; relayout(): void };
type Kakao = {
  maps: {
    load(cb: () => void): void;
    LatLng: new (lat: number, lng: number) => LatLng;
    Map: new (el: HTMLElement, opts: { center: LatLng; level: number }) => KakaoMap;
    event: { addListener(target: unknown, type: string, cb: () => void): void };
    services: {
      Geocoder: new () => {
        coord2RegionCode(lng: number, lat: number, cb: (r: { region_type: string; address_name: string; region_3depth_name: string }[], status: string) => void): void;
      };
    };
  };
};

let sdk: Promise<Kakao> | null = null;
function loadSdk(jsKey: string): Promise<Kakao> {
  sdk ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${jsKey}&autoload=false&libraries=services`;
    s.onload = () => {
      const kakao = (window as unknown as { kakao: Kakao }).kakao;
      kakao.maps.load(() => resolve(kakao));
    };
    s.onerror = () => {
      sdk = null;
      reject(new Error("kakao sdk"));
    };
    document.head.appendChild(s);
  });
  return sdk;
}

export type Spot = { lat: number; lon: number; area: string; dong: string };

// A map with a fixed pin in the middle: move the map to put the pin on the place.
export default function PlaceMap({ jsKey, lat, lon, onMove }: { jsKey: string; lat: number; lon: number; onMove: (s: Spot) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<{ kakao: Kakao; map: KakaoMap } | null>(null);
  const moved = useRef(onMove);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    moved.current = onMove;
  }, [onMove]);

  useEffect(() => {
    let alive = true;
    let keep: (() => void) | null = null;
    loadSdk(jsKey)
      .then((kakao) => {
        if (!alive || !el.current) return;
        const m = new kakao.maps.Map(el.current, { center: new kakao.maps.LatLng(lat, lon), level: 3 });
        const geocoder = new kakao.maps.services.Geocoder();
        const report = () => {
          const c = m.getCenter();
          geocoder.coord2RegionCode(c.getLng(), c.getLat(), (rows, status) => {
            const r = status === "OK" ? (rows.find((x) => x.region_type === "H") ?? rows[0]) : undefined;
            moved.current({ lat: c.getLat(), lon: c.getLng(), area: r?.address_name ?? "", dong: r?.region_3depth_name ?? "" });
          });
        };
        map.current = { kakao, map: m };
        // The map measures its box once at creation; re-measure after layout and re-centre,
        // otherwise it opens off-centre. Only then start reporting where the pin is.
        requestAnimationFrame(() => {
          if (!alive) return;
          m.relayout();
          m.setCenter(new kakao.maps.LatLng(lat, lon));
          kakao.maps.event.addListener(m, "idle", report);
          report();
        });
        // Keep the pin on the same spot when the window changes size (rotation, keyboard).
        let center = m.getCenter();
        kakao.maps.event.addListener(m, "idle", () => (center = m.getCenter()));
        keep = () => {
          m.relayout();
          m.setCenter(center);
        };
        window.addEventListener("resize", keep);
      })
      .catch(() => setFailed(true));
    return () => {
      alive = false;
      if (keep) window.removeEventListener("resize", keep);
    };
    // The map is created once; later centre changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsKey]);

  useEffect(() => {
    const m = map.current;
    if (m) m.map.setCenter(new m.kakao.maps.LatLng(lat, lon));
  }, [lat, lon]);

  if (failed) return <p className="rounded-xl border border-line px-3 py-6 text-center text-sm text-muted">지도를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>;
  return (
    <div className="relative h-60 overflow-hidden rounded-2xl border border-line">
      <div ref={el} className="h-full w-full bg-[#EEF1F4]" />
      {/* Fixed pin: its tip marks the map centre. */}
      <svg className="pointer-events-none absolute left-1/2 top-1/2 z-10 -ml-[15px] -mt-[40px]" width="30" height="40" viewBox="0 0 30 40">
        <path d="M15 39C15 39 28 24.5 28 14.5A13 13 0 0 0 2 14.5C2 24.5 15 39 15 39z" fill="#E2705A" stroke="#fff" strokeWidth="2" />
        <circle cx="15" cy="14.5" r="5" fill="#fff" />
      </svg>
      <p className="pointer-events-none absolute inset-x-0 top-2 z-10 mx-auto w-fit rounded-full bg-white/90 px-3 py-1 text-[11.5px] font-bold text-soft shadow">
        지도를 움직여 핀을 맞춰요
      </p>
    </div>
  );
}
