import { useId } from "react";
import type { WeatherKind } from "@/lib/advice";

// Calendar weather icons: filled and colour-first so the day's sky reads at a glance
// (white cloud for 구름 조금, grey rain cloud with many streaks, a darker cloud for 폭우).
export type WxIconKind = WeatherKind | "heavy";

export default function WxIcon({ kind, size = 22 }: { kind: WxIconKind; size?: number }) {
  const id = useId().replace(/:/g, "");
  switch (kind) {
    case "sun":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
          <defs>
            <radialGradient id={id} cx=".4" cy=".35" r=".7">
              <stop offset="0" stopColor="#FFE27A" />
              <stop offset="1" stopColor="#FFB21E" />
            </radialGradient>
          </defs>
          <path d="M16 2.8v3M16 26.2v3M2.8 16h3M26.2 16h3M6.7 6.7l2.1 2.1M23.2 23.2l2.1 2.1M6.7 25.3l2.1-2.1M23.2 8.8l2.1-2.1" stroke="#FFC23C" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="16" cy="16" r="7.2" fill={`url(#${id})`} />
        </svg>
      );
    case "partly":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
          <path d="M19 3v2.6M27.6 8.6l-1.8 1.8M10.4 8.6l1.8 1.8M29.5 15.5h-2.6" stroke="#FFC23C" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="19" cy="13.5" r="6" fill="#FFC83D" />
          <path d="M8.5 27h14a5 5 0 0 0 .4-9.98A6.6 6.6 0 0 0 10.1 18.5 4.3 4.3 0 0 0 8.5 27z" fill="#fff" stroke="#C9D2DE" strokeWidth="1.4" />
        </svg>
      );
    case "cloud":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
          <path d="M8 25h16.5a5.6 5.6 0 0 0 .5-11.17A7.6 7.6 0 0 0 10 15.2 5 5 0 0 0 8 25z" fill="#D9DFE7" />
          <path d="M8 25h16.5a5.6 5.6 0 0 0 .5-11.17" fill="none" stroke="#C3CBD6" strokeWidth="1.3" />
        </svg>
      );
    case "rain":
    case "shower":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
          <path d="M7.5 19.5h17a5.3 5.3 0 0 0 .5-10.57A7.3 7.3 0 0 0 10.6 10.3 4.7 4.7 0 0 0 7.5 19.5z" fill="#9AA5B4" />
          <path d="M10 22.5l-1.4 3.2M14.5 22.5l-1.4 3.2M19 22.5l-1.4 3.2M23.5 22.5l-1.4 3.2M12.2 27.3l-.9 2M16.7 27.3l-.9 2M21.2 27.3l-.9 2" stroke="#3D8BFF" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "heavy":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
          <path d="M7 18.5h18a5.5 5.5 0 0 0 .4-10.98A7.6 7.6 0 0 0 10.3 9 4.9 4.9 0 0 0 7 18.5z" fill="#6E7A8B" />
          <path d="M8.5 21.5l-2 4.6M12.5 21.5l-2 4.6M16.5 21.5l-2 4.6M20.5 21.5l-2 4.6M24.5 21.5l-2 4.6" stroke="#1E6FFF" strokeWidth="2.3" strokeLinecap="round" />
        </svg>
      );
    case "snow":
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
          <path d="M7.5 19h17a5.3 5.3 0 0 0 .5-10.57A7.3 7.3 0 0 0 10.6 9.8 4.7 4.7 0 0 0 7.5 19z" fill="#C7D0DC" />
          <g fill="#7FB2FF">
            <circle cx="10" cy="23.5" r="1.6" />
            <circle cx="16" cy="23.5" r="1.6" />
            <circle cx="22" cy="23.5" r="1.6" />
            <circle cx="13" cy="28" r="1.6" />
            <circle cx="19" cy="28" r="1.6" />
          </g>
        </svg>
      );
  }
}

// 폭우: a rain day with a lot of water expected
export const wxKind = (kind: WeatherKind, mm: number | null): WxIconKind => (kind === "rain" && mm != null && mm >= 15 ? "heavy" : kind);
