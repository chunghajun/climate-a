"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addPlace } from "../actions/settings";
import { input } from "@/components/ui";
import PlacePicker from "./place-picker";

export default function PlaceAdder({ jsKey }: { jsKey: string }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [status, setStatus] = useState("");
  const [key, setKey] = useState(0); // remounts the picker after a save

  async function save(name: string, lat: number, lon: number) {
    const result = await addPlace(label.trim() || name, lat, lon);
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
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="직접 입력 (예: 집)" maxLength={20} className={input} />
      </div>
      <div>
        <p className="mb-1.5 text-sm font-semibold">2. 위치 찾기</p>
        <PlacePicker key={key} jsKey={jsKey} confirmLabel={label.trim() ? `'${label.trim()}'(으)로 저장` : "이 위치로 저장"} onPick={save} />
      </div>
      {status && <p className="text-sm text-muted">{status}</p>}
    </div>
  );
}
