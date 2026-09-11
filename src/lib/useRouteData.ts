/* Loads a screen's data when you navigate to it.
 *
 * Mounted once in the app shell rather than in each page, so the 77 page
 * components keep reading their plain arrays and know nothing about when those
 * arrays were filled. What they do need is to re-render once the data lands,
 * which is what the store subscription below provides. */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { ensureLoaded, isLoaded, onStoreChange, storeLoaded } from "./api";
import { collectionsFor } from "./routeData";

export type RouteDataState = {
  /** True while this route's collections are still arriving for the first time. */
  loading: boolean;
};

export function useRouteData(): RouteDataState {
  const { pathname } = useLocation();
  const [loading, setLoading] = useState(false);

  // Any write, anywhere, re-renders the tree below the shell — which is how a
  // page rendered against an empty array picks up its rows a moment later.
  const [, bump] = useState(0);
  useEffect(() => onStoreChange(() => bump((n) => n + 1)), []);

  useEffect(() => {
    if (!storeLoaded()) return;

    const needed = collectionsFor(pathname);
    if (!needed.length) {
      setLoading(false);
      return;
    }

    // Already here from an earlier visit: no request, no spinner.
    const missing = needed.filter((c) => !isLoaded(c));
    if (!missing.length) {
      setLoading(false);
      return;
    }

    let live = true;
    setLoading(true);
    void ensureLoaded(missing).finally(() => {
      if (live) setLoading(false);
    });

    return () => {
      // Navigating away mid-fetch must not leave the next screen spinning.
      live = false;
    };
  }, [pathname]);

  return { loading };
}
