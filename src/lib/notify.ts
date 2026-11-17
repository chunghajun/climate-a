// 알림 settings: one switch for all pushes, then when the daily weather alert comes —
// "first": a set time before the day's first trip (no trips = no alert that day),
// "fixed": at the 기후 알람 times the tester set (lib/alarms.ts).
export type NotifyMode = "first" | "fixed";
export type Notify = { on: boolean; mode: NotifyMode; leadMin: number };

export const DEFAULT_NOTIFY: Notify = { on: true, mode: "first", leadMin: 60 };
export const MAX_LEAD = 3 * 60;

export function notifyOf(doc: { notify?: unknown } | undefined): Notify {
  return cleanNotify((doc?.notify ?? {}) as Partial<Notify>);
}

export function cleanNotify(x: Partial<Notify>): Notify {
  const lead = Number(x.leadMin);
  return {
    on: typeof x.on === "boolean" ? x.on : DEFAULT_NOTIFY.on,
    mode: x.mode === "fixed" || x.mode === "first" ? x.mode : DEFAULT_NOTIFY.mode,
    // 10-minute steps, up to 3 hours before
    leadMin: Number.isFinite(lead) ? Math.max(0, Math.min(MAX_LEAD, Math.round(lead / 10) * 10)) : DEFAULT_NOTIFY.leadMin,
  };
}

export function leadLabel(min: number) {
  if (min === 0) return "나갈 때";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h ? `${h}시간` : ""}${h && m ? " " : ""}${m ? `${m}분` : ""} 전`;
}
