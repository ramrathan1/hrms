import { Plus } from "lucide-react";
import { useState } from "react";
import { CalendarMonth } from "@/components/CalendarMonth";
import { can } from "@/lib/api";
import { FormModal } from "@/components/crud";
import { PageHeader } from "@/components/PageHeader";
import { events } from "@/data/ops";
import { HOLIDAY_COLOR, holidayEvents } from "@/lib/calendar";
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
  /* Holidays are drawn here too, so the month on screen is the month people
     actually work. They are not editable from this page — the list is HR's,
     under HR › Holidays. */
  const shown = [...items, ...holidayEvents()];
  return (
    <>
      <PageHeader
        title="Events"
        actions={
          can("events:create") ? (
            <button className="btn-primary" onClick={() => setOpen(true)}>
              <Plus size={15} /> Add Event
            </button>
          ) : undefined
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted">
        {Object.entries(COLOR_BY_KIND).map(([kind, color]) => (
          <span key={kind} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            {kind}
          </span>
        ))}
        <span className="flex items-center gap-1.5 font-semibold">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: HOLIDAY_COLOR }} />
          Holiday
        </span>
      </div>
      <CalendarMonth
        events={shown}
        /* Clicking a day opened the Add Event form for everyone, including
           people whose accounts cannot create one — the save would 403. */
        onDayClick={
          can("events:create")
            ? (d) => {
                setPickedDate(d);
                setOpen(true);
              }
            : undefined
        }
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
