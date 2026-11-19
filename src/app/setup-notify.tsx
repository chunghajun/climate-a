"use client";

import InstallGuide from "@/components/install-guide";
import { CheckIcon } from "@/components/line-icons";
import { usePush } from "@/components/notification-card";
import { NotifyPromptView } from "@/components/notify-prompt";
import { btnPrimary } from "@/components/ui";
import type { Notify } from "@/lib/notify";

// 초기 설정의 세 번째 카드. 기기의 알림 구독 상태를 그대로 따른다 (이미 켜져 있으면 완료).
export default function SetupNotify({ code, notify }: { code: string; notify: Notify }) {
  const push = usePush();
  const { env, subscription, status, busy, subscribe } = push;
  const on = env === "ok" && !!subscription;
  return (
    <li className={`rounded-2xl border p-4 ${on ? "border-transparent bg-sky" : "border-line"}`}>
      <NotifyPromptView push={push} code={code} initial={notify} />
      <div className="flex items-center gap-3">
        <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${on ? "bg-blue text-white" : "border-2 border-faint text-soft"}`}>
          {on ? <CheckIcon /> : 3}
        </span>
        <h2 className="text-[17px] font-extrabold">알림</h2>
        {on && <span className="ml-auto text-sm font-bold text-blue">완료</span>}
      </div>
      <div className="mt-2 pl-10">
        {on ? (
          <p className="text-[15px] font-bold">이 기기에서 알림을 받아요</p>
        ) : (
          <>
            <p className="text-[15px] text-soft">알림을 켜면 그날 챙길 것을 미리 알려 드려요.</p>
            {env === "ok" ? (
              <button type="button" onClick={subscribe} disabled={busy || subscription === undefined} className={`${btnPrimary} mt-3 !py-3 text-[15px]`}>
                알림 받기
              </button>
            ) : (
              env !== "loading" && (
                <div className="mt-3">
                  <InstallGuide env={env} />
                </div>
              )
            )}
            {status && <p className="mt-2 text-sm text-soft">{status}</p>}
          </>
        )}
      </div>
    </li>
  );
}
