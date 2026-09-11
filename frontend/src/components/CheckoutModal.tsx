/* Simulated gateway checkout — TEST MODE ONLY.
   No real payment is processed and no real card data should ever be entered:
   the form is pre-filled with the standard test card and clearly labelled. */
import clsx from "clsx";
import { CheckCircle2, CreditCard, Landmark, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Modal } from "./ui";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { useToast } from "@/lib/store";

const METHODS = [
  { id: "card", label: "Card", icon: CreditCard, note: "Visa, Mastercard, Amex" },
  { id: "bank", label: "Bank transfer", icon: Landmark, note: "1–2 business days" },
];

export function CheckoutModal({
  open,
  onClose,
  amount,
  reference,
  payerEmail,
  onPaid,
}: {
  open: boolean;
  onClose: () => void;
  amount: number;
  reference: string;
  payerEmail?: string;
  onPaid: (method: string) => void;
}) {
  const { push } = useToast();
  const [method, setMethod] = useState("card");
  const [stage, setStage] = useState<"form" | "processing" | "done">("form");
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [expiry, setExpiry] = useState("12 / 30");
  const [cvc, setCvc] = useState("123");

  const pay = () => {
    setStage("processing");
    setTimeout(() => {
      setStage("done");
      void api.create("paymentAttempts", {
        reference,
        amount,
        method,
        result: "succeeded",
        mode: "test",
        at: new Date().toISOString(),
      });
      setTimeout(() => {
        onPaid(method === "card" ? "Card (test)" : "Bank transfer");
        push(`${money(amount)} received for ${reference}`);
        onClose();
        setStage("form");
      }, 900);
    }, 1400);
  };

  return (
    <Modal open={open} onClose={stage === "form" ? onClose : () => {}} title={`Pay ${reference}`}>
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-xs font-semibold text-[#a9720e]">
        <ShieldCheck size={14} /> TEST MODE — this is a simulation. No real payment is taken; never enter a real card.
      </div>

      {stage === "done" ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckCircle2 size={44} className="text-good" />
          <p className="font-display text-lg font-bold">Payment successful</p>
          <p className="text-sm text-muted">{money(amount)} received for {reference}</p>
        </div>
      ) : stage === "processing" ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="h-9 w-9 animate-spin rounded-full border-3 border-line border-t-primary" style={{ borderWidth: 3 }} />
          <p className="text-sm font-medium text-muted">Contacting payment gateway…</p>
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between rounded-xl border border-line bg-page/60 px-4 py-3">
            <span className="text-sm text-muted">Amount due</span>
            <span className="font-display text-xl font-bold tabular-nums">{money(amount)}</span>
          </div>

          <div className="mt-4 flex gap-2">
            {METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={clsx(
                  "btn flex-1 flex-col items-start gap-0.5 rounded-xl border px-3.5 py-2.5 text-left",
                  method === m.id ? "border-primary bg-primary-soft" : "border-line bg-white/70"
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <m.icon size={14} /> {m.label}
                </span>
                <span className="text-[11px] font-normal text-muted">{m.note}</span>
              </button>
            ))}
          </div>

          {method === "card" ? (
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="lbl">Card number <span className="font-normal text-faint">(test card pre-filled)</span></span>
                <input className="input font-mono" value={card} onChange={(e) => setCard(e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="lbl">Expiry</span>
                  <input className="input font-mono" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
                </label>
                <label className="block">
                  <span className="lbl">CVC</span>
                  <input className="input font-mono" value={cvc} onChange={(e) => setCvc(e.target.value)} />
                </label>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-line bg-white/70 p-4 text-sm">
              <p className="font-semibold">Transfer to</p>
              <dl className="mt-2 space-y-1 text-muted">
                <div className="flex justify-between"><dt>Account name</dt><dd className="font-medium text-ink">Worksuite Ltd</dd></div>
                <div className="flex justify-between"><dt>Sort code</dt><dd className="font-mono text-ink">00-00-00</dd></div>
                <div className="flex justify-between"><dt>Account</dt><dd className="font-mono text-ink">1234 5678</dd></div>
                <div className="flex justify-between"><dt>Reference</dt><dd className="font-mono text-ink">{reference}</dd></div>
              </dl>
            </div>
          )}

          {payerEmail && <p className="mt-3 text-xs text-faint">Receipt will be sent to {payerEmail}</p>}

          <div className="mt-5 flex items-center gap-3">
            <button className="btn-primary" onClick={pay}>
              <Lock size={14} /> Pay {money(amount)}
            </button>
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </>
      )}
    </Modal>
  );
}
