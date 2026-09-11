/**
 * Today, as the app sees it.
 *
 * This used to be pinned to a fixed date so the shipped demo rows stayed
 * coherent. The data comes from the server now, so "overdue" and "upcoming"
 * have to mean what they say — a task due yesterday is overdue whichever day
 * you open the app.
 */
export const TODAY = new Date();

/** Tomorrow, for forms that schedule something ahead. */
export const tomorrowISO = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Today as "YYYY-MM-DD", the form every stored date takes. */
export const todayISO = (): string => {
  const d = new Date();
  // Built from local parts, not toISOString(), which would shift the date for
  // anyone west of UTC late in the day.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const money = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

/** exchange rates against the base currency (USD) */
export const RATES: Record<string, { rate: number; symbol: string }> = {
  USD: { rate: 1, symbol: "$" },
  GBP: { rate: 0.79, symbol: "£" },
  EUR: { rate: 0.92, symbol: "€" },
  INR: { rate: 83.2, symbol: "₹" },
  AED: { rate: 3.67, symbol: "د.إ" },
};

/** convert an amount from a currency back into the USD base */
export const toBase = (amount: number, currency = "USD") =>
  Math.round((amount / (RATES[currency]?.rate ?? 1)) * 100) / 100;

/** convert a USD base amount into the target currency */
export const fromBase = (amount: number, currency = "USD") =>
  Math.round(amount * (RATES[currency]?.rate ?? 1) * 100) / 100;

/** A record with a missing or malformed date should render a dash, not crash
    the page it appears on. */
export const fmtDate = (d?: string | Date | null) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d) : d;
  if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return "—";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${dt.getFullYear()}`;
};

export const monthName = (m: number) =>
  [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ][m];

export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const initials = (name?: string) =>
  (name ?? "")
    .split(" ")
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

const HUES = [210, 262, 330, 22, 160, 200, 288, 12, 100, 240, 180, 45];
export const nameHue = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997;
  return HUES[h % HUES.length];
};

export const hoursLabel = (h: number) => `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`;
