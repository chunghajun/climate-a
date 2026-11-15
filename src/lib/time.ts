// All schedule times are Korea time; servers run in UTC, so convert explicitly.

export const DOW = ["일", "월", "화", "수", "목", "금", "토"];

const kstParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function kstNow(now = new Date()) {
  const p = Object.fromEntries(kstParts.formatToParts(now).map((x) => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  return { date, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dowOf(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number) {
  const t = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

// Sunday of the week containing `date` (the app's weeks run 일 → 토).
export function sundayOf(date: string) {
  return addDays(date, -dowOf(date));
}

// Monday of the week containing `date`.
export function mondayOf(date: string) {
  return addDays(date, -((dowOf(date) + 6) % 7));
}

// ISO week number (weeks start on Monday).
export function isoWeek(date: string) {
  const thursday = addDays(mondayOf(date), 3);
  const jan1 = `${thursday.slice(0, 4)}-01-01`;
  const days = (Date.parse(`${thursday}T00:00:00Z`) - Date.parse(`${jan1}T00:00:00Z`)) / 86_400_000;
  return Math.floor(days / 7) + 1;
}

export function dateLabel(date: string) {
  const [, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일 (${DOW[dowOf(date)]})`;
}
