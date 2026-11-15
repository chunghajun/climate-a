// Firestore cache of KMA forecasts per grid: wx/{nx_ny} holds the last fetched base times,
// wx/{nx_ny}/days/{YYYY-MM-DD} holds hourly values. Keeping every hour also leaves a
// record of what was forecast and observed, for checking accuracy after the test.
import { FieldPath } from "firebase-admin/firestore";
import { db } from "./firebase";
import { kstNow } from "./time";
import {
  baseId,
  fetchNcst,
  fetchUltraFcst,
  fetchVilage,
  gridKey,
  ncstBase,
  ultraFcstBase,
  vilageBase,
  type DayWx,
  type Grid,
  type WxPatch,
} from "./kma";

function gridRef(grid: Grid) {
  return db().collection("wx").doc(gridKey(grid));
}

async function save(grid: Grid, patch: WxPatch) {
  const batch = db().batch();
  for (const [date, day] of Object.entries(patch)) {
    batch.set(gridRef(grid).collection("days").doc(date), day, { merge: true });
  }
  await batch.commit();
}

// Fetch whatever the KMA has published since the last refresh of this grid.
export async function refreshGrid(grid: Grid, now = new Date()) {
  const meta = (await gridRef(grid).get()).data() ?? {};
  const jobs = [
    { key: "vil", base: vilageBase(now), fetch: fetchVilage },
    { key: "uf", base: ultraFcstBase(now), fetch: fetchUltraFcst },
    { key: "nc", base: ncstBase(now), fetch: fetchNcst },
  ];
  const done: Record<string, string> = {};
  await Promise.all(
    jobs
      .filter((j) => meta[j.key] !== baseId(j.base))
      .map(async (j) => {
        try {
          await save(grid, await j.fetch(grid, j.base));
          done[j.key] = baseId(j.base);
        } catch (e) {
          console.error(`refresh ${gridKey(grid)} ${j.key}`, e);
        }
      })
  );
  if (Object.keys(done).length) await gridRef(grid).set({ ...done, nx: grid.nx, ny: grid.ny }, { merge: true });
}

// All cached days between two dates (inclusive) in one query.
export async function readRange(grid: Grid, from: string, to: string) {
  const snap = await gridRef(grid)
    .collection("days")
    .where(FieldPath.documentId(), ">=", from)
    .where(FieldPath.documentId(), "<=", to)
    .get();
  const out: Record<string, DayWx> = {};
  for (const s of snap.docs) {
    const d = s.data() as Partial<DayWx>;
    out[s.id] = { ...d, h: d.h ?? {} };
  }
  return out;
}

export async function readDays(grid: Grid, dates: string[]) {
  const snaps = await Promise.all(dates.map((d) => gridRef(grid).collection("days").doc(d).get()));
  const out: Record<string, DayWx> = {};
  snaps.forEach((s, i) => {
    if (s.exists) {
      const d = s.data() as Partial<DayWx>;
      out[dates[i]] = { ...d, h: d.h ?? {} };
    }
  });
  return out;
}

// Pages read the cache (kept fresh by the 5-minute cron) and only call the KMA
// themselves when a date is missing, e.g. right after a new place is saved.
export async function weatherFor(grid: Grid, dates: string[], refresh: "always" | "if-missing" = "if-missing") {
  if (refresh === "always") await refreshGrid(grid);
  const days = await readDays(grid, dates);
  const today = kstNow().date;
  if (refresh === "if-missing" && dates.includes(today) && !days[today]) {
    await refreshGrid(grid);
    return readDays(grid, dates);
  }
  return days;
}
