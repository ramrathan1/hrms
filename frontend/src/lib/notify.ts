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

const SEED: Notification[] = [
  { id: "n1", kind: "task", text: "Lila Lueilwitz logged 4h on DMS-25", detail: "Document management System", to: "/work/timesheets", time: "12 min ago", read: false },
  { id: "n2", kind: "invoice", text: "INV#017 was sent to Kihn-Schaden", detail: "$7,400.00 · due 10 Sep", to: "/finance/invoices/i8", time: "1 hour ago", read: false },
  { id: "n3", kind: "leave", text: "Leave request from Kole Johnston is pending", detail: "Casual leave · 03 Sep", to: "/hr/leaves", time: "3 hours ago", read: false },
  { id: "n4", kind: "deal", text: "Deal “Brand refresh” marked Won", detail: "$7,800.00 · Swan Craft", to: "/deals", time: "Yesterday", read: true },
  { id: "n5", kind: "ticket", text: "TKT#012 escalated to High priority", detail: "Cannot download invoice PDF", to: "/tickets/TKT%23012", time: "Yesterday", read: true },
];

let items: Notification[] = (() => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Notification[]) : SEED;
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
