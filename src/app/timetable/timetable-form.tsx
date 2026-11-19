"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveTimetable, type DatedRow, type TimetableRow } from "../actions/events";
import { readScheduleImage } from "../actions/timetable-image";
import CalendarReview from "./calendar-review";
import { btnPrimary, btnSecondary, card, input } from "@/components/ui";
import { DOW } from "@/lib/time";
import type { Place } from "@/lib/types";

const emptyRow = (): TimetableRow => ({ title: "", days: [], start: "09:00", end: "10:15", placeId: null });

// Shrink the screenshot before upload (server actions accept about 1MB).
async function toJpegBase64(file: File, maxSide = 2000) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}

// Classes usually happen at school, which may not be the default place: guess it from the names.
const guessSchool = (places: Place[]) => places.find((p) => /학교|대학|캠퍼스|대$/.test(p.label))?.id ?? null;

export default function TimetableForm({ places, from = "/" }: { places: Place[]; from?: string }) {
  const router = useRouter();
  const [classPlace, setClassPlace] = useState<string | null>(guessSchool(places));
  const [rows, setRows] = useState<TimetableRow[]>(() => [emptyRow(), emptyRow(), emptyRow()].map((r) => ({ ...r, placeId: guessSchool(places) })));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState("");
  const [dated, setDated] = useState<DatedRow[] | null>(null);
  const [lastImage, setLastImage] = useState<string | null>(null);
  const back = ["/", "/calendar"].includes(from) ? from : "/";

  function update(i: number, patch: Partial<TimetableRow>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function toggleDay(i: number, d: number) {
    const days = rows[i].days;
    update(i, { days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] });
  }

  async function submit() {
    setBusy(true);
    setError("");
    const result = await saveTimetable(rows);
    if (result.ok) router.push(back);
    else {
      setError(result.error ?? "저장 실패");
      setBusy(false);
    }
  }

  async function readImage(image: string, force?: "timetable" | "calendar") {
    setReading(true);
    setError("");
    setNotice("");
    try {
      const result = await readScheduleImage(image, force);
      if (!result.ok) setError(result.error);
      else if (result.kind === "timetable") {
        setDated(null);
        // Keep anything already typed, replace the empty rows.
        setRows((rs) => [...rs.filter((r) => r.title.trim()), ...result.rows.map((r) => ({ ...r, placeId: r.placeId ?? classPlace }))]);
        setNotice(`매주 반복되는 시간표로 읽었어요. ${result.rows.length}개 수업의 요일과 시간을 확인하고 저장해 주세요.`);
      } else {
        setDated(result.events);
        setNotice(`날짜가 있는 달력으로 읽었어요. ${result.events.length}개 일정을 확인하고 넣을 것만 골라 주세요.`);
      }
    } catch {
      setError("이미지를 읽지 못했어요. 다시 시도해 주세요.");
    } finally {
      setReading(false);
    }
  }

  async function pickFile(file: File) {
    try {
      const image = await toJpegBase64(file);
      setLastImage(image);
      await readImage(image);
    } catch {
      setError("이미지를 열지 못했어요. 다른 캡처로 시도해 주세요.");
    }
  }

  return (
    <div className="space-y-3">
      <label className={`${card} block cursor-pointer border-2 border-dashed border-navy/30 text-center`}>
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={reading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pickFile(f);
            e.target.value = "";
          }}
        />
        <p className="text-lg font-extrabold">{reading ? "캡처를 읽고 있어요… (20초쯤)" : "캡처로 채우기"}</p>
        <p className="mt-1 text-sm text-muted">에브리타임 시간표는 <b>매주 반복</b>으로, 다른 달력 앱 화면은 <b>날짜별 일정</b>으로 알아서 구분해 넣어요.</p>
      </label>
      {notice && <p className="rounded-xl bg-navy/[.06] px-3 py-2.5 text-sm font-semibold text-navy">{notice}</p>}
      {lastImage && !reading && (
        <button type="button" onClick={() => readImage(lastImage, dated ? "timetable" : "calendar")} className="w-full text-center text-[13px] font-semibold text-muted underline">
          {dated ? "매주 반복되는 시간표예요 → 시간표로 다시 읽기" : "날짜가 있는 달력이에요 → 달력으로 다시 읽기"}
        </button>
      )}
      {dated ? (
        <CalendarReview initial={dated} back={back} onError={setError} />
      ) : (
        <>
      {/* One place for the whole timetable (each class can still change its own below). */}
      {places.length > 1 && (
        <section className={card}>
          <p className="mb-2 text-sm font-bold">수업은 어디에서 하나요?</p>
          <div className="flex flex-wrap gap-1.5">
            {[{ id: null as string | null, label: `기본 (${places[0].label})` }, ...places.slice(1).map((p) => ({ id: p.id as string | null, label: p.label }))].map((o) => (
              <button
                key={o.id ?? "default"}
                type="button"
                onClick={() => {
                  setClassPlace(o.id);
                  setRows((rs) => rs.map((r) => ({ ...r, placeId: o.id })));
                }}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${classPlace === o.id ? "border-navy bg-navy text-white" : "border-line bg-white"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">모든 수업에 한 번에 적용돼요.</p>
        </section>
      )}
      {rows.map((r, i) => (
        <section key={i} className={`${card} space-y-3`}>
          <div className="flex items-center gap-2">
            <input
              value={r.title}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder={`과목 ${i + 1}`}
              maxLength={40}
              className={input}
            />
            {rows.length > 1 && (
              <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="px-2 text-xl text-muted" aria-label="삭제">
                ×
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(i, d)}
                className={`rounded-full border px-3.5 py-2 text-sm font-semibold ${
                  r.days.includes(d) ? "border-navy bg-navy text-white" : "border-line"
                }`}
              >
                {DOW[d]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="time" value={r.start} onChange={(e) => update(i, { start: e.target.value })} className={input} aria-label="시작" />
            <input type="time" value={r.end} onChange={(e) => update(i, { end: e.target.value })} className={input} aria-label="끝" />
          </div>
          {places.length > 0 && (
            <select value={r.placeId ?? ""} onChange={(e) => update(i, { placeId: e.target.value || null })} className={input} aria-label="장소">
              <option value="">기본 장소</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
        </section>
      ))}
      <button type="button" onClick={() => setRows((rs) => [...rs, emptyRow()])} className={btnSecondary}>
        + 과목 추가
      </button>
      <button type="button" onClick={submit} disabled={busy} className={btnPrimary}>
        {busy ? "저장 중…" : "저장"}
      </button>
        </>
      )}
      {error && <p className="text-sm font-semibold text-coral">{error}</p>}
    </div>
  );
}
