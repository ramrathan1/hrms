import { Landmark, Plus } from "lucide-react";
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { DataTable } from "@/components/DataTable";
import { FormModal, useCrud } from "@/components/crud";
import { FilterBar, PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { StatusPill } from "@/components/ui";
import { bankAccounts } from "@/data/finance";
import { api } from "@/lib/api";
import { fmtDate, money, todayISO } from "@/lib/format";
import { useServerRows } from "@/lib/useServerRows";
import { useToast } from "@/lib/store";

type Txn = {
  id: string;
  accountId: string;
  type: "Credit" | "Debit";
  amount: number;
  date: string;
  memo: string;
};

/** The form both screens use to put a line on the ledger. */
const TXN_FIELDS = [
  { key: "type", label: "Type", type: "select" as const, options: ["Credit", "Debit"], required: true },
  { key: "amount", label: "Amount ($)", type: "number" as const, required: true },
  { key: "date", label: "Date", type: "date" as const, required: true },
  { key: "memo", label: "Memo" },
];

export function BankAccountDetail() {
  const { id } = useParams();
  const acc = bankAccounts.find((b) => b.id === id) ?? bankAccounts[0];
  const { push } = useToast();
  const [adding, setAdding] = useState(false);

  /* A ledger only grows, so it pages against the server rather than being
     held whole in the page. */
  const table = useServerRows<Txn>("transactions", {
    pageSize: 25,
    filters: acc ? { bankAccountId: acc.id } : {},
  });

  if (!acc) {
    return (
      <>
        <PageHeader title="Bank Account" crumbs={["Finance"]} />
        <p className="card px-5 py-10 text-center text-sm text-muted">
          That account no longer exists. <Link to="/finance/bank-accounts" className="text-primary">Back to accounts</Link>
        </p>
      </>
    );
  }

  const post = async (values: Record<string, unknown>) => {
    setAdding(false);
    api.create("transactions", {
      accountId: acc.id,
      type: String(values.type),
      amount: Number(values.amount),
      date: String(values.date),
      memo: String(values.memo ?? ""),
    });
    // The balance is derived from the ledger, so re-read rather than adjusting
    // a local number that would drift the moment anyone else posts a line —
    // after the write has actually landed, or we would read the old total.
    await api.settled();
    await api.refresh("bankAccounts");
    table.refresh();
    push(`${values.type === "Credit" ? "Deposit" : "Withdrawal"} recorded`);
  };

  const shown = table.rows;
  return (
    <>
      <PageHeader
        title={acc.name}
        crumbs={["Finance", "Bank Account"]}
        actions={
          <button className="btn-primary" onClick={() => setAdding(true)}>
            <Plus size={15} /> Add Transaction
          </button>
        }
      />
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Current Balance" value={money(acc.balance)} icon={Landmark} />
        <StatCard
          label="Credit on this page"
          value={money(shown.filter((t) => t.type === "Credit").reduce((a, t) => a + t.amount, 0))}
        />
        <StatCard
          label="Debit on this page"
          value={money(shown.filter((t) => t.type === "Debit").reduce((a, t) => a + t.amount, 0))}
        />
      </div>
      <DataTable
        rows={table.rows}
        server={table.server}
        selectable={false}
        emptyText="Nothing on this ledger yet"
        columns={[
          { key: "date", label: "Date", sort: (t) => t.date, render: (t) => fmtDate(t.date) },
          { key: "memo", label: "Memo", render: (t) => <span className="font-medium">{t.memo || "—"}</span> },
          { key: "type", label: "Type", render: (t) => <StatusPill status={t.type} tone={t.type === "Credit" ? "good" : "bad"} /> },
          {
            key: "amount",
            label: "Amount",
            sort: (t) => t.amount,
            render: (t) => (
              <span className={"font-medium tabular-nums " + (t.type === "Credit" ? "text-good" : "text-bad")}>
                {t.type === "Credit" ? "+" : "-"}
                {money(t.amount)}
              </span>
            ),
          },
        ]}
      />

      <FormModal
        open={adding}
        title={`Add a transaction to ${acc.name}`}
        fields={TXN_FIELDS}
        initial={{ type: "Credit", date: todayISO() }}
        submitLabel="Post transaction"
        onSubmit={post}
        onClose={() => setAdding(false)}
      />
    </>
  );
}

export default function BankAccounts() {
  const { push } = useToast();
  const [txnFor, setTxnFor] = useState<string | null>(null);

  const crud = useCrud({
    collection: "bankAccounts",
    seed: bankAccounts,
    itemName: "Bank Account",
    fields: [
      { key: "name", label: "Account Name", required: true },
      { key: "bank", label: "Bank Name" },
      { key: "type", label: "Type", type: "select", options: ["Bank", "Cash", "Card"] },
      { key: "number", label: "Account Number (last 4)" },
      { key: "openingBalance", label: "Opening Balance ($)", type: "number" },
    ],
    defaults: { openingBalance: 0, type: "Bank" } as never,
  });

  const post = async (values: Record<string, unknown>) => {
    const accountId = txnFor;
    setTxnFor(null);
    if (!accountId) return;

    api.create("transactions", {
      accountId,
      type: String(values.type),
      amount: Number(values.amount),
      date: String(values.date),
      memo: String(values.memo ?? ""),
    });
    await api.settled();
    await api.refresh("bankAccounts");
    push("Transaction recorded");
  };

  return (
    <>
      <PageHeader
        title="Bank Account"
        crumbs={["Finance"]}
        actions={
          <button className="btn-primary" onClick={crud.openNew}>
            <Plus size={15} /> Add Bank Account
          </button>
        }
      />
      <FilterBar>
        <span className="text-sm text-muted">Balances are computed from each account's ledger.</span>
      </FilterBar>
      <DataTable
        rows={crud.items}
        columns={[
          { key: "name", label: "Account Name", render: (b) => <Link to={`/finance/bank-accounts/${b.id}`} className="font-medium text-primary">{b.name}</Link> },
          { key: "bank", label: "Bank Name" },
          { key: "type", label: "Type" },
          { key: "number", label: "Account Number" },
          { key: "balance", label: "Balance", sort: (b) => b.balance, render: (b) => <span className="font-medium tabular-nums">{money(b.balance)}</span> },
          { key: "status", label: "Status", render: (b) => <StatusPill status={b.status} /> },
        ]}
        rowActions={(b) =>
          crud.rowActions(b, [{ label: "Add transaction", onClick: () => setTxnFor(b.id) }])
        }
      />
      {crud.modals}

      <FormModal
        open={txnFor !== null}
        title="Add a transaction"
        fields={TXN_FIELDS}
        initial={{ type: "Credit", date: todayISO() }}
        submitLabel="Post transaction"
        onSubmit={post}
        onClose={() => setTxnFor(null)}
      />
    </>
  );
}
