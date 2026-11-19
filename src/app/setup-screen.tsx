import { CheckIcon } from "@/components/line-icons";
import { TLink } from "@/components/nav-transition";
import type { Notify } from "@/lib/notify";
import type { CalEvent, Place } from "@/lib/types";
import { FinishButton, FinishX, MarkSetupSeen } from "./setup-finish";
import SetupNotify from "./setup-notify";

const action = "mt-3 block rounded-[14px] bg-blue py-3 text-center text-[15px] font-extrabold text-white";
const actionPlain = "mt-3 block rounded-[14px] bg-gray py-3 text-center text-[15px] font-bold text-ink";
const more = "text-[15px] font-bold text-blue";

// 초기 설정: 동의한 뒤 처음 한 번 나오는 화면. 할 일 세 가지를 보여 주고, 끝낸 것은 완료로 표시한다.
// 탭 막대는 이 화면이 떠 있는 동안만 숨긴다. 마치기(또는 ×)를 누르면 본 화면(오늘)으로 넘어간다.
export default function SetupScreen({ code, places, events, notify }: { code: string; places: Place[]; events: CalEvent[]; notify: Notify }) {
  const hasPlace = places.length > 0;
  const hasEvent = events.length > 0;
  return (
    <>
      {/* 탭 막대(layout의 body 바로 아래 nav)를 이 화면에서만 숨긴다. 화면이 사라지면 이 스타일도 같이 사라진다. */}
      <style>{"body > nav { display: none !important; }"}</style>
      <MarkSetupSeen code={code} />
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-6">
        <header className="flex items-center justify-between">
          <p className="text-[17px] font-extrabold text-blue">CliMate</p>
          <FinishX code={code} />
        </header>

        <h1 className="mt-8 text-[26px] font-extrabold leading-snug tracking-[-.02em]">초기 설정</h1>
        <p className="mt-2 text-[15px] text-soft">세 가지를 해 두면 내 일정에 맞춰 알려 드릴 수 있어요. 나중에 설정에서 바꿀 수 있어요.</p>

        <ol className="mt-8 flex-1 space-y-3">
          <Step n={1} done={hasPlace} title="자주 가는 장소">
            {hasPlace ? (
              <>
                <p className="text-[15px] font-bold">{places.map((p) => p.label).join(", ")}</p>
                <TLink href="/places/new" kind="push" className={`${more} mt-2 inline-block`}>
                  장소 더 저장하기
                </TLink>
              </>
            ) : (
              <>
                <p className="text-[15px] text-soft">집이나 학교처럼 자주 가는 곳의 날씨로 알려 드려요.</p>
                <TLink href="/places/new" kind="push" className={action}>
                  장소 저장하기
                </TLink>
              </>
            )}
          </Step>

          <Step n={2} done={hasEvent} title="일정">
            {hasEvent ? (
              <>
                <p className="text-[15px] font-bold">일정 {events.length}개를 넣었어요</p>
                <p className="mt-2 flex gap-5">
                  <TLink href="/events/new?from=/" kind="push" className={more}>
                    일정 더 넣기
                  </TLink>
                  <TLink href="/timetable?from=/" kind="push" className={more}>
                    시간표 캡처로 넣기
                  </TLink>
                </p>
              </>
            ) : (
              <>
                <p className="text-[15px] text-soft">일정을 넣어 두면 나가기 전에 날씨와 챙길 것을 알려 드려요.</p>
                <div className="grid grid-cols-2 gap-2">
                  <TLink href="/timetable?from=/" kind="push" className={action}>
                    시간표 캡처로 넣기
                  </TLink>
                  <TLink href="/events/new?from=/" kind="push" className={actionPlain}>
                    직접 넣기
                  </TLink>
                </div>
              </>
            )}
          </Step>

          <SetupNotify code={code} notify={notify} />
        </ol>

        <div className="mt-8">
          <FinishButton code={code} ready={hasPlace && hasEvent} />
        </div>
      </main>
    </>
  );
}

// One thing to do. Done: a blue check in place of the number, "완료" on the right, a light-blue tint.
function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className={`rounded-2xl border p-4 ${done ? "border-transparent bg-sky" : "border-line"}`}>
      <div className="flex items-center gap-3">
        <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${done ? "bg-blue text-white" : "border-2 border-faint text-soft"}`}>
          {done ? <CheckIcon /> : n}
        </span>
        <h2 className="text-[17px] font-extrabold">{title}</h2>
        {done && <span className="ml-auto text-sm font-bold text-blue">완료</span>}
      </div>
      <div className="mt-2 pl-10">{children}</div>
    </li>
  );
}
