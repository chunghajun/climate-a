import { listPlaces, requireTester } from "@/lib/data";
import BackHeader from "@/components/back-header";
import PlaceAdder from "../../settings/place-adder";

// 장소 저장만 하는 화면 (초기 설정과 오늘 화면에서 들어온다). 저장하면 `/`로 돌아간다.
export default async function NewPlacePage() {
  const tester = await requireTester();
  const places = (await listPlaces(tester.code)).filter((p) => p.favorite);
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pb-10 pt-6">
      <BackHeader href="/" title="자주 가는 장소" />
      <p className="mt-3 text-[15px] text-soft">
        집이나 학교처럼 자주 가는 곳을 저장하면 그 동네 날씨로 알려 드려요.{places.length === 0 && " 처음 저장한 곳이 기본 장소가 돼요."}
      </p>
      <PlaceAdder jsKey={process.env.KAKAO_JS_KEY ?? ""} doneHref="/" />
    </main>
  );
}
