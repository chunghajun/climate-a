"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { login, startNew } from "./actions/auth";
import { useBrowserEnv } from "@/components/browser-env";
import InstallGuide from "@/components/install-guide";
import SubmitButton from "@/components/submit-button";
import { btnPrimary, card, input } from "@/components/ui";

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const [showCode, setShowCode] = useState(false);
  const env = useBrowserEnv();

  return (
    <div className="space-y-4">
      {/* iPhone keeps the home-screen app's login separate from Safari, so install first. */}
      {(env === "ios-browser" || env === "inapp") && <InstallGuide env={env} />}

      <form action={startNew} className={card}>
        <p className="text-lg font-extrabold">처음이신가요?</p>
        <p className="mt-1 text-sm text-muted">가입 없이 바로 시작할 수 있어요.</p>
        <div className="mt-4">
          <SubmitButton>바로 시작하기</SubmitButton>
        </div>
        <Link href="/guide" className="mt-3 block text-center text-sm font-semibold text-navy">
          어떤 앱인지 먼저 보기 ›
        </Link>
      </form>

      {!showCode ? (
        <button onClick={() => setShowCode(true)} className="w-full py-2 text-sm text-muted underline">
          테스터 코드가 있어요
        </button>
      ) : (
        <form action={action} className={card}>
          <label htmlFor="code" className="font-extrabold">
            테스터 코드로 시작하기
          </label>
          <p className="mt-1 text-sm text-muted">받은 코드나, 다른 기기에서 쓰던 내 코드(설정 화면 맨 아래)를 입력해 주세요.</p>
          <input
            id="code"
            name="code"
            placeholder="CM-XXXXXX"
            autoCapitalize="characters"
            autoComplete="off"
            required
            className={`${input} mt-4 font-mono tracking-wider`}
          />
          {state?.error && <p className="mt-2 text-sm font-semibold text-coral">{state.error}</p>}
          <button type="submit" disabled={pending} className={`${btnPrimary} mt-4`}>
            {pending ? "확인 중…" : "시작하기"}
          </button>
        </form>
      )}
    </div>
  );
}
