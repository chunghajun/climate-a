import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase";
import { logEvent } from "./data";
import type { Suggestion } from "./suggest";

// Records the first time each suggestion is shown (for H3) and returns the ones
// the tester has not answered yet.
export async function openSuggestions(code: string, list: Suggestion[], via: "home" | "alert") {
  if (!list.length) return [];
  const col = db().collection("suggestions");
  const snaps = await Promise.all(list.map((s) => col.doc(s.id).get()));
  const open: Suggestion[] = [];
  await Promise.all(
    list.map(async (s, i) => {
      const snap = snaps[i];
      if (snap.exists) {
        if (!snap.data()!.choice) open.push(s);
        return;
      }
      await col.doc(s.id).create({ ...s, code, via, shownAt: FieldValue.serverTimestamp() }).catch(() => {});
      await logEvent(code, "suggestion_shown", { id: s.id, moves: s.moves.length, via });
      open.push(s);
    })
  );
  return open;
}
