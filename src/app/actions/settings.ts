"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { logEvent, requireTester, testerRef, wakeCron } from "@/lib/data";
import { normalizeIcsUrl, syncIcs } from "@/lib/ics";

export async function addPlace(label: string, lat: number, lon: number) {
  const tester = await requireTester();
  wakeCron(tester.code);
  const name = label.trim().slice(0, 20);
  // Only places inside (roughly) South Korea can be forecast by the KMA grid.
  if (!name || !(lat > 32 && lat < 39.5 && lon > 124 && lon < 132)) {
    return { ok: false, error: "국내 위치만 저장할 수 있어요" };
  }
  await testerRef(tester.code)
    .collection("places")
    .add({ label: name, lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)), favorite: true, createdAt: FieldValue.serverTimestamp() });
  await logEvent(tester.code, "place_add", { label: name });
  revalidatePath("/settings");
  return { ok: true };
}

export type PlaceResult = { name: string; address: string; category: string; lat: number; lon: number };

async function kakaoLocal<T>(path: string, query: string, size: number): Promise<T[]> {
  const params = new URLSearchParams({ query, size: String(size) });
  const res = await fetch(`https://dapi.kakao.com/v2/local/search/${path}.json?${params}`, {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_KEY}` },
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`kakao ${path} ${res.status}`);
  return (await res.json()).documents as T[];
}

// Place search (Kakao Local): area names like "안암동" come from the address search,
// shops/buildings like "안암역 스타벅스" from the keyword search.
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  await requireTester();
  const q = query.trim().slice(0, 50);
  if (!q) return [];
  try {
    const [areas, spots] = await Promise.all([
      kakaoLocal<{ address_name: string; address_type: string; x: string; y: string }>("address", q, 2),
      kakaoLocal<{ place_name: string; road_address_name: string; address_name: string; category_group_name: string; x: string; y: string }>("keyword", q, 8),
    ]);
    return [
      ...areas.map((a) => ({
        name: a.address_name.split(" ").pop()!,
        address: a.address_name,
        category: a.address_type === "REGION" ? "동네" : "주소",
        lat: Number(a.y),
        lon: Number(a.x),
      })),
      ...spots.map((s) => ({
        name: s.place_name,
        address: s.road_address_name || s.address_name,
        category: s.category_group_name,
        lat: Number(s.y),
        lon: Number(s.x),
      })),
    ];
  } catch (e) {
    console.error("place search failed", e);
    return [];
  }
}

export async function deletePlace(id: string) {
  const tester = await requireTester();
  wakeCron(tester.code);
  await testerRef(tester.code).collection("places").doc(id).delete();
  revalidatePath("/settings");
}

export async function connectCalendar(rawUrl: string) {
  const tester = await requireTester();
  wakeCron(tester.code);
  const url = normalizeIcsUrl(rawUrl);
  if (!url) return { ok: false, error: "아이폰(iCloud)이나 구글 캘린더의 공유 링크를 넣어 주세요." };
  try {
    const count = await syncIcs(tester.code, url);
    await testerRef(tester.code).update({ icsUrl: url });
    await logEvent(tester.code, "ics_connect", { host: new URL(url).hostname, count });
    revalidatePath("/settings");
    return { ok: true, count };
  } catch (e) {
    console.error("ics connect failed", e);
    return { ok: false, error: "캘린더를 읽지 못했어요. 링크를 다시 확인해 주세요." };
  }
}

export async function syncCalendarNow() {
  const tester = await requireTester();
  wakeCron(tester.code);
  if (!tester.icsUrl) return { ok: false, error: "연결된 캘린더가 없어요." };
  try {
    const count = await syncIcs(tester.code, tester.icsUrl);
    revalidatePath("/settings");
    return { ok: true, count };
  } catch {
    return { ok: false, error: "캘린더를 읽지 못했어요. 잠시 뒤 다시 해 주세요." };
  }
}

export async function disconnectCalendar() {
  const tester = await requireTester();
  wakeCron(tester.code);
  const imported = await testerRef(tester.code).collection("events").where("source", "==", "ics").get();
  const batch = testerRef(tester.code).firestore.batch();
  imported.docs.forEach((d) => batch.delete(d.ref));
  batch.update(testerRef(tester.code), { icsUrl: null, icsLastSync: null });
  await batch.commit();
  await logEvent(tester.code, "ics_disconnect");
  revalidatePath("/settings");
}

export async function saveAlertPrefs(formData: FormData) {
  const tester = await requireTester();
  wakeCron(tester.code);
  const keys = ["umbrella", "folding", "outfit", "heat", "range", "suggestion"] as const;
  const alertPrefs = Object.fromEntries(keys.map((k) => [k, formData.get(k) === "on"]));
  await testerRef(tester.code).update({ alertPrefs });
  logEvent(tester.code, "alert_prefs", alertPrefs);
  revalidatePath("/settings");
}
