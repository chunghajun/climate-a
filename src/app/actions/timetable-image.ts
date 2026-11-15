"use server";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { logEvent, requireTester } from "@/lib/data";
import { addDays, DOW, dowOf, kstNow } from "@/lib/time";
import type { DatedRow, TimetableRow } from "./events";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

const ScheduleSchema = z.object({
  kind: z.enum(["timetable", "calendar"]),
  classes: z.array(
    z.object({
      title: z.string(),
      days: z.array(z.enum(DAYS)),
      start: z.string().describe("24시간제 HH:MM"),
      end: z.string().describe("24시간제 HH:MM"),
    })
  ),
  events: z.array(
    z.object({
      title: z.string(),
      date: z.string().describe("YYYY-MM-DD"),
      start: z.string().nullable().describe("24시간제 HH:MM, 화면에 시각이 없으면 null"),
      end: z.string().nullable().describe("24시간제 HH:MM, 화면에 없으면 null"),
    })
  ),
});

function prompt(today: string, force?: "timetable" | "calendar") {
  return `오늘은 ${today}(${DOW[dowOf(today)]}요일), 한국 시간 기준이야.
이 이미지는 일정 앱 화면 캡처야. 먼저 kind를 정해:
- "timetable": 날짜 없이 요일×시간 칸으로 된, 매주 반복되는 수업 시간표 (에브리타임, 학교 포털 시간표 등)
- "calendar": 특정 날짜가 보이는 달력이나 일정 목록 (월간·주간 달력, 일정 리스트, 다른 캘린더 앱 등)
${force ? `이 이미지는 "${force}"로 읽어 줘.\n` : ""}
timetable이면 classes에 수업마다 과목명, 요일, 시작·끝 시각을 넣고 events는 빈 배열로 둬.
- 블록 안에 시각이 있으면 그 값을, 없으면 왼쪽 시각 눈금과 블록 위치로 판단해. 수업은 보통 정시, 30분, 15분 단위로 시작해.
- 같은 과목이 같은 시각에 여러 요일이면 하나로 합쳐 days에 모두 넣어.
- 강의실, 교수명은 빼고 과목명만 적어.

calendar이면 events에 일정마다 제목, 날짜(YYYY-MM-DD), 시작·끝 시각을 넣고 classes는 빈 배열로 둬.
- 화면에 시각이 안 보이면 start, end는 null로 둬. 시작만 보이면 end는 null.
- 연도가 안 보이면 화면의 월과 오늘 날짜를 보고 가장 자연스러운 연도를 골라.
- 여러 날에 걸친 일정은 시작 날짜 하나로 적어.
- 공휴일, 음력, 절기, 기념일처럼 달력에 원래 찍혀 있는 표시는 빼.
- 제목은 보이는 그대로 적고, 읽을 수 없는 일정은 지어내지 말고 빼.`;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ScheduleImageResult =
  | { ok: true; kind: "timetable"; rows: TimetableRow[] }
  | { ok: true; kind: "calendar"; events: DatedRow[] }
  | { ok: false; error: string };

// Reads a screenshot of a timetable (→ weekly repeating rows) or of another
// calendar app (→ dated one-off events) to pre-fill the form for review.
export async function readScheduleImage(base64Jpeg: string, force?: "timetable" | "calendar"): Promise<ScheduleImageResult> {
  const tester = await requireTester();
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "캡처로 읽기 기능은 준비 중이에요. 직접 입력해 주세요." };
  if (base64Jpeg.length > 4_000_000) return { ok: false, error: "이미지가 너무 커요." };

  const today = kstNow().date;
  const client = new Anthropic();
  try {
    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(ScheduleSchema) },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64Jpeg } },
            { type: "text", text: prompt(today, force) },
          ],
        },
      ],
    });
    const parsed = response.parsed_output;
    if (response.stop_reason === "refusal" || !parsed) return { ok: false, error: "캡처를 읽지 못했어요. 직접 입력해 주세요." };

    if (parsed.kind === "timetable") {
      const rows: TimetableRow[] = parsed.classes
        .filter((c) => c.title.trim() && c.days.length && TIME.test(c.start) && TIME.test(c.end))
        .map((c) => ({ title: c.title.trim().slice(0, 40), days: c.days.map((d) => DAYS.indexOf(d)), start: c.start, end: c.end, placeId: null }));
      logEvent(tester.code, "timetable_image", { count: rows.length, forced: !!force });
      return rows.length ? { ok: true, kind: "timetable", rows } : { ok: false, error: "시간표에서 수업을 찾지 못했어요. 직접 입력해 주세요." };
    }

    // Keep dates within a sensible window around today.
    const min = addDays(today, -31);
    const max = addDays(today, 366);
    const events: DatedRow[] = parsed.events
      .filter((e) => e.title.trim() && DATE.test(e.date) && e.date >= min && e.date <= max)
      .map((e) => ({
        title: e.title.trim().slice(0, 40),
        date: e.date,
        start: e.start && TIME.test(e.start) ? e.start : "",
        end: e.end && TIME.test(e.end) ? e.end : "",
      }))
      .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
    logEvent(tester.code, "calendar_image", { count: events.length, timed: events.filter((e) => e.start).length, forced: !!force });
    return events.length ? { ok: true, kind: "calendar", events } : { ok: false, error: "달력에서 일정을 찾지 못했어요. 직접 입력해 주세요." };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { ok: false, error: "요청이 많아요. 잠시 뒤 다시 해 주세요." };
    console.error("schedule image failed", error);
    return { ok: false, error: "캡처를 읽는 중 문제가 생겼어요. 직접 입력해 주세요." };
  }
}
