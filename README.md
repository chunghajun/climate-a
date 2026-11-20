# CliMate A

내 일정에 맞춰 날씨를 보고, 나가기 전에 챙길 것을 알려 주는 일정·날씨 앱이에요.
디지털사회혁신 팀 프로젝트(일단해보조)의 두 번째 버전(A안 디자인)입니다.

- 실제 앱: https://climate-a.vercel.app (휴대폰에서 열어 홈 화면에 추가해서 쓰는 웹앱)
- 날씨: 기상청 단기·중기예보 · 장소: 카카오 로컬 · 시간표 캡처 읽기: Claude

## 주요 기능

| 화면 | 기능 |
|---|---|
| 오늘 | 오늘의 가방(챙길 것 체크, 내 물건 직접 추가), 지금 날씨와 시간별 날씨, 이번 주 날씨, 일정 타임라인 |
| 달력 | 한 장의 달력을 두 손가락으로 늘이면 점 → 막대 → 블록 → 주간 → **주간 시간표**(0–24시, 좌우로 주 넘기기) |
| 처음 시작 | 간단한 동의, 초기 설정(장소·일정·알림), 알림 허용 팝업 |
| 일정 넣기 | 직접 입력(한 번/매주 반복, 시간 미정), 시간표·달력 캡처로 한 번에 넣기, 캘린더(iCloud·Google) 연결 |
| 알림 | 알림 켜기/끄기, **첫 외출 몇 분 전** 또는 **정한 시각(기후 알람)**, 일정 알림, 옮길 수 있는(유동) 일정의 비 주의 |
| 설정 | 받을 알림 종류, 즐겨찾기 장소, 캘린더 연결, 테스터 코드 |

## 기술 구성

- **Next.js 16 (App Router) + React 19 + Tailwind CSS 4**, 서버 액션으로 데이터 저장
- **Firebase Firestore** (firebase-admin, 서버에서만 접근)
- **Web Push** (VAPID)로 알림, **Vercel**에 배포
- **cron-job.org**가 5분마다 `/api/cron`을 불러서 알림을 보내요 (차례가 된 테스터만 확인)

## 폴더 안내

```
src/
  app/
    page.tsx              오늘 화면
    today-bag.tsx         오늘의 가방
    today-weather.tsx     오늘 날씨 카드
    calendar/             달력 · 주간 시간표 (calendar-view.tsx)
    events/               일정 추가 · 수정
    timetable/            캡처로 일정 넣기
    alarms/               기후 알람(정한 시각)
    settings/             설정 (notify-settings.tsx = 알림 켜기/끄기와 방식)
    a/[id]/               알림을 눌렀을 때 뜨는 화면
    api/cron/route.ts     알림 보내는 서버 작업
    actions/              서버 액션 (저장·삭제 등)
  components/             공통 부품 (탭 막대, + 버튼, 시트, 아이콘 …)
  lib/                    날씨(kma, mid, weather), 일정 계산(plan, outing), 알림 설정(notify, alarms), 데이터(data)
scripts/
  make-codes.mjs          테스터 코드 만들기
  status.mjs              테스트 현황 보기
```

## 내 컴퓨터에서 실행하기

1. Node.js 20 이상을 설치하고 `npm install`
2. 프로젝트 폴더에 `.env.local` 파일을 만들고 아래 값을 채워요 (값은 팀 내부에서 따로 받아요. **절대 저장소에 올리지 마세요.**)

| 이름 | 설명 | 받는 곳 |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase 서비스 계정 JSON을 base64로 인코딩한 값 | Firebase 콘솔 › 프로젝트 설정 › 서비스 계정 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | 웹 푸시 키 (`npx web-push generate-vapid-keys`) | 직접 생성 |
| `CRON_SECRET` | `/api/cron`을 부를 때 쓰는 비밀값 | 직접 생성 |
| `KMA_SERVICE_KEY` | 기상청 단기·중기예보 (일반 인증키 Decoding) | 공공데이터포털 |
| `KAKAO_REST_KEY`, `KAKAO_JS_KEY` | 장소 검색 · 지도 | 카카오 개발자 |
| `ANTHROPIC_API_KEY` | 시간표 캡처 읽기 | Anthropic Console |

3. `npm run dev` 후 http://localhost:3000

## 배포

Vercel에 연결해서 배포하고, 위 환경 변수를 Vercel 프로젝트 설정에 같은 이름으로 넣어요.
cron-job.org에 `https://<배포 주소>/api/cron?key=<CRON_SECRET>`를 5분마다 부르는 작업을 만들면 알림이 동작해요.
