import clsx from "clsx";
import { Check, CloudUpload, Plus } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/lib/store";
import { todayISO } from "@/lib/format";

export function FormCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="card">
      {title && (
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-[17px] font-semibold">{title}</h2>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

export function FormGrid({ cols = 3, children }: { cols?: number; children: ReactNode }) {
  return (
    <div
      className={clsx(
        "grid gap-x-6 gap-y-5 [&:not(:first-child)]:mt-5",
        cols === 2 ? "grid-cols-1 md:grid-cols-2" : cols === 4 ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-4" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
      )}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  required,
  children,
  span,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  span?: boolean;
}) {
  return (
    <label className={clsx("block", span && "md:col-span-2 xl:col-span-3")}>
      <span className="lbl">
        {label} {required && <span className="text-bad">*</span>}
      </span>
      {children}
    </label>
  );
}

export function TextInput({ placeholder, defaultValue, name }: { placeholder?: string; defaultValue?: string; name?: string }) {
  return <input className="input" placeholder={placeholder} defaultValue={defaultValue} name={name} />;
}

export function SelectInput({ options, withAdd, defaultValue, name }: { options: string[]; withAdd?: boolean; defaultValue?: string; name?: string }) {
  /* `withAdd` used to render a button that did nothing. It now appends an
     option and selects it, which is what the affordance promises. */
  const [extra, setExtra] = useState<string[]>([]);
  const [value, setValue] = useState(defaultValue ?? options[0]);
  const all = [...options, ...extra];

  const add = () => {
    const name = window.prompt("Add an option");
    const trimmed = name?.trim();
    if (!trimmed || all.includes(trimmed)) return;
    setExtra((e) => [...e, trimmed]);
    setValue(trimmed);
  };

  return (
    <span className="flex gap-2">
      <select className="input" value={value} onChange={(e) => setValue(e.target.value)} name={name}>
        {all.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      {withAdd && (
        <button type="button" className="btn-outline shrink-0 px-3" onClick={add}>
          <Plus size={14} /> Add
        </button>
      )}
    </span>
  );
}

export function DateInput({ defaultValue = todayISO(), name }: { defaultValue?: string; name?: string }) {
  return <input type="date" className="input" defaultValue={defaultValue} name={name} />;
}

export function TextArea({ rows = 4, placeholder, name }: { rows?: number; placeholder?: string; name?: string }) {
  return <textarea rows={rows} className="input resize-y" placeholder={placeholder} name={name} />;
}

/** Uncontrolled by default; pass value + onChange to drive it from state. */
export function RichText({
  rows = 5,
  placeholder,
  value,
  onChange,
  className,
  name,
}: {
  rows?: number;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  className?: string;
  /** Required for the field to be picked up by a surrounding <form>. */
  name?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  /* The toolbar used to be inert. These wrap the selection in markdown, which
     is what the plain-text bodies elsewhere in the app already use. */
  const wrap = (before: string, after = before) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value: v } = el;
    const chosen = v.slice(a, b) || "text";
    const next = `${v.slice(0, a)}${before}${chosen}${after}${v.slice(b)}`;
    if (onChange) onChange(next);
    else el.value = next;
    // Put the caret around what was just wrapped.
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + before.length, a + before.length + chosen.length);
    });
  };

  const prefixLines = (marker: string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value: v } = el;
    const from = v.lastIndexOf("\n", a - 1) + 1;
    const to = v.indexOf("\n", b) === -1 ? v.length : v.indexOf("\n", b);
    const block = v.slice(from, to).split("\n").map((l, i) => `${marker === "1." ? `${i + 1}.` : marker} ${l}`).join("\n");
    const next = v.slice(0, from) + block + v.slice(to);
    if (onChange) onChange(next);
    else el.value = next;
    requestAnimationFrame(() => el.focus());
  };

  const TOOLS: { key: string; title: string; className?: string; run: () => void }[] = [
    { key: "B", title: "Bold", className: "font-bold", run: () => wrap("**") },
    { key: "I", title: "Italic", className: "italic", run: () => wrap("_") },
    { key: "S", title: "Strikethrough", className: "line-through", run: () => wrap("~~") },
    { key: "•", title: "Bullet list", run: () => prefixLines("-") },
    { key: "1.", title: "Numbered list", run: () => prefixLines("1.") },
    { key: "🔗", title: "Link", run: () => wrap("[", "](https://)") },
  ];

  return (
    <div className="overflow-hidden rounded-md border border-line focus-within:border-primary">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-white/55 px-2 py-1.5 text-[13px] text-muted">
        {TOOLS.map((t) => (
          <button
            key={t.key}
            type="button"
            title={t.title}
            aria-label={t.title}
            onMouseDown={(e) => e.preventDefault()} // keep the textarea selection
            onClick={t.run}
            className={clsx("btn-ghost min-w-8 px-2 py-1", t.className)}
          >
            {t.key}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        rows={rows}
        className={clsx("w-full resize-y px-3 py-2 text-sm outline-none placeholder:text-faint", className)}
        placeholder={placeholder}
        name={name}
        {...(onChange ? { value: value ?? "", onChange: (e) => onChange(e.target.value) } : { defaultValue: value })}
      />
    </div>
  );
}

export function FileDrop({ label = "Choose a file" }: { label?: string }) {
  return (
    <div className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line bg-white/55 py-10 text-sm text-muted hover:border-primary hover:text-primary">
      <CloudUpload size={26} className="text-faint" />
      {label}
    </div>
  );
}

/* hideLabel keeps the label in the DOM (forms persist by label) but out of sight,
   for checkboxes sitting in a table whose row and column already name them. */
export function CheckboxInput({ label, defaultChecked, hideLabel, name }: { label: string; defaultChecked?: boolean; hideLabel?: boolean; name?: string }) {
  return (
    <label className={clsx("flex cursor-pointer items-center gap-2 text-sm", hideLabel && "justify-center")}>
      <input type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4 accent-primary" name={name} />
      {hideLabel ? <span className="sr-only">{label}</span> : label}
    </label>
  );
}

export function Toggle({ defaultChecked = true, onChange }: { defaultChecked?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <label className="relative inline-block h-5.5 w-10 cursor-pointer">
      <input type="checkbox" defaultChecked={defaultChecked} onChange={(e) => onChange?.(e.target.checked)} className="peer sr-only" />
      <span className="absolute inset-0 rounded-full bg-line transition-colors peer-checked:bg-primary" />
      <span className="absolute top-0.5 left-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4.5" />
    </label>
  );
}

export function SaveBar({
  onSave,
  onCancel,
  saveLabel = "Save",
  extra,
  toast = "Saved successfully",
}: {
  onSave?: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  extra?: ReactNode;
  toast?: string;
}) {
  const { push } = useToast();
  const nav = useNavigate();
  return (
    <div className="mt-2 flex items-center gap-3 border-t border-line pt-5">
      <button
        className="btn-primary"
        onClick={() => {
          push(toast);
          onSave?.();
        }}
      >
        <Check size={15} /> {saveLabel}
      </button>
      {extra}
      <button type="button" className="btn-ghost" onClick={() => (onCancel ? onCancel() : nav(-1))}>
        Cancel
      </button>
    </div>
  );
}
