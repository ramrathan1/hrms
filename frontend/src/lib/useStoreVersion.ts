import { useEffect, useState } from "react";
import { onStoreChange } from "./api";

/**
 * Re-render this component whenever any collection changes.
 *
 * Most screens read their rows straight out of the shared arrays in `@/data/*`
 * rather than from React state, so nothing tells them when a collection is
 * pulled from the server or written to. A component that renders a count at
 * mount therefore keeps that number for as long as it stays mounted — which is
 * how the HR portal's "Leave to approve" tile could sit on a stale figure while
 * new requests arrived behind it.
 *
 * `useCrud` already does this for the tables it owns. This is the same
 * subscription for screens that compute their own figures.
 */
export function useStoreVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => onStoreChange(() => setVersion((n) => n + 1)), []);
  return version;
}
