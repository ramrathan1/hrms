/* Guards a detail route against an id that isn't there.
 *
 * Detail pages look their record up by id and used to fall back to the first
 * one in the collection, so a stale link or a deleted row quietly displayed
 * somebody else's invoice — and crashed when the collection was empty. Doing
 * the check here keeps the pages themselves simple: they only ever render for
 * a record that exists. */
import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";

import { getCollection, onStoreChange, storeLoaded } from "@/lib/api";
import { RecordNotFound } from "@/components/ui";

export function RequireRecord({
  collection,
  what,
  backTo,
  backLabel,
  param = "id",
  children,
}: {
  /** Collection name in the store, e.g. "invoices". */
  collection: string;
  /** How to name it to the reader, e.g. "invoice". */
  what: string;
  backTo: string;
  backLabel?: string;
  /** Route parameter holding the id. */
  param?: string;
  children: ReactNode;
}) {
  const params = useParams();
  const id = params[param];

  // The collection is a shared array that fills in as data loads, so re-check
  // whenever anything writes rather than deciding once on first render.
  const [, bump] = useState(0);
  useEffect(() => onStoreChange(() => bump((n) => n + 1)), []);

  const rows = getCollection(collection);
  const found = rows.some((r) => String(r.id) === String(id));
  if (found) return <>{children}</>;

  // Still loading, or the collection has simply not arrived yet: show nothing
  // rather than claiming the record is missing.
  if (!storeLoaded() || rows.length === 0) {
    return <p className="card px-6 py-16 text-center text-sm text-faint">Loading…</p>;
  }

  return <RecordNotFound what={what} backTo={backTo} backLabel={backLabel} />;
}
