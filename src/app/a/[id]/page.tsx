import Link from "next/link";
import { notFound } from "next/navigation";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/lib/firebase";
import { logEvent, requireTester } from "@/lib/data";
import { reactToAlert, type Reaction } from "../../actions/alerts";
import type { Suggestion } from "@/lib/suggest";
import SuggestionCard from "@/components/suggestion-card";
import { card } from "@/components/ui";

const CHOICES: { value: Reaction; label: string }[] = [
  { value: "packed", label: "챙겼어요" },
  { value: "had", label: "원래 갖고 있었어요" },
  { value: "skip", label: "필요 없어요" },
];

// Opened from a notification: shows the alert again and asks what the tester did.
export default async function AlertPage({ params }: PageProps<"/a/[id]">) {
  const { id } = await params;
  const tester = await requireTester();
  const ref = db().collection("alerts").doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.code !== tester.code) notFound();
  const alert = snap.data()!;

  if (!alert.openedAt) {
    await ref.update({ openedAt: FieldValue.serverTimestamp() });
    await logEvent(tester.code, "alert_open", { alertId: id });
  }

  const hours: { h: number; pop: number | null; temp: number | null }[] = alert.hours ?? [];
  const suggestionSnaps = await Promise.all(
    ((alert.eventIds ?? []) as string[]).map((eid) => db().collection("suggestions").doc(`${tester.code}_${alert.date}_${eid}`).get())
  );
  const suggestions: Suggestion[] = suggestionSnaps
    .filter((s) => s.exists && !s.data()!.choice)
    .map((s) => {
      const d = s.data()!;
      return { id: d.id, eventId: d.eventId, date: d.date, title: d.title, start: d.start, end: d.end, pop: d.pop, moves: d.moves };
    });

  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 py-6">
      <header className="flex items-center gap-3">
        <Link href="/" className="text-2xl text-muted" aria-label="홈으로">
          ‹
        </Link>
        <p className="text-sm font-semibold text-muted">{alert.titles?.join(", ")}</p>
      </header>

      <section className={card}>
        <h1 className="text-lg font-extrabold leading-snug">{alert.title}</h1>
        <p className="mt-2 leading-relaxed">{alert.body}</p>
        {hours.length > 0 && (
          <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
            {hours.map((x) => (
              <div key={x.h} className="min-w-14 rounded-xl bg-paper px-2 py-2 text-center text-xs">
                <p className="font-semibold text-muted">{x.h}시</p>
                <p className={`mt-1 font-bold ${(x.pop ?? 0) >= 30 ? "text-indigo" : ""}`}>{x.pop ?? "-"}%</p>
                <p className="text-muted">{x.temp ?? "-"}°</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {suggestions.map((s) => (
        <SuggestionCard key={s.id} s={s} />
      ))}

      <section className={card}>
        <h2 className="font-extrabold">알림을 보고 어떻게 하셨어요?</h2>
        <div className="mt-3 space-y-2">
          {CHOICES.map((c) => (
            <form key={c.value} action={reactToAlert.bind(null, id, c.value)}>
              <button
                type="submit"
                className={`w-full rounded-xl border py-3 font-semibold ${
                  alert.reaction === c.value ? "border-indigo bg-indigo text-white" : "border-line"
                }`}
              >
                {c.label}
              </button>
            </form>
          ))}
        </div>
        {alert.reaction && <p className="mt-3 text-sm text-muted">알려 주셔서 고마워요! 다음 알림에 참고할게요.</p>}
      </section>
    </main>
  );
}
