"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { saveNotify } from "@/app/actions/notify";
import { BellIcon } from "@/components/line-icons";
import { usePush } from "@/components/notification-card";
import type { Notify } from "@/lib/notify";

type Push = ReturnType<typeof usePush>;

const askedKey = (code: string) => `cm_notif_asked_${code}`;

// 앱을 처음 쓸 때 한 번, 다른 앱처럼 "알림을 받아 볼까요?" 팝업을 띄운다.
//  - 허용: 이어서 브라우저의 권한 창이 뜬다. 권한을 받으면 앱의 알림 스위치가 켜진 채로 시작한다 (설정에서 바꿀 수 있다).
//  - 나중에: 아무것도 바꾸지 않는다. 설정이나 오늘 화면의 안내에서 언제든 켤 수 있다.
// 이미 알림을 받는 기기, 알림을 받을 수 없는 브라우저, 이미 권한을 정한 기기에서는 뜨지 않는다.
export function NotifyPromptView({ push, code, initial }: { push: Push; code: string; initial: Notify }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { env, subscription } = push;

  useEffect(() => {
    if (env !== "ok" || subscription !== null) return; // can't take pushes, or already does (null = checked, none yet)
    if (typeof Notification === "undefined" || Notification.permission !== "default") return;
    try {
      if (localStorage.getItem(askedKey(code))) return;
    } catch {
      // No storage: ask again next time rather than never.
    }
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, [env, subscription, code]);

  async function answer(allow: boolean) {
    try {
      localStorage.setItem(askedKey(code), "1");
    } catch {
      // see above
    }
    setOpen(false);
    if (allow) {
      const granted = await push.subscribe();
      if (granted && !initial.on) await saveNotify({ ...initial, on: true });
      router.refresh();
    }
  }

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(20,24,34,.45)] px-8" role="dialog" aria-modal="true" aria-label="알림 허용">
      <div className="w-full max-w-[300px] overflow-hidden rounded-[22px] bg-white text-center shadow-[0_12px_40px_rgba(0,0,0,.2)]">
        <div className="px-6 pb-5 pt-7">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky text-blue">
            <BellIcon size={24} />
          </span>
          <h2 className="mt-4 text-[18px] font-extrabold">알림을 받아 볼까요?</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-soft">나가기 전에 챙길 것을 알려 드려요.</p>
        </div>
        <div className="grid grid-cols-2 border-t border-line text-[16px]">
          <button type="button" onClick={() => answer(false)} className="border-r border-line py-3.5 text-soft">
            나중에
          </button>
          <button type="button" onClick={() => answer(true)} className="py-3.5 font-extrabold text-blue">
            허용
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// 오늘 화면용: 이 기기의 알림 상태를 직접 읽는다.
export default function NotifyPrompt({ code, initial }: { code: string; initial: Notify }) {
  const push = usePush();
  return <NotifyPromptView push={push} code={code} initial={initial} />;
}
