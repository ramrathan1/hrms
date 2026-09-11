/* Offer letters.
 *
 * An offer hangs off an application — that is what carries the candidate and
 * the role — so this screen picks an application rather than retyping names.
 * Accepting one creates the employee record on the server, which is why that
 * action goes through its own endpoint instead of a status edit. */
import { Plus } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/DataTable";
import { FormModal, useCrud } from "@/components/crud";
import { PageHeader } from "@/components/PageHeader";
import { AvatarName, StatusPill } from "@/components/ui";
import { applications, offers } from "@/data/recruit";
import { acceptOffer, declineOffer } from "@/lib/api";
import { fmtDate, money, todayISO } from "@/lib/format";
import { useToast } from "@/lib/store";

export default function Offers() {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  const crud = useCrud({
    collection: "offers",
    seed: offers,
    itemName: "Offer Letter",
    fields: [
      {
        key: "applicationId",
        label: "Applicant",
        type: "select",
        required: true,
        // Only people still in the running — an offer to a rejected candidate
        // is a mistake, not a workflow.
        options: applications
          .filter((a) => !["Hired", "Rejected"].includes(String(a.status)))
          .map((a) => ({ value: a.id, label: `${a.name} — ${a.job || "role"}` })),
      },
      { key: "salary", label: "Annual salary", type: "number", required: true },
      { key: "joining", label: "Expected joining date", type: "date", required: true },
    ],
    defaults: { joining: todayISO() } as never,
  });

  const respond = async (id: string, accept: boolean) => {
    setBusy(true);
    const ok = accept ? await acceptOffer(id) : await declineOffer(id);
    setBusy(false);
    if (!ok) return push("Couldn't record that response");
    push(accept ? "Offer accepted — employee record created" : "Offer declined");
  };

  return (
    <>
      <PageHeader
        title="Offer Letters"
        crumbs={["Recruit"]}
        actions={
          <button className="btn-primary" onClick={crud.openNew} disabled={applications.length === 0}>
            <Plus size={15} /> Add Offer Letter
          </button>
        }
      />
      <DataTable
        rows={crud.items}
        columns={[
          { key: "offer", label: "Offer", render: (o) => <span className="font-mono text-xs text-muted">{o.offer}</span> },
          { key: "applicant", label: "Job Applicant", render: (o) => <AvatarName name={o.applicant} sub={o.job} size={28} /> },
          { key: "salary", label: "Salary", sort: (o) => o.salary, render: (o) => <span className="tabular-nums">{money(o.salary, o.currency)}</span> },
          { key: "joining", label: "Expected Joining", sort: (o) => o.joining, render: (o) => fmtDate(o.joining) },
          { key: "status", label: "Status", render: (o) => <StatusPill status={o.status} /> },
          { key: "respondedAt", label: "Responded", render: (o) => (o.respondedAt ? fmtDate(o.respondedAt) : "—") },
        ]}
        exportName="offer-letters"
        emptyText="No offers yet"
        rowActions={(o) =>
          crud.rowActions(o, [
            { label: "Download", onClick: () => window.print() },
            ...(o.status === "Sent" && !busy
              ? [
                  { label: "Mark accepted", onClick: () => void respond(String(o.id), true) },
                  { label: "Mark declined", danger: true, onClick: () => void respond(String(o.id), false) },
                ]
              : []),
          ])
        }
      />
      {crud.modals}
    </>
  );
}
