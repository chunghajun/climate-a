import { redirect } from "next/navigation";

// 이번 주 and 이번 달 are one calendar now.
export default function WeekPage() {
  redirect("/calendar");
}
