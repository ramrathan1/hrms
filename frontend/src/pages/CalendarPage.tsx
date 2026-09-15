import { CalendarMonth } from "@/components/CalendarMonth";
import { PageHeader } from "@/components/PageHeader";
import { events } from "@/data/ops";
import { holidayEvents } from "@/lib/calendar";
import { tasks } from "@/data/work";

export default function CalendarPage() {
  const all = [
    ...events,
    ...holidayEvents(),
    ...tasks.filter((t) => t.status !== "Completed").map((t) => ({ date: t.due, title: t.code + " due", color: "#8b94a7" })),
  ];
  return (
    <>
      <PageHeader title="My Calendar" />
      <CalendarMonth events={all} />
    </>
  );
}
