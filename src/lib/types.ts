import type { Alarm } from "./alarms";

// Which push alerts the tester wants (screen icons always show).
export type AlertPrefs = {
  umbrella: boolean;
  folding: boolean;
  outfit: boolean; // 옷차림 (much colder than yesterday)
  heat: boolean; // 폭염
  range: boolean;
  suggestion: boolean;
};

export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  umbrella: true,
  folding: true,
  outfit: true,
  heat: true,
  range: true,
  suggestion: true,
};

export type Tester = {
  code: string;
  label: string;
  consentAt: string | null;
  defaultTravelMin: number;
  alertPrefs: AlertPrefs;
  icsUrl: string | null;
  icsLastSync: string | null;
  alarms: Alarm[]; // 기후 알람
};

export type Place = {
  id: string;
  label: string;
  lat: number;
  lon: number;
  favorite: boolean; // 즐겨찾기 (listed in settings); false = picked for one event only
};

export type Setting = "indoor" | "outdoor";

export type CalEvent = {
  id: string;
  title: string;
  start: string; // "HH:MM", KST ("" when the time is not decided yet)
  end: string;
  untimed: boolean; // 시간 미정: shown on its day, but no departure alert
  remindBefore: number | null; // 일정 알림: minutes before the start (5-minute steps), null = off
  remindAt: string | null; // 일정 알림 for a 시간 미정 event: "HH:MM" on its day, null = off
  date: string | null; // one-off event: "YYYY-MM-DD"
  repeatDays: number[]; // repeating event: 0 = 일 … 6 = 토
  skipDates: string[]; // repeating event: days it does not happen this time (휴강 등)
  placeId: string | null;
  setting: Setting;
  flexible: boolean;
  travelMin: number;
  source: "manual" | "timetable" | "ics" | "suggestion" | "image";
};
