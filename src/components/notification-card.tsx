"use client";

import { useEffect, useState } from "react";
import { removeSubscription, saveSubscription } from "@/app/actions/push";
import { useBrowserEnv } from "./browser-env";
import InstallGuide from "./install-guide";
import { btnPrimary, card } from "./ui";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

// mode "home": only asks for permission (hidden once notifications are on).
// mode "full": also shows that they are on and lets the tester turn them off.
export default function NotificationCard({ mode }: { mode: "home" | "full" }) {
  const env = useBrowserEnv();
  const [subscription, setSubscription] = useState<PushSubscription | null | undefined>(undefined);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (env !== "ok") return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        setSubscription(sub);
        // Re-save in case this browser subscribed before the tester signed in.
        if (sub) saveSubscription(JSON.parse(JSON.stringify(sub)), navigator.userAgent);
      })
      .catch((e) => setStatus(`서비스 워커 등록 실패: ${e}`));
  }, [env]);

  async function subscribe() {
    setBusy(true);
    setStatus("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("알림이 허용되지 않았어요. 폰 설정에서 알림을 켜 주세요.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim()),
      });
      await saveSubscription(JSON.parse(JSON.stringify(sub)), navigator.userAgent);
      setSubscription(sub);
      setStatus("알림 받을 준비가 됐어요!");
    } catch (e) {
      setStatus(`알림 설정 실패: ${e}`);
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    if (!subscription) return;
    await removeSubscription(subscription.endpoint);
    await subscription.unsubscribe();
    setSubscription(null);
    setStatus("알림을 껐어요.");
  }

  if (env === "loading" || (env === "ok" && subscription === undefined)) return null;
  if (mode === "home" && subscription) return null;

  // A안: on the 오늘 screen the ask is a slim grey banner with a blue 켜기.
  if (mode === "home" && env === "ok") {
    return (
      <div className="mb-4 rounded-[14px] bg-gray px-4 py-3 text-[13px] text-[#5a5a5a]">
        <div className="flex items-center justify-between gap-3">
          <span>알림을 켜면 기후 알람 시각에 가방을 알려 드려요.</span>
          <button onClick={subscribe} disabled={busy} className="flex-none font-bold text-blue disabled:opacity-50">
            켜기
          </button>
        </div>
        {status && <p className="mt-2 text-[12.5px]">{status}</p>}
      </div>
    );
  }

  return (
    <section className={card}>
      <h2 className="text-lg font-extrabold">{mode === "home" ? "알림을 켜 주세요" : "알림"}</h2>
      <div className="mt-3 space-y-3">
        <InstallGuide env={env} />

        {env === "ok" && !subscription && (
          <>
            <p className="text-muted">기후 알람 시각에 그날의 날씨와 챙길 것을 알려 드릴게요.</p>
            <button onClick={subscribe} disabled={busy} className={btnPrimary}>
              알림 받기
            </button>
          </>
        )}

        {env === "ok" && subscription && (
          <>
            <p className="text-sm font-semibold text-indigo">✓ 이 기기에서 알림이 켜져 있어요</p>
            <button onClick={unsubscribe} className="w-full py-2 text-sm text-muted underline">
              이 기기에서 알림 끄기
            </button>
          </>
        )}

        {status && <p className="rounded-lg bg-[#F0F0F0] px-3 py-2 text-sm">{status}</p>}
      </div>
    </section>
  );
}
