"use server";

import { createHash } from "node:crypto";
import webpush from "web-push";
import { FieldValue } from "firebase-admin/firestore";
import { logEvent, requireTester, testerRef } from "@/lib/data";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!.trim(),
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
  process.env.VAPID_PRIVATE_KEY!.trim()
);

function subId(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex").slice(0, 32);
}

export async function saveSubscription(sub: webpush.PushSubscription, userAgent: string) {
  const tester = await requireTester();
  const ref = testerRef(tester.code).collection("subscriptions").doc(subId(sub.endpoint));
  // The app re-saves the device on every visit; only a new device counts as subscribing.
  if ((await ref.get()).exists) return;
  await ref.set({ endpoint: sub.endpoint, keys: sub.keys, userAgent: userAgent.slice(0, 300), createdAt: FieldValue.serverTimestamp() });
  logEvent(tester.code, "push_subscribe", { ios: /iPhone|iPad/.test(userAgent) });
}

export async function removeSubscription(endpoint: string) {
  const tester = await requireTester();
  await testerRef(tester.code).collection("subscriptions").doc(subId(endpoint)).delete();
  await logEvent(tester.code, "push_unsubscribe");
}

// Sample messages for the three rain-probability levels.
const SAMPLES = {
  umbrella: {
    title: "☔ 곧 러닝하러 나가시죠?",
    body: "19시쯤 비 올 확률이 70%예요. 우산 꼭 챙겨 가세요!",
  },
  folding: {
    title: "🌂 16시 귀가길에 비가 올 수도 있어요",
    body: "비 올 확률 40%라서, 가방에 접이식 우산 하나 넣어두면 든든할 거예요.",
  },
  clear: {
    title: "🌤 수업 가는 길, 날씨 괜찮아요",
    body: "비 올 확률은 20% 정도예요. 가볍게 다녀오세요!",
  },
} as const;

export type SampleKind = keyof typeof SAMPLES;

export async function sendTestToMe(kind: SampleKind, delaySeconds: 0 | 10) {
  const tester = await requireTester();
  const sample = SAMPLES[kind];
  if (!sample) return { ok: false, error: "알 수 없는 알림 종류" };
  if (delaySeconds > 0) await new Promise((r) => setTimeout(r, 10_000));

  const subs = await testerRef(tester.code).collection("subscriptions").get();
  if (subs.empty) return { ok: false, error: "알림이 켜진 기기가 없어요" };

  let sent = 0;
  for (const doc of subs.docs) {
    const { endpoint, keys } = doc.data();
    try {
      await webpush.sendNotification(
        { endpoint, keys },
        JSON.stringify({ ...sample, tag: "test", url: "/" }),
        { TTL: 60, urgency: "high" }
      );
      sent++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      // 404/410 mean the browser dropped this subscription for good.
      if (status === 404 || status === 410) await doc.ref.delete();
      else console.error("push failed", status, error);
    }
  }
  await logEvent(tester.code, "push_test", { kind, sent });
  return sent > 0 ? { ok: true } : { ok: false, error: "전송 실패. 알림을 껐다가 다시 켜 주세요." };
}
