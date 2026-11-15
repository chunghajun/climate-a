"use client";

import type { BrowserEnv } from "./browser-env";

export default function InstallGuide({ env }: { env: BrowserEnv }) {
  if (env === "inapp") {
    return (
      <Guide title="다른 브라우저로 열어 주세요">
        카톡·인스타 같은 앱 안의 브라우저에서는 알림을 받을 수 없어요. 오른쪽 위(또는 아래) 메뉴에서{" "}
        <b>&quot;다른 브라우저로 열기&quot;</b>를 눌러 <b>크롬</b>(안드로이드)이나 <b>사파리</b>(아이폰)로 열어 주세요.
      </Guide>
    );
  }
  if (env === "ios-browser") {
    return (
      <Guide title="아이폰은 홈 화면에 먼저 추가해 주세요">
        <ol className="mt-1 list-decimal space-y-1 pl-5">
          <li>
            아래쪽 <b>공유 버튼</b>(네모에 위쪽 화살표)을 눌러요
          </li>
          <li>
            <b>&quot;홈 화면에 추가&quot;</b> → <b>추가</b>를 눌러요
          </li>
          <li>
            사파리를 닫고, 홈 화면의 <b>CliMate 아이콘</b>으로 다시 열어요
          </li>
        </ol>
        <p className="mt-2 text-sm text-muted">iOS 16.4 이상에서만 알림을 받을 수 있어요.</p>
      </Guide>
    );
  }
  if (env === "unsupported") {
    return (
      <Guide title="이 브라우저는 알림을 지원하지 않아요">
        안드로이드는 <b>크롬</b>, 아이폰은 <b>사파리에서 홈 화면에 추가</b>한 뒤 열어 주세요.
      </Guide>
    );
  }
  return null;
}

function Guide({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-indigo/10 p-4 leading-relaxed">
      <p className="font-bold">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
