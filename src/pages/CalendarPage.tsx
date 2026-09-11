import { CalendarMonth } from "@/components/CalendarMonth";
import { PageHeader } from "@/components/PageHeader";
import { events } from "@/data/ops";
import { holidays } from "@/data/hr";
import { tasks } from "@/data/work";

export default function CalendarPage() {
  const all = [
    ...events,
    ...holidays.map((h) => ({ date: h.date, title: h.name, color: "#e8983c" })),
    ...tasks.filter((t) => t.status !== "Completed").map((t) => ({ date: t.due, title: t.code + " due", color: "#8b94a7" })),
  ];
  return (
    <>
      <PageHeader title="My Calendar" />
      <CalendarMonth events={all} />
    </>
  );
}
