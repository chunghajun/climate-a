"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CloseIcon } from "@/components/line-icons";
import { btnPrimary } from "@/components/ui";

// 초기 설정 상태는 이 기기의 쿠키에만 남긴다 (서버 데이터는 건드리지 않는다). 값은 테스터 코드라서
// 같은 기기를 다른 테스터가 쓰면 그 테스터에게는 다시 보인다.
//   cm_setup    = 마치기(또는 ×)를 눌렀다
//   cm_setup_on = 이 기기에서 초기 설정 화면을 열었다 (이미 쓰던 테스터에게는 화면이 뜨지 않게 하려는 표시)
const YEAR = 60 * 60 * 24 * 365;
const set = (name: string, code: string) => {
  document.cookie = `${name}=${encodeURIComponent(code)}; path=/; max-age=${YEAR}; samesite=lax`;
};

export function MarkSetupSeen({ code }: { code: string }) {
  useEffect(() => {
    set("cm_setup_on", code);
  }, [code]);
  return null;
}

function useFinish(code: string) {
  const router = useRouter();
  return () => {
    set("cm_setup", code);
    router.refresh();
  };
}

export function FinishButton({ code, ready }: { code: string; ready: boolean }) {
  const finish = useFinish(code);
  return (
    <button type="button" onClick={finish} className={btnPrimary}>
      {ready ? "마치기" : "나중에 하고 시작하기"}
    </button>
  );
}

export function FinishX({ code }: { code: string }) {
  const finish = useFinish(code);
  return (
    <button type="button" onClick={finish} aria-label="초기 설정 닫기" className="-mr-2 p-2 text-soft">
      <CloseIcon />
    </button>
  );
}
