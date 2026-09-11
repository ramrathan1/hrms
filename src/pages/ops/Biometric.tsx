import { Plus, RefreshCw } from "lucide-react";
import { useLocation } from "react-router-dom";
import { DataTable } from "@/components/DataTable";
import { useCrud } from "@/components/crud";
import { PageHeader } from "@/components/PageHeader";
import { AvatarName, StatusPill } from "@/components/ui";
import { byId } from "@/data/core";
import { biometricDevices } from "@/data/ops";
import { useServerRows } from "@/lib/useServerRows";
import { useToast } from "@/lib/store";
import { todayISO } from "@/lib/format";

export default function Biometric() {
  const { pathname } = useLocation();
  const { push } = useToast();
  const logs = pathname.endsWith("/logs");

  /* Door readers produce a row per person per door per day, so this table
     genuinely grows without bound — it pages against the server rather than
     holding the lot. */
  const punches = useServerRows<{ id: string; employee?: string; device: string; type: string; time: string }>(
    "biometricLogs",
    { pageSize: 25 }
  );
  const crud = useCrud({
    collection: "biometricDevices",
    seed: biometricDevices,
    itemName: "Device",
    fields: [
      { key: "name", label: "Device Name", required: true, span: true },
      { key: "serial", label: "Serial No.", required: true },
      { key: "location", label: "Location" },
      { key: "status", label: "Status", type: "select", options: ["Online", "Offline"] },
    ],
    defaults: { lastSync: "—", status: "Offline" } as never,
  });

  if (logs) {
    return (
      <>
        <PageHeader title="Biometric Attendance Logs" crumbs={["Biometric"]} />
        <DataTable
          rows={punches.rows}
          server={punches.server}
          selectable={false}
          emptyText="No door reads recorded yet"
          columns={[
            { key: "employee", label: "Employee", render: (l) => <AvatarName name={byId(l.employee)?.name ?? "—"} size={28} /> },
            { key: "device", label: "Device" },
            { key: "type", label: "Event", render: (l) => <StatusPill status={l.type} tone={l.type === "Clock In" ? "good" : "muted"} /> },
            { key: "time", label: "Timestamp" },
          ]}
        />
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Biometric Devices"
        crumbs={["Biometric"]}
        actions={
          <>
            <button className="btn-primary" onClick={crud.openNew}>
              <Plus size={15} /> Add Device
            </button>
            <button
              className="btn-outline"
              onClick={() => {
                crud.items.forEach((d) => crud.update(d.id, { lastSync: `${todayISO()} ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).toLowerCase()}`, status: "Online" } as never, true));
                push("All devices synced");
              }}
            >
              <RefreshCw size={15} /> Sync All
            </button>
          </>
        }
      />
      <DataTable
        rows={crud.items}
        columns={[
          { key: "name", label: "Device", render: (d) => <span className="font-medium">{d.name}</span> },
          { key: "serial", label: "Serial No." },
          { key: "location", label: "Location" },
          { key: "status", label: "Status", render: (d) => <StatusPill status={d.status} tone={d.status === "Online" ? "good" : "bad"} /> },
          { key: "lastSync", label: "Last Sync" },
        ]}
        rowActions={(d) =>
          crud.rowActions(d, [
            { label: "Sync Now", onClick: () => { crud.update(d.id, { lastSync: `${todayISO()} ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).toLowerCase()}`, status: "Online" } as never, true); push(`${d.name} synced`); } },
            { label: "Restart Device", onClick: () => push(`Restart command queued for ${d.name}`) },
          ])
        }
      />
      {crud.modals}
    </>
  );
}
