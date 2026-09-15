import { Plus } from "lucide-react";
import { useState } from "react";
import { FormModal } from "@/components/crud";
import { PageHeader, FilterBar } from "@/components/PageHeader";
import { AvatarName, Select } from "@/components/ui";
import { employees } from "@/data/core";
import { shifts } from "@/data/hr";
import { api } from "@/lib/api";
import { useToast } from "@/lib/store";

const WEEK = ["Mon 24", "Tue 25", "Wed 26", "Thu 27", "Fri 28", "Sat 29", "Sun 30"];

export default function Shifts() {
  const { push } = useToast();
  const [assignOpen, setAssignOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [shiftFilter, setShiftFilter] = useState("All");

  /* The roster assigns a shift per employee per weekday; this is the single
     source of truth for both the grid and the shift filter. */
  /* Each employee has a home shift; one day a week they cover the next one,
     so the roster spreads across all three shifts rather than piling on the first. */
  const shiftAt = (idx: number, di: number) => {
    const override = shifts.find((s) => s.id === overrides[employees[idx].id]);
    if (override) return override;
    /* Nothing to place until at least one shift exists. Without this the
       `% shifts.length` below is `% 0`, which is NaN, and every cell reads an
       undefined shift. */
    if (!shifts.length) return undefined;
    const home = idx % shifts.length;
    const covers = (idx * 2 + 1) % 5 === di;
    return shifts[covers ? (home + 1) % shifts.length : home];
  };
  /* An employee's primary shift is the one they work most weekdays, so the
     filter partitions the roster instead of matching almost everyone. */
  const primaryShift = (idx: number) => {
    const tally = new Map<string, number>();
    WEEK.slice(0, 5).forEach((_, di) => {
      const n = shiftAt(idx, di)?.name;
      if (n) tally.set(n, (tally.get(n) ?? 0) + 1);
    });
    return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const roster = employees
    .map((e, idx) => ({ e, idx }))
    .filter(({ idx }) => shiftFilter === "All" || primaryShift(idx) === shiftFilter);
  return (
    <>
      <PageHeader
        title="Shift Roster"
        crumbs={["HR"]}
        actions={
          <button className="btn-primary" onClick={() => setAssignOpen(true)}>
            <Plus size={15} /> Assign Shift
          </button>
        }
      />
      <FormModal
        open={assignOpen}
        title="Assign Shift"
        fields={[
          { key: "employee", label: "Employee", type: "select", options: employees.map((e) => ({ value: e.id, label: e.name })), required: true },
          { key: "shift", label: "Shift", type: "select", options: shifts.map((s) => ({ value: s.id, label: `${s.name} (${s.start}–${s.end})` })), required: true },
          { key: "from", label: "From Date", type: "date", required: true },
          { key: "to", label: "To Date", type: "date" },
        ]}
        initial={{ from: "2026-08-31", to: "2026-09-04" }}
        submitLabel="Assign"
        onSubmit={(v) => {
          setOverrides((o) => ({ ...o, [String(v.employee)]: String(v.shift) }));
          void api.create("rosterAssignments", v);
          push(`Shift assigned to ${employees.find((e) => e.id === v.employee)?.name}`);
          setAssignOpen(false);
        }}
        onClose={() => setAssignOpen(false)}
      />
      <FilterBar>
        <span className="text-sm"><span className="text-muted">Week</span> <b>24 Aug – 30 Aug 2026</b></span>
        <Select label="Shift" value={shiftFilter} onChange={setShiftFilter} options={["All", ...shifts.map((s) => s.name)]} />
        <span className="text-xs text-muted">{roster.length} of {employees.length} people</span>
        <span className="ml-auto flex gap-3 text-xs">
          {shifts.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5 text-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} /> {s.name} ({s.start}–{s.end})
            </span>
          ))}
        </span>
      </FilterBar>
      <div className="card overflow-x-auto">
        <table className="tbl w-full text-sm">
          <thead>
            <tr>
              <th>Employee</th>
              {WEEK.map((d) => (
                <th key={d} className="text-center">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roster.map(({ e, idx }) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap"><AvatarName name={e.name} sub={e.designation} size={28} /></td>
                {WEEK.map((d, di) => {
                  const isWeekend = di >= 5;
                  const shift = shiftAt(idx, di);
                  return (
                    <td key={d} className="text-center">
                      {isWeekend ? (
                        <span className="text-xs text-faint">Day Off</span>
                      ) : shift ? (
                        <span className="inline-block rounded px-2 py-1 text-[11px] font-semibold text-white" style={{ background: shift.color }}>
                          {shift.name.split(" ")[0]}
                        </span>
                      ) : (
                        <span className="text-xs text-faint">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
