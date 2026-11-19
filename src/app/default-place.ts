import type { Place } from "@/lib/types";

// 장소를 아직 저장하지 않은 사람에게 날씨를 보여 줄 기본 위치: 서울 도심(서울시청 근처).
// 저장된 장소가 하나라도 있으면 쓰지 않는다. 저장하지 않으므로 DB에는 아무것도 남지 않는다.
export const DEFAULT_PLACE: Place = { id: "default-seoul", label: "서울", lat: 37.5665, lon: 126.978, favorite: false };
