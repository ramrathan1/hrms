import { money, fmtDate } from "@/lib/format";
import { StatusPill } from "./ui";

export function DocumentView({
  kind,
  number,
  status,
  client,
  date,
  due,
  items,
  discountPct = 0,
  note = "Thank you for your business.",
}: {
  kind: string;
  number: string;
  status: string;
  client: { name: string; company: string; email: string };
  date: string;
  due?: string;
  items: { desc: string; qty: number; rate: number; tax: number }[];
  discountPct?: number;
  note?: string;
}) {
  const sub = items.reduce((a, i) => a + i.qty * i.rate, 0);
  const tax = items.reduce((a, i) => a + (i.qty * i.rate * i.tax) / 100, 0);
  const disc = (sub * discountPct) / 100;
  return (
    <div className="card mx-auto max-w-3xl p-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[#4cc3ff] text-lg font-black text-white">W</span>
          <div>
            <p className="font-bold">Worksuite</p>
            <p className="text-xs text-muted">https://worksuite.biz</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold uppercase">{kind}</p>
          <p className="text-sm text-muted">{number}</p>
          <div className="mt-2">
            <StatusPill status={status} />
          </div>
        </div>
      </div>
      <div className="mt-8 flex justify-between gap-6 text-sm">
        <div>
          <p className="mb-1 text-xs font-semibold text-muted uppercase">Billed To</p>
          <p className="font-semibold">{client.name}</p>
          <p className="text-muted">{client.company}</p>
          <p className="text-muted">{client.email}</p>
        </div>
        <div className="text-right">
          <p>
            <span className="text-muted">{kind} Date: </span>
            <span className="font-medium">{fmtDate(date)}</span>
          </p>
          {due && (
            <p>
              <span className="text-muted">Due Date: </span>
              <span className="font-medium">{fmtDate(due)}</span>
            </p>
          )}
        </div>
      </div>
      <table className="tbl mt-6 w-full text-sm">
        <thead>
          <tr>
            <th>Description</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Unit Price</th>
            <th className="text-right">Tax</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i, idx) => (
            <tr key={idx}>
              <td className="font-medium">{i.desc}</td>
              <td className="text-right tabular-nums">{i.qty}</td>
              <td className="text-right tabular-nums">{money(i.rate)}</td>
              <td className="text-right tabular-nums">{i.tax}%</td>
              <td className="text-right font-medium tabular-nums">{money(i.qty * i.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-5 ml-auto w-full max-w-60 space-y-1.5 text-sm">
        <div className="flex justify-between text-muted">
          <span>Sub Total</span>
          <span className="tabular-nums">{money(sub)}</span>
        </div>
        {discountPct > 0 && (
          <div className="flex justify-between text-muted">
            <span>Discount ({discountPct}%)</span>
            <span className="tabular-nums">-{money(disc)}</span>
          </div>
        )}
        <div className="flex justify-between text-muted">
          <span>Tax</span>
          <span className="tabular-nums">{money(tax)}</span>
        </div>
        <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
          <span>Total</span>
          <span className="tabular-nums">{money(sub + tax - disc)}</span>
        </div>
      </div>
      <p className="mt-8 border-t border-line pt-4 text-xs text-muted">{note}</p>
    </div>
  );
}
