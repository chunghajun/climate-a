import { redirect } from "next/navigation";
import { requireTester } from "@/lib/data";
import { giveConsent } from "../actions/auth";
import SubmitButton from "@/components/submit-button";
import { card } from "@/components/ui";

export default async function ConsentPage() {
  const tester = await requireTester({ consent: false });
  if (tester.consentAt) redirect("/");

  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 py-8">
      <h1 className="text-2xl font-extrabold">시작하기 전에</h1>
      <section className={`${card} space-y-4 leading-relaxed`}>
        <p>
          CliMate는 <b>대학 수업(디지털사회혁신) 팀 프로젝트</b>로 만든 테스트용 앱이에요. 2주 동안 써 보신 뒤 짧은
          인터뷰에 참여해 주시면 큰 도움이 돼요.
        </p>
        <div>
          <p className="font-bold">수집하는 정보</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            <li>테스터 코드 (이름·전화번호는 받지 않아요)</li>
            <li>입력한 일정: 제목, 시간, 실내/야외, 이동 시간</li>
            <li>캘린더를 연결한 경우, 앞으로 2주 일정의 제목과 시간</li>
            <li>저장한 장소의 대략적인 위치 (날씨 조회용)</li>
            <li>앱 사용 기록: 알림을 눌렀는지, 추천에 어떻게 반응했는지</li>
            <li>알림을 보내기 위한 기기 정보</li>
          </ul>
        </div>
        <div>
          <p className="font-bold">이렇게 써요</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            <li>날씨 알림을 보내고, 앱이 도움이 됐는지 연구하는 데만 써요.</li>
            <li>팀원만 볼 수 있고, 다른 곳에 넘기지 않아요.</li>
            <li>테스트가 끝나고 30일 안에 모두 삭제해요.</li>
            <li>언제든 그만두실 수 있고, 말씀해 주시면 바로 삭제해 드려요.</li>
          </ul>
        </div>
        <p className="text-sm text-muted">날씨 정보는 기상청 예보를 바탕으로 하며, 실제 날씨와 다를 수 있어요.</p>
      </section>
      <form action={giveConsent}>
        <SubmitButton>동의하고 시작하기</SubmitButton>
      </form>
    </main>
  );
}
