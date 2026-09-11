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
  /**
   * Changes once, when a route's data finishes arriving.
   *
   * Pages read plain module-level arrays, which React cannot observe: splicing
   * rows into one triggers no render, so a screen that mounted before its data
   * landed would sit there showing the seed fallback forever. Using this as a
   * key remounts the screen the moment its data is real — once, on first
   * visit. A revisit finds everything loaded and does not remount at all.
   */
  dataKey: string;
};

export function useRouteData(): RouteDataState {
  const { pathname } = useLocation();
  const [loading, setLoading] = useState(false);
  const [arrivals, setArrivals] = useState(0);

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

    // Already here from an earlier visit: no request, no spinner, no remount.
    const missing = needed.filter((c) => !isLoaded(c));
    if (!missing.length) {
      setLoading(false);
      return;
    }

    let live = true;
    setLoading(true);
    void ensureLoaded(missing).finally(() => {
      if (!live) return;
      setLoading(false);
      // Something new landed, so whatever is on screen is now stale.
      setArrivals((n) => n + 1);
    });

    return () => {
      // Navigating away mid-fetch must not leave the next screen spinning.
      live = false;
    };
  }, [pathname]);

  return { loading, dataKey: `${pathname}:${arrivals}` };
}
