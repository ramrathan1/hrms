import { Plus } from "lucide-react";
import { useState } from "react";
import { CalendarMonth } from "@/components/CalendarMonth";
import { FormModal } from "@/components/crud";
import { PageHeader } from "@/components/PageHeader";
import { events } from "@/data/ops";
import { api } from "@/lib/api";
import { useToast } from "@/lib/store";

const COLOR_BY_KIND: Record<string, string> = {
  Meeting: "#5b5ceb", Social: "#e8983c", Release: "#e85d51", Client: "#1fa971", Other: "#3fa9f5",
};

export default function Events() {
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [items, setItems] = useState(() => [...events]);
  return (
    <>
      <PageHeader
        title="Events"
        actions={
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus size={15} /> Add Event
          </button>
        }
      />
      <CalendarMonth
        events={items}
        onDayClick={(d) => {
          setPickedDate(d);
          setOpen(true);
        }}
      />
      <FormModal
        open={open}
        title="Add Event"
        fields={[
          { key: "title", label: "Event Name", required: true, span: true },
          { key: "date", label: "Date", type: "date", required: true },
          { key: "kind", label: "Type", type: "select", options: Object.keys(COLOR_BY_KIND) },
          { key: "where", label: "Where", placeholder: "e.g. Lounge / Meeting Room Alpha" },
          { key: "description", label: "Description", type: "textarea" },
        ]}
        initial={{ date: pickedDate ?? "2026-09-05" }}
        submitLabel="Create Event"
        onSubmit={(v) => {
          const ev = { date: String(v.date), title: String(v.title), color: COLOR_BY_KIND[String(v.kind)] ?? "#5b5ceb" };
          setItems((its) => [...its, ev]);
          events.push(ev);
          void api.create("events", ev);
          push(`Event "${ev.title}" added to the calendar`);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
