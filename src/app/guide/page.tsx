import Link from "next/link";
import { getTester } from "@/lib/data";
import { OUTFITS } from "@/lib/advice";
import BackHeader from "@/components/back-header";
import { AdviceBadge, WeatherIcon } from "@/components/icons";
import { BellIcon, CameraIcon, InfoIcon } from "@/components/line-icons";
import { btnPrimary } from "@/components/ui";

// What only CliMate does — shown big.
const SIGNATURE: { title: string; body: string; why: string; visual: React.ReactNode }[] = [
  {
    title: "내 일정 맞춤 출발 알림",
    body: "기후 알람으로 정한 시각에, 그날 일정의 가는 길·일정 중·돌아오는 길 날씨까지 보고 알려 드려요.",
    why: "날씨 앱은 ‘지금 여기’만 알려 주지만, CliMate는 내 일정과 이동 시간을 알아요.",
    visual: <BellIcon size={26} className="text-blue" />,
  },
  {
    title: "오늘의 가방",
    body: "우산과 오늘 입을 옷(반팔·긴팔·두꺼운 겉옷·패딩 등)을 아이콘으로 정리해 드려요.",
    why: "강수확률·기온 숫자를 ‘무엇을 챙길지’로 바꿔 줘요.",
    visual: (
      <span className="flex gap-1">
        <AdviceBadge k="umbrella" size={26} />
        <AdviceBadge k="o5" size={26} />
      </span>
    ),
  },
  {
    title: "유동 일정 비 주의",
    body: "옮길 수 있다고 표시한 일정 시간에 비 소식이 있으면, 그 일정에 비가 온다고 미리 짚어 드려요.",
    why: "하루 날씨가 아니라 내 일정 시간의 날씨를 봐요.",
    visual: <WeatherIcon kind="rain" size={30} />,
  },
  {
    title: "날씨가 겹쳐 보이는 플래너",
    body: "오늘 · 이번 주 · 이번 달 화면에 일정과 날씨가 함께 보여요.",
    why: "달력 앱엔 날씨가, 날씨 앱엔 일정이 없죠. 한 화면에서 둘 다 봐요.",
    visual: (
      <span className="flex">
        <WeatherIcon kind="sun" size={26} />
        <WeatherIcon kind="rain" size={26} />
      </span>
    ),
  },
  {
    title: "캡처 한 장으로 일정 넣기",
    body: "에브리타임 시간표는 매주 반복으로, 다른 달력 앱 화면은 날짜별 일정으로 AI가 알아서 넣어 줘요.",
    why: "일정을 하나하나 칠 필요 없이, 저장 전에 확인만 하면 돼요.",
    visual: <CameraIcon size={26} className="text-blue" />,
  },
];

// Everything else — shown small.
const DETAILS: { group: string; items: [string, string][] }[] = [
  {
    group: "알림",
    items: [
      ["일정 알림", "켠 일정만, 시작 정각~3시간 전(5분 단위)에 알림. 날씨 알림과 시각이 겹치면 하나로 합쳐요."],
      ["받을 알림 고르기", "설정 → 받을 알림에서 우산·접이식·옷차림·폭염·일교차·일정 제안 알림을 켜고 꺼요. 화면 아이콘은 그대로 보여요."],
      ["알림 반응", "알림을 누르면 ‘챙겼어요 / 원래 있었어요 / 필요 없어요’로 알려 줄 수 있어요."],
    ],
  },
  {
    group: "일정",
    items: [
      ["일정 추가", "한 번 또는 매주 반복. 실내/야외, 옮길 수 있는지, 날씨 알림 받을 때를 정해요."],
      ["시간 미정", "시간을 몰라도 저장돼요. 시간을 정하면 출발 알림이 시작돼요."],
      ["이번만 쉬어요", "휴강처럼 반복 일정을 한 번만 빼요. 그날은 알림도 없어요."],
      ["캘린더 가져오기", "아이폰(공개 캘린더 링크)·구글(비공개 주소) 연결 시 앞으로 2주 일정을 1시간마다 가져와요."],
      ["전체 일정 보기", "+ 버튼에서 반복 일정과 한 번 일정을 모아 봐요."],
    ],
  },
  {
    group: "날씨",
    items: [
      ["시간별 날씨", "오늘 화면의 ‘시간별’에서 시간마다 비 확률·기온과 내 일정 시간대를 봐요."],
      ["이번 주 날씨", "요일별 최저~최고 기온 막대와 챙길 것 아이콘. 지난 날은 실제 측정값이에요."],
      ["장소별 날씨", "설정에서 동네·학교를 검색해 저장하면 일정마다 그 동네 날씨를 봐요."],
      ["예보 범위", "5일까지는 동네 단위 단기예보, 그 뒤 10일까지는 시·도 단위 중기예보예요."],
    ],
  },
];

const ICONS = [
  ["umbrella", "우산", "비 60% 이상 또는 1mm 이상"],
  ["folding", "접이식 우산", "비 30~50%"],
  ["range", "일교차 큼", "최고·최저 차이 10° 이상 (겉옷 안 입는 날만)"],
  ["heat", "폭염", "체감온도 33° 이상 (물·그늘)"],
] as const;

export default async function GuidePage() {
  const tester = await getTester();
  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-5 py-6">
      <BackHeader href="/" title="주요 기능" />
      <p className="text-sm leading-relaxed text-soft">CliMate는 내 일정에 맞춰 날씨를 보고, 나가기 전에 챙길 것을 알려 주는 플래너예요.</p>

      <section>
        <p className="mb-2 text-[11px] font-extrabold tracking-[.08em] text-coral">ONLY IN CLIMATE</p>
        <div className="space-y-2.5">
          {SIGNATURE.map((f, i) => (
            // 제목만 먼저 보이고, (i)를 누르면 설명이 펼쳐진다.
            <details key={f.title} className="group rounded-[22px] border border-line bg-white">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                <span className="flex h-11 w-[68px] flex-none items-center justify-center rounded-2xl bg-paper text-navy">{f.visual}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-extrabold text-coral">0{i + 1}</span>
                  <h2 className="font-serif text-[19px] font-bold leading-snug">{f.title}</h2>
                </span>
                <InfoIcon className="flex-none text-faint transition-colors group-open:text-blue" />
              </summary>
              <div className="px-4 pb-4">
                <p className="text-[14.5px] leading-relaxed">{f.body}</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{f.why}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      <details className="group rounded-[20px] border border-line bg-white px-4 py-3.5">
        <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
          <span className="text-[11px] font-extrabold tracking-[.08em] text-muted">ALL FEATURES · 모든 기능</span>
          <InfoIcon className="text-faint transition-colors group-open:text-blue" />
        </summary>
        {DETAILS.map((g) => (
          <div key={g.group} className="mt-3">
            <p className="text-[13px] font-extrabold">{g.group}</p>
            <ul className="mt-1 space-y-1.5">
              {g.items.map(([head, body]) => (
                <li key={head} className="text-xs leading-relaxed text-soft">
                  <b className="text-ink">{head}</b> · {body}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="mt-3">
          <p className="text-[13px] font-extrabold">챙길 것 아이콘</p>
          <ul className="mt-1.5 space-y-1.5">
            {ICONS.map(([k, name, rule]) => (
              <li key={k} className="flex items-center gap-2 text-xs text-soft">
                <AdviceBadge k={k} size={22} />
                <b className="text-ink">{name}</b> · {rule}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] font-extrabold">옷차림 (그날 기온 기준)</p>
          <ul className="mt-1.5 grid grid-cols-2 gap-1.5">
            {OUTFITS.map((o) => (
              <li key={o.key} className="flex items-center gap-2 text-xs text-soft">
                <AdviceBadge k={o.key} size={22} />
                <b className="text-ink">{o.label}</b> · {o.range}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-soft">외출 시간대 중 가장 낮은 기온으로 골라요. 어제보다 5° 이상 추우면 ↓ 표시가 붙어요.</p>
          <p className="mt-2 text-xs text-soft">
            <b className="text-hi">↑</b>최고 <b className="text-lo">↓</b>최저 기온 · 날씨는 기상청 예보 기준이에요.
          </p>
        </div>
      </details>

      <Link href="/" className={btnPrimary}>
        {tester ? "오늘 화면으로" : "시작하기"}
      </Link>
    </main>
  );
}
