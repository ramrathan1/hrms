import { Plus } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { DurationFilter, FilterBar, PageHeader } from "@/components/PageHeader";
import { Attachments, type FileItem } from "@/components/RecordPanels";
import { AvatarName, Modal, StatusPill, Tabs } from "@/components/ui";
import { byId, employees } from "@/data/core";
import { expenses, recurringExpenses } from "@/data/finance";
import { fmtDate, money, todayISO } from "@/lib/format";
import { useToast } from "@/lib/store";

export default function Expenses() {
  const [tab, setTab] = useState("Expenses");
  const { push } = useToast();
  const [receiptFor, setReceiptFor] = useState<(typeof expenses)[number] | null>(null);
  const [receipts, setReceipts] = useState<Record<string, FileItem[]>>({});
  const crud = useCrud({
    collection: "expenses",
    seed: expenses,
    itemName: "Expense",
    fields: [
      { key: "item", label: "Item Name", required: true },
      { key: "price", label: "Price ($)", type: "number", required: true },
      { key: "employee", label: "Employee", type: "select", options: employees.map((e) => ({ value: e.id, label: e.name })) },
      { key: "category", label: "Category", type: "select", options: ["Hardware", "Software", "Travel", "Office"] },
      { key: "date", label: "Purchase Date", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["Pending", "Approved", "Rejected"] },
    ],
    defaults: { date: todayISO(), status: "Pending", project: "—" } as never,
  });
  const recCrud = useCrud({
    collection: "recurringExpenses",
    seed: recurringExpenses,
    itemName: "Recurring Expense",
    fields: [
      { key: "item", label: "Item Name", required: true },
      { key: "price", label: "Price ($)", type: "number", required: true },
      { key: "cycle", label: "Billing Cycle", type: "select", options: ["Monthly", "Weekly", "Yearly"] },
      { key: "next", label: "Next Run", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["Active", "Paused"] },
    ],
    defaults: { next: "2026-09-01", status: "Active" } as never,
  });
  return (
    <>
      <PageHeader
        title="Expenses"
        crumbs={["Finance"]}
        actions={
          <button className="btn-primary" onClick={tab === "Expenses" ? crud.openNew : recCrud.openNew}>
            <Plus size={15} /> {tab === "Expenses" ? "Add Expense" : "Add Recurring Expense"}
          </button>
        }
      />
      <div className="card mb-5 px-2">
        <Tabs tabs={["Expenses", "Recurring Expenses"]} active={tab} onChange={setTab} className="border-b-0" />
      </div>
      {tab === "Expenses" ? (
        <>
          <FilterBar><DurationFilter /></FilterBar>
          <DataTable
            rows={crud.items}
            columns={[
              { key: "item", label: "Item Name", sort: (e) => e.item, render: (e) => <span className="font-medium">{e.item}</span> },
              { key: "price", label: "Price", sort: (e) => e.price, render: (e) => money(e.price) },
              { key: "employee", label: "Employee", render: (e) => <AvatarName name={byId(e.employee)?.name ?? "—"} size={28} /> },
              { key: "category", label: "Category" },
              { key: "date", label: "Purchase Date", render: (e) => fmtDate(e.date) },
              { key: "status", label: "Status", render: (e) => <StatusPill status={e.status} /> },
            ]}
            exportName="expenses"
            onBulkDelete={crud.removeMany}
            bulkActions={[
              { label: "Approve", onClick: (rs) => crud.updateMany(rs, { status: "Approved" } as never, "approved") },
              { label: "Reject", danger: true, onClick: (rs) => crud.updateMany(rs, { status: "Rejected" } as never, "rejected") },
            ]}
            rowActions={(e) =>
              crud.rowActions(e, [
                { label: "Receipt", onClick: () => setReceiptFor(e) },
                ...(e.status === "Pending"
                  ? [
                      { label: "Approve", onClick: () => { crud.update(e.id, { status: "Approved" } as never, true); push(`${e.item} approved`); } },
                      { label: "Reject", danger: true, onClick: () => { crud.update(e.id, { status: "Rejected" } as never, true); push(`${e.item} rejected`); } },
                    ]
                  : []),
              ])
            }
          />
        </>
      ) : (
        <DataTable
          rows={recCrud.items}
          columns={[
            { key: "item", label: "Item Name", render: (e) => <span className="font-medium">{e.item}</span> },
            { key: "price", label: "Price", render: (e) => money(e.price) },
            { key: "cycle", label: "Billing Cycle" },
            { key: "next", label: "Next Run", render: (e) => fmtDate(e.next) },
            { key: "status", label: "Status", render: (e) => <StatusPill status={e.status} /> },
          ]}
          rowActions={(e) =>
            recCrud.rowActions(e, [
              {
                label: e.status === "Active" ? "Pause" : "Resume",
                onClick: () => recCrud.update(e.id, { status: e.status === "Active" ? "Paused" : "Active" } as never),
              },
            ])
          }
        />
      )}
      <Modal open={receiptFor !== null} onClose={() => setReceiptFor(null)} title={`Receipt — ${receiptFor?.item ?? ""}`} wide>
        <p className="mb-3 text-sm text-muted">
          {receiptFor && <>Attach the bill or receipt for <b>{money(receiptFor.price)}</b> so finance can verify this claim.</>}
        </p>
        <Attachments
          files={receipts[receiptFor?.id ?? ""] ?? []}
          onAdd={(f) => setReceipts((r) => ({ ...r, [receiptFor!.id]: [...(r[receiptFor!.id] ?? []), f] }))}
          onRemove={(fid) => setReceipts((r) => ({ ...r, [receiptFor!.id]: (r[receiptFor!.id] ?? []).filter((x) => x.id !== fid) }))}
          collection="expenses"
          recordId={String(receiptFor?.id)}
        />
      </Modal>
      {crud.modals}
      {recCrud.modals}
    </>
  );
}
