import { listPlaces, requireTester } from "@/lib/data";
import BackHeader from "@/components/back-header";
import TimetableForm from "./timetable-form";

// Reading a screenshot with Claude can take a while.
export const maxDuration = 60;

export default async function TimetablePage({ searchParams }: PageProps<"/timetable">) {
  const tester = await requireTester();
  const sp = await searchParams;
  const from = typeof sp.from === "string" ? sp.from : "/";
  const places = (await listPlaces(tester.code)).filter((p) => p.favorite);

  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-5 py-6">
      <BackHeader href={from} title="캡처로 일정 넣기" />
      <TimetableForm places={places} from={from} />
    </main>
  );
}
