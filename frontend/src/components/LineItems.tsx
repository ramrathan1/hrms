import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { money } from "@/lib/format";

type Item = { id: number; desc: string; qty: number; rate: number; tax: number };

export function LineItemsEditor({ initial, onTotal }: { initial?: Item[]; onTotal?: (total: number) => void }) {
  const [items, setItems] = useState<Item[]>(
    initial ?? [{ id: 1, desc: "Website design & development", qty: 1, rate: 1200, tax: 10 }]
  );
  const [discount, setDiscount] = useState(0);

  const set = (id: number, patch: Partial<Item>) =>
    setItems((its) => its.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const totals = useMemo(() => {
    const sub = items.reduce((a, i) => a + i.qty * i.rate, 0);
    const tax = items.reduce((a, i) => a + (i.qty * i.rate * i.tax) / 100, 0);
    const disc = (sub * discount) / 100;
    return { sub, tax, disc, total: sub + tax - disc };
  }, [items, discount]);

  useEffect(() => {
    onTotal?.(Math.round(totals.total));
  }, [totals.total, onTotal]);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="tbl w-full text-sm">
          <thead>
            <tr>
              <th className="min-w-64">Description</th>
              <th className="w-24">Quantity</th>
              <th className="w-32">Unit Price</th>
              <th className="w-28">Tax %</th>
              <th className="w-32 text-right">Amount</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>
                  <input className="input" value={i.desc} onChange={(e) => set(i.id, { desc: e.target.value })} placeholder="Item description" />
                </td>
                <td>
                  <input type="number" className="input" value={i.qty} min={1} onChange={(e) => set(i.id, { qty: Number(e.target.value) })} />
                </td>
                <td>
                  <input type="number" className="input" value={i.rate} onChange={(e) => set(i.id, { rate: Number(e.target.value) })} />
                </td>
                <td>
                  <input type="number" className="input" value={i.tax} onChange={(e) => set(i.id, { tax: Number(e.target.value) })} />
                </td>
                <td className="text-right font-medium tabular-nums">{money(i.qty * i.rate)}</td>
                <td>
                  <button className="btn-ghost px-2 text-bad" onClick={() => setItems((its) => its.filter((x) => x.id !== i.id))} aria-label="Remove item">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className="btn mt-3 gap-1.5 text-primary"
        onClick={() => setItems((its) => [...its, { id: Date.now(), desc: "", qty: 1, rate: 0, tax: 0 }])}
      >
        <Plus size={15} /> Add Item
      </button>
      <div className="mt-4 ml-auto w-full max-w-xs space-y-2 text-sm">
        <div className="flex justify-between text-muted">
          <span>Sub Total</span>
          <span className="font-medium text-ink tabular-nums">{money(totals.sub)}</span>
        </div>
        <div className="flex items-center justify-between text-muted">
          <span>Discount %</span>
          <input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="input w-20 py-1 text-right" />
        </div>
        <div className="flex justify-between text-muted">
          <span>Tax</span>
          <span className="tabular-nums">{money(totals.tax)}</span>
        </div>
        <div className="flex justify-between border-t border-line pt-2 text-[15px] font-bold">
          <span>Total</span>
          <span className="tabular-nums">{money(totals.total)}</span>
        </div>
      </div>
    </div>
  );
}
