import { CheckCircle2, Globe, Server as ServerIcon } from "lucide-react";
import { useLocation } from "react-router-dom";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { FilterBar, PageHeader } from "@/components/PageHeader";
import { useFilters } from "@/lib/filters";
import { StatCard } from "@/components/StatCard";
import { Select, StatusPill } from "@/components/ui";
import { domains, hostings } from "@/data/ops";
import { fmtDate, todayISO } from "@/lib/format";

export default function Servers() {
  const { pathname } = useLocation();
  const page = pathname.endsWith("/hosting") ? "hosting" : pathname.endsWith("/domains") ? "domains" : "overview";
  const hostingCrud = useCrud({
    collection: "hostings",
    seed: hostings,
    itemName: "Hosting",
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "provider", label: "Provider Name", required: true },
      { key: "type", label: "Server Type" },
      { key: "client", label: "Client" },
      { key: "status", label: "Status", type: "select", options: ["Pending", "Suspended", "Expired"] },
      { key: "purchased", label: "Purchase Date", type: "date" },
      { key: "expiry", label: "Expiry Date", type: "date" },
    ],
    defaults: { client: "—", purchased: todayISO(), expiry: "2027-08-29" } as never,
  });

  const hostingFilters = useFilters<(typeof hostings)[number]>([
    { label: "Status", options: ["All", "Pending", "Suspended", "Expired"], match: (h, v) => h.status === v },
    { label: "Provider", options: ["All", ...Array.from(new Set(hostings.map((h) => h.provider)))], match: (h, v) => h.provider === v },
  ]);
  const domainFilters = useFilters<(typeof domains)[number]>([
    { label: "Status", options: ["All", "Active", "Pending", "Suspended", "Expired", "Transferring"], match: (d, v) => d.status === v },
    { label: "Provider", options: ["All", ...Array.from(new Set(domains.map((d) => d.provider)))], match: (d, v) => d.provider === v },
  ]);
  const domainCrud = useCrud({
    collection: "domains",
    seed: domains,
    itemName: "Domain",
    fields: [
      { key: "name", label: "Domain Name", required: true },
      { key: "provider", label: "Provider", required: true },
      { key: "type", label: "Domain Type", type: "select", options: ["COM", "NET", "ORG", "DEV", "CO", "APP"] },
      { key: "client", label: "Client" },
      { key: "status", label: "Status", type: "select", options: ["Active", "Pending", "Suspended", "Expired", "Transferring"] },
      { key: "expiry", label: "Expiry Date", type: "date" },
      { key: "hosting", label: "Linked Hosting", type: "select", options: ["—", ...hostings.map((h) => h.title)] },
    ],
    defaults: { client: "—", purchased: todayISO(), expiry: "2027-08-29" } as never,
  });

  if (page === "overview") {
    return (
      <>
        <PageHeader title="Server Manager" />
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Hostings" value={hostings.length} icon={ServerIcon} />
          <StatCard label="Active Hostings" value={hostings.filter((h) => h.status === "Pending").length} />
          <StatCard label="Total Domains" value={domains.length} icon={Globe} />
          <StatCard label="Active Domains" value={domains.filter((d) => d.status === "Active").length} />
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {["hostings", "domains"].map((kind) => (
            <div key={kind} className="card p-8 text-center">
              <CheckCircle2 size={36} className="mx-auto text-good" />
              <p className="mt-3 font-semibold capitalize">No {kind} expiring in the next 30 days</p>
              <p className="mt-1 text-sm text-muted">You will be alerted here 30 days before expiry.</p>
            </div>
          ))}
        </div>
        <div className="card mt-5">
          <div className="border-b border-line px-5 py-3.5 text-[15px] font-semibold">Recent Activities</div>
          <ul className="divide-y divide-line text-sm">
            {hostings.slice(0, 6).map((h) => (
              <li key={h.id} className="px-5 py-3">
                Hosting "{h.title}" was created
                <span className="block text-xs text-faint">{fmtDate(h.purchased)} 06:00 pm</span>
              </li>
            ))}
          </ul>
        </div>
      </>
    );
  }

  if (page === "hosting") {
    return (
      <>
        <PageHeader
          title="Hosting Management"
          crumbs={["Server Manager"]}
          actions={<button className="btn-primary" onClick={hostingCrud.openNew}>+ Add Hosting</button>}
        />
        <FilterBar>
          {hostingFilters.controls.map((c) => <Select key={c.label} {...c} />)}
        </FilterBar>
        <DataTable
          rows={hostingFilters.apply(hostingCrud.items)}
          columns={[
            { key: "title", label: "Title", sort: (h) => h.title, render: (h) => <span className="font-medium">{h.title}</span> },
            { key: "provider", label: "Provider Name" },
            { key: "type", label: "Server Type" },
            { key: "client", label: "Client" },
            { key: "status", label: "Status", render: (h) => <StatusPill status={h.status} /> },
            { key: "purchased", label: "Purchase Date", render: (h) => fmtDate(h.purchased) },
            { key: "expiry", label: "Expiry Date", sort: (h) => h.expiry, render: (h) => fmtDate(h.expiry) },
          ]}
          rowActions={(h) => hostingCrud.rowActions(h)}
        />
        {hostingCrud.modals}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Domain Management"
        crumbs={["Server Manager"]}
        actions={<button className="btn-primary" onClick={domainCrud.openNew}>+ Add Domain</button>}
      />
      <FilterBar>
        {domainFilters.controls.map((c) => <Select key={c.label} {...c} />)}
      </FilterBar>
      <DataTable
        rows={domainFilters.apply(domainCrud.items)}
        columns={[
          { key: "name", label: "Domain Name", sort: (d) => d.name, render: (d) => <span className="font-medium text-primary">{d.name}</span> },
          { key: "provider", label: "Provider" },
          { key: "type", label: "Domain Type", render: (d) => <StatusPill status={d.type} tone="info" /> },
          { key: "client", label: "Client" },
          { key: "status", label: "Status", render: (d) => <StatusPill status={d.status} /> },
          { key: "expiry", label: "Expiry Date", sort: (d) => d.expiry, render: (d) => fmtDate(d.expiry) },
          { key: "hosting", label: "Hosting" },
        ]}
        rowActions={(d) => domainCrud.rowActions(d)}
      />
      {domainCrud.modals}
    </>
  );
}
