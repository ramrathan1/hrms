import { Plus } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { FilterBar, PageHeader } from "@/components/PageHeader";
import { useFilters } from "@/lib/filters";
import { Select, StatusPill } from "@/components/ui";
import { qrCodes } from "@/data/ops";
import { fmtDate, todayISO } from "@/lib/format";

function FakeQr({ color }: { color: string }) {
  const cells: boolean[] = [];
  let s = color.charCodeAt(1) + color.charCodeAt(3);
  for (let i = 0; i < 64; i++) {
    s = (s * 75 + 74) % 65537;
    cells.push(s % 3 !== 0);
  }
  return (
    <svg width="52" height="52" viewBox="0 0 8 8" className="rounded border border-line">
      <rect width="8" height="8" fill="white" />
      {cells.map((c, i) => c && <rect key={i} x={i % 8} y={Math.floor(i / 8)} width="1" height="1" fill={color} />)}
    </svg>
  );
}

const QR_COLORS = ["#5b5ceb", "#1fa971", "#e8983c", "#4cc3ff", "#e85d51", "#3fa9f5"];

export default function QrCodes() {
  const crud = useCrud({
    collection: "qrCodes",
    seed: qrCodes,
    itemName: "QR Code",
    fields: [
      { key: "title", label: "QR Title", required: true, span: true },
      { key: "type", label: "Type", type: "select", options: ["URL", "WhatsApp", "Email", "SMS", "WiFi", "Location", "Skype"] },
      { key: "content", label: "Content", placeholder: "URL / phone / SSID…", span: true },
      { key: "created", label: "Created", type: "date" },
    ],
    defaults: { created: todayISO(), color: QR_COLORS[Math.floor(Math.random() * QR_COLORS.length)] } as never,
  });
  const filters = useFilters<(typeof qrCodes)[number]>([
    { label: "Type", options: ["All", "URL", "WhatsApp", "Email", "SMS", "WiFi", "Location"], match: (q, v) => q.type === v },
  ]);
  return (
    <>
      <PageHeader
        title="QR Code"
        actions={
          <button className="btn-primary" onClick={crud.openNew}>
            <Plus size={15} /> Create QR Code
          </button>
        }
      />
      <FilterBar>
        {filters.controls.map((c) => <Select key={c.label} {...c} />)}
      </FilterBar>
      <DataTable
        rows={filters.apply(crud.items)}
        columns={[
          { key: "qr", label: "QR Code", render: (q) => <FakeQr color={q.color} />, className: "w-20" },
          { key: "title", label: "QR Title", sort: (q) => q.title, render: (q) => <span className="font-medium">{q.title}</span> },
          { key: "type", label: "Type", render: (q) => <StatusPill status={q.type} tone="info" /> },
          { key: "created", label: "Created", sort: (q) => q.created, render: (q) => fmtDate(q.created) },
        ]}
        rowActions={(q) => crud.rowActions(q, [{ label: "Download", onClick: () => window.print() }])}
      />
      {crud.modals}
    </>
  );
}
