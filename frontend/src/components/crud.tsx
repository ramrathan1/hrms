/* Generic working-CRUD framework: config-driven form modals, confirm dialogs,
   detail viewers, and a useCrud hook that keeps page state, the shared seed
   arrays, and the backend API all in sync. */
import { useEffect, useState, type ReactNode } from "react";
import { Modal } from "./ui";
import { api, isAppendOnly, onStoreChange } from "@/lib/api";
import { useToast } from "@/lib/store";

export type FieldOption = string | { value: string; label: string };
export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select";
  options?: FieldOption[];
  required?: boolean;
  placeholder?: string;
  span?: boolean;
  /** textarea height; defaults to 3 */
  rows?: number;
};

const optValue = (o: FieldOption) => (typeof o === "string" ? o : o.value);
const optLabel = (o: FieldOption) => (typeof o === "string" ? o : o.label);

export function FormModal({
  open,
  title,
  fields,
  initial,
  submitLabel = "Save",
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  fields: FieldDef[];
  initial?: Record<string, unknown> | null;
  submitLabel?: string;
  onSubmit: (values: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      const base: Record<string, unknown> = { ...(initial ?? {}) };
      for (const f of fields) {
        if (base[f.key] === undefined && f.type === "select" && f.options?.length)
          base[f.key] = optValue(f.options[0]);
      }
      setValues(base);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (key: string, v: unknown) => setValues((old) => ({ ...old, [key]: v }));

  const submit = () => {
    for (const f of fields) {
      if (f.required && !String(values[f.key] ?? "").trim()) {
        setError(`${f.label} is required`);
        return;
      }
    }
    const out: Record<string, unknown> = { ...values };
    for (const f of fields) if (f.type === "number") out[f.key] = Number(out[f.key] ?? 0);
    onSubmit(out);
  };

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {fields.map((f) => (
          <label key={f.key} className={f.span || f.type === "textarea" ? "block md:col-span-2" : "block"}>
            <span className="lbl">
              {f.label} {f.required && <span className="text-bad">*</span>}
            </span>
            {f.type === "select" ? (
              <select className="input" value={String(values[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)}>
                {f.options?.map((o) => (
                  <option key={optValue(o)} value={optValue(o)}>
                    {optLabel(o)}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea rows={f.rows ?? 3} className="input resize-y" value={String(values[f.key] ?? "")} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />
            ) : (
              <input
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                className="input"
                value={String(values[f.key] ?? "")}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
          </label>
        ))}
      </div>
      {error && <p className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      <div className="mt-5 flex gap-3">
        <button className="btn-primary" onClick={submit}>{submitLabel}</button>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

export function ConfirmDialog({
  open,
  text,
  confirmLabel = "Delete",
  onConfirm,
  onClose,
}: {
  open: boolean;
  text: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Are you sure?">
      <p className="text-sm text-muted">{text}</p>
      <div className="mt-5 flex gap-3">
        <button className="btn bg-bad px-4 py-2 font-semibold text-white hover:brightness-110" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

export function DetailModal({
  open,
  title,
  fields,
  record,
  onClose,
  extra,
}: {
  open: boolean;
  title: string;
  fields: FieldDef[];
  record: Record<string, unknown> | null;
  onClose: () => void;
  extra?: ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <dl className="space-y-2.5 text-sm">
        {fields.map((f) => {
          const raw = record?.[f.key];
          const label =
            f.type === "select" && f.options
              ? optLabel(f.options.find((o) => optValue(o) === String(raw)) ?? String(raw ?? "—"))
              : String(raw ?? "—");
          return (
            <div key={f.key} className="flex gap-4 border-b border-line pb-2">
              <dt className="w-36 shrink-0 text-muted">{f.label}</dt>
              <dd className="font-medium break-words">{label}</dd>
            </div>
          );
        })}
      </dl>
      {extra}
    </Modal>
  );
}

export type RowAction = { label: ReactNode; onClick?: () => void; danger?: boolean };

export function useCrud<T extends { id: string | number }>(opts: {
  collection: string;
  seed: T[];
  fields: FieldDef[];
  itemName: string;
  defaults?: Partial<T>;
  makeId?: (items: T[]) => string | number;
  onView?: (r: T) => void;
  withView?: boolean;
}) {
  const [items, setItems] = useState<T[]>(() => [...opts.seed]);
  const [editing, setEditing] = useState<T | "new" | null>(null);
  const [removing, setRemoving] = useState<T | null>(null);
  const [viewing, setViewing] = useState<T | null>(null);
  const { push } = useToast();

  const commit = (next: T[]) => {
    setItems(next);
    opts.seed.splice(0, opts.seed.length, ...next); // other pages see it too
  };

  /* Re-read whenever anything writes.
     The collection is a shared array: the server reconciles an optimistic row
     with the real one after the request lands, and another screen may refresh
     it entirely. Without this the page keeps rendering the version it created,
     which is how a computed balance ends up one deposit behind. */
  useEffect(() => onStoreChange(() => setItems([...opts.seed])), [opts.seed]);

  const add = (values: Record<string, unknown>) => {
    const rec = {
      ...opts.defaults,
      ...values,
      id: opts.makeId?.(items) ?? `${opts.collection.slice(0, 3)}-${Date.now()}`,
    } as T;
    commit([rec, ...items]);
    void api.create(opts.collection, rec);
    push(`${opts.itemName} added`);
    return rec;
  };

  const update = (id: T["id"], patch: Partial<T>, quiet = false) => {
    commit(items.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    void api.update(opts.collection, id, patch);
    if (!quiet) push(`${opts.itemName} updated`);
  };

  const remove = (id: T["id"]) => {
    commit(items.filter((r) => r.id !== id));
    void api.remove(opts.collection, id);
    push(`${opts.itemName} deleted`);
  };

  /** bulk delete — wired to the DataTable selection bar */
  const removeMany = (rows: T[]) => {
    const ids = new Set(rows.map((r) => r.id));
    commit(items.filter((r) => !ids.has(r.id)));
    rows.forEach((r) => void api.remove(opts.collection, r.id));
    push(`${rows.length} ${opts.itemName.toLowerCase()}${rows.length === 1 ? "" : "s"} deleted`);
  };

  /** bulk field update, e.g. set status on many rows at once */
  const updateMany = (rows: T[], patch: Partial<T>, verb = "updated") => {
    const ids = new Set(rows.map((r) => r.id));
    commit(items.map((r) => (ids.has(r.id) ? { ...r, ...patch } : r)));
    rows.forEach((r) => void api.update(opts.collection, r.id, patch));
    push(`${rows.length} ${opts.itemName.toLowerCase()}${rows.length === 1 ? "" : "s"} ${verb}`);
  };

  /** duplicate rows (bulk-friendly) */
  const duplicateMany = (rows: T[]) => {
    const copies = rows.map((r, i) => ({
      ...r,
      id: opts.makeId ? opts.makeId([...items, ...Array(i).fill(r)]) : `${opts.collection.slice(0, 3)}-${Date.now()}-${i}`,
    })) as T[];
    commit([...copies, ...items]);
    copies.forEach((c) => void api.create(opts.collection, c));
    push(`${rows.length} ${opts.itemName.toLowerCase()}${rows.length === 1 ? "" : "s"} duplicated`);
  };

  const rowActions = (r: T, extra: RowAction[] = []): RowAction[] => [
    ...extra,
    ...(opts.onView || opts.withView !== false
      ? [{ label: "View", onClick: () => (opts.onView ? opts.onView(r) : setViewing(r)) }]
      : []),
    // Some records are append-only on the server — an award given, a punch at
    // a door, a salary band. Offering "Edit" for them would promise something
    // the API deliberately refuses.
    ...(isAppendOnly(opts.collection) ? [] : [{ label: "Edit", onClick: () => setEditing(r) }]),
    { label: "Delete", danger: true, onClick: () => setRemoving(r) },
  ];

  const modals = (
    <>
      <FormModal
        open={editing !== null}
        title={editing === "new" ? `Add ${opts.itemName}` : `Edit ${opts.itemName}`}
        fields={opts.fields}
        initial={editing === "new" ? (opts.defaults as Record<string, unknown>) : (editing as Record<string, unknown> | null)}
        onSubmit={(v) => {
          if (editing === "new") add(v);
          else if (editing) update(editing.id, v as Partial<T>);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={removing !== null}
        text={`This will permanently delete this ${opts.itemName.toLowerCase()}. This action cannot be undone.`}
        onConfirm={() => {
          if (removing) remove(removing.id);
          setRemoving(null);
        }}
        onClose={() => setRemoving(null)}
      />
      <DetailModal
        open={viewing !== null}
        title={`${opts.itemName} details`}
        fields={opts.fields}
        record={viewing as Record<string, unknown> | null}
        onClose={() => setViewing(null)}
      />
    </>
  );

  return {
    items,
    setItems: commit,
    add,
    update,
    remove,
    removeMany,
    updateMany,
    duplicateMany,
    openNew: () => setEditing("new"),
    openEdit: (r: T) => setEditing(r),
    rowActions,
    modals,
    /** ready-made selection-bar actions for DataTable */
    bulkActions: [{ label: "Duplicate", onClick: (rows: T[]) => duplicateMany(rows) }],
  };
}
