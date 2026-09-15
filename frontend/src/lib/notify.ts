/* App-wide notification store: records get created by app events, carry a deep link
   to the record they're about, and track read state. */
import { useEffect, useState } from "react";

export type Notification = {
  id: string;
  text: string;
  detail?: string;
  to?: string;
  time: string;
  read: boolean;
  kind: "task" | "invoice" | "leave" | "chat" | "deal" | "ticket" | "system";
};

const KEY = "ws.notifications";

/**
 * A new workspace has no notifications.
 *
 * This list used to open with five invented ones — an invoice for $7,400, a
 * deal marked Won, a colleague's pending leave. They were demo copy, but they
 * carried figures and names, sat behind an unread badge on every screen, and
 * were shown to every role including an employee who may see none of those
 * records. Notifications now arrive only from real events: `notify.push` and
 * the realtime hub.
 */
const SEED: Notification[] = [];

/** Ids of the demo notifications this store used to ship with. */
const RETIRED_SEED_IDS = new Set(["n1", "n2", "n3", "n4", "n5"]);

let items: Notification[] = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return SEED;
    // Anyone who opened the app before carries the old demo rows in storage.
    // Drop them on read so the invented invoice and deal do not outlive them.
    return (JSON.parse(raw) as Notification[]).filter((n) => !RETIRED_SEED_IDS.has(n.id));
  } catch {
    return SEED;
  }
})();

const listeners = new Set<(n: Notification[]) => void>();

const persist = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, 40)));
  } catch {
    /* storage may be unavailable */
  }
  listeners.forEach((l) => l([...items]));
};

export const notify = {
  push(n: Omit<Notification, "id" | "time" | "read">) {
    items = [{ ...n, id: `n-${Date.now()}`, time: "just now", read: false }, ...items];
    persist();
  },
  markRead(id: string) {
    items = items.map((n) => (n.id === id ? { ...n, read: true } : n));
    persist();
  },
  markAllRead() {
    items = items.map((n) => ({ ...n, read: true }));
    persist();
  },
  clear() {
    items = [];
    persist();
  },
};

export function useNotifications() {
  const [list, setList] = useState<Notification[]>(() => [...items]);
  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  return { list, unread: list.filter((n) => !n.read).length };
}
