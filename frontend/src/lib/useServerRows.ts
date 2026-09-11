/**
 * A table that pages against the server.
 *
 * Most lists in this app hold their whole collection in memory, which is fine
 * for a few hundred rows and wrong for a ledger that grows every day. This hook
 * fetches one page at a time from an adapter-backed collection and hands
 * `DataTable` exactly what its `server` prop wants.
 *
 * Search and filters are passed through as query parameters, so the server does
 * the filtering too — filtering one page on the client would hide matches that
 * happen to sit on another page.
 */
import { useCallback, useEffect, useState } from "react";

import { ADAPTERS } from "./adapters";
import { request, type Paginated } from "./http";

type Row = Record<string, any>;

export type ServerRows<T> = {
  rows: T[];
  total: number;
  loading: boolean;
  error: string | null;
  /** Spread straight into `<DataTable server={…} />`. */
  server: {
    total: number;
    page: number;
    pageSize: number;
    loading: boolean;
    onPageChange: (page: number, pageSize: number) => void;
    onSortChange: (key: string | null, direction: "asc" | "desc") => void;
  };
  /** Re-read the current page — call after a write. */
  refresh: () => void;
};

export function useServerRows<T extends { id: string | number }>(
  collection: string,
  options: { pageSize?: number; filters?: Record<string, unknown> } = {}
): ServerRows<T> {
  const { pageSize: initialPageSize = 25, filters } = options;

  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sort, setSort] = useState<{ by: string | null; order: "asc" | "desc" }>({
    by: null,
    order: "desc",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Serialised, so a changed filter object with identical contents doesn't
  // re-fetch on every render.
  const filterKey = JSON.stringify(filters ?? {});

  useEffect(() => {
    const adapter = ADAPTERS[collection];
    if (!adapter) {
      setError(`No endpoint for "${collection}"`);
      setLoading(false);
      return;
    }

    let live = true;
    setLoading(true);

    void (async () => {
      try {
        const body = await request<Paginated<Row> | Row[]>(adapter.path, {
          query: {
            page,
            limit: pageSize,
            ...(sort.by ? { sortBy: sort.by, sortOrder: sort.order } : {}),
            ...(adapter.query ?? {}),
            ...(JSON.parse(filterKey) as Record<string, unknown>),
          },
          quiet: true,
        });
        if (!live) return;

        const data = Array.isArray(body) ? body : (body?.data ?? []);
        setRows(data.map((r) => adapter.fromServer(r)) as T[]);
        setTotal(Array.isArray(body) ? data.length : (body?.meta?.total ?? data.length));
        setError(null);
      } catch (err) {
        if (!live) return;
        setError(err instanceof Error ? err.message : "Couldn't load this page");
        setRows([]);
        setTotal(0);
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [collection, page, pageSize, sort.by, sort.order, filterKey, tick]);

  const onPageChange = useCallback((nextPage: number, nextSize: number) => {
    setPage(nextPage);
    setPageSize(nextSize);
  }, []);

  const onSortChange = useCallback((key: string | null, direction: "asc" | "desc") => {
    setSort({ by: key, order: direction });
    // A different sort means a different first page.
    setPage(1);
  }, []);

  return {
    rows,
    total,
    loading,
    error,
    server: { total, page, pageSize, loading, onPageChange, onSortChange },
    refresh: () => setTick((t) => t + 1),
  };
}
