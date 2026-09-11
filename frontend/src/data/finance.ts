export type Invoice = {
  id: string;
  number: string;
  projectId?: string;
  clientId: string;
  total: number;
  paid: number;
  date: string;
  due: string;
  status: "Paid" | "Unpaid" | "Partially Paid" | "Overdue" | "Draft";
};

export const invoices: Invoice[] = [
  { id: "i1", number: "INV#001", projectId: "p1", clientId: "c1", total: 25713, paid: 25713, date: "2026-08-14", due: "2026-08-17", status: "Paid" },
  { id: "i2", number: "INV#003", projectId: "p1", clientId: "c1", total: 64136, paid: 64136, date: "2026-08-07", due: "2026-08-10", status: "Paid" },
  { id: "i3", number: "INV#006", projectId: "p2", clientId: "c2", total: 59214, paid: 59214, date: "2026-08-01", due: "2026-08-04", status: "Paid" },
  { id: "i4", number: "INV#011", projectId: "p5", clientId: "c3", total: 39670, paid: 39670, date: "2026-08-19", due: "2026-08-22", status: "Paid" },
  { id: "i5", number: "INV#012", projectId: "p5", clientId: "c5", total: 21402, paid: 21402, date: "2026-08-21", due: "2026-08-23", status: "Paid" },
  { id: "i6", number: "INV#014", projectId: "p6", clientId: "c8", total: 41056, paid: 41056, date: "2026-08-05", due: "2026-08-07", status: "Paid" },
  { id: "i7", number: "INV#016", projectId: "p3", clientId: "c3", total: 18300, paid: 9000, date: "2026-08-24", due: "2026-09-08", status: "Partially Paid" },
  { id: "i8", number: "INV#017", clientId: "c4", total: 7400, paid: 0, date: "2026-08-26", due: "2026-09-10", status: "Unpaid" },
  { id: "i9", number: "INV#018", clientId: "c6", total: 12750, paid: 0, date: "2026-07-15", due: "2026-07-30", status: "Overdue" },
  { id: "i10", number: "INV#019", clientId: "c9", total: 4500, paid: 0, date: "2026-08-28", due: "2026-09-12", status: "Draft" },
];

export const estimates = [
  { id: "es1", number: "EST#001", clientId: "c1", total: 42000, valid: "2026-09-15", status: "Accepted", date: "2026-08-01" },
  { id: "es2", number: "EST#002", clientId: "c4", total: 15800, valid: "2026-09-20", status: "Sent", date: "2026-08-12" },
  { id: "es3", number: "EST#003", clientId: "c6", total: 30000, valid: "2026-09-05", status: "Declined", date: "2026-08-08" },
  { id: "es4", number: "EST#004", clientId: "c2", total: 21500, valid: "2026-09-30", status: "Draft", date: "2026-08-25" },
];

export const proposals = [
  { id: "pr1", number: "PROP#001", leadName: "Botsford Media", total: 12500, date: "2026-08-13", valid: "2026-09-13", status: "Sent" },
  { id: "pr2", number: "PROP#002", leadName: "Klocko Logistics", total: 48000, date: "2026-08-20", valid: "2026-09-20", status: "Draft" },
  { id: "pr3", number: "PROP#003", leadName: "Swan Craft", total: 7800, date: "2026-08-10", valid: "2026-08-25", status: "Accepted" },
];

export const payments = [
  { id: "pay1", invoiceId: "i1", amount: 25713, date: "2026-08-17", gateway: "Stripe", account: "Primary Account" },
  { id: "pay2", invoiceId: "i2", amount: 64136, date: "2026-08-10", gateway: "Bank Transfer", account: "Secondary Account" },
  { id: "pay3", invoiceId: "i3", amount: 59214, date: "2026-08-04", gateway: "PayPal", account: "Primary Account" },
  { id: "pay4", invoiceId: "i4", amount: 39670, date: "2026-08-22", gateway: "Stripe", account: "Secondary Account" },
  { id: "pay5", invoiceId: "i5", amount: 21402, date: "2026-08-23", gateway: "Razorpay", account: "Secondary Account" },
  { id: "pay6", invoiceId: "i6", amount: 41056, date: "2026-08-07", gateway: "Stripe", account: "Secondary Account" },
  { id: "pay7", invoiceId: "i7", amount: 9000, date: "2026-08-27", gateway: "Bank Transfer", account: "Primary Account" },
];

export const creditNotes = [
  { id: "cn1", number: "CN#001", invoice: "INV#003", clientId: "c1", total: 1200, used: 0, date: "2026-08-12", status: "Open" },
  { id: "cn2", number: "CN#002", invoice: "INV#006", clientId: "c2", total: 900, used: 900, date: "2026-08-15", status: "Closed" },
];

export const expenses = [
  { id: "ex1", item: "Team workstation upgrade", price: 942, employee: "e7", project: "—", date: "2026-08-19", status: "Approved", category: "Hardware" },
  { id: "ex2", item: "Figma org plan (annual)", price: 540, employee: "e6", project: "—", date: "2026-08-03", status: "Approved", category: "Software" },
  { id: "ex3", item: "Client visit travel", price: 310, employee: "e3", project: "User Management", date: "2026-08-22", status: "Pending", category: "Travel" },
  { id: "ex4", item: "Load-testing credits", price: 120, employee: "e9", project: "Railway tracking…", date: "2026-08-26", status: "Rejected", category: "Software" },
];

export const recurringExpenses = [
  { id: "rex1", item: "Office rent", price: 2400, cycle: "Monthly", next: "2026-09-01", status: "Active" },
  { id: "rex2", item: "CI runner pool", price: 260, cycle: "Monthly", next: "2026-09-05", status: "Active" },
];

export const recurringInvoices = [
  { id: "ri1", clientId: "c1", amount: 4500, cycle: "Monthly", nextRun: "2026-09-01", startedOn: "2026-01-01", issued: 8, status: "Active", memo: "Retainer — support & maintenance" },
  { id: "ri2", clientId: "c6", amount: 1800, cycle: "Monthly", nextRun: "2026-09-05", startedOn: "2026-04-05", issued: 5, status: "Active", memo: "Hosting & monitoring" },
  { id: "ri3", clientId: "c3", amount: 12000, cycle: "Quarterly", nextRun: "2026-10-01", startedOn: "2026-01-01", issued: 3, status: "Paused", memo: "Platform licence" },
];

export const bankAccounts = [
  { id: "b1", name: "Primary Account", bank: "First National", type: "Bank", number: "•••• 4410", balance: 148230, status: "Active" },
  { id: "b2", name: "Secondary Account", bank: "Harbor Trust", type: "Bank", number: "•••• 9902", balance: 86410, status: "Active" },
  { id: "b3", name: "Petty Cash", bank: "—", type: "Cash", number: "—", balance: 1240, status: "Active" },
];

export const transactions = [
  { id: "tx1", accountId: "b1", type: "Credit", amount: 25713, date: "2026-08-17", memo: "INV#001 payment" },
  { id: "tx2", accountId: "b1", type: "Debit", amount: 942, date: "2026-08-19", memo: "Workstation upgrade" },
  { id: "tx3", accountId: "b2", type: "Credit", amount: 64136, date: "2026-08-10", memo: "INV#003 payment" },
  { id: "tx4", accountId: "b2", type: "Credit", amount: 41056, date: "2026-08-07", memo: "INV#014 payment" },
  { id: "tx5", accountId: "b1", type: "Debit", amount: 2400, date: "2026-08-01", memo: "Office rent" },
];

export const invoiceItems = [
  { desc: "Discovery & UX audit", qty: 1, rate: 4200, tax: 10 },
  { desc: "Implementation sprint (×3)", qty: 3, rate: 6000, tax: 10 },
  { desc: "QA & launch support", qty: 1, rate: 2900, tax: 0 },
];
