import { notFound } from "next/navigation";
import { getEvent, listPlaces, requireTester } from "@/lib/data";
import { upcomingDates } from "@/lib/events";
import { kstNow } from "@/lib/time";
import BackHeader from "@/components/back-header";
import { deleteEvent } from "../../actions/events";
import EventForm from "../event-form";

export default async function EditEventPage({ params, searchParams }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const from = typeof sp.from === "string" ? sp.from : "/";
  const tester = await requireTester();
  const [event, places] = await Promise.all([getEvent(tester.code, id), listPlaces(tester.code)]);
  if (!event) notFound();

  return (
    <main className="mx-auto w-full max-w-md flex-1 space-y-4 px-5 py-6">
      <BackHeader href={from} title="일정 수정" />
      {event.source === "ics" && (
        <p className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-soft">
          캘린더에서 가져온 일정이에요. 제목과 시간은 캘린더에서 바꿔 주세요. 여기서는 실내/야외, 장소, 날씨 알림 받을 때를 정할 수 있어요.
        </p>
      )}
      <EventForm
        event={event}
        places={places}
        defaultDate={kstNow().date}
       
        upcoming={upcomingDates(event, kstNow().date)}
        from={from}
        jsKey={process.env.KAKAO_JS_KEY ?? ""}
      />
      <form action={deleteEvent.bind(null, event.id, from)}>
        <button type="submit" className="w-full py-3 text-sm font-semibold text-coral">
          이 일정 삭제
        </button>
      </form>
    </main>
  );
}
