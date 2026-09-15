import clsx from "clsx";
import { Database, KeyRound, RotateCcw, Search } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import {
  CheckboxInput, DateInput, Field, FileDrop, FormGrid, SelectInput, TextArea, TextInput, Toggle,
} from "@/components/FormKit";
import { ConfirmDialog } from "@/components/crud";
import { Modal, StatusPill, Tabs } from "@/components/ui";
import { PermissionMatrix } from "@/components/PermissionMatrix";
import { api, getSetting, onStoreChange, resetDemoData, saveSetting, storeSize } from "@/lib/api";
import { leaveTypes } from "@/lib/leaveBalance";
import { employees } from "@/data/core";
import { CURRENT_USER, useToast } from "@/lib/store";

const SECTIONS: { slug: string; name: string }[] = [
  { slug: "company", name: "Company Settings" },
  { slug: "app", name: "App Settings" },
  { slug: "profile", name: "Profile Settings" },
  { slug: "notification", name: "Notification Settings" },
  { slug: "email-templates", name: "Email Templates" },
  { slug: "currency", name: "Currency Settings" },
  { slug: "payment", name: "Payment Credentials" },
  { slug: "finance", name: "Finance Settings" },
  { slug: "tax", name: "Tax Settings" },
  { slug: "ticket", name: "Ticket Settings" },
  { slug: "project", name: "Project Settings" },
  { slug: "attendance", name: "Attendance Settings" },
  { slug: "leaves", name: "Leaves Settings" },
  { slug: "custom-fields", name: "Custom Fields" },
  { slug: "roles", name: "Roles & Permissions" },
  { slug: "lead", name: "Lead Settings" },
  { slug: "task", name: "Task Settings" },
  { slug: "security", name: "Security Settings" },
  { slug: "theme", name: "Theme Settings" },
  { slug: "module", name: "Module Settings" },
  { slug: "storage", name: "Storage Settings" },
  { slug: "language", name: "Language Settings" },
  { slug: "payroll", name: "Payroll Settings" },
  { slug: "recruit", name: "Recruit Settings" },
];

/* Monitor module intentionally removed from this build. */
const MODULES = [
  "Projects", "Tickets", "Invoices", "Estimates", "Events", "Messages", "Tasks", "Time Logs",
  "Contracts", "Notices", "Payments", "Knowledge Base", "Clients", "Employees",
  "Attendance", "Expenses", "Leaves", "Leads", "Holidays", "Reports", "Bank Account",
  "Assets", "Biolinks", "Biometric", "Letter", "Payroll", "Performance", "QR Code",
  "Recruit", "Rest API", "Server Manager", "Webhooks",
];

/* Modules a client never sees in their portal. */
const CLIENT_HIDDEN = ["Employees", "Attendance", "Leaves", "Payroll", "Performance", "Recruit", "Leads", "Expenses", "Server Manager", "Webhooks", "Rest API", "Biometric"];

const ROLES = [
  { name: "App Administrator", members: 1, locked: true },
  { name: "Employee", members: 9 },
  { name: "Client", members: 9 },
  { name: "Manager", members: 0 },
];

const NOTIF_EVENTS = [
  "New Expense/Added by Admin", "New Expense/Added by Member", "Expense Status Changed",
  "New Support Ticket Request", "New Leave Application", "Task Completed", "Task Status Updated",
  "Invoice Create/Update Notification", "Discussion Reply", "Lead Notification", "Payment Notification",
  "Employee Appreciation", "Event Notification", "Message Notification", "Shift Assign Notification",
];

/* Settings panes persist: every control is serialised by its field label,
   saved to the "settings" collection, and restored when you come back. */
type Saved = Record<string, unknown>;
const PaneCtx = createContext<{ save: (msg?: string) => void; saved: Saved }>({ save: () => {}, saved: {} });

/* Controlled inputs can't be restored by writing to the DOM — React overwrites
   them on the next render — so they seed their initial state from here instead.
   Pane holds children back until the saved values have landed. */
function useSaved(label: string, fallback: string) {
  const { saved } = useContext(PaneCtx);
  return label in saved ? String(saved[label]) : fallback;
}

const labelOf = (el: Element): string => {
  const lab = el.closest("label");
  const text = lab?.querySelector(".lbl")?.textContent ?? lab?.textContent ?? "";
  return text.replace(/\s*\*\s*$/, "").trim().slice(0, 60);
};

function Pane({ title, slug, children }: { title: string; slug?: string; children: ReactNode }) {
  const ref = useRef<HTMLFormElement>(null);
  const { push } = useToast();
  const key = slug ?? title.toLowerCase().replace(/\s+/g, "-");
  const [saved, setSaved] = useState<Saved | null>(null);

  // restore saved values
  useEffect(() => {
    setSaved(getSetting(key) as Saved);
  }, [key]);

  // uncontrolled inputs are restored straight onto the DOM once values arrive
  useEffect(() => {
    if (!saved || !ref.current) return;
    ref.current.querySelectorAll("input, select, textarea").forEach((el) => {
      const node = el as HTMLInputElement;
      const k = labelOf(node) || node.name;
      if (!(k in saved)) return;
      if (node.type === "checkbox") node.checked = Boolean(saved[k]);
      else node.value = String(saved[k]);
    });
  }, [saved]);

  const save = (msg = "Settings saved") => {
    /* Merge over what's already stored: a tabbed pane only has the active
       tab's inputs mounted, and replacing outright would wipe the others. */
    const values: Record<string, unknown> = { ...(saved ?? {}) };
    ref.current?.querySelectorAll("input, select, textarea").forEach((el) => {
      const node = el as HTMLInputElement;
      const k = labelOf(node) || node.name;
      if (!k) return;
      values[k] = node.type === "checkbox" ? node.checked : node.value;
    });
    setSaved(values);
    saveSetting(key, values, title);
    push(msg);
  };

  return (
    <PaneCtx.Provider value={{ save, saved: saved ?? {} }}>
      <form ref={ref} onSubmit={(e) => e.preventDefault()} className="card p-6">
        <h2 className="mb-5 text-[17px] font-semibold">{title}</h2>
        {saved === null ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-page" style={{ width: `${90 - i * 12}%` }} />
            ))}
          </div>
        ) : (
          children
        )}
      </form>
    </PaneCtx.Provider>
  );
}

function SettingsSave({ saveLabel = "Save", toast = "Settings saved", extra }: { saveLabel?: string; toast?: string; extra?: ReactNode }) {
  const { save } = useContext(PaneCtx);
  return (
    <div className="mt-2 flex items-center gap-3 border-t border-line pt-5">
      <button type="button" className="btn-primary" onClick={() => save(toast)}>
        {saveLabel}
      </button>
      {extra}
      <span className="ml-auto text-[11px] text-faint">Changes are stored per workspace</span>
    </div>
  );
}

/* ---------- email templates ---------- */
const TEMPLATE_SEED = [
  { id: "invoice-sent", name: "Invoice sent", subject: "Invoice {{invoice_number}} from {{company}}", body: "Hi {{client_first_name}},\n\nPlease find invoice {{invoice_number}} for {{amount}} attached. Payment is due by {{due_date}}.\n\nThank you for your business!\n{{company}} Billing", event: "When an invoice is emailed" },
  { id: "payment-reminder", name: "Payment reminder", subject: "Payment reminder — {{invoice_number}}", body: "Hi {{client_first_name}},\n\nA friendly reminder that {{amount}} on invoice {{invoice_number}} was due on {{due_date}}.\n\nThanks,\n{{company}} Billing", event: "Overdue invoice chase" },
  { id: "estimate-sent", name: "Estimate sent", subject: "Estimate {{estimate_number}} from {{company}}", body: "Hi {{client_first_name}},\n\nYour estimate for {{amount}} is attached and valid until {{valid_date}}.\n\nApprove it and we'll get started.\n\n{{company}}", event: "When an estimate is emailed" },
  { id: "welcome-client", name: "Client portal invite", subject: "Your {{company}} client portal access", body: "Hi {{client_first_name}},\n\nWe've set up portal access for {{client_company}}. View project progress, download invoices and raise tickets.\n\nSet your password: {{portal_link}}\n\n{{company}} Team", event: "Portal invitation" },
  { id: "leave-approved", name: "Leave approved", subject: "Your leave request was approved", body: "Hi {{employee_first_name}},\n\nYour {{leave_type}} leave on {{leave_date}} has been approved.\n\n{{company}} HR", event: "Leave approval" },
  { id: "offer-letter", name: "Offer letter", subject: "Your offer from {{company}}", body: "Dear {{candidate_name}},\n\nWe're delighted to offer you the position of {{job_title}}, starting {{joining_date}}.\n\nPlease review and confirm by {{expiry_date}}.\n\n{{company}} Recruitment", event: "Recruitment offer" },
];

const MERGE_FIELDS = ["{{company}}", "{{client_first_name}}", "{{client_company}}", "{{invoice_number}}", "{{amount}}", "{{due_date}}", "{{employee_first_name}}", "{{portal_link}}"];

function EmailTemplates() {
  const { push } = useToast();
  const [templates, setTemplates] = useState(TEMPLATE_SEED);
  const [activeId, setActiveId] = useState(TEMPLATE_SEED[0].id);
  const active = templates.find((t) => t.id === activeId)!;

  const update = (patch: Partial<(typeof TEMPLATE_SEED)[number]>) =>
    setTemplates((ts) => ts.map((t) => (t.id === activeId ? { ...t, ...patch } : t)));

  return (
    <div className="card p-6">
      <h2 className="mb-1 text-[17px] font-semibold">Email Templates</h2>
      <p className="mb-5 text-sm text-muted">
        These power every outbound email — invoices, reminders, estimates, portal invites, HR and recruitment.
      </p>
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveId(t.id)}
            className={clsx(
              "btn rounded-full border px-3.5 py-1.5 text-xs font-semibold",
              t.id === activeId ? "border-primary bg-primary text-white" : "border-line bg-white/70 text-muted hover:border-primary hover:text-primary"
            )}
          >
            {t.name}
          </button>
        ))}
      </div>

      <p className="mt-4 rounded-lg bg-page px-3 py-2 text-xs text-muted">Triggered: {active.event}</p>

      <label className="mt-4 block">
        <span className="lbl">Subject line</span>
        <input className="input" value={active.subject} onChange={(e) => update({ subject: e.target.value })} />
      </label>
      <label className="mt-3.5 block">
        <span className="lbl">Body</span>
        <textarea rows={10} className="input resize-y font-mono text-[13px] leading-relaxed" value={active.body} onChange={(e) => update({ body: e.target.value })} />
      </label>

      <div className="mt-3">
        <p className="mb-1.5 text-xs font-bold tracking-wider text-faint uppercase">Merge fields — click to insert</p>
        <div className="flex flex-wrap gap-1.5">
          {MERGE_FIELDS.map((f) => (
            <button
              key={f}
              className="btn rounded-lg border border-line bg-white px-2 py-1 font-mono text-[11px] text-primary hover:border-primary"
              onClick={() => update({ body: `${active.body}${f}` })}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 border-t border-line pt-5">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            void api.replace("emailTemplates", active.id, active);
            push(`Template “${active.name}” saved`);
          }}
        >
          Save template
        </button>
        <button
          type="button"
          className="btn-outline"
          onClick={() => {
            void api.create("outbox", { to: "you@worksuite.demo", subject: active.subject, body: active.body, date: new Date().toISOString() });
            push("Test email sent to you@worksuite.demo");
          }}
        >
          Send test email
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            setTemplates((ts) => ts.map((t) => (t.id === activeId ? TEMPLATE_SEED.find((s) => s.id === activeId)! : t)));
            push("Reset to default");
          }}
        >
          Reset to default
        </button>
      </div>
    </div>
  );
}

/* ---------- roles & permissions ---------- */
function RolesPane() {
  const { push } = useToast();
  const [roles, setRoles] = useState(ROLES);
  const [editing, setEditing] = useState<{ name: string; locked?: boolean } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newRole, setNewRole] = useState("");

  return (
    <div className="card p-6">
      <h2 className="mb-1 text-[17px] font-semibold">Roles &amp; Permissions</h2>
      <p className="mb-5 text-sm text-muted">Control exactly what each role can view, create, edit and delete.</p>
      <div className="space-y-3">
        {roles.map((r) => (
          <div key={r.name} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-5 py-4">
            <div>
              <p className="font-semibold">{r.name}</p>
              <p className="text-xs text-muted">{r.members} Member{r.members === 1 ? "" : "s"}</p>
            </div>
            <span className="flex items-center gap-2">
              {r.locked && <span className="text-xs text-faint">Full access — cannot be reduced</span>}
              <button className="btn-outline" onClick={() => setEditing({ name: r.name, locked: r.locked })}>
                <KeyRound size={14} /> {r.locked ? "View" : "Permissions"}
              </button>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3 border-t border-line pt-5">
        <button type="button" className="btn-primary" onClick={() => setAddOpen(true)}>Add role</button>
      </div>

      <PermissionMatrix role={editing?.name ?? null} locked={editing?.locked} onClose={() => setEditing(null)} />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a role">
        <label className="block">
          <span className="lbl">Role name</span>
          <input className="input" value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="e.g. Finance Lead" autoFocus />
        </label>
        <div className="mt-5 flex gap-3">
          <button
            className="btn-primary"
            onClick={() => {
              if (!newRole.trim()) return;
              const role = { name: newRole.trim(), members: 0 };
              setRoles((rs) => [...rs, role]);
              void api.create("roles", { id: role.name, ...role });
              push(`Role “${role.name}” created — set its permissions next`);
              setEditing({ name: role.name });
              setNewRole("");
              setAddOpen(false);
            }}
          >
            Create role
          </button>
          <button className="btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
        </div>
      </Modal>
    </div>
  );
}

/* ---------- two-factor authentication ---------- */
function TwoFactorSetup() {
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [codes] = useState(() =>
    Array.from({ length: 8 }, () => Math.random().toString(36).slice(2, 6).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase())
  );
  const secret = "JBSWY3DPEHPK3PXP";

  // deterministic little QR-ish block so the modal looks like a real enrolment
  const cells: boolean[] = [];
  let seed = 42;
  for (let i = 0; i < 100; i++) {
    seed = (seed * 75 + 74) % 65537;
    cells.push(seed % 3 !== 0);
  }

  return (
    <>
      {enabled ? (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-good-soft px-3 py-1.5 text-sm font-semibold text-good">
          ✓ Two-factor authentication is on
          <button className="ml-2 cursor-pointer text-xs font-medium text-muted underline" onClick={() => { setEnabled(false); push("2FA disabled"); }}>
            disable
          </button>
        </p>
      ) : (
        <button type="button" className="btn-primary mt-3" onClick={() => setOpen(true)}>Enable</button>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Set up two-factor authentication" wide>
        <ol className="space-y-5 text-sm">
          <li>
            <p className="font-semibold">1. Scan this code in your authenticator app</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-5">
              <svg width="132" height="132" viewBox="0 0 10 10" className="rounded-lg border border-line bg-white p-1">
                {cells.map((c, i) => c && <rect key={i} x={i % 10} y={Math.floor(i / 10)} width="1" height="1" fill="#1d1e2c" />)}
              </svg>
              <div>
                <p className="text-xs text-muted">Or enter this key manually:</p>
                <p className="mt-1 rounded-lg border border-line bg-page px-3 py-2 font-mono text-sm font-bold tracking-widest">{secret}</p>
              </div>
            </div>
          </li>
          <li>
            <p className="font-semibold">2. Enter the 6-digit code it shows</p>
            <input
              className="input mt-2 w-40 text-center font-mono text-lg tracking-[0.3em]"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
            />
          </li>
          <li>
            <p className="font-semibold">3. Save your backup codes</p>
            <p className="text-xs text-muted">Each code works once if you lose your device.</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-lg border border-line bg-page/60 p-3 font-mono text-xs sm:grid-cols-4">
              {codes.map((c) => <span key={c}>{c}</span>)}
            </div>
          </li>
        </ol>
        <div className="mt-5 flex items-center gap-3">
          <button
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            disabled={code.length !== 6}
            onClick={() => {
              if (code.length !== 6) return push("Enter the 6-digit code from your app");
              setEnabled(true);
              void api.create("securitySettings", { id: "2fa", enabled: true, method: "authenticator", at: new Date().toISOString() });
              push("Two-factor authentication enabled");
              setOpen(false);
            }}
          >
            Verify &amp; enable
          </button>
          <button className="btn-outline" onClick={() => { navigator.clipboard?.writeText(codes.join("\n")).catch(() => {}); push("Backup codes copied"); }}>
            Copy backup codes
          </button>
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </Modal>
    </>
  );
}

/* ---------- add currency ---------- */
function AddCurrency() {
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", symbol: "", rate: "1" });

  return (
    <>
      <div className="mt-2 flex items-center gap-3 border-t border-line pt-5">
        <button type="button" className="btn-primary" onClick={() => setOpen(true)}>Add new currency</button>
        <span className="ml-auto text-[11px] text-faint">Rates are quoted against your base currency</span>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Add a currency" wide>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {([
            ["name", "Currency name", "e.g. Canadian Dollar"],
            ["code", "ISO code", "e.g. CAD"],
            ["symbol", "Symbol", "e.g. C$"],
            ["rate", "Exchange rate (1 base =)", "e.g. 1.36"],
          ] as const).map(([k, label, ph]) => (
            <label key={k} className="block">
              <span className="lbl">{label}</span>
              <input className="input" value={form[k]} placeholder={ph} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </label>
          ))}
        </div>
        <div className="mt-5 flex gap-3">
          <button
            className="btn-primary"
            onClick={() => {
              if (!form.code.trim() || !form.name.trim()) return push("Currency name and ISO code are required");
              void api.create("currencies", { id: form.code.toUpperCase(), ...form, rate: Number(form.rate) || 1 });
              push(`${form.code.toUpperCase()} added at ${form.rate} to base`);
              setForm({ name: "", code: "", symbol: "", rate: "1" });
              setOpen(false);
            }}
          >
            Add currency
          </button>
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </Modal>
    </>
  );
}

/* ---------- small reusable list editor (rows persist as normal inputs) ---------- */
function ListEditor({
  label, seed, placeholder,
}: { label: string; seed: string[]; placeholder: string }) {
  const { saved } = useContext(PaneCtx);
  const [rows, setRows] = useState(() => {
    const restored: string[] = [];
    for (let i = 0; `${label} ${i + 1}` in saved; i++) restored.push(String(saved[`${label} ${i + 1}`]));
    return restored.length ? restored : seed;
  });
  return (
    <div className="max-w-md">
      <div className="space-y-2">
        {rows.map((r, i) => (
          <label key={i} className="flex items-center gap-2">
            <span className="lbl" style={{ display: "none" }}>{`${label} ${i + 1}`}</span>
            <input className="input flex-1" defaultValue={r} placeholder={placeholder} />
            <button
              type="button"
              className="cursor-pointer rounded-lg border border-line px-2.5 py-2 text-xs text-muted hover:border-bad hover:text-bad"
              onClick={() => setRows((rs) => rs.filter((_, x) => x !== i))}
            >
              Remove
            </button>
          </label>
        ))}
      </div>
      <button type="button" className="btn-outline mt-3" onClick={() => setRows((rs) => [...rs, ""])}>
        + Add {label.toLowerCase()}
      </button>
    </div>
  );
}

/* ---------- finance sub-tabs ---------- */
const INVOICE_TEMPLATES = [
  { id: "classic", name: "Classic", note: "Serif headings, itemised table, totals right." },
  { id: "modern", name: "Modern", note: "Accent header band, condensed line items." },
  { id: "compact", name: "Compact", note: "Single page, small type, ideal for retainers." },
];

function InvoiceTemplateTab() {
  const [picked, setPicked] = useState(useSaved("Invoice template", "modern"));
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        {INVOICE_TEMPLATES.map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => setPicked(t.id)}
            className={clsx(
              "cursor-pointer rounded-xl border p-3 text-left transition-colors",
              picked === t.id ? "border-primary bg-primary-soft/50" : "border-line hover:border-primary/50"
            )}
          >
            <div className="mb-2.5 space-y-1.5 rounded-lg border border-line bg-white p-3">
              <div className={clsx("h-2.5 w-1/2 rounded", picked === t.id ? "bg-primary" : "bg-line")} />
              <div className="h-1.5 w-3/4 rounded bg-line" />
              <div className="mt-2.5 space-y-1">
                {[0, 1, 2].map((r) => (
                  <div key={r} className="flex gap-1.5">
                    <div className="h-1.5 flex-1 rounded bg-line" />
                    <div className="h-1.5 w-6 rounded bg-line" />
                  </div>
                ))}
              </div>
              <div className="ml-auto h-2 w-10 rounded bg-line" />
            </div>
            <p className="text-sm font-semibold">{t.name}</p>
            <p className="mt-0.5 text-xs text-muted">{t.note}</p>
          </button>
        ))}
      </div>
      <label>
        <span className="lbl" style={{ display: "none" }}>Invoice template</span>
        <input type="hidden" name="Invoice template" value={picked} readOnly />
      </label>
      <FormGrid cols={2}>
        <Field label="Accent colour"><TextInput defaultValue="#5b5ceb" /></Field>
        <Field label="Paper size"><SelectInput options={["A4", "Letter", "Legal"]} /></Field>
      </FormGrid>
      <Field label="Footer note printed on every invoice">
        <TextArea rows={3} placeholder="Thank you for your business. Payment by bank transfer to…" />
      </Field>
      <div className="mt-4 flex flex-wrap gap-5">
        <CheckboxInput label="Show PAID stamp when settled" defaultChecked />
        <CheckboxInput label="Show authorised signature" defaultChecked />
        <CheckboxInput label="Show bank details block" defaultChecked />
        <CheckboxInput label="Include QR code for online payment" />
      </div>
    </>
  );
}

const PREFIX_ROWS = [
  { doc: "Invoice", prefix: "INV", next: "1042" },
  { doc: "Estimate", prefix: "EST", next: "318" },
  { doc: "Proposal", prefix: "PRP", next: "126" },
  { doc: "Credit Note", prefix: "CN", next: "47" },
  { doc: "Payment", prefix: "PAY", next: "903" },
  { doc: "Expense", prefix: "EXP", next: "551" },
];

function PrefixTab() {
  const [sep, setSep] = useState(useSaved("Separator", "#"));
  const [pad, setPad] = useState(useSaved("Zero padding", "4"));
  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-page text-left text-xs font-semibold text-muted uppercase">
            <tr>
              <th className="px-4 py-2.5">Document</th>
              <th className="px-4 py-2.5">Prefix</th>
              <th className="px-4 py-2.5">Next number</th>
              <th className="px-4 py-2.5">Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {PREFIX_ROWS.map((r) => (
              <PrefixRow key={r.doc} row={r} sep={sep} pad={Number(pad) || 0} />
            ))}
          </tbody>
        </table>
      </div>
      <FormGrid cols={2}>
        <Field label="Separator">
          <select className="input" value={sep} onChange={(e) => setSep(e.target.value)}>
            {["#", "-", "/", ""].map((s) => (
              <option key={s} value={s}>{s === "" ? "(none)" : s}</option>
            ))}
          </select>
        </Field>
        <Field label="Zero padding">
          <select className="input" value={pad} onChange={(e) => setPad(e.target.value)}>
            {["0", "3", "4", "5", "6"].map((p) => (
              <option key={p} value={p}>{p === "0" ? "No padding" : `${p} digits`}</option>
            ))}
          </select>
        </Field>
      </FormGrid>
      <div className="mt-2 flex flex-wrap gap-5">
        <CheckboxInput label="Reset numbering every financial year" />
        <CheckboxInput label="Include year in number (INV-2026-0042)" defaultChecked />
      </div>
    </>
  );
}

function PrefixRow({ row, sep, pad }: { row: (typeof PREFIX_ROWS)[number]; sep: string; pad: number }) {
  const [prefix, setPrefix] = useState(useSaved(`${row.doc} prefix`, row.prefix));
  const [next, setNext] = useState(useSaved(`${row.doc} next number`, row.next));
  const preview = `${prefix}${sep}${next.padStart(pad, "0")}`;
  return (
    <tr>
      <td className="px-4 py-2.5 font-medium">{row.doc}</td>
      <td className="px-4 py-2">
        <label className="block">
          <span className="lbl" style={{ display: "none" }}>{`${row.doc} prefix`}</span>
          <input className="input w-24" value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} />
        </label>
      </td>
      <td className="px-4 py-2">
        <label className="block">
          <span className="lbl" style={{ display: "none" }}>{`${row.doc} next number`}</span>
          <input className="input w-28" value={next} onChange={(e) => setNext(e.target.value.replace(/\D/g, ""))} />
        </label>
      </td>
      <td className="px-4 py-2.5 font-mono text-[13px] text-primary">{preview}</td>
    </tr>
  );
}

function RemindersTab() {
  return (
    <>
      <h3 className="mb-3 font-semibold">Invoice reminders</h3>
      <div className="space-y-2.5">
        <CheckboxInput label="Send a reminder before the due date" defaultChecked />
        <CheckboxInput label="Send a reminder on the due date" defaultChecked />
        <CheckboxInput label="Keep chasing after the due date" defaultChecked />
      </div>
      <FormGrid cols={3}>
        <Field label="Days before due date"><TextInput defaultValue="3" /></Field>
        <Field label="Repeat every X days when overdue"><TextInput defaultValue="7" /></Field>
        <Field label="Stop after X reminders"><TextInput defaultValue="4" /></Field>
        <Field label="Send at"><SelectInput options={["09:00", "12:00", "17:00"]} /></Field>
        <Field label="Skip weekends"><SelectInput options={["Yes", "No"]} /></Field>
        <Field label="Copy account manager"><SelectInput options={["Yes", "No"]} /></Field>
      </FormGrid>
      <h3 className="mt-6 mb-3 font-semibold">Other reminders</h3>
      <div className="space-y-2.5">
        <CheckboxInput label="Warn me before an estimate expires" defaultChecked />
        <CheckboxInput label="Notify when a recurring invoice is about to generate" defaultChecked />
        <CheckboxInput label="Notify when a contract renewal is 30 days out" />
        <CheckboxInput label="Alert when an expense is awaiting approval over 48h" defaultChecked />
      </div>
    </>
  );
}

function EstimateTab() {
  return (
    <>
      <FormGrid cols={2}>
        <Field label="Estimate valid for (days)" required><TextInput defaultValue="30" /></Field>
        <Field label="Default tax"><SelectInput options={["GST 18%", "GST 12%", "VAT 20%", "No tax"]} /></Field>
        <Field label="On client approval"><SelectInput options={["Convert to invoice automatically", "Notify me only", "Create a project"]} /></Field>
        <Field label="On client rejection"><SelectInput options={["Notify me only", "Move to lost", "Archive"]} /></Field>
      </FormGrid>
      <div className="mt-4 flex flex-wrap gap-5">
        <CheckboxInput label="Let clients accept online from the portal" defaultChecked />
        <CheckboxInput label="Require a typed digital signature" defaultChecked />
        <CheckboxInput label="Allow clients to comment before accepting" defaultChecked />
        <CheckboxInput label="Show line-item discounts" />
      </div>
      <Field label="Default terms shown on every estimate">
        <TextArea rows={4} placeholder="50% due on acceptance, balance on delivery. Prices exclude tax and are valid for 30 days." />
      </Field>
    </>
  );
}

/* ---------- attendance sub-tabs ---------- */
const SHIFT_SEED = [
  { name: "General", start: "09:00", end: "18:00", days: "Mon–Fri", members: 9 },
  { name: "Early", start: "06:00", end: "15:00", days: "Mon–Sat", members: 3 },
  { name: "Night", start: "22:00", end: "07:00", days: "Mon–Sun", members: 2 },
];

function ShiftsTab() {
  const [shifts, setShifts] = useState(SHIFT_SEED);
  const [open, setOpen] = useState(false);
  const { push } = useToast();
  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-page text-left text-xs font-semibold text-muted uppercase">
            <tr>
              <th className="px-4 py-2.5">Shift</th><th className="px-4 py-2.5">Starts</th>
              <th className="px-4 py-2.5">Ends</th><th className="px-4 py-2.5">Working days</th>
              <th className="px-4 py-2.5">Assigned</th><th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shifts.map((s, i) => (
              <tr key={s.name}>
                <td className="px-4 py-2.5 font-medium">{s.name}</td>
                <td className="px-4 py-2.5">{s.start}</td>
                <td className="px-4 py-2.5">{s.end}</td>
                <td className="px-4 py-2.5 text-muted">{s.days}</td>
                <td className="px-4 py-2.5">{s.members} people</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    className="cursor-pointer text-xs font-semibold text-muted hover:text-bad"
                    onClick={() => { setShifts((xs) => xs.filter((_, x) => x !== i)); push(`${s.name} shift removed`); }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn-outline mt-3" onClick={() => setOpen(true)}>+ Add shift</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add shift">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setShifts((xs) => [...xs, {
              name: String(f.get("name") || "New shift"),
              start: String(f.get("start") || "09:00"),
              end: String(f.get("end") || "18:00"),
              days: String(f.get("days") || "Mon–Fri"),
              members: 0,
            }]);
            setOpen(false);
            push("Shift added");
          }}
        >
          <FormGrid cols={2}>
            <Field label="Shift name" required><input name="name" className="input" required placeholder="Weekend cover" /></Field>
            <Field label="Working days"><select name="days" className="input">{["Mon–Fri", "Mon–Sat", "Mon–Sun", "Sat–Sun"].map((d) => <option key={d}>{d}</option>)}</select></Field>
            <Field label="Starts at"><input name="start" type="time" className="input" defaultValue="09:00" /></Field>
            <Field label="Ends at"><input name="end" type="time" className="input" defaultValue="18:00" /></Field>
          </FormGrid>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary">Add shift</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function RotationTab() {
  return (
    <>
      <div className="flex items-center gap-3">
        <Toggle defaultChecked />
        <span className="text-sm font-medium">Rotate shifts automatically</span>
      </div>
      <FormGrid cols={3}>
        <Field label="Rotate every" required><SelectInput options={["1 week", "2 weeks", "4 weeks", "1 month"]} /></Field>
        <Field label="Rotation starts on"><SelectInput options={["Monday", "Sunday", "1st of month"]} /></Field>
        <Field label="Notify employees"><SelectInput options={["3 days before", "1 week before", "Same day"]} /></Field>
      </FormGrid>
      <h3 className="mt-6 mb-3 font-semibold">Rotation order</h3>
      <p className="mb-3 text-sm text-muted">Employees move down this list each cycle.</p>
      <ListEditor label="Rotation step" seed={["General", "Early", "Night"]} placeholder="Shift name" />
      <div className="mt-5 flex flex-wrap gap-5">
        <CheckboxInput label="Skip employees who are on leave" defaultChecked />
        <CheckboxInput label="Never assign night shift two cycles in a row" defaultChecked />
      </div>
    </>
  );
}

function QrTab() {
  const { push } = useToast();
  const [rotate, setRotate] = useState(0);
  const cells: boolean[] = [];
  let seed = 907 + rotate * 31;
  for (let i = 0; i < 144; i++) {
    seed = (seed * 75 + 74) % 65537;
    cells.push(seed % 3 !== 0);
  }
  return (
    <>
      <div className="flex flex-wrap items-start gap-6">
        <div className="text-center">
          <svg width="164" height="164" viewBox="0 0 12 12" className="rounded-xl border border-line bg-white p-1.5">
            {cells.map((c, i) => c && <rect key={i} x={i % 12} y={Math.floor(i / 12)} width="1" height="1" fill="#1d1e2c" />)}
          </svg>
          <button type="button" className="btn-outline mt-3 w-full" onClick={() => { setRotate((r) => r + 1); push("New clock-in code generated"); }}>
            Regenerate
          </button>
        </div>
        <div className="min-w-[260px] flex-1">
          <p className="text-sm text-muted">
            Print this code at reception. Employees scan it from the mobile app to clock in — the code
            rotates on the schedule below so a photographed code stops working.
          </p>
          <FormGrid cols={2}>
            <Field label="Code rotates"><SelectInput options={["Every 60 seconds", "Every 15 minutes", "Daily", "Never"]} /></Field>
            <Field label="Valid at location"><SelectInput options={["Head Office", "Warehouse", "Any location"]} /></Field>
          </FormGrid>
          <div className="mt-4 flex flex-wrap gap-5">
            <CheckboxInput label="Require the employee to also be on office Wi-Fi" defaultChecked />
            <CheckboxInput label="Capture a selfie on scan" />
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- tax rates ---------- */
const TAX_SEED = [
  { name: "GST", rate: "18" },
  { name: "GST (reduced)", rate: "12" },
  { name: "GST (essential)", rate: "5" },
  { name: "Zero rated", rate: "0" },
];

function TaxTable() {
  const [rows, setRows] = useState(TAX_SEED);
  const { push } = useToast();
  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-page text-left text-xs font-semibold text-muted uppercase">
            <tr><th className="px-4 py-2.5">Tax name</th><th className="px-4 py-2.5">Rate %</th><th className="px-4 py-2.5" /></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-2">
                  <label className="block"><span className="lbl" style={{ display: "none" }}>{`Tax ${i + 1} name`}</span>
                    <input className="input" defaultValue={r.name} /></label>
                </td>
                <td className="px-4 py-2">
                  <label className="block"><span className="lbl" style={{ display: "none" }}>{`Tax ${i + 1} rate`}</span>
                    <input className="input w-24" defaultValue={r.rate} /></label>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    className="cursor-pointer text-xs font-semibold text-muted hover:text-bad"
                    onClick={() => { setRows((xs) => xs.filter((_, x) => x !== i)); push(`${r.name} removed`); }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn-outline mt-3" onClick={() => setRows((xs) => [...xs, { name: "", rate: "0" }])}>
        + Add tax
      </button>
    </>
  );
}

/* ---------- salary components ---------- */
const COMPONENT_SEED = [
  { name: "Basic", kind: "Earning", calc: "% of CTC", value: "50" },
  { name: "House Rent Allowance", kind: "Earning", calc: "% of Basic", value: "40" },
  { name: "Conveyance", kind: "Earning", calc: "Fixed", value: "1600" },
  { name: "Provident Fund", kind: "Deduction", calc: "% of Basic", value: "12" },
  { name: "Professional Tax", kind: "Deduction", calc: "Fixed", value: "200" },
];

function SalaryComponents() {
  const [rows, setRows] = useState(COMPONENT_SEED);
  const [open, setOpen] = useState(false);
  const { push } = useToast();
  const earnings = rows.filter((r) => r.kind === "Earning").length;
  return (
    <>
      <p className="mb-3 text-sm text-muted">
        {rows.length} components · {earnings} earning, {rows.length - earnings} deduction. These make up gross and net pay on every payslip.
      </p>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-page text-left text-xs font-semibold text-muted uppercase">
            <tr>
              <th className="px-4 py-2.5">Component</th><th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Calculation</th><th className="px-4 py-2.5">Value</th><th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => (
              <tr key={r.name}>
                <td className="px-4 py-2.5 font-medium">{r.name}</td>
                <td className="px-4 py-2.5">
                  <StatusPill status={r.kind} tone={r.kind === "Earning" ? "good" : "bad"} />
                </td>
                <td className="px-4 py-2.5 text-muted">{r.calc}</td>
                <td className="px-4 py-2">
                  <label className="block"><span className="lbl" style={{ display: "none" }}>{`${r.name} value`}</span>
                    <input className="input w-28" defaultValue={r.value} /></label>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    className="cursor-pointer text-xs font-semibold text-muted hover:text-bad"
                    onClick={() => { setRows((xs) => xs.filter((_, x) => x !== i)); push(`${r.name} removed`); }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-faint">No salary components yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn-outline mt-3" onClick={() => setOpen(true)}>+ Add component</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add salary component">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const name = String(f.get("name") || "").trim();
            if (!name) return;
            setRows((xs) => [...xs, {
              name,
              kind: String(f.get("kind") || "Earning"),
              calc: String(f.get("calc") || "Fixed"),
              value: String(f.get("value") || "0"),
            }]);
            setOpen(false);
            push(`${name} added`);
          }}
        >
          <FormGrid cols={2}>
            <Field label="Component name" required><input name="name" className="input" required placeholder="Medical allowance" /></Field>
            <Field label="Type"><select name="kind" className="input"><option>Earning</option><option>Deduction</option></select></Field>
            <Field label="Calculation"><select name="calc" className="input"><option>Fixed</option><option>% of CTC</option><option>% of Basic</option></select></Field>
            <Field label="Value"><input name="value" className="input" defaultValue="0" /></Field>
          </FormGrid>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary">Add component</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function SectionBody({ slug }: { slug: string }) {
  const { push } = useToast();
  const [finTab, setFinTab] = useState("Invoice Settings");
  const [payTab, setPayTab] = useState("Paypal");
  const [attTab, setAttTab] = useState("Attendance Settings");
  const [tktTab, setTktTab] = useState("General");
  const [modTab, setModTab] = useState("Admin");
  const [leadTab, setLeadTab] = useState("Lead Source");
  const [payrollTab, setPayrollTab] = useState("Salary Components");

  switch (slug) {
    case "company":
      return (
        <Pane slug={slug} title="Company Settings">
          <FormGrid cols={2}>
            <Field label="Company Name" required><TextInput defaultValue="Worksuite" /></Field>
            <Field label="Company Email" required><TextInput defaultValue="company@email.com" /></Field>
            <Field label="Company Phone" required><TextInput defaultValue="1234567891" /></Field>
            <Field label="Company Website"><TextInput defaultValue="https://worksuite.biz" /></Field>
          </FormGrid>
          <SettingsSave />
        </Pane>
      );
    case "app":
      return (
        <Pane slug={slug} title="App Settings">
          <FormGrid>
            <Field label="Date Format"><SelectInput options={["d-m-Y (29-08-2026)", "m-d-Y (08-29-2026)", "Y-m-d (2026-08-29)"]} /></Field>
            <Field label="Time Format"><SelectInput options={["12 Hour(s) (07:33 pm)", "24 Hour(s) (19:33)"]} /></Field>
            <Field label="Default Timezone"><SelectInput options={["Asia/Kolkata", "UTC", "America/New_York"]} /></Field>
            <Field label="Default Currency"><SelectInput options={["$ (USD)", "£ (GBP)", "€ (EUR)", "₹ (INR)"]} /></Field>
            <Field label="Language"><SelectInput options={["English", "Spanish", "French"]} /></Field>
            <Field label="Datatable Row Limit"><SelectInput options={["10", "25", "50"]} /></Field>
          </FormGrid>
          <div className="mt-5 flex flex-wrap gap-6">
            <CheckboxInput label="App Debug" />
            <CheckboxInput label="App Update" defaultChecked />
            <CheckboxInput label="Enable Cache" defaultChecked />
            <CheckboxInput label="Employee can export data" defaultChecked />
          </div>
          <SettingsSave />
        </Pane>
      );
    case "notification":
      return (
        <Pane slug={slug} title="Notification Settings">
          <div className="mb-5 rounded-md bg-bad-soft px-4 py-3 text-sm text-bad">
            ⓘ Your SMTP details are not correct. Please update to the correct one.
          </div>
          <FormGrid cols={2}>
            <Field label="Mail From Name" required><TextInput defaultValue="Worksuite" /></Field>
            <Field label="Mail From Email" required><TextInput defaultValue="from@email.com" /></Field>
            <Field label="Mail Host" required><TextInput defaultValue="smtp.gmail.com" /></Field>
            <Field label="Mail Port" required><TextInput defaultValue="465" /></Field>
            <Field label="Mail Encryption"><SelectInput options={["ssl", "tls", "none"]} /></Field>
            <Field label="Mail Username"><TextInput defaultValue="myemail@gmail.com" /></Field>
          </FormGrid>
          <h3 className="mt-6 mb-3 font-semibold">Email Notification Settings</h3>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {NOTIF_EVENTS.map((ev) => (
              <CheckboxInput key={ev} label={ev} defaultChecked />
            ))}
          </div>
          <SettingsSave extra={<button className="btn-outline" onClick={() => push("Test email sent")}>Send Test Email</button>} />
        </Pane>
      );
    case "email-templates":
      return <EmailTemplates />;
    case "currency":
      return (
        <Pane slug={slug} title="Currency Settings">
          <div className="mb-4 rounded-md bg-info-soft px-4 py-3 text-sm text-info">
            ⓘ Exchange rate is calculated from your default currency. Change default currency in App Settings.
          </div>
          <div className="overflow-x-auto">
            <table className="tbl w-full text-sm">
              <thead>
                <tr><th>Currency Name</th><th>Symbol</th><th>Code</th><th>Exchange Rate</th><th>Format</th></tr>
              </thead>
              <tbody>
                {[
                  ["Dollars", "$", "USD", "1", "$1,000.00", true],
                  ["Pounds", "£", "GBP", "1", "£1,000.00", false],
                  ["Euros", "€", "EUR", "1", "€1,000.00", false],
                  ["Rupee", "₹", "INR", "1", "₹1,000.00", false],
                ].map(([name, sym, code, rate, f, def]) => (
                  <tr key={code as string}>
                    <td className="font-medium">{name} {def && <StatusPill status="Default" tone="info" />}</td>
                    <td>{sym}</td><td>{code}</td><td>{rate}</td><td>{f}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AddCurrency />
        </Pane>
      );
    case "payment":
      return (
        <Pane slug={slug} title="Payment Credentials">
          <Tabs tabs={["Paypal", "Stripe", "Razorpay", "Paystack", "Mollie"]} active={payTab} onChange={setPayTab} className="mb-5" />
          <div className="flex items-center gap-3">
            <Toggle defaultChecked={false} onChange={() => push(`${payTab} status updated`)} />
            <span className="text-sm font-medium">{payTab} Status</span>
            <StatusPill status="Disabled" tone="bad" />
          </div>
          <p className="mt-4 max-w-lg text-sm text-muted">
            Add your {payTab} keys on the server side — credentials should never live in frontend code.
            This screen only toggles availability per gateway.
          </p>
          <SettingsSave />
        </Pane>
      );
    case "finance":
      return (
        <Pane slug={slug} title="Finance Settings">
          <Tabs
            tabs={["Invoice Settings", "Invoice Template", "Prefix Settings", "Units", "Reminders", "Estimate Setting"]}
            active={finTab}
            onChange={setFinTab}
            className="mb-5"
          />
          {finTab === "Invoice Settings" ? (
            <>
              <FormGrid cols={2}>
                <Field label="Invoice Logo"><FileDrop /></Field>
                <Field label="Authorised Signatory Signature"><FileDrop /></Field>
                <Field label="Language"><SelectInput options={["English"]} /></Field>
                <Field label="Due after" required><TextInput defaultValue="15" /></Field>
              </FormGrid>
              <h3 className="mt-6 mb-3 font-semibold">Client info to show on invoice</h3>
              <div className="flex flex-wrap gap-5">
                {["Client Name", "Company Name", "Client Email", "Client Address", "Client Phone", "Show Project on invoice"].map((l, i) => (
                  <CheckboxInput key={l} label={l} defaultChecked={i < 5} />
                ))}
              </div>
            </>
          ) : finTab === "Invoice Template" ? (
            <InvoiceTemplateTab />
          ) : finTab === "Prefix Settings" ? (
            <PrefixTab />
          ) : finTab === "Units" ? (
            <>
              <p className="mb-3 text-sm text-muted">Units offered on invoice and estimate line items.</p>
              <ListEditor label="Unit" seed={["Hour", "Day", "Sprint", "Licence", "Piece", "Month"]} placeholder="e.g. Hour" />
            </>
          ) : finTab === "Reminders" ? (
            <RemindersTab />
          ) : (
            <EstimateTab />
          )}
          <SettingsSave />
        </Pane>
      );
    case "attendance":
      return (
        <Pane slug={slug} title="Attendance Settings">
          <Tabs tabs={["Attendance Settings", "Employee Shifts", "Shift Rotation", "QR Code"]} active={attTab} onChange={setAttTab} className="mb-5" />
          {attTab === "Attendance Settings" ? (
            <>
              <div className="space-y-2.5">
                <CheckboxInput label="Allow employee to request shift change" defaultChecked />
                <CheckboxInput label="Save Clock-In Location" />
                <CheckboxInput label="Allowed Employee self Clock-In/Clock-Out" defaultChecked />
                <CheckboxInput label="Auto clock-in employee by first sign in" />
                <CheckboxInput label="Clock-in check with added location Radius" />
                <CheckboxInput label="Allow clock-in outside shift hours" />
                <CheckboxInput label="Clock-in check with added IP address" />
              </div>
              <FormGrid cols={2}>
                <Field label="Allowed Working From" required><SelectInput options={["Office, Home, Other", "Office", "Home"]} /></Field>
                <Field label="Week Starts From" required><SelectInput options={["Monday", "Sunday"]} /></Field>
              </FormGrid>
            </>
          ) : attTab === "Employee Shifts" ? (
            <ShiftsTab />
          ) : attTab === "Shift Rotation" ? (
            <RotationTab />
          ) : (
            <QrTab />
          )}
          <SettingsSave />
        </Pane>
      );
    case "task":
      return (
        <Pane slug={slug} title="Task Settings">
          <h3 className="mb-3 font-semibold">Send Reminder</h3>
          <FormGrid>
            <Field label="Send task reminder before X days of due date"><TextInput defaultValue="0" /></Field>
            <Field label="Send task reminder after X days of due date"><TextInput defaultValue="0" /></Field>
            <Field label="Taskboard Default Length"><TextInput defaultValue="10" /></Field>
          </FormGrid>
          <h3 className="mt-6 mb-3 font-semibold">Sections visible to client</h3>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
            {["Task category", "Project", "Start Date", "Due Date", "Assigned To", "Description", "Label", "Assigned By", "Status", "Priority", "Make Private", "Time estimate", "Comment", "Add File", "Sub Task", "Timesheet", "Notes", "History"].map((l) => (
              <CheckboxInput key={l} label={l} defaultChecked />
            ))}
          </div>
          <SettingsSave />
        </Pane>
      );
    case "theme":
      return (
        <Pane slug={slug} title="Theme Settings">
          <FormGrid cols={2}>
            <Field label="App Name" required><TextInput defaultValue="Worksuite" /></Field>
            <Field label="Public Pages Theme"><SelectInput options={["Light", "Dark"]} /></Field>
            <Field label="Light Mode Logo"><FileDrop /></Field>
            <Field label="Dark Mode Logo"><FileDrop /></Field>
          </FormGrid>
          {["Admin Panel Theme", "Employee Panel Theme", "Client Panel Theme"].map((panel) => (
            <div key={panel} className="mt-5 border-t border-line pt-5">
              <h3 className="mb-3 font-semibold">{panel}</h3>
              <FormGrid cols={2}>
                <Field label="Primary Color" required>
                  <span className="flex items-center gap-2">
                    <TextInput defaultValue="#5b5ceb" />
                    <span className="h-9 w-10 shrink-0 rounded-md border border-line bg-primary" />
                  </span>
                </Field>
                <Field label="Sidebar Theme"><SelectInput options={["Dark", "Light"]} /></Field>
              </FormGrid>
            </div>
          ))}
          <SettingsSave
            extra={
              <button
                type="button"
                className="btn-outline"
                onClick={(e) => {
                  const form = (e.currentTarget as HTMLElement).closest("form");
                  form?.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])').forEach((i) => {
                    i.value = "#5b5ceb";
                  });
                  push("Theme colours reset to the Worksuite default");
                }}
              >
                Use Default Theme
              </button>
            }
          />
        </Pane>
      );
    case "module":
      return (
        <Pane slug={slug} title="Module Settings">
          <Tabs tabs={["Admin", "Employee", "Client"]} active={modTab} onChange={setModTab} className="mb-5" />
          <p className="mb-4 text-sm text-muted">
            Modules switched off here disappear from the sidebar for everyone with the {modTab} role.
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
            {MODULES.map((m) => (
              <label key={m} className="block">
                <span className="lbl mb-1.5 block text-sm"><span style={{ display: "none" }}>{`${modTab} · `}</span>{m}</span>
                <Toggle
                  key={`${modTab}-${m}`}
                  defaultChecked={modTab === "Admin" || !CLIENT_HIDDEN.includes(m) || modTab === "Employee"}
                  onChange={(v) => push(`${m} ${v ? "enabled" : "disabled"} for ${modTab}`)}
                />
              </label>
            ))}
          </div>
          <p className="mt-6 rounded-md bg-page px-4 py-3 text-xs text-muted">
            The Monitor module is intentionally excluded from this build.
          </p>
        </Pane>
      );
    case "roles":
      return <RolesPane />;
    case "security":
      return (
        <Pane slug={slug} title="Security Settings">
          <div className="mb-4 rounded-md bg-page px-4 py-3 text-sm text-muted">
            ⓘ Increase your account's security by enabling Two-Factor Authentication (2FA)
          </div>
          <div className="space-y-4">
            <div className="rounded-lg border border-line p-5">
              <p className="font-semibold">📧 Setup Using Email</p>
              <p className="mt-1 text-sm text-muted">Enabling this feature will send a code to admin@worksuite.demo on login.</p>
            </div>
            <div className="rounded-lg border border-line p-5">
              <p className="font-semibold">🔑 Setup Using Google Authenticator</p>
              <p className="mt-1 text-sm text-muted">Use the Authenticator app to get free verification codes, even offline.</p>
              <TwoFactorSetup />
            </div>
          </div>
        </Pane>
      );
    case "storage":
      return (
        <Pane slug={slug} title="Storage Settings">
          <LocalStoragePane />
        </Pane>
      );
    case "custom-fields":
      return (
        <Pane slug={slug} title="Custom Fields">
          <p className="py-10 text-center text-sm text-faint">- No record found. -</p>
          <SettingsSave saveLabel="Add Field" toast="Custom field builder — entity, label, type, required" />
        </Pane>
      );
    case "lead":
      return (
        <Pane slug={slug} title="Lead Settings">
          <Tabs tabs={["Lead Source", "Pipeline", "Deal Agent", "Round Robin"]} active={leadTab} onChange={setLeadTab} className="mb-5" />
          {leadTab === "Lead Source" ? (
            <>
              <p className="mb-3 text-sm text-muted">Where your leads come from. Shown on the lead form and in source reports.</p>
              <ListEditor label="Lead source" seed={["Email", "Google", "Facebook", "Referral", "Direct", "Event"]} placeholder="e.g. Google" />
            </>
          ) : leadTab === "Pipeline" ? (
            <>
              <p className="mb-3 text-sm text-muted">Deal stages, in order. The last stage counts as won.</p>
              <ListEditor label="Pipeline stage" seed={["Qualified", "Discovery", "Proposal Sent", "Negotiation", "Won"]} placeholder="e.g. Proposal Sent" />
              <FormGrid cols={2}>
                <Field label="Mark a deal lost after X days of no activity"><TextInput defaultValue="45" /></Field>
                <Field label="Default deal currency"><SelectInput options={["USD", "INR", "EUR", "GBP"]} /></Field>
              </FormGrid>
            </>
          ) : leadTab === "Deal Agent" ? (
            <>
              <p className="mb-3 text-sm text-muted">Who can own deals, and who picks up anything unassigned.</p>
              <FormGrid cols={2}>
                <Field label="Default deal owner"><SelectInput options={employees.map((e) => e.name)} /></Field>
                <Field label="When an owner leaves, reassign to"><SelectInput options={["Their manager", "Default owner", "Leave unassigned"]} /></Field>
              </FormGrid>
              <div className="mt-4 space-y-2.5">
                <CheckboxInput label="Let agents see deals they do not own" defaultChecked />
                <CheckboxInput label="Notify the owner when a lead they own replies" defaultChecked />
                <CheckboxInput label="Allow agents to reassign their own deals" />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Toggle defaultChecked={false} onChange={(v) => push(`Round robin ${v ? "on" : "off"}`)} />
                <span className="text-sm font-medium">Distribute new leads automatically</span>
              </div>
              <FormGrid cols={2}>
                <Field label="Distribute by"><SelectInput options={["Even rotation", "Fewest open deals", "Highest close rate"]} /></Field>
                <Field label="Skip agents who are on leave"><SelectInput options={["Yes", "No"]} /></Field>
                <Field label="Maximum open leads per agent"><TextInput defaultValue="25" /></Field>
                <Field label="Reassign if untouched for (hours)"><TextInput defaultValue="24" /></Field>
              </FormGrid>
              <h3 className="mt-6 mb-3 font-semibold">Rotation order</h3>
              <ListEditor label="Rotation agent" seed={employees.slice(0, 4).map((e) => e.name)} placeholder="Agent name" />
            </>
          )}
          <SettingsSave toast="Lead settings saved" />
        </Pane>
      );
    case "profile":
      return (
        <Pane slug={slug} title="Profile Settings">
          <FormGrid cols={2}>
            <Field label="Profile Picture"><FileDrop /></Field>
            <Field label="Full Name" required><TextInput defaultValue={CURRENT_USER.name} /></Field>
            <Field label="Email" required><TextInput defaultValue={CURRENT_USER.email} /></Field>
            <Field label="Job Title"><TextInput defaultValue={CURRENT_USER.role} /></Field>
            <Field label="Mobile"><TextInput defaultValue="+91 98765 43210" /></Field>
            <Field label="Date of Birth"><DateInput defaultValue="1992-04-17" /></Field>
            <Field label="Locale"><SelectInput options={["English (India)", "English (US)", "English (UK)"]} /></Field>
            <Field label="Time Zone"><SelectInput options={["Asia/Kolkata", "UTC", "America/New_York", "Europe/London"]} /></Field>
          </FormGrid>
          <Field label="About me">
            <TextArea rows={3} placeholder="A short bio your teammates see on your profile card." />
          </Field>
          <h3 className="mt-6 mb-3 font-semibold">Working hours</h3>
          <FormGrid cols={3}>
            <Field label="Starts"><SelectInput options={["09:00", "08:00", "10:00"]} /></Field>
            <Field label="Ends"><SelectInput options={["18:00", "17:00", "19:00"]} /></Field>
            <Field label="Weekly capacity (hours)"><TextInput defaultValue="40" /></Field>
          </FormGrid>
          <h3 className="mt-6 mb-3 font-semibold">Preferences</h3>
          <div className="space-y-2.5">
            <CheckboxInput label="Show my presence to teammates" defaultChecked />
            <CheckboxInput label="Start my timer automatically when I open a task" />
            <CheckboxInput label="Send me a daily digest at 8am" defaultChecked />
            <CheckboxInput label="Use compact table density" />
          </div>
          <SettingsSave toast="Profile updated" />
        </Pane>
      );
    case "tax":
      return (
        <Pane slug={slug} title="Tax Settings">
          <p className="mb-3 text-sm text-muted">Taxes available on invoice, estimate and expense line items.</p>
          <TaxTable />
          <FormGrid cols={2}>
            <Field label="Default tax on new invoices"><SelectInput options={["GST 18%", "GST 12%", "GST 5%", "No tax"]} /></Field>
            <Field label="Tax number shown on documents"><TextInput defaultValue="29ABCDE1234F1Z5" /></Field>
          </FormGrid>
          <div className="mt-4 flex flex-wrap gap-5">
            <CheckboxInput label="Prices entered are tax-inclusive" />
            <CheckboxInput label="Apply tax per line item rather than per invoice" defaultChecked />
            <CheckboxInput label="Show a tax summary block on documents" defaultChecked />
          </div>
          <SettingsSave toast="Tax settings saved" />
        </Pane>
      );
    case "ticket":
      return (
        <Pane slug={slug} title="Ticket Settings">
          <Tabs tabs={["General", "Types", "Groups", "SLA"]} active={tktTab} onChange={setTktTab} className="mb-5" />
          {tktTab === "General" ? (
            <>
              <FormGrid cols={2}>
                <Field label="Default priority"><SelectInput options={["Medium", "Low", "High", "Urgent"]} /></Field>
                <Field label="Assign new tickets to"><SelectInput options={["Round robin", "Least busy agent", "Leave unassigned"]} /></Field>
                <Field label="Auto-close resolved tickets after (days)"><TextInput defaultValue="7" /></Field>
                <Field label="Reopen window after close (days)"><TextInput defaultValue="14" /></Field>
              </FormGrid>
              <div className="mt-4 space-y-2.5">
                <CheckboxInput label="Let clients raise tickets from the portal" defaultChecked />
                <CheckboxInput label="Email the requester on every agent reply" defaultChecked />
                <CheckboxInput label="Ask for a satisfaction rating when resolved" defaultChecked />
                <CheckboxInput label="Allow clients to see the assigned agent" />
              </div>
            </>
          ) : tktTab === "Types" ? (
            <ListEditor label="Ticket type" seed={["Problem", "Request", "Question", "Incident"]} placeholder="e.g. Problem" />
          ) : tktTab === "Groups" ? (
            <ListEditor label="Ticket group" seed={["Technical", "Billing", "Onboarding"]} placeholder="e.g. Technical" />
          ) : (
            <>
              <p className="mb-3 text-sm text-muted">Response and resolution targets per priority, in business hours.</p>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-sm">
                  <thead className="bg-page text-left text-xs font-semibold text-muted uppercase">
                    <tr><th className="px-4 py-2.5">Priority</th><th className="px-4 py-2.5">First response</th><th className="px-4 py-2.5">Resolution</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {[["Urgent", "1", "4"], ["High", "4", "8"], ["Medium", "8", "24"], ["Low", "24", "72"]].map(([p, r, x]) => (
                      <tr key={p}>
                        <td className="px-4 py-2.5 font-medium">{p}</td>
                        <td className="px-4 py-2">
                          <label className="block"><span className="lbl" style={{ display: "none" }}>{`${p} first response`}</span>
                            <input className="input w-24" defaultValue={r} /></label>
                        </td>
                        <td className="px-4 py-2">
                          <label className="block"><span className="lbl" style={{ display: "none" }}>{`${p} resolution`}</span>
                            <input className="input w-24" defaultValue={x} /></label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap gap-5">
                <CheckboxInput label="Escalate to the manager when a target is breached" defaultChecked />
                <CheckboxInput label="Pause the SLA clock while awaiting the customer" defaultChecked />
              </div>
            </>
          )}
          <SettingsSave toast="Ticket settings saved" />
        </Pane>
      );
    case "project":
      return (
        <Pane slug={slug} title="Project Settings">
          <FormGrid cols={2}>
            <Field label="Default project status"><SelectInput options={["Not Started", "In Progress", "On Hold"]} /></Field>
            <Field label="Default billing type"><SelectInput options={["Fixed price", "Hourly", "Retainer", "Non-billable"]} /></Field>
            <Field label="Warn when budget used reaches (%)"><TextInput defaultValue="80" /></Field>
            <Field label="Consider a project at risk after (days overdue)"><TextInput defaultValue="3" /></Field>
          </FormGrid>
          <h3 className="mt-6 mb-3 font-semibold">Behaviour</h3>
          <div className="space-y-2.5">
            <CheckboxInput label="Calculate progress from completed tasks" defaultChecked />
            <CheckboxInput label="Require a client on every project" defaultChecked />
            <CheckboxInput label="Let members log time without a task" />
            <CheckboxInput label="Lock timesheets once the week is approved" defaultChecked />
            <CheckboxInput label="Archive a project automatically when all milestones are complete" />
          </div>
          <h3 className="mt-6 mb-3 font-semibold">Visible to the client in the portal</h3>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
            {["Overview", "Milestones", "Tasks", "Gantt Chart", "Files", "Discussion", "Invoices", "Time Logs", "Burndown"].map((l, i) => (
              <CheckboxInput key={l} label={l} defaultChecked={i < 6} />
            ))}
          </div>
          <h3 className="mt-6 mb-3 font-semibold">Project categories</h3>
          <ListEditor label="Project category" seed={["Platform", "Client Delivery", "Internal", "R&D"]} placeholder="e.g. Platform" />
          <SettingsSave toast="Project settings saved" />
        </Pane>
      );
    case "leaves":
      return (
        <Pane slug={slug} title="Leaves Settings">
          <p className="mb-3 text-sm text-muted">
            Annual entitlement per leave type. These quotas drive the balances shown on leave requests.
          </p>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-page text-left text-xs font-semibold text-muted uppercase">
                <tr>
                  <th className="px-4 py-2.5">Leave type</th><th className="px-4 py-2.5">Days per year</th>
                  <th className="px-4 py-2.5">Paid</th><th className="px-4 py-2.5">Carry forward</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {leaveTypes().map(({ name: t, quota }) => (
                  <tr key={t}>
                    <td className="px-4 py-2.5 font-medium">{t}</td>
                    <td className="px-4 py-2">
                      <label className="block"><span className="lbl" style={{ display: "none" }}>{`${t} days per year`}</span>
                        <input className="input w-24" defaultValue={String(quota)} /></label>
                    </td>
                    <td className="px-4 py-2.5"><CheckboxInput label={`${t} paid`} defaultChecked hideLabel /></td>
                    <td className="px-4 py-2.5"><CheckboxInput label={`${t} carry forward`} defaultChecked={t === "Earned"} hideLabel /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <FormGrid cols={2}>
            <Field label="Leave year starts"><SelectInput options={["January", "April", "On joining anniversary"]} /></Field>
            <Field label="Approval required from"><SelectInput options={["Reporting manager", "HR", "Manager then HR"]} /></Field>
            <Field label="Notice required for planned leave (days)"><TextInput defaultValue="3" /></Field>
            <Field label="Maximum consecutive days"><TextInput defaultValue="15" /></Field>
          </FormGrid>
          <div className="mt-4 space-y-2.5">
            <CheckboxInput label="Allow half-day requests" defaultChecked />
            <CheckboxInput label="Allow a negative balance (leave without pay)" />
            <CheckboxInput label="Exclude weekends and holidays from the day count" defaultChecked />
            <CheckboxInput label="Notify the team calendar when leave is approved" defaultChecked />
          </div>
          <SettingsSave toast="Leave settings saved" />
        </Pane>
      );
    case "language":
      return (
        <Pane slug={slug} title="Language Settings">
          <FormGrid cols={2}>
            <Field label="Default language" required><SelectInput options={["English", "Hindi", "Spanish", "French", "German", "Arabic"]} /></Field>
            <Field label="Date format"><SelectInput options={["DD-MM-YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]} /></Field>
            <Field label="Time format"><SelectInput options={["24 hour", "12 hour"]} /></Field>
            <Field label="First day of the week"><SelectInput options={["Monday", "Sunday", "Saturday"]} /></Field>
          </FormGrid>
          <div className="mt-4 flex flex-wrap gap-5">
            <CheckboxInput label="Let each member pick their own language" defaultChecked />
            <CheckboxInput label="Send client emails in the client's language" defaultChecked />
            <CheckboxInput label="Enable right-to-left layout for RTL languages" />
          </div>
          <h3 className="mt-6 mb-3 font-semibold">Enabled languages</h3>
          <p className="mb-3 text-sm text-muted">Only enabled languages appear in the member language picker.</p>
          <ListEditor label="Language" seed={["English", "Hindi", "Spanish"]} placeholder="e.g. English" />
          <SettingsSave toast="Language settings saved" />
        </Pane>
      );
    case "payroll":
      return (
        <Pane slug={slug} title="Payroll Settings">
          <Tabs tabs={["Salary Components", "Salary Groups", "Salary TDS", "Payment Method"]} active={payrollTab} onChange={setPayrollTab} className="mb-5" />
          {payrollTab === "Salary Components" ? (
            <SalaryComponents />
          ) : payrollTab === "Salary Groups" ? (
            <>
              <p className="mb-3 text-sm text-muted">Bundles of components applied together when you set someone's salary.</p>
              <ListEditor label="Salary group" seed={["Standard Full Time", "Contract", "Intern", "Leadership"]} placeholder="e.g. Standard Full Time" />
              <FormGrid cols={2}>
                <Field label="Default group for new employees"><SelectInput options={["Standard Full Time", "Contract", "Intern", "Leadership"]} /></Field>
                <Field label="Pay cycle"><SelectInput options={["Monthly", "Fortnightly", "Weekly"]} /></Field>
              </FormGrid>
            </>
          ) : payrollTab === "Salary TDS" ? (
            <>
              <p className="mb-3 text-sm text-muted">Tax deducted at source, applied to gross pay when payroll runs.</p>
              <FormGrid cols={2}>
                <Field label="TDS regime"><SelectInput options={["New regime", "Old regime"]} /></Field>
                <Field label="Flat TDS rate (%)"><TextInput defaultValue="10" /></Field>
                <Field label="Annual exemption limit"><TextInput defaultValue="250000" /></Field>
                <Field label="Employer PF contribution (%)"><TextInput defaultValue="12" /></Field>
              </FormGrid>
              <div className="mt-4 space-y-2.5">
                <CheckboxInput label="Deduct TDS automatically each run" defaultChecked />
                <CheckboxInput label="Show the TDS breakdown on payslips" defaultChecked />
                <CheckboxInput label="Let employees submit investment declarations" defaultChecked />
              </div>
            </>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted">How salaries leave the business.</p>
              <FormGrid cols={2}>
                <Field label="Default payment method"><SelectInput options={["Bank transfer", "Cheque", "Cash", "UPI"]} /></Field>
                <Field label="Pay from account"><SelectInput options={["Operating account", "Payroll account"]} /></Field>
                <Field label="Pay on day of month"><TextInput defaultValue="1" /></Field>
                <Field label="If payday is a weekend"><SelectInput options={["Pay the Friday before", "Pay the next Monday"]} /></Field>
              </FormGrid>
              <div className="mt-4 space-y-2.5">
                <CheckboxInput label="Email payslips when payroll is marked paid" defaultChecked />
                <CheckboxInput label="Require a second approver before paying" defaultChecked />
                <CheckboxInput label="Generate a bank transfer file for the run" />
              </div>
            </>
          )}
          <SettingsSave toast="Payroll settings saved" />
        </Pane>
      );
    case "recruit":
      return (
        <Pane slug={slug} title="Recruit Settings">
          <FormGrid cols={2}>
            <Field label="Company Name"><TextInput defaultValue="Worksuite" /></Field>
            <Field label="Company Website"><TextInput defaultValue="https://worksuite.biz" /></Field>
            <Field label="Duplicate Job Application Restriction (In days)" required><TextInput defaultValue="180" /></Field>
            <Field label="Offer Letter Reminder To Candidate (In days)" required><TextInput defaultValue="0" /></Field>
          </FormGrid>
          <div className="mt-5 flex flex-wrap gap-6">
            <CheckboxInput label="Enable Career Site" defaultChecked />
            <CheckboxInput label="Google Recaptcha" />
            <CheckboxInput label="Job Alert" />
          </div>
          <SettingsSave />
        </Pane>
      );
    default:
      /* Every slug in SECTIONS has a real pane above, so this is only reached
         by a mistyped URL. */
      return (
        <div className="card p-10 text-center">
          <h2 className="text-[17px] font-semibold">No such settings section</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            There's no section called “{slug}”. Pick one from the list on the left.
          </p>
          <NavLink to="/settings/company" className="btn-primary mt-5 inline-flex">
            Go to Company Settings
          </NavLink>
        </div>
      );
  }
}

export default function Settings() {
  const { section = "company" } = useParams();
  const [q, setQ] = useState("");
  const title = SECTIONS.find((s) => s.slug === section)?.name ?? "Settings";
  return (
    <>
      <PageHeader title={title} crumbs={["Settings"]} />
      <div className="flex items-start gap-5">
        <aside className="card w-64 shrink-0 overflow-hidden">
          <div className="border-b border-line p-3">
            <span className="relative block">
              <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="input w-full py-1.5 pl-8" />
            </span>
          </div>
          <nav className="max-h-[calc(100vh-240px)] overflow-y-auto py-1">
            {SECTIONS.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())).map((s) => (
              <NavLink
                key={s.slug}
                to={`/settings/${s.slug}`}
                className={({ isActive }) =>
                  clsx(
                    "block border-r-2 px-4 py-2.5 text-[13.5px]",
                    isActive
                      ? "border-primary bg-page font-medium text-ink"
                      : "border-transparent text-muted hover:bg-page hover:text-ink"
                  )
                }
              >
                {s.name}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          <SectionBody slug={section} />
        </div>
      </div>
    </>
  );
}


/* ------------------------------------------------------- local data pane */

/** This build has no server, so "storage" means this browser. */
function LocalStoragePane() {
  const { push } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [size, setSize] = useState(() => storeSize());
  useEffect(() => onStoreChange(() => setSize(storeSize())), []);

  const kb = (size.bytes / 1024).toFixed(0);
  const pctOfBudget = Math.min(100, Math.round((size.bytes / (5 * 1024 * 1024)) * 100));

  return (
    <>
      <div className="mb-5 flex items-start gap-3 rounded-xl border-l-4 border-l-primary bg-page px-4 py-3 text-sm">
        <Database size={17} className="mt-0.5 shrink-0 text-primary" />
        <p className="text-muted">
          Almost everything lives on the server and is shared with your colleagues. A few areas
          don't have an endpoint yet — proposals, payslips, objectives and similar — and those are
          kept in this browser only: they survive a refresh, but nobody else can see them and
          clearing your browser data removes them.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["On the server", String(size.serverRecords)],
          ["In this browser", `${size.records} in ${size.collections} areas`],
          ["Browser storage", `${kb} KB`],
        ].map(([label, value]) => (
          <div key={label} className="card px-5 py-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-muted">Browser storage used</span>
          <span className="text-muted tabular-nums">{pctOfBudget}% of a typical 5 MB budget</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, pctOfBudget)}%` }} />
        </div>
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <p className="font-semibold">Reset browser data</p>
        <p className="mt-1 mb-3 text-sm text-muted">
          Puts the browser-only areas back to the data the app ships with. Server records are not
          touched.
        </p>
        <button className="btn bg-bad px-4 py-2 font-semibold text-white hover:brightness-110" onClick={() => setConfirming(true)}>
          <RotateCcw size={15} /> Reset browser data
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        text="Records held only in this browser will be replaced with the originals. Anything stored on the server is left alone. This cannot be undone."
        confirmLabel="Reset everything"
        onConfirm={() => {
          resetDemoData();
          setConfirming(false);
          push("Browser data reset");
        }}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}
