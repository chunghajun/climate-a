// 기후 알람: like phone alarms — at each set time on its days, the tester gets the day's weather
// and what to bring (for the day's events, or just the local weather when there are none).
// No repeat days = a one-time alarm on `onceOn` (the next time that time comes); it switches off after ringing.
export type Alarm = { id: string; time: string; days: number[]; on: boolean; onceOn?: string | null };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// Everyone starts with one alarm on weekday mornings.
export const DEFAULT_ALARMS: Alarm[] = [{ id: "a1", time: "07:30", days: [1, 2, 3, 4, 5], on: true }];

export function alarmsOf(doc: { alarms?: unknown } | undefined): Alarm[] {
  if (!doc || !Array.isArray(doc.alarms)) return DEFAULT_ALARMS;
  return cleanAlarms(doc.alarms);
}

export function cleanAlarms(list: unknown[]): Alarm[] {
  return list
    .map((a, i) => {
      const x = a as Partial<Alarm>;
      return {
        id: typeof x.id === "string" && x.id ? x.id.slice(0, 20) : `a${i + 1}`,
        time: typeof x.time === "string" && TIME.test(x.time) ? x.time : "07:30",
        days: Array.isArray(x.days) ? [...new Set(x.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [],
        on: !!x.on,
        onceOn: typeof x.onceOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x.onceOn) ? x.onceOn : null,
      };
    })
    .slice(0, 10);
}

// Does this alarm ring on `date` (KST, with its weekday)?
export const ringsOn = (a: Alarm, date: string, dow: number) => a.on && (a.days.length ? a.days.includes(dow) : a.onceOn === date);

// A one-time alarm rings the next time its time comes: today if still ahead, else tomorrow.
export function nextOnce(time: string, now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600e3);
  const [h, m] = time.split(":").map(Number);
  if (h * 60 + m <= kst.getUTCHours() * 60 + kst.getUTCMinutes()) kst.setUTCDate(kst.getUTCDate() + 1);
  return kst.toISOString().slice(0, 10);
}

export function daysLabel(days: number[]) {
  const s = [...days].sort().join(",");
  if (s === "1,2,3,4,5") return "평일";
  if (s === "0,6") return "주말";
  if (days.length === 7) return "매일";
  if (!days.length) return "반복 안 함";
  return [...days].sort().map((d) => "일월화수목금토"[d]).join(" ");
}
