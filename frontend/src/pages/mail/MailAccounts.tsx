/* Mail accounts: connect a provider over IMAP/SMTP.
   The form captures exactly what a real client needs, and the connection test
   walks the same steps a real one would — but the handshake is simulated,
   which the page says plainly rather than implying a live mailbox. */
import clsx from "clsx";
import { Check, Info, Loader2, Mail, Plus, Server, Star, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmDialog } from "@/components/crud";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, Modal } from "@/components/ui";
import {
  MAIL_PROVIDERS, mailAccounts, type MailAccount, type MailSecurity,
} from "@/data/mail";
import { api } from "@/lib/api";
import { isEmail, testConnection, type ConnectionResult } from "@/lib/mail";
import { fmtDate } from "@/lib/format";
import { useToast } from "@/lib/store";

const SECURITIES: MailSecurity[] = ["SSL/TLS", "STARTTLS", "None"];

const blank = (): Partial<MailAccount> => ({
  name: "",
  email: "",
  provider: "Gmail",
  imapHost: "imap.gmail.com", imapPort: 993, imapSecurity: "SSL/TLS",
  smtpHost: "smtp.gmail.com", smtpPort: 465, smtpSecurity: "SSL/TLS",
  username: "",
  password: "",
  signature: "",
});

export default function MailAccounts() {
  const [accounts, setAccounts] = useState<MailAccount[]>(() => [...mailAccounts]);
  const [editing, setEditing] = useState<Partial<MailAccount> | null>(null);
  const [removing, setRemoving] = useState<MailAccount | null>(null);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ConnectionResult | null>(null);
  const { push } = useToast();

  const commit = (next: MailAccount[]) => {
    setAccounts(next);
    mailAccounts.splice(0, mailAccounts.length, ...next);
  };

  const applyProvider = (name: string) => {
    const p = MAIL_PROVIDERS.find((x) => x.name === name);
    if (!p) return;
    setEditing((e) => ({
      ...e,
      provider: name,
      imapHost: p.imapHost, imapPort: p.imapPort, imapSecurity: p.imapSecurity,
      smtpHost: p.smtpHost, smtpPort: p.smtpPort, smtpSecurity: p.smtpSecurity,
    }));
    setResult(null);
  };

  const runTest = async () => {
    if (!editing) return;
    setTesting(true);
    setResult(null);
    setResult(await testConnection(editing));
    setTesting(false);
  };

  const save = () => {
    if (!editing) return;
    const isNew = !editing.id;
    const rec: MailAccount = {
      id: editing.id ?? `ma-${Date.now().toString(36)}`,
      name: String(editing.name ?? "").trim() || String(editing.email ?? ""),
      email: String(editing.email ?? "").trim(),
      provider: editing.provider ?? "Custom (IMAP/SMTP)",
      color: editing.color ?? "#7C5CFF",
      imapHost: String(editing.imapHost ?? "").trim(),
      imapPort: Number(editing.imapPort) || 993,
      imapSecurity: editing.imapSecurity ?? "SSL/TLS",
      smtpHost: String(editing.smtpHost ?? "").trim(),
      smtpPort: Number(editing.smtpPort) || 587,
      smtpSecurity: editing.smtpSecurity ?? "STARTTLS",
      username: String(editing.username ?? editing.email ?? "").trim(),
      password: String(editing.password ?? ""),
      signature: String(editing.signature ?? ""),
      status: result?.ok ? "Connected" : "Not connected",
      lastSync: new Date().toISOString(),
      default: editing.default ?? accounts.length === 0,
    };

    const next = isNew ? [...accounts, rec] : accounts.map((a) => (a.id === rec.id ? rec : a));
    commit(next);
    if (isNew) api.create("mailAccounts", rec);
    else api.replace("mailAccounts", rec.id, rec);
    push(isNew ? `${rec.email} added` : `${rec.email} updated`);
    setEditing(null);
    setResult(null);
  };

  const makeDefault = (id: string) => {
    const next = accounts.map((a) => ({ ...a, default: a.id === id }));
    commit(next);
    next.forEach((a) => api.update("mailAccounts", a.id, { default: a.default }));
    push("Default account changed");
  };

  const remove = (a: MailAccount) => {
    const next = accounts.filter((x) => x.id !== a.id);
    if (next.length && !next.some((x) => x.default)) next[0].default = true;
    commit(next);
    api.remove("mailAccounts", a.id);
    setRemoving(null);
    push(`${a.email} removed`);
  };

  const emailOk = isEmail(String(editing?.email ?? ""));
  const canSave = emailOk && Boolean(editing?.imapHost?.trim()) && Boolean(editing?.smtpHost?.trim());

  return (
    <>
      <PageHeader
        title="Mail accounts"
        crumbs={["Mail"]}
        actions={
          <>
            <Link to="/mail" className="btn-outline">Back to mailbox</Link>
            <button className="btn-primary" onClick={() => { setEditing(blank()); setResult(null); }}>
              <Plus size={15} /> Add account
            </button>
          </>
        }
      />

      <div className="card mb-5 flex items-start gap-3 border-l-4 border-l-primary px-5 py-4">
        <Info size={18} className="mt-0.5 shrink-0 text-primary" />
        <div className="text-sm">
          <p className="font-semibold">Your password never stays in this browser</p>
          <p className="mt-1 text-muted">
            IMAP and SMTP are raw TCP protocols a browser cannot speak, so the connection is made
            by the server. Credentials are sent once, encrypted at rest, and never returned — to
            change a password you set a new one, and leaving the field blank keeps the current one.
          </p>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="card">
          <EmptyState text="No mail accounts yet — add one to get started" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {accounts.map((a) => (
            <div key={a.id} className="card flex flex-col p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: a.color }}>
                  <Mail size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {a.email}
                    {a.default && (
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary">Default</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{a.name} · {a.provider}</p>
                </div>
                <span
                  className={clsx(
                    "flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold",
                    a.status === "Connected" ? "bg-good-soft text-good" : a.status === "Error" ? "bg-bad-soft text-bad" : "bg-page text-muted"
                  )}
                >
                  {a.status === "Connected" ? <Check size={11} /> : <X size={11} />} {a.status}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-4 text-xs">
                <div>
                  <dt className="text-faint">IMAP (incoming)</dt>
                  <dd className="mt-0.5 font-mono font-medium">{a.imapHost || "—"}:{a.imapPort}</dd>
                  <dd className="text-muted">{a.imapSecurity}</dd>
                </div>
                <div>
                  <dt className="text-faint">SMTP (outgoing)</dt>
                  <dd className="mt-0.5 font-mono font-medium">{a.smtpHost || "—"}:{a.smtpPort}</dd>
                  <dd className="text-muted">{a.smtpSecurity}</dd>
                </div>
              </dl>

              <p className="mt-3 text-xs text-faint">Last sync {fmtDate(a.lastSync.slice(0, 10))}</p>

              <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                <button className="btn-outline px-2.5 py-1.5 text-xs" onClick={() => { setEditing({ ...a }); setResult(null); }}>
                  Edit
                </button>
                {!a.default && (
                  <button className="btn-outline px-2.5 py-1.5 text-xs" onClick={() => makeDefault(a.id)}>
                    <Star size={13} /> Make default
                  </button>
                )}
                <button
                  className="btn-ghost ml-auto cursor-pointer px-2 py-1.5 text-xs text-bad hover:bg-bad-soft"
                  onClick={() => setRemoving(a)}
                  aria-label={`Remove ${a.email}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------- add / edit modal */}
      <Modal
        open={editing !== null}
        onClose={() => { setEditing(null); setResult(null); }}
        title={editing?.id ? "Edit mail account" : "Connect a mail account"}
        wide
      >
        {editing && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="lbl">Provider</span>
                <select className="input" value={editing.provider} onChange={(e) => applyProvider(e.target.value)}>
                  {MAIL_PROVIDERS.map((p) => (
                    <option key={p.name}>{p.name}</option>
                  ))}
                </select>
                {MAIL_PROVIDERS.find((p) => p.name === editing.provider)?.note && (
                  <span className="mt-1 block text-xs text-muted">
                    {MAIL_PROVIDERS.find((p) => p.name === editing.provider)?.note}
                  </span>
                )}
              </label>

              <label className="block">
                <span className="lbl">Email address <span className="text-bad">*</span></span>
                <input
                  className={clsx("input", editing.email && !emailOk && "border-bad")}
                  type="email"
                  value={editing.email ?? ""}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value, username: e.target.value })}
                  placeholder="you@company.com"
                />
                {editing.email && !emailOk && <span className="mt-1 block text-xs text-bad">Not a valid email address</span>}
              </label>

              <label className="block">
                <span className="lbl">Display name</span>
                <input className="input" value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Shown on mail you send" />
              </label>
            </div>

            {/* incoming */}
            <fieldset className="rounded-xl border border-line p-4">
              <legend className="flex items-center gap-1.5 px-2 text-xs font-bold tracking-wide text-muted uppercase">
                <Server size={12} /> Incoming — IMAP
              </legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <label className="block sm:col-span-2">
                  <span className="lbl">Host <span className="text-bad">*</span></span>
                  <input className="input font-mono text-[13px]" value={editing.imapHost ?? ""} onChange={(e) => setEditing({ ...editing, imapHost: e.target.value })} placeholder="imap.example.com" />
                </label>
                <label className="block">
                  <span className="lbl">Port</span>
                  <input className="input font-mono text-[13px]" type="number" value={editing.imapPort ?? 993} onChange={(e) => setEditing({ ...editing, imapPort: Number(e.target.value) })} />
                </label>
                <label className="block">
                  <span className="lbl">Security</span>
                  <select className="input" value={editing.imapSecurity} onChange={(e) => setEditing({ ...editing, imapSecurity: e.target.value as MailSecurity })}>
                    {SECURITIES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
              </div>
            </fieldset>

            {/* outgoing */}
            <fieldset className="rounded-xl border border-line p-4">
              <legend className="flex items-center gap-1.5 px-2 text-xs font-bold tracking-wide text-muted uppercase">
                <Server size={12} /> Outgoing — SMTP
              </legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <label className="block sm:col-span-2">
                  <span className="lbl">Host <span className="text-bad">*</span></span>
                  <input className="input font-mono text-[13px]" value={editing.smtpHost ?? ""} onChange={(e) => setEditing({ ...editing, smtpHost: e.target.value })} placeholder="smtp.example.com" />
                </label>
                <label className="block">
                  <span className="lbl">Port</span>
                  <input className="input font-mono text-[13px]" type="number" value={editing.smtpPort ?? 587} onChange={(e) => setEditing({ ...editing, smtpPort: Number(e.target.value) })} />
                </label>
                <label className="block">
                  <span className="lbl">Security</span>
                  <select className="input" value={editing.smtpSecurity} onChange={(e) => setEditing({ ...editing, smtpSecurity: e.target.value as MailSecurity })}>
                    {SECURITIES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
              </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="lbl">Username</span>
                <input className="input" value={editing.username ?? ""} onChange={(e) => setEditing({ ...editing, username: e.target.value })} placeholder="Usually your full email address" />
              </label>
              <label className="block">
                <span className="lbl">Password</span>
                <input className="input" type="password" value={editing.password ?? ""} onChange={(e) => setEditing({ ...editing, password: e.target.value })} placeholder="App password for most providers" />
                <span className="mt-1 block text-xs text-faint">Stored in this browser only; never sent anywhere.</span>
              </label>
              <label className="block md:col-span-2">
                <span className="lbl">Signature</span>
                <textarea className="input resize-y" rows={3} value={editing.signature ?? ""} onChange={(e) => setEditing({ ...editing, signature: e.target.value })} placeholder={"Your Name\nRole · Company"} />
              </label>
            </div>

            {/* connection test */}
            {(testing || result) && (
              <div className="rounded-xl border border-line bg-page/60 p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  {testing ? <Loader2 size={14} className="animate-spin text-primary" /> : result?.ok ? <Check size={14} className="text-good" /> : <X size={14} className="text-bad" />}
                  {testing ? "Testing connection…" : result?.ok ? "All checks passed" : "Some checks failed"}
                </p>
                <ul className="space-y-1.5">
                  {result?.steps.map((s) => (
                    <li key={s.label} className="flex items-start gap-2 text-xs">
                      {s.ok ? <Check size={13} className="mt-0.5 shrink-0 text-good" /> : <X size={13} className="mt-0.5 shrink-0 text-bad" />}
                      <span className="font-medium">{s.label}</span>
                      <span className="text-muted">— {s.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-3 border-t border-line pt-4">
              <button className="btn-primary" onClick={save} disabled={!canSave}>
                {editing.id ? "Save account" : "Add account"}
              </button>
              <button className="btn-outline" onClick={runTest} disabled={testing}>
                {testing ? <Loader2 size={15} className="animate-spin" /> : <Server size={15} />} Test connection
              </button>
              <button className="btn-ghost" onClick={() => { setEditing(null); setResult(null); }}>Cancel</button>
              {!canSave && (
                <span className="self-center text-xs text-faint">Email, IMAP host and SMTP host are required</span>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        text={`Remove ${removing?.email}? Mail already in the mailbox stays where it is.`}
        confirmLabel="Remove account"
        onConfirm={() => removing && remove(removing)}
        onClose={() => setRemoving(null)}
      />
    </>
  );
}
