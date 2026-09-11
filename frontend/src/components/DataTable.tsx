import clsx from "clsx";
import { ArrowDownUp, Columns3, Download, MoreVertical, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Dropdown, EmptyState } from "./ui";

export type Col<T> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  sort?: (row: T) => string | number;
  csv?: (row: T) => string | number;
  className?: string;
  hideable?: boolean;
};

export type BulkAction<T> = {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onClick: (rows: T[]) => void;
};

export function DataTable<T extends { id: string | number }>({
  columns,
  rows,
  pageSize: initialPageSize = 10,
  selectable = true,
  rowActions,
  emptyText,
  bulkActions,
  exportName,
  onBulkDelete,
  toolbar,
  server,
}: {
  columns: Col<T>[];
  rows: T[];
  pageSize?: number;
  selectable?: boolean;
  rowActions?: (row: T) => { label: ReactNode; onClick?: () => void; danger?: boolean }[];
  emptyText?: string;
  /** extra actions shown in the floating selection bar */
  bulkActions?: BulkAction<T>[];
  /** enables CSV export of selected rows (or all rows from the toolbar) */
  exportName?: string;
  /** enables "Delete" in the selection bar */
  onBulkDelete?: (rows: T[]) => void;
  /** extra controls rendered above the table */
  toolbar?: ReactNode;
  /**
   * Set when the server owns paging.
   *
   * `rows` is then just the page on screen and `total` is what the server says
   * exists, so the table stops pretending it holds everything. Sorting and
   * paging are handed back rather than done here — a client-side sort of one
   * page sorts the wrong set.
   */
  server?: {
    total: number;
    page: number;
    pageSize: number;
    loading?: boolean;
    onPageChange: (page: number, pageSize: number) => void;
    onSortChange?: (key: string | null, direction: "asc" | "desc") => void;
  };
}) {
  const [localPage, setLocalPage] = useState(1);
  const [localPageSize, setLocalPageSize] = useState(initialPageSize);

  // With a server, the page belongs to the caller; without one, to this table.
  const page = server ? server.page : localPage;
  const pageSize = server ? server.pageSize : localPageSize;

  const setPage = (next: number) =>
    server ? server.onPageChange(next, pageSize) : setLocalPage(next);
  const setPageSize = (next: number) => {
    if (server) server.onPageChange(1, next);
    else {
      setLocalPageSize(next);
      setLocalPage(1);
    }
  };
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [selected, setSelected] = useState<Set<T["id"]>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const visibleCols = columns.filter((c) => !hidden.has(c.key));

  const sorted = useMemo(() => {
    // The server already sorted the page it sent; re-sorting it here would
    // only reorder these few rows against the wrong set.
    if (server || !sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sort) return rows;
    return [...rows].sort((a, b) => {
      const va = col.sort!(a);
      const vb = col.sort!(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sortDir;
    });
  }, [rows, sortKey, sortDir, columns, server]);

  const total = server ? server.total : sorted.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(page, pages);
  const slice = server ? sorted : sorted.slice((cur - 1) * pageSize, cur * pageSize);
  const selectedRows = rows.filter((r) => selected.has(r.id));

  const toggleSort = (c: Col<T>) => {
    if (!c.sort && !server) return;
    const nextDir: 1 | -1 = sortKey === c.key && sortDir === 1 ? -1 : 1;
    server?.onSortChange?.(c.key, nextDir === 1 ? "asc" : "desc");
    if (sortKey === c.key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(c.key);
      setSortDir(1);
    }
  };

  const csvOf = (list: T[]) => {
    const cols = visibleCols;
    const header = cols.map((c) => c.label).join(",");
    const lines = list.map((r) =>
      cols
        .map((c) => {
          const v = c.csv ? c.csv(r) : c.sort ? c.sort(r) : ((r as never)[c.key] ?? "");
          return JSON.stringify(String(v ?? ""));
        })
        .join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exportName ?? "export"}.csv`;
    a.click();
  };

  const allChecked = slice.length > 0 && slice.every((r) => selected.has(r.id));

  return (
    <div className="card overflow-hidden">
      {(toolbar || exportName || columns.some((c) => c.hideable !== false)) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
          {toolbar}
          <span className="ml-auto flex items-center gap-2">
            {exportName && (
              <button className="btn-outline px-2.5 py-1.5 text-xs" onClick={() => csvOf(sorted)}>
                <Download size={13} /> Export
              </button>
            )}
            <Dropdown
              button={
                <button className="btn-outline px-2.5 py-1.5 text-xs">
                  <Columns3 size={13} /> Columns
                </button>
              }
              items={columns
                .filter((c) => c.hideable !== false)
                .map((c) => ({
                  label: (
                    <span className="flex items-center gap-2">
                      <input type="checkbox" readOnly checked={!hidden.has(c.key)} className="h-3.5 w-3.5 accent-primary" />
                      {c.label}
                    </span>
                  ),
                  onClick: () =>
                    setHidden((h) => {
                      const n = new Set(h);
                      n.has(c.key) ? n.delete(c.key) : n.add(c.key);
                      return n;
                    }),
                }))}
            />
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="tbl w-full text-sm">
          <thead>
            <tr>
              {selectable && (
                <th className="w-10">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-primary"
                    checked={allChecked}
                    onChange={() =>
                      setSelected((s) => {
                        const n = new Set(s);
                        if (allChecked) slice.forEach((r) => n.delete(r.id));
                        else slice.forEach((r) => n.add(r.id));
                        return n;
                      })
                    }
                  />
                </th>
              )}
              {visibleCols.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c)}
                  className={clsx(c.sort && "cursor-pointer select-none", c.className)}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {c.sort && <ArrowDownUp size={11} className="text-faint" />}
                  </span>
                </th>
              ))}
              {rowActions && <th className="w-16 text-right">Action</th>}
            </tr>
          </thead>
          <tbody>
            {slice.map((row) => (
              <tr key={row.id} className={clsx(selected.has(row.id) && "bg-primary-soft/50")}>
                {selectable && (
                  <td>
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-primary"
                      checked={selected.has(row.id)}
                      onChange={() =>
                        setSelected((s) => {
                          const n = new Set(s);
                          n.has(row.id) ? n.delete(row.id) : n.add(row.id);
                          return n;
                        })
                      }
                    />
                  </td>
                )}
                {visibleCols.map((c) => (
                  <td key={c.key} className={c.className}>
                    {c.render ? c.render(row) : (row as never)[c.key]}
                  </td>
                ))}
                {rowActions && (
                  <td className="text-right">
                    <Dropdown
                      button={
                        <button className="btn-ghost rounded-md border border-line px-1.5 py-1.5" aria-label="Row actions">
                          <MoreVertical size={14} />
                        </button>
                      }
                      items={rowActions(row)}
                    />
                  </td>
                )}
              </tr>
            ))}
            {slice.length === 0 && (
              <tr>
                <td colSpan={visibleCols.length + 2}>
                  {/* An empty page mid-fetch is "loading", not "nothing here". */}
                  {server?.loading ? (
                    <p className="py-10 text-center text-sm text-faint">Loading…</p>
                  ) : (
                    <EmptyState text={emptyText ?? "No data available in table"} />
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* floating selection bar with real bulk actions */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-2xl bg-[#191a28]/95 px-2 py-1.5 text-sm text-white shadow-2xl backdrop-blur-xl">
          <span className="flex items-center gap-2 rounded-xl px-2.5 py-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-xs font-bold">{selected.size}</span>
            <span className="font-medium">Selected</span>
          </span>
          <span className="mx-1 h-5 w-px bg-white/15" />
          {bulkActions?.map((a) => (
            <button
              key={a.label}
              className={clsx(
                "flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 font-medium hover:bg-white/10",
                a.danger ? "text-[#ff8a80]" : "text-white/85 hover:text-white"
              )}
              onClick={() => {
                a.onClick(selectedRows);
                setSelected(new Set());
              }}
            >
              {a.icon}
              {a.label}
            </button>
          ))}
          {exportName && (
            <button
              className="flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 font-medium text-white/85 hover:bg-white/10 hover:text-white"
              onClick={() => csvOf(selectedRows)}
            >
              <Download size={13} /> Export
            </button>
          )}
          {onBulkDelete && (
            <button
              className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-bad/90 px-3 py-1.5 font-semibold text-white hover:bg-bad"
              onClick={() => {
                onBulkDelete(selectedRows);
                setSelected(new Set());
              }}
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
          <span className="mx-1 h-5 w-px bg-white/15" />
          <button
            className="cursor-pointer rounded-xl px-3 py-1.5 font-medium text-white/60 hover:bg-white/10 hover:text-white"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-muted">
        <span className="flex items-center gap-2">
          Show
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="input w-16 px-2 py-1"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          entries
        </span>
        <span>
          Showing {total === 0 ? 0 : (cur - 1) * pageSize + 1} to {Math.min(cur * pageSize, total)} of {total} entries
        </span>
        <span className="flex items-center gap-1">
          <button className="btn-outline px-3 py-1.5 disabled:opacity-40" disabled={cur === 1} onClick={() => setPage(cur - 1)}>
            Previous
          </button>
          {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={clsx("btn px-3 py-1.5", p === cur ? "bg-primary text-white" : "border border-line bg-white hover:bg-page")}
            >
              {p}
            </button>
          ))}
          {pages > 5 && <span className="px-1">…</span>}
          <button className="btn-outline px-3 py-1.5 disabled:opacity-40" disabled={cur === pages} onClick={() => setPage(cur + 1)}>
            Next
          </button>
        </span>
      </div>
    </div>
  );
}
