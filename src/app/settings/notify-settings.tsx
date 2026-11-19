"use client";

// 설정 › 알림: one switch for every push, then when the daily weather alert comes —
// a chosen time before the day's first trip, or at the 기후 알람 times set on /alarms.
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import InstallGuide from "@/components/install-guide";
import { TLink } from "@/components/nav-transition";
import { usePush } from "@/components/notification-card";
import Wheel from "@/components/wheel";
import { leadLabel, MAX_LEAD, type Notify, type NotifyMode } from "@/lib/notify";
import { saveNotify } from "../actions/notify";

const SMOOTH = "cubic-bezier(.2,.8,.2,1)";
const HOURS = ["0", "1", "2", "3"];
const MINUTES = ["00", "10", "20", "30", "40", "50"];

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative h-[30px] w-[51px] flex-none rounded-full transition-colors duration-200 ${on ? "bg-blue" : "bg-[#E2E2E2]"}`}
    >
      <span
        className="absolute left-[2px] top-[2px] h-[26px] w-[26px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,.18)] transition-transform duration-200"
        style={{ transform: on ? "translateX(21px)" : "none" }}
      />
    </button>
  );
}

function Radio({ on }: { on: boolean }) {
  return (
    <span
      className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-2 transition-colors ${on ? "border-blue" : "border-[#CFCFCF]"}`}
      aria-hidden
    >
      <span className={`h-[10px] w-[10px] rounded-full bg-blue transition-transform duration-200 ${on ? "scale-100" : "scale-0"}`} />
    </span>
  );
}

export default function NotifySettings({ initial, alarmsLabel }: { initial: Notify; alarmsLabel: string }) {
  const [n, setN] = useState(initial);
  const [, start] = useTransition();
  const push = usePush();
  const [sheet, setSheet] = useState<{ h: number; m: number } | null>(null);
  const [shown, setShown] = useState(false);

  // "이렇게 와요" 예시는 이 기기에서 처음 한 번만 보여 준다.
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    if (!n.on) return;
    try {
      if (localStorage.getItem("cm_notif_preview") === "1") return;
      localStorage.setItem("cm_notif_preview", "1");
    } catch {
      // No storage: it just shows each time.
    }
    // Whether it was seen before is only known on the device, after the page is on screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview(true);
  }, [n.on]);

  const save = (next: Notify) => {
    setN(next);
    start(async () => {
      setN(await saveNotify(next));
    });
  };

  async function toggle() {
    if (n.on) return save({ ...n, on: false });
    // switching on also asks this device for permission, if it has not got it yet
    if (push.env === "ok" && !push.subscription) await push.subscribe();
    save({ ...n, on: true });
  }

  function openLead() {
    setSheet({ h: Math.floor(n.leadMin / 60), m: (n.leadMin % 60) / 10 });
    requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
  }
  function closeLead() {
    setShown(false);
    setTimeout(() => setSheet(null), 300);
  }
  function saveLead() {
    if (!sheet) return;
    save({
      ...n,
      mode: "first",
      leadMin: Math.min(MAX_LEAD, sheet.h * 60 + sheet.m * 10),
    });
    closeLead();
  }
  const pick = (mode: NotifyMode) => mode !== n.mode && save({ ...n, mode });

  const deviceOff = push.env === "ok" && push.subscription === null;
  const draftLead = sheet ? Math.min(MAX_LEAD, sheet.h * 60 + sheet.m * 10) : 0;

  return (
    <section className="border-b border-line pb-5">
      <p className="mb-1 text-[12.5px] font-bold text-muted">알림</p>

      <div className="flex items-center gap-3 py-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[11px] bg-sky text-blue">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5h4" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[15.5px]">알림 받기</b>
          <span className="block text-[12.5px] text-muted">{n.on ? "그날의 날씨와 챙길 것을 알려 드려요" : "알림을 하나도 보내지 않아요"}</span>
        </span>
        <Switch on={n.on} onClick={toggle} label="알림 받기" />
      </div>

      {n.on && push.env !== "ok" && push.env !== "loading" && (
        <div className="mb-2">
          <InstallGuide env={push.env} />
        </div>
      )}
      {n.on && deviceOff && (
        <div className="mb-2 flex items-center justify-between gap-3 rounded-[12px] bg-gray px-3.5 py-2.5 text-[12.5px] text-[#5a5a5a]">
          <span>이 기기는 아직 알림을 받을 수 없어요.</span>
          <button type="button" onClick={push.subscribe} disabled={push.busy} className="flex-none font-bold text-blue disabled:opacity-50">
            허용하기
          </button>
        </div>
      )}
      {push.status && <p className="mb-2 text-[12.5px] text-muted">{push.status}</p>}

      {/* 켠 경우: 언제 받을지 */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300"
        style={{
          gridTemplateRows: n.on ? "1fr" : "0fr",
          opacity: n.on ? 1 : 0,
          transitionTimingFunction: SMOOTH,
        }}
        aria-hidden={!n.on}
      >
        <div className="min-h-0 overflow-hidden">
          <p className="mb-1 mt-2 text-[12.5px] font-bold text-muted">언제 받을까요?</p>
          <div className="rounded-[16px] bg-gray">
            <div
              role="radio"
              aria-checked={n.mode === "first"}
              tabIndex={n.on ? 0 : -1}
              onClick={() => pick("first")}
              className="flex cursor-pointer items-center gap-3 px-4 py-3.5"
            >
              <Radio on={n.mode === "first"} />
              <span className="min-w-0 flex-1">
                <b className="block text-[15px]">첫 외출 전</b>
                <span className="block text-[12.5px] text-muted">그날 첫 일정에 나가기 전에 알려요</span>
              </span>
              <button
                type="button"
                tabIndex={n.on ? 0 : -1}
                onClick={(e) => {
                  e.stopPropagation();
                  openLead();
                }}
                className={`flex-none rounded-full px-3 py-1.5 text-[13.5px] font-bold ${n.mode === "first" ? "bg-white text-blue shadow-[0_1px_2px_rgba(0,0,0,.06)]" : "text-muted"}`}
              >
                {leadLabel(n.leadMin)} ⌄
              </button>
            </div>
            <div className="mx-4 h-px bg-[#E6E6E6]" />
            <div
              role="radio"
              aria-checked={n.mode === "fixed"}
              tabIndex={n.on ? 0 : -1}
              onClick={() => pick("fixed")}
              className="flex cursor-pointer items-center gap-3 px-4 py-3.5"
            >
              <Radio on={n.mode === "fixed"} />
              <span className="min-w-0 flex-1">
                <b className="block text-[15px]">정한 시각에</b>
                <span className="block truncate text-[12.5px] text-muted">{alarmsLabel}</span>
              </span>
              <TLink
                href="/alarms?from=/settings"
                kind="push"
                tabIndex={n.on ? 0 : -1}
                onClick={(e) => e.stopPropagation()}
                className={`flex-none rounded-full px-3 py-1.5 text-[13.5px] font-bold ${n.mode === "fixed" ? "bg-white text-blue shadow-[0_1px_2px_rgba(0,0,0,.06)]" : "text-muted"}`}
              >
                시각 편집 ›
              </TLink>
            </div>
          </div>

          {preview && (
            <>
            <p className="mb-1.5 mt-4 text-[12.5px] font-bold text-muted">이렇게 와요</p>
            <div className="flex items-start gap-3 rounded-[16px] border border-line bg-white px-3.5 py-3">
              <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-sky">
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                  <path d="M3 12a9 9 0 0 1 18 0z" fill="#3A6FD8" />
                  <path d="M12 12v6.5a2.2 2.2 0 0 1-4.4 0" fill="none" stroke="#3A6FD8" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </span>
              <span className="min-w-0 text-[13px] leading-relaxed">
                <b className="block text-[14px]">{n.mode === "first" ? `첫 외출 ${leadLabel(n.leadMin)}이에요` : "오늘 우산 챙기세요"}</b>
                <span className="text-[#5a5a5a]">
                  {n.mode === "first"
                    ? "10:30 환경공학I 가는 길에 비 70%예요. 우산과 두꺼운 겉옷을 챙기세요."
                    : "15:00 구조역학I 가는 길에 비 70%. 밖에서 최저 4°라 두꺼운 겉옷도 챙겨요."}
                </span>
                {n.mode === "first" && <span className="mt-1 block text-[12px] text-muted">일정이 없는 날은 알림을 보내지 않아요.</span>}
              </span>
            </div>
            </>
          )}
        </div>
      </div>

      {sheet &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="닫기"
              onClick={closeLead}
              className="fixed inset-0 z-40 bg-ink/30"
              style={{
                opacity: shown ? 1 : 0,
                transition: "opacity .25s ease",
              }}
            />
            <div
              className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md rounded-t-[22px] bg-white pb-[calc(24px+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,.15)]"
              style={{
                transform: shown ? "none" : "translateY(100%)",
                transition: `transform .36s ${SMOOTH}`,
              }}
            >
              <div className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-[#DADADA]" />
              <div className="flex h-12 items-center justify-between px-5">
                <button type="button" onClick={closeLead} className="text-[15px] text-soft">
                  취소
                </button>
                <b className="text-[16px]">첫 외출 몇 분 전?</b>
                <button type="button" onClick={saveLead} className="text-[15px] font-extrabold text-blue">
                  완료
                </button>
              </div>
              <div className="relative mx-5 mt-1 flex h-[216px] items-center justify-center gap-2 overflow-hidden">
                <div className="pointer-events-none absolute inset-x-0 top-[90px] h-9 rounded-[10px] bg-gray" />
                <Wheel items={HOURS} index={sheet.h} onPick={(i) => setSheet((s) => s && { ...s, h: i })} />
                <span className="relative z-[1] w-10 text-[15px] font-semibold text-soft">시간</span>
                <Wheel items={MINUTES} index={sheet.m} onPick={(i) => setSheet((s) => s && { ...s, m: i })} />
                <span className="relative z-[1] w-6 text-[15px] font-semibold text-soft">분</span>
                <div className="pointer-events-none absolute inset-0 z-[2] bg-[linear-gradient(#fff,rgba(255,255,255,0)_38%,rgba(255,255,255,0)_62%,#fff)]" />
              </div>
              <p className="mt-3 text-center text-[13px] text-muted">
                {draftLead === 0 ? "나갈 시각에 알려 드려요" : `첫 일정에 나가기 ${leadLabel(draftLead)}에 알려 드려요`}
                {sheet.h * 60 + sheet.m * 10 > MAX_LEAD && " (최대 3시간)"}
              </p>
            </div>
          </>,
          document.body,
        )}
    </section>
  );
}
