import { daysLabel } from "@/lib/alarms";
import { listPlaces, requireTester } from "@/lib/data";
import type { AlertPrefs } from "@/lib/types";
import { logout } from "../actions/auth";
import { deletePlace, saveAlertPrefs } from "../actions/settings";
import PageHeader, { GuideButton } from "@/components/page-header";
import { AdviceBadge } from "@/components/icons";
import NotifySettings from "./notify-settings";
import SubmitButton from "@/components/submit-button";
import { btnSecondary, card } from "@/components/ui";
import CalendarConnect from "./calendar-connect";
import PlaceAdder from "./place-adder";

const ALERTS: { key: keyof AlertPrefs; title: string; sub: string }[] = [
  { key: "umbrella", title: "우산", sub: "비 올 확률 60% 이상이거나 비가 1mm 이상 올 때" },
  { key: "folding", title: "접이식 우산", sub: "비 올 확률 30~50%일 때" },
  { key: "outfit", title: "옷차림", sub: "그날 입으면 좋을 옷을 알려요. 어제보다 5° 이상 추우면 따로 짚어 드려요" },
  { key: "heat", title: "폭염", sub: "체감온도 33° 이상일 때, 물과 그늘을 챙기라고 알려요" },
  { key: "range", title: "일교차", sub: "하루 최고·최저 차이가 10° 이상일 때. 이미 겉옷을 입을 만큼 쌀쌀한 날은 빼요" },
  { key: "suggestion", title: "일정 바꾸기 제안", sub: "옮길 수 있는 야외 일정에 비가 오면 바로 알려요 (밤 10시~아침 7시 제외, 2시간 전까지)" },
];

export default async function SettingsPage() {
  const tester = await requireTester();
  const places = (await listPlaces(tester.code)).filter((p) => p.favorite);

  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-5 pb-28 pt-7">
      <PageHeader title="설정" right={<GuideButton />} />

      <NotifySettings
        initial={tester.notify}
        alarmsLabel={
          tester.alarms.filter((a) => a.on).length
            ? tester.alarms
                .filter((a) => a.on)
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((a) => `${daysLabel(a.days)} ${a.time}`)
                .join(" · ")
            : "켜 둔 시각이 없어요"
        }
      />

      {/* what goes into the alerts — only meaningful while 알림 is on */}
      {tester.notify.on && (
        <section className={card}>
          <h2 className="font-serif text-lg font-bold">받을 알림</h2>
          <p className="mt-1 text-sm text-soft">알림에 넣을 내용을 골라요. 꺼도 앱 화면의 아이콘은 그대로 보여요.</p>
          <form action={saveAlertPrefs} className="mt-3">
            <div className="divide-y divide-line">
              {ALERTS.map((a) => (
                <label key={a.key} className="flex cursor-pointer items-center gap-3 py-3">
                  {a.key === "suggestion" ? (
                    <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[10px] bg-sky text-sm text-blue">↻</span>
                  ) : (
                    <AdviceBadge k={a.key === "outfit" ? "o5" : a.key} size={30} />
                  )}
                  <span className="min-w-0 flex-1">
                    <b className="block text-[14.5px]">{a.title}</b>
                    <span className="block text-xs text-muted">{a.sub}</span>
                  </span>
                  <input type="checkbox" name={a.key} defaultChecked={tester.alertPrefs[a.key]} className="peer sr-only" />
                  <span className="relative h-7 w-12 flex-none rounded-full bg-[#E4E4E4] transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-navy peer-checked:after:translate-x-5" />
                </label>
              ))}
            </div>
            <div className="mt-2">
              <SubmitButton className={btnSecondary}>알림 설정 저장</SubmitButton>
            </div>
          </form>
        </section>
      )}

      <section id="places" className={card}>
        <h2 className="font-serif text-lg font-bold">즐겨찾기 장소</h2>
        <p className="mt-1 text-sm text-soft">
          일정을 넣을 때 바로 고를 수 있어요. 처음 저장한 곳이 <b>기본 장소</b>가 되고, 오늘 화면 날씨도 이 동네 기준이에요.
        </p>
        {places.length > 0 && (
          <ul className="mt-3 space-y-2">
            {places.map((p, i) => (
              <li key={p.id} className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
                <span className="font-semibold">
                  {p.label}
                  {i === 0 && <span className="ml-2 rounded-full bg-navy/10 px-2 py-0.5 text-xs text-navy">기본</span>}
                </span>
                <form action={deletePlace.bind(null, p.id)}>
                  <button type="submit" className="text-sm text-muted underline">
                    삭제
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <PlaceAdder jsKey={process.env.KAKAO_JS_KEY ?? ""} />
      </section>

      <section id="calendar" className={card}>
        <h2 className="font-serif text-lg font-bold">캘린더 가져오기</h2>
        <p className="mt-1 text-sm text-soft">쓰고 있는 캘린더의 일정을 자동으로 가져와요.</p>
        <CalendarConnect url={tester.icsUrl} lastSync={tester.icsLastSync} />
      </section>

      <section className={`${card} text-sm text-soft`}>
        <p>
          내 코드: <b className="font-mono text-navy">{tester.code}</b>
        </p>
        <p className="mt-1 text-xs">다른 기기에서 이어 쓰거나 다시 로그인할 때 이 코드를 입력하세요.</p>
        <form action={logout} className="mt-3">
          <button type="submit" className="underline">
            로그아웃
          </button>
        </form>
      </section>
    </main>
  );
}
