import { listPlaces, requireTester } from "@/lib/data";
import { kstNow } from "@/lib/time";
import BackHeader from "@/components/back-header";
import EventForm from "../event-form";

export default async function NewEventPage({ searchParams }: PageProps<"/events/new">) {
  const tester = await requireTester();
  const sp = await searchParams;
  const from = typeof sp.from === "string" ? sp.from : "/";
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : kstNow().date;
  const places = await listPlaces(tester.code);

  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-5 py-6">
      <BackHeader href={from} title="일정 추가" />
      <EventForm places={places} defaultDate={date} from={from} jsKey={process.env.KAKAO_JS_KEY ?? ""} />
    </main>
  );
}
