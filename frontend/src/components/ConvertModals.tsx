/* Conversion flows that connect the CRM to delivery & billing:
   Lead → Client, and Deal → Project (optionally with a kickoff invoice). */
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Modal } from "./ui";
import { clients } from "@/data/core";
import { deals, leads } from "@/data/crm";
import { invoices } from "@/data/finance";
import { projects } from "@/data/work";
import { api } from "@/lib/api";
import { money, todayISO } from "@/lib/format";
import { CURRENT_USER, useToast } from "@/lib/store";

export function ConvertLeadModal({
  lead,
  onClose,
  onDone,
}: {
  lead: (typeof leads)[number] | null;
  onClose: () => void;
  onDone?: (clientId: string) => void;
}) {
  const { push } = useToast();
  const [category, setCategory] = useState("SMB");
  const [keepLead, setKeepLead] = useState(false);
  const [makeProject, setMakeProject] = useState(true);
  if (!lead) return null;

  const leadDeals = deals.filter((d) => d.leadId === lead.id);
  const value = leadDeals.reduce((a, d) => a + d.value, 0);

  const convert = () => {
    const client = {
      id: `c-${Date.now().toString(36)}`,
      name: lead.name,
      company: lead.company,
      email: lead.email,
      phone: lead.phone,
      category,
      added: todayISO(),
      status: "Active" as const,
    };
    clients.push(client);
    void api.create("clients", client);

    if (makeProject && leadDeals.length > 0) {
      const project = {
        id: `p-${Date.now().toString(36)}`,
        code: lead.company.slice(0, 3).toUpperCase(),
        name: leadDeals[0].name,
        clientId: client.id,
        members: [CURRENT_USER.id],
        start: todayISO(),
        deadline: "2026-12-31",
        progress: 0,
        status: "Not Started" as const,
        budget: value,
        category: "Web",
      };
      projects.push(project);
      void api.create("projects", project);
    }

    if (!keepLead) {
      const idx = leads.findIndex((l) => l.id === lead.id);
      if (idx >= 0) leads.splice(idx, 1);
      void api.remove("leads", lead.id);
    }

    push(`${lead.company} converted to a client${makeProject && leadDeals.length ? " with a project" : ""}`);
    onDone?.(client.id);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Convert lead to client" wide>
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-page/60 p-4 text-sm">
        <span>
          <span className="block text-xs text-faint">Lead</span>
          <b>{lead.name}</b> · {lead.company}
        </span>
        <ArrowRight size={18} className="text-primary" />
        <span>
          <span className="block text-xs text-faint">Becomes</span>
          <b>Client record</b> with full billing history
        </span>
        {leadDeals.length > 0 && (
          <span className="ml-auto rounded-lg bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary">
            {leadDeals.length} deal{leadDeals.length === 1 ? "" : "s"} · {money(value)}
          </span>
        )}
      </div>

      <label className="mt-4 block">
        <span className="lbl">Client category</span>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {["Enterprise", "SMB", "Agency"].map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>

      <div className="mt-4 space-y-2.5 text-sm">
        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" className="h-4 w-4 accent-primary" checked={makeProject} onChange={(e) => setMakeProject(e.target.checked)} />
          Create a project from the won deal {leadDeals.length === 0 && <span className="text-faint">(no deals on this lead)</span>}
        </label>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" className="h-4 w-4 accent-primary" checked={keepLead} onChange={(e) => setKeepLead(e.target.checked)} />
          Keep the original lead record
        </label>
      </div>

      <div className="mt-5 flex gap-3">
        <button className="btn-primary" onClick={convert}>Convert to client</button>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

export function ConvertDealModal({
  deal,
  onClose,
}: {
  deal: (typeof deals)[number] | null;
  onClose: () => void;
}) {
  const { push } = useToast();
  const [withInvoice, setWithInvoice] = useState(true);
  const [advance, setAdvance] = useState(40);
  if (!deal) return null;
  const lead = leads.find((l) => l.id === deal.leadId);
  const client = clients.find((c) => c.company === lead?.company);

  const convert = () => {
    const clientId = client?.id ?? clients[0].id;
    const project = {
      id: `p-${Date.now().toString(36)}`,
      code: (lead?.company ?? deal.name).slice(0, 3).toUpperCase(),
      name: deal.name,
      clientId,
      members: [CURRENT_USER.id],
      start: todayISO(),
      deadline: deal.close,
      progress: 0,
      status: "Not Started" as const,
      budget: deal.value,
      category: "Web",
    };
    projects.push(project);
    void api.create("projects", project);

    if (withInvoice) {
      const inv = {
        id: `inv-${Date.now().toString(36)}`,
        number: `INV#${String(invoices.length + 20).padStart(3, "0")}`,
        projectId: project.id,
        clientId,
        total: Math.round((deal.value * advance) / 100),
        paid: 0,
        date: todayISO(),
        due: "2026-09-13",
        status: "Unpaid" as const,
      };
      invoices.push(inv);
      void api.create("invoices", inv);
    }

    const i = deals.findIndex((d) => d.id === deal.id);
    if (i >= 0) deals[i] = { ...deals[i], stage: "won" };
    void api.update("deals", deal.id, { stage: "won" });

    push(`Deal won — project created${withInvoice ? ` with a ${advance}% advance invoice` : ""}`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Win deal & start delivery" wide>
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-page/60 p-4 text-sm">
        <span>
          <span className="block text-xs text-faint">Deal</span>
          <b>{deal.name}</b> · {money(deal.value)}
        </span>
        <ArrowRight size={18} className="text-primary" />
        <span>
          <span className="block text-xs text-faint">Creates</span>
          <b>Project</b>{withInvoice ? " + advance invoice" : ""}
        </span>
      </div>
      <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-primary" checked={withInvoice} onChange={(e) => setWithInvoice(e.target.checked)} />
        Raise an advance invoice
      </label>
      {withInvoice && (
        <label className="mt-3 block">
          <span className="lbl">Advance %</span>
          <span className="flex items-center gap-3">
            <input type="range" min={10} max={100} step={10} value={advance} onChange={(e) => setAdvance(Number(e.target.value))} className="flex-1 accent-primary" />
            <b className="w-28 text-right tabular-nums">{advance}% = {money((deal.value * advance) / 100)}</b>
          </span>
        </label>
      )}
      <div className="mt-5 flex gap-3">
        <button className="btn-primary" onClick={convert}>Win deal</button>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}
