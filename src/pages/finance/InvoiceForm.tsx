import { Coins } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { DateInput, Field, FormCard, FormGrid, SaveBar, SelectInput, TextArea, TextInput } from "@/components/FormKit";
import { LineItemsEditor } from "@/components/LineItems";
import { clients } from "@/data/core";
import { invoices } from "@/data/finance";
import { projects } from "@/data/work";
import { api } from "@/lib/api";
import { RATES, fromBase, money, todayISO } from "@/lib/format";

export default function InvoiceForm() {
  const nav = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const [total, setTotal] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const save = (draft: boolean) => {
    const v = Object.fromEntries(new FormData(formRef.current!).entries());
    const invoice = {
      id: `inv-${Date.now().toString(36)}`,
      number: String(v.number || `INV#${String(invoices.length + 20).padStart(3, "0")}`),
      clientId: clients.find((c) => c.company === v.client)?.id ?? clients[0].id,
      total,
      paid: 0,
      date: todayISO(),
      due: String(v.due || "2026-09-13"),
      status: (draft ? "Draft" : "Unpaid") as "Draft" | "Unpaid",
      currency,
      fxRate: RATES[currency].rate,
      foreignTotal: fromBase(total, currency),
    };
    invoices.push(invoice);
    void api.create("invoices", invoice);
    nav("/finance/invoices");
  };
  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()}>
      <PageHeader title="Create Invoice" crumbs={["Finance", "Invoices"]} />
      <FormCard title="Invoice Details">
        <FormGrid>
          <Field label="Invoice Number" required><TextInput defaultValue="INV#020" name="number" /></Field>
          <Field label="Client" required><SelectInput options={clients.map((c) => c.company)} name="client" /></Field>
          <Field label="Project"><SelectInput options={["--", ...projects.map((p) => p.name)]} /></Field>
          <Field label="Invoice Date" required><DateInput /></Field>
          <Field label="Due Date" required><DateInput defaultValue="2026-09-13" name="due" /></Field>
          <Field label="Currency">
            <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {Object.keys(RATES).map((c) => (
                <option key={c} value={c}>{c} ({RATES[c].symbol})</option>
              ))}
            </select>
          </Field>
          <Field label="Exchange rate (1 USD =)">
            <input className="input" value={RATES[currency].rate} readOnly />
          </Field>
          <Field label="Bank Account"><SelectInput options={["Primary Account", "Secondary Account"]} /></Field>
          <Field label="Calculate Tax"><SelectInput options={["After Discount", "Before Discount"]} /></Field>
        </FormGrid>
      </FormCard>
      <div className="h-5" />
      <FormCard title="Items">
        <LineItemsEditor onTotal={setTotal} />
        {currency !== "USD" && (
          <p className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-primary-soft px-3.5 py-2.5 text-sm text-primary">
            <Coins size={15} />
            Billed in <b>{currency}</b>: {RATES[currency].symbol}{fromBase(total, currency).toLocaleString()} ·
            recorded in your books as <b>{money(total)}</b> at {RATES[currency].rate} {currency}/USD
          </p>
        )}
      </FormCard>
      <div className="h-5" />
      <FormCard>
        <FormGrid cols={2}>
          <Field label="Note for the recipient"><TextArea rows={3} /></Field>
          <Field label="Terms and Conditions"><TextArea rows={3} placeholder="Thank you for your business." /></Field>
        </FormGrid>
        <SaveBar
          toast="Invoice saved"
          onSave={() => save(false)}
          extra={<button type="button" className="btn-outline" onClick={() => save(true)}>Save As Draft</button>}
        />
      </FormCard>
    </form>
  );
}
