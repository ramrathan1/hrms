/* Letters: author templates, then generate one for a person.
   Generating is a two-step flow on purpose — you see the fully merged letter,
   edit it, and only then save it. What you approve is what gets stored. */
import { Eye, FileText, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog, FormModal } from "@/components/crud";
import { DataTable } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { Field, FormCard, FormGrid, RichText } from "@/components/FormKit";
import { AvatarName, EmptyState, Modal, Tabs } from "@/components/ui";
import { byId, employees } from "@/data/core";
import { generatedLetters, letterTemplates, type GeneratedLetter, type LetterTemplate } from "@/data/ops";
import { salaries } from "@/data/people2";
import { api, generateLetter, removeGeneratedLetter } from "@/lib/api";
import { fmtDate, money, todayISO } from "@/lib/format";
import { useToast } from "@/lib/store";

const TODAY = todayISO();
const COMPANY = "Worksuite";

/** Placeholders a template may use, with how each one is filled in. */
const MERGE_FIELDS: { token: string; describe: string; value: (e: (typeof employees)[number]) => string }[] = [
  { token: "employee_name", describe: "Full name", value: (e) => e.name },
  { token: "designation", describe: "Job title", value: (e) => e.designation },
  { token: "department", describe: "Department", value: (e) => e.department },
  { token: "joining_date", describe: "Date joined", value: (e) => fmtDate(e.joined) },
  { token: "salary", describe: "Annual salary", value: (e) => money(salaries.find((s) => s.employee === e.id)?.annual ?? 0) },
  { token: "email", describe: "Work email", value: (e) => e.email },
  { token: "manager", describe: "Reports to", value: (e) => byId(e.reportsTo)?.name ?? "—" },
  { token: "company", describe: "Company name", value: () => COMPANY },
  { token: "today", describe: "Today's date", value: () => fmtDate(TODAY) },
];

/** Swap every {{token}} for its value. Unknown tokens are left visible on
    purpose, so a typo in a template shows up in the preview instead of
    silently vanishing from the finished letter. */
export function mergeLetter(body: string, emp: (typeof employees)[number]) {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, token: string) => {
    const field = MERGE_FIELDS.find((f) => f.token === token.toLowerCase());
    return field ? field.value(emp) : whole;
  });
}

const unresolvedIn = (text: string) => [...new Set(text.match(/\{\{\s*[a-z_]+\s*\}\}/gi) ?? [])];

/* ------------------------------------------------------------------ page */

export default function Letters() {
  const [tab, setTab] = useState("Generate");
  const { push } = useToast();

  const [templates, setTemplates] = useState<LetterTemplate[]>(() => [...letterTemplates]);
  const [generated, setGenerated] = useState<GeneratedLetter[]>(() => [...generatedLetters]);

  /* Empty on a fresh workspace, so don't index into it. */
  const [genTemplateId, setGenTemplateId] = useState(letterTemplates[0]?.id ?? "");
  const [genEmployee, setGenEmployee] = useState(employees[0]?.id ?? "");
  /* null until the body is edited by hand, so switching template keeps refilling */
  const [bodyOverride, setBodyOverride] = useState<string | null>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [viewing, setViewing] = useState<GeneratedLetter | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<LetterTemplate | "new" | null>(null);
  const [removingTemplate, setRemovingTemplate] = useState<LetterTemplate | null>(null);

  const template = templates.find((t) => t.id === genTemplateId) ?? templates[0];
  const employee = byId(genEmployee) ?? employees[0];
  const canGenerate = Boolean(template && employee);
  const draft = bodyOverride ?? template?.body ?? "";
  const merged = useMemo(() => mergeLetter(draft, employee), [draft, employee]);

  const commitTemplates = (next: LetterTemplate[]) => {
    setTemplates(next);
    letterTemplates.splice(0, letterTemplates.length, ...next);
  };

  const saveTemplate = (values: Record<string, unknown>) => {
    const name = String(values.name ?? "").trim();
    const body = String(values.body ?? "");
    if (editingTemplate === "new") {
      const rec: LetterTemplate = { id: `lt-${Date.now().toString(36)}`, name, body, updated: TODAY };
      commitTemplates([...templates, rec]);
      void api.create("letterTemplates", rec);
      setGenTemplateId(rec.id);
      setBodyOverride(null);
      push(`Template "${name}" created`);
    } else if (editingTemplate) {
      const rec = { ...editingTemplate, name, body, updated: TODAY };
      commitTemplates(templates.map((t) => (t.id === rec.id ? rec : t)));
      void api.update("letterTemplates", rec.id, { name, body, updated: TODAY });
      if (rec.id === genTemplateId) setBodyOverride(null);
      push(`Template "${name}" saved`);
    }
    setEditingTemplate(null);
  };

  const deleteTemplate = (t: LetterTemplate) => {
    const next = templates.filter((x) => x.id !== t.id);
    commitTemplates(next);
    void api.remove("letterTemplates", t.id);
    if (t.id === genTemplateId) {
      setGenTemplateId(next[0]?.id ?? "");
      setBodyOverride(null);
    }
    setRemovingTemplate(null);
    push("Template deleted");
  };

  /** Called from the preview modal — this is the point the letter is created.
      The server does the merge and stores the issued letter, so what was shown
      can always be produced again. */
  const saveLetter = async () => {
    if (!canGenerate) return;
    const body = preview ?? merged;
    setPreview(null);
    setBodyOverride(null);

    const issued = await generateLetter({
      employeeId: genEmployee,
      templateId: template?.id,
      // Send the body only when the preview was edited by hand.
      ...(body !== merged ? { body } : {}),
    });
    if (!issued) return push("Couldn't issue the letter");

    setGenerated([...generatedLetters]);
    setTab("Generated Letters");
    push(`Letter issued for ${employee.name}`);
  };

  const printLetter = (letter: GeneratedLetter) => {
    const win = window.open("", "_blank", "width=820,height=900");
    if (!win) return push("Allow pop-ups to print this letter");
    win.document.write(
      `<title>${letter.template} — ${byId(letter.employee)?.name ?? ""}</title>` +
        `<pre style="font:14px/1.7 Georgia,serif;white-space:pre-wrap;padding:56px;max-width:70ch"></pre>`
    );
    // textContent, not HTML — letter bodies are user-authored text
    win.document.querySelector("pre")!.textContent = letter.body;
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <>
      <PageHeader
        title="Letter"
        actions={
          tab === "Templates" ? (
            <button className="btn-primary" onClick={() => setEditingTemplate("new")}>
              <Plus size={15} /> New template
            </button>
          ) : undefined
        }
      />
      <div className="card mb-5 px-2">
        <Tabs tabs={["Generate", "Templates", "Generated Letters"]} active={tab} onChange={setTab} className="border-b-0" />
      </div>

      {/* ------------------------------------------------------- generate */}
      {tab === "Generate" && (
        <>
          {templates.length === 0 ? (
            <div className="card">
              <EmptyState text="No templates yet — create one on the Templates tab first" />
            </div>
          ) : (
            <FormCard title="Generate Letter">
              <FormGrid cols={2}>
                <Field label="Letter Template" required>
                  <select
                    className="input"
                    value={genTemplateId}
                    onChange={(e) => {
                      setGenTemplateId(e.target.value);
                      setBodyOverride(null);
                    }}
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Employee" required>
                  <select className="input" value={genEmployee} onChange={(e) => setGenEmployee(e.target.value)}>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Letter Body" span>
                  <RichText
                    rows={12}
                    value={draft}
                    onChange={setBodyOverride}
                    className="font-mono"
                    placeholder="Dear {{employee_name}}, …"
                  />
                  <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span className="mr-1">Merge fields — click to insert:</span>
                    {MERGE_FIELDS.map((f) => (
                      <button
                        key={f.token}
                        type="button"
                        title={f.describe}
                        onClick={() => setBodyOverride(`${draft}{{${f.token}}}`)}
                        className="cursor-pointer rounded-md bg-primary-soft px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary hover:brightness-95"
                      >
                        {`{{${f.token}}}`}
                      </button>
                    ))}
                  </p>
                  {bodyOverride !== null && (
                    <p className="mt-2 text-xs text-faint">
                      Edited for this letter only —{" "}
                      <button className="cursor-pointer font-semibold text-primary hover:underline" onClick={() => setBodyOverride(null)}>
                        reset to the template
                      </button>
                    </p>
                  )}
                </Field>
              </FormGrid>

              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-5">
                <button className="btn-primary" disabled={!draft.trim()} onClick={() => setPreview(merged)}>
                  <Eye size={15} /> Preview letter
                </button>
                <p className="text-xs text-muted">
                  You'll see the finished letter for {employee.name} and can edit it before saving.
                </p>
              </div>
            </FormCard>
          )}
        </>
      )}

      {/* ------------------------------------------------------ templates */}
      {tab === "Templates" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="card flex flex-col p-5">
              <div className="flex items-start gap-3">
                <FileText size={18} className="mt-0.5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t.name}</p>
                  <p className="mt-0.5 text-xs text-muted">Updated {fmtDate(t.updated)}</p>
                </div>
              </div>
              <pre className="mt-3 max-h-28 flex-1 overflow-hidden rounded-lg bg-page px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted">
                {(t.body ?? "").slice(0, 220) || "Empty template"}
                {(t.body ?? "").length > 220 ? "…" : ""}
              </pre>
              <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                <button className="btn-outline px-2.5 py-1.5 text-xs" onClick={() => setEditingTemplate(t)}>
                  <Pencil size={13} /> Edit
                </button>
                <button
                  className="btn-outline px-2.5 py-1.5 text-xs"
                  onClick={() => {
                    setGenTemplateId(t.id);
                    setBodyOverride(null);
                    setTab("Generate");
                  }}
                >
                  Use
                </button>
                <button
                  className="btn-ghost ml-auto cursor-pointer px-2 py-1.5 text-xs text-bad hover:bg-bad-soft"
                  onClick={() => setRemovingTemplate(t)}
                  aria-label={`Delete ${t.name}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          <button
            className="card flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 border-dashed p-5 text-sm text-muted hover:border-primary hover:text-primary"
            onClick={() => setEditingTemplate("new")}
          >
            <Plus size={18} /> New Template
          </button>
        </div>
      )}

      {/* ---------------------------------------------- generated letters */}
      {tab === "Generated Letters" && (
        <DataTable
          rows={generated}
          selectable={false}
          columns={[
            { key: "template", label: "Template", render: (l) => <span className="font-medium">{l.template}</span> },
            { key: "employee", label: "Employee", render: (l) => <AvatarName name={byId(l.employee)?.name ?? "—"} size={26} /> },
            { key: "date", label: "Generated On", render: (l) => fmtDate(l.date) },
          ]}
          rowActions={(l) => [
            { label: "View", onClick: () => setViewing(l) },
            { label: "Print", onClick: () => printLetter(l) },
            {
              label: "Delete",
              danger: true,
              onClick: async () => {
                const ok = await removeGeneratedLetter(String(l.id));
                setGenerated([...generatedLetters]);
                push(ok ? "Letter withdrawn" : "Couldn't withdraw that letter");
              },
            },
          ]}
          emptyText="No letters generated yet"
        />
      )}

      {/* -------------------------------------------------- preview modal */}
      <Modal open={preview !== null} onClose={() => setPreview(null)} title={`${template?.name ?? "Letter"} — ${employee.name}`} wide>
        <p className="mb-3 text-sm text-muted">
          This is the finished letter with every merge field filled in. Edit anything you like, then save it.
        </p>
        {preview !== null && unresolvedIn(preview).length > 0 && (
          <p className="mb-3 rounded-lg bg-warn-soft px-3 py-2 text-sm text-[#a9720e]">
            Unrecognised merge {unresolvedIn(preview).length === 1 ? "field" : "fields"}:{" "}
            <span className="font-mono font-semibold">{unresolvedIn(preview).join(", ")}</span> — these will print as-is.
          </p>
        )}
        <textarea
          rows={18}
          className="input w-full resize-y font-serif text-sm leading-relaxed"
          value={preview ?? ""}
          onChange={(e) => setPreview(e.target.value)}
        />
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="btn-primary" disabled={!preview?.trim()} onClick={saveLetter}>
            Save letter
          </button>
          <button
            className="btn-outline"
            onClick={() => {
              setBodyOverride(draft);
              setPreview(null);
            }}
          >
            Back to editing
          </button>
          <button className="btn-ghost" onClick={() => setPreview(merged)}>
            Reset to merged text
          </button>
        </div>
      </Modal>

      {/* ------------------------------------------------ view a saved one */}
      <Modal open={viewing !== null} onClose={() => setViewing(null)} title={viewing ? `${viewing.template} — ${byId(viewing.employee)?.name ?? ""}` : ""} wide>
        <pre className="max-h-[60vh] overflow-y-auto rounded-lg border border-line bg-page px-4 py-3 font-serif text-sm leading-relaxed whitespace-pre-wrap">
          {viewing?.body || "This letter has no saved body."}
        </pre>
        <div className="mt-5 flex gap-3">
          <button className="btn-primary" onClick={() => viewing && printLetter(viewing)}>
            <Printer size={15} /> Print
          </button>
          <button className="btn-ghost" onClick={() => setViewing(null)}>Close</button>
        </div>
      </Modal>

      {/* ------------------------------------------------- template editor */}
      <FormModal
        open={editingTemplate !== null}
        title={editingTemplate === "new" ? "New letter template" : "Edit letter template"}
        submitLabel={editingTemplate === "new" ? "Create template" : "Save template"}
        fields={[
          { key: "name", label: "Template name", required: true, span: true, placeholder: "e.g. Probation Confirmation" },
          {
            key: "body",
            label: `Template body — merge fields: ${MERGE_FIELDS.map((f) => `{{${f.token}}}`).join(" ")}`,
            type: "textarea",
            rows: 14,
            required: true,
            placeholder: "Dear {{employee_name}}, …",
          },
        ]}
        initial={editingTemplate === "new" ? { name: "", body: "" } : (editingTemplate as unknown as Record<string, unknown>)}
        onSubmit={saveTemplate}
        onClose={() => setEditingTemplate(null)}
      />

      <ConfirmDialog
        open={removingTemplate !== null}
        text={`Delete the "${removingTemplate?.name}" template? Letters already generated from it are kept.`}
        onConfirm={() => removingTemplate && deleteTemplate(removingTemplate)}
        onClose={() => setRemovingTemplate(null)}
      />
    </>
  );
}
