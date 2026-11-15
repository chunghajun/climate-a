// Line-style weather pictures and the advice badges used across the views.
import { ADVICE_LABEL, isOutfit, OUTFITS, type AdviceKey, type WeatherKind } from "@/lib/advice";

const SUN = "#D9963A";
const SUN_FILL = "#F6E2B8";
const CLOUD = "#6E6A63";
const RAIN = "#4A6FA5";

export function WeatherIcon({ kind, size = 28, className = "" }: { kind: WeatherKind | "heat" | null; size?: number; className?: string }) {
  if (!kind) return <span style={{ width: size, height: size }} className={`inline-block ${className}`} />;
  const common = { width: size, height: size, viewBox: "0 0 32 32", fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.9, className, "aria-label": kind };
  switch (kind) {
    case "sun":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="5.6" stroke={SUN} fill={SUN_FILL} />
          <path stroke={SUN} d="M16 4.5v3M16 24.5v3M4.5 16h3M24.5 16h3M7.9 7.9l2.1 2.1M22 22l2.1 2.1M7.9 24.1L10 22M22 10l2.1-2.1" />
        </svg>
      );
    case "partly":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4.4" stroke={SUN} fill={SUN_FILL} />
          <path stroke={SUN} d="M12 3.8v2M3.8 12h2M6.2 6.2l1.4 1.4M17.8 6.2l-1.4 1.4" />
          <path stroke={CLOUD} fill="#fff" d="M11 26h11.5a4.5 4.5 0 0 0 .6-8.96A6 6 0 0 0 11.6 18.6 3.7 3.7 0 0 0 11 26z" />
        </svg>
      );
    case "cloud":
      return (
        <svg {...common}>
          <path stroke={CLOUD} fill="#F4F4F5" d="M9 24h14a5 5 0 0 0 .7-9.95A7 7 0 0 0 10.2 15.3 4.4 4.4 0 0 0 9 24z" />
        </svg>
      );
    case "rain":
      return (
        <svg {...common}>
          <path stroke={CLOUD} fill="#F4F4F5" d="M9 19.5h14a5 5 0 0 0 .7-9.95A7 7 0 0 0 10.2 10.8 4.4 4.4 0 0 0 9 19.5z" />
          <path stroke={RAIN} d="M11.5 23l-1.3 3.2M16.5 23l-1.3 3.2M21.5 23l-1.3 3.2" />
        </svg>
      );
    case "shower":
      return (
        <svg {...common}>
          <circle cx="21.5" cy="9.5" r="3.6" stroke={SUN} fill={SUN_FILL} />
          <path stroke={CLOUD} fill="#fff" d="M8 21h12a4.5 4.5 0 0 0 .6-8.96A6.2 6.2 0 0 0 9 13.4 3.9 3.9 0 0 0 8 21z" />
          <path stroke={RAIN} d="M11 24.5l-1.1 2.7M16 24.5l-1.1 2.7" />
        </svg>
      );
    case "heat":
      return (
        <svg {...common} strokeWidth={2}>
          <circle cx="16" cy="13" r="6" stroke="#D2471F" fill="#FBC46B" />
          <path stroke="#D2471F" d="M16 2.5v3M16 20.5v2M5.5 13h3M23.5 13h3M8.6 5.6l2.1 2.1M21.3 5.6l-2.1 2.1" />
          <path stroke="#E07A2C" d="M7 25.5c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0M9 29c2-1.4 3.6-1.4 5.4 0s3.6 1.4 5.4 0" />
        </svg>
      );
    case "snow":
      return (
        <svg {...common}>
          <path stroke={CLOUD} fill="#F4F4F5" d="M9 19.5h14a5 5 0 0 0 .7-9.95A7 7 0 0 0 10.2 10.8 4.4 4.4 0 0 0 9 19.5z" />
          <path stroke={RAIN} d="M11 24h.01M16 26h.01M21 24h.01M13.5 28h.01M18.5 28h.01" strokeWidth={2.6} />
        </svg>
      );
  }
}

const SHIRT_LONG = "M8.5 3.5L5 5.5 3.5 17H6L8 9v11.5h8V9l2 8h2.5L19 5.5l-3.5-2c-.6 1.6-1.9 2.5-3.5 2.5s-2.9-.9-3.5-2.5z";

const BADGE: Record<AdviceKey, { bg: string; fg: string; path: React.ReactNode }> = {
  umbrella: { bg: "#E9EEF6", fg: "#3F639B", path: <><path d="M3 11.5a9 9 0 0 1 18 0z" /><path d="M12 11.5v7a2 2 0 0 1-4 0" /></> },
  folding: { bg: "#EEF2F7", fg: "#6383B3", path: <><path d="M12 3l3.2 11H8.8z" /><path d="M12 14v4.5a1.8 1.8 0 0 1-3.6 0" /><path d="M10.2 9.5l2.8 1.2" /></> },
  range: { bg: "#F0EBF5", fg: "#77589E", path: <><path d="M10 4.5a2 2 0 0 1 4 0v8.8a4 4 0 1 1-4 0z" /><path d="M19 4v6M17 6l2-2 2 2M17 8l2 2 2-2" /></> },
  heat: {
    bg: "#FFE0D2",
    fg: "#C23A14",
    path: <><circle cx="12" cy="10" r="4" /><path d="M12 2.5v1.8M4.5 10h1.8M17.7 10h1.8M6.7 4.7l1.3 1.3M17.3 4.7 16 6" /><path d="M5 18c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0M7 21.5c1.4-1 2.8-1 4.2 0s2.8 1 4.2 0" /></>,
  },
  // 옷차림: warmer colours for lighter clothes, navy for the heaviest.
  o1: { bg: "#FDE6DC", fg: "#C9471F", path: <path d="M8.5 3c.3 2 1.7 3.2 3.5 3.2S15.2 5 15.5 3L17.5 4 16.5 9v12h-9V9l-1-5z" /> },
  o2: { bg: "#FDEEDF", fg: "#D9762A", path: <path d="M8.5 3.5L4 6l1.8 3.6L8 8.8V20.5h8V8.8l2.2.8L20 6l-4.5-2.5c-.6 1.6-1.9 2.5-3.5 2.5s-2.9-.9-3.5-2.5z" /> },
  o3: { bg: "#F6EEDB", fg: "#A47E26", path: <path d={SHIRT_LONG} /> },
  o4: {
    bg: "#E8F0E2",
    fg: "#5E7F4B",
    path: <><path d="M8.5 3.5L5 5.5 3.5 17H6L8 9v11.5h8V9l2 8h2.5L19 5.5l-3.5-2L12 8z" /><path d="M12 8v12.5" /><path d="M13.6 11h.01M13.6 14h.01M13.6 17h.01" strokeWidth={2.4} /></>,
  },
  o5: {
    bg: "#E6EDF6",
    fg: "#3F639B",
    path: <><path d="M8.5 3L5 5 3.5 17H6L7.5 9.5V22h9V9.5L18 17h2.5L19 5l-3.5-2L12 9z" /><path d="M8.5 3L12 9l3.5-6" /><path d="M7.5 14.5h9" /></>,
  },
  o6: { bg: "#E4E8EF", fg: "#3A6FD8", path: <><path d="M9 3h6l1.5 2.5L20 7v14H4V7l3.5-1.5z" /><path d="M12 5.5V21" /><path d="M4 11h16M4 15.5h16" /></> },
};

// `colder` adds a small ↓ when it is much colder than yesterday.
export function AdviceBadge({ k, size = 26, white = false, colder = false }: { k: AdviceKey; size?: number; white?: boolean; colder?: boolean }) {
  const b = BADGE[k];
  return (
    <span
      title={colder ? `${ADVICE_LABEL[k]} · 어제보다 추워요` : ADVICE_LABEL[k]}
      className="relative inline-flex flex-none items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.34, background: white ? "#fff" : "#EEF2FC", color: "#3A6FD8" }} // A안: every badge is the one blue
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {b.path}
      </svg>
      {colder && (
        <i
          className="absolute flex items-center justify-center rounded-full bg-navy font-black not-italic text-white"
          style={{ width: size * 0.5, height: size * 0.5, right: -size * 0.18, top: -size * 0.18, fontSize: size * 0.32 }}
        >
          ↓
        </i>
      )}
    </span>
  );
}

export function AdviceBadges({ list, size = 20, colder = false }: { list: AdviceKey[]; size?: number; colder?: boolean }) {
  if (!list.length) return null;
  return (
    <span className="inline-flex gap-1">
      {list.map((k) => (
        <AdviceBadge key={k} k={k} size={size} colder={colder && isOutfit(k)} />
      ))}
    </span>
  );
}

// Explanation card shown at the bottom of each view.
export function Legend({ temps = false, extra }: { temps?: boolean; long?: boolean; extra?: React.ReactNode }) {
  const keys: AdviceKey[] = ["umbrella", "folding", "range", "heat"];
  return (
    <section className="rounded-[18px] border border-line bg-white px-4 py-3">
      <p className="mb-2.5 text-[11px] font-extrabold tracking-[.06em] text-muted">아이콘 설명</p>
      <div className="flex flex-wrap gap-x-3.5 gap-y-2.5 text-[11.5px] font-semibold text-soft">
        {temps && (
          <span className="inline-flex items-center gap-1.5">
            <b className="text-hi">↑</b>최고 <b className="text-lo">↓</b>최저
          </span>
        )}
        {extra}
        {keys.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <AdviceBadge k={k} size={20} />
            {ADVICE_LABEL[k]}
          </span>
        ))}
      </div>
      <p className="mb-2 mt-3 text-[11px] font-extrabold tracking-[.06em] text-muted">옷차림 (그날 기온 기준)</p>
      <div className="grid grid-cols-3 gap-x-2 gap-y-2 text-[11px] font-semibold text-soft">
        {OUTFITS.map((o) => (
          <span key={o.key} className="inline-flex items-center gap-1.5">
            <AdviceBadge k={o.key} size={20} />
            <span>
              <b className="text-ink">{o.label}</b> {o.range}
            </span>
          </span>
        ))}
      </div>
      <p className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-soft">
        <AdviceBadge k="o5" size={20} colder /> 어제보다 5° 이상 추우면 ↓ 표시가 붙어요
      </p>
    </section>
  );
}