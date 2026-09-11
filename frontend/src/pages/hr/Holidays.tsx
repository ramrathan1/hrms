import { Plus } from "lucide-react";
import { CalendarMonth } from "@/components/CalendarMonth";
import { useCrud } from "@/components/crud";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { holidays } from "@/data/hr";
import { fmtDate } from "@/lib/format";
import { useToast } from "@/lib/store";

const seed = holidays.map((h, i) => ({ id: `hd${i + 1}`, ...h }));

export default function Holidays() {
  const { push } = useToast();
  const crud = useCrud({
    collection: "holidays",
    seed,
    itemName: "Holiday",
    fields: [
      { key: "date", label: "Date", type: "date", required: true },
      { key: "name", label: "Occasion", required: true },
    ],
    defaults: { date: "2026-09-15" } as never,
  });
  return (
    <>
      <PageHeader
        title="Holiday"
        crumbs={["HR"]}
        actions={
          <>
            <button className="btn-primary" onClick={crud.openNew}>
              <Plus size={15} /> Add Holiday
            </button>
            <button
              className="btn-outline"
              onClick={() => {
                const defaults = [
                  { date: "2026-12-25", name: "Christmas Day" },
                  { date: "2027-01-01", name: "New Year's Day" },
                ];
                defaults.forEach((d) => {
                  if (!crud.items.some((h) => h.date === d.date)) crud.add(d);
                });
                push("Default holidays added");
              }}
            >
              Mark Default Holidays
            </button>
          </>
        }
      />
      <div className="mb-5">
        <CalendarMonth events={crud.items.map((h) => ({ date: h.date, title: h.name, color: "#e8983c" }))} compact />
      </div>
      <DataTable
        rows={crud.items}
        selectable={false}
        columns={[
          { key: "date", label: "Date", sort: (h) => h.date, render: (h) => fmtDate(h.date) },
          { key: "day", label: "Day", render: (h) => new Date(h.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" }) },
          { key: "name", label: "Occasion", render: (h) => <span className="font-medium">{h.name}</span> },
        ]}
        rowActions={(h) => crud.rowActions(h)}
      />
      {crud.modals}
    </>
  );
}
