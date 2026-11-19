"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addPlace } from "../actions/settings";
import { input } from "@/components/ui";
import PlacePicker from "./place-picker";

// doneHref: where to go once a place is saved (the 장소 저장 screen); without it the form stays
// open for another place (설정).
export default function PlaceAdder({ jsKey, doneHref }: { jsKey: string; doneHref?: string }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState("");
  const [key, setKey] = useState(0); // remounts the picker after a save

  async function save(name: string, lat: number, lon: number) {
    const result = await addPlace(label.trim() || name, lat, lon);
    if (result.ok && doneHref) {
      router.push(doneHref);
      router.refresh();
      return;
    }
    if (result.ok) {
      setLabel("");
      setKey((k) => k + 1);
      setStatus("저장했어요!");
      router.refresh();
    } else setStatus(result.error ?? "저장 실패");
  }

  return (
    <div className="mt-4 space-y-3 border-t border-line pt-4">
      <div>
        <p className="mb-1.5 text-sm font-semibold">1. 이름 정하기</p>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="직접 입력 (예: 본가, 자취방)" maxLength={20} className={input} />
      </div>
      <div>
        <p className="mb-1.5 text-sm font-semibold">2. 위치 찾기</p>
        <p className="mb-2 text-[13px] text-soft">이 장소의 날씨를 확인하는 데만 써요. 집 주소가 걱정되면 근처 역이나 건물을 적어도 괜찮아요.</p>
        <PlacePicker key={key} jsKey={jsKey} confirmLabel={label.trim() ? `'${label.trim()}'(으)로 저장` : "이 위치로 저장"} onPick={save} />
      </div>
      {status && <p className="text-sm text-muted">{status}</p>}
    </div>
  );
}
