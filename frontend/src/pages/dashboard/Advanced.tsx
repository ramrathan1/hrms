import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard, ChartCard } from "@/components/StatCard";
import { BarChart, Donut, LineChart } from "@/components/charts";
import { Tabs, AvatarName, StatusPill } from "@/components/ui";
import { clients } from "@/data/core";
import { deals, leads } from "@/data/crm";
import { projects, tasks } from "@/data/work";
import { invoices, expenses } from "@/data/finance";
import { employees } from "@/data/core";
import { leaves } from "@/data/hr";
import { tickets } from "@/data/ops";
import { money, todayISO } from "@/lib/format";

const TABS = ["Overview", "Project", "Client", "HR", "Ticket", "Finance"];

export default function AdvancedDashboard() {
  const [tab, setTab] = useState("Overview");
  const earned = invoices.reduce((a, i) => a + i.paid, 0);
  const spent = expenses.reduce((a, e) => a + e.price, 0);
  return (
    <>
      <PageHeader title="Advanced Dashboard" crumbs={["Dashboard"]} />
      <div className="card mb-5 px-2">
        <Tabs tabs={TABS} active={tab} onChange={setTab} className="border-b-0" />
      </div>

      {tab === "Overview" && (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Clients" value={clients.length} />
            <StatCard label="Total Employees" value={employees.length} />
            <StatCard label="Total Earnings" value={money(earned)} />
            <StatCard label="Due Invoices" value={invoices.filter((i) => i.status !== "Paid" && i.status !== "Draft").length} />
          </div>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <ChartCard title="Earnings — August 2026">
              <LineChart points={[59, 41, 64, 27, 1, 40, 21].map((n) => n * 1000)} labels={["04 Aug", "07 Aug", "10 Aug", "17 Aug", "19 Aug", "22 Aug", "23 Aug"]} yFmt={(v) => `$${Math.round(v / 1000)}k`} />
            </ChartCard>
            <ChartCard title="Income vs Expense">
              <BarChart
                data={[
                  { label: "May", values: [{ name: "Income", value: 61000, color: "#5b5ceb" }, { name: "Expense", value: 9000, color: "#e85d51" }] },
                  { label: "Jun", values: [{ name: "Income", value: 74000, color: "#5b5ceb" }, { name: "Expense", value: 11000, color: "#e85d51" }] },
                  { label: "Jul", values: [{ name: "Income", value: 68000, color: "#5b5ceb" }, { name: "Expense", value: 8000, color: "#e85d51" }] },
                  { label: "Aug", values: [{ name: "Income", value: earned / 4, color: "#5b5ceb" }, { name: "Expense", value: spent, color: "#e85d51" }] },
                ]}
                yFmt={(v) => `$${Math.round(v / 1000)}k`}
              />
            </ChartCard>
          </div>
        </>
      )}

      {tab === "Project" && (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Projects" value={projects.length} />
            <StatCard label="In Progress" value={projects.filter((p) => p.status === "In Progress").length} />
            <StatCard label="On Hold" value={projects.filter((p) => p.status === "On Hold").length} />
            <StatCard label="Overdue Tasks" value={tasks.filter((t) => t.due < todayISO() && t.status !== "Completed").length} />
          </div>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <ChartCard title="Projects by Status">
              <Donut
                centerLabel="projects"
                segments={[
                  { label: "In Progress", value: projects.filter((p) => p.status === "In Progress").length, color: "#3fa9f5" },
                  { label: "Completed", value: projects.filter((p) => p.status === "Completed").length, color: "#1fa971" },
                  { label: "On Hold", value: projects.filter((p) => p.status === "On Hold").length, color: "#e8983c" },
                  { label: "Not Started", value: projects.filter((p) => p.status === "Not Started").length, color: "#8b94a7" },
                ]}
              />
            </ChartCard>
            <ChartCard title="Tasks by Status">
              <Donut
                centerLabel="tasks"
                segments={[
                  { label: "Completed", value: tasks.filter((t) => t.status === "Completed").length, color: "#1fa971" },
                  { label: "Doing", value: tasks.filter((t) => t.status === "Doing").length, color: "#3fa9f5" },
                  { label: "To Do", value: tasks.filter((t) => t.status === "Todo").length, color: "#e8983c" },
                  { label: "Incomplete", value: tasks.filter((t) => t.status === "Incomplete").length, color: "#e85d51" },
                ]}
              />
            </ChartCard>
          </div>
        </>
      )}

      {tab === "Client" && (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Leads" value={leads.length} />
            <StatCard label="Total Deals" value={deals.length} />
            <StatCard label="Deal Conversions" value={deals.filter((d) => d.stage === "won").length} />
            <StatCard label="New Clients (Aug)" value={2} />
          </div>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <ChartCard title="Deals by Stage">
              <Donut
                centerLabel="deals"
                segments={[
                  { label: "Generated", value: deals.filter((d) => d.stage === "generated").length, color: "#8b94a7" },
                  { label: "Qualified", value: deals.filter((d) => d.stage === "qualified").length, color: "#3fa9f5" },
                  { label: "Proposal", value: deals.filter((d) => d.stage === "proposal").length, color: "#e8983c" },
                  { label: "Negotiation", value: deals.filter((d) => d.stage === "negotiation").length, color: "#5b5ceb" },
                  { label: "Won", value: deals.filter((d) => d.stage === "won").length, color: "#1fa971" },
                  { label: "Lost", value: deals.filter((d) => d.stage === "lost").length, color: "#e85d51" },
                ]}
              />
            </ChartCard>
            <ChartCard title="Latest Clients">
              <ul className="divide-y divide-line">
                {clients.slice(0, 5).map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2.5">
                    <AvatarName name={c.name} sub={c.company} />
                    <StatusPill status={c.status} />
                  </li>
                ))}
              </ul>
            </ChartCard>
          </div>
        </>
      )}

      {tab === "HR" && (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Employees" value={employees.length} />
            <StatCard label="On Leave Today" value={1} />
            <StatCard label="Pending Leaves" value={leaves.filter((l) => l.status === "Pending").length} />
            <StatCard label="Average Attendance" value="92%" />
          </div>
          <ChartCard title="Department Headcount">
            <BarChart
              data={[
                { label: "Engineering", values: [{ name: "n", value: 5, color: "#5b5ceb" }] },
                { label: "Design", values: [{ name: "n", value: 2, color: "#5b5ceb" }] },
                { label: "Delivery", values: [{ name: "n", value: 2, color: "#1fa971" }] },
                { label: "HR", values: [{ name: "n", value: 1, color: "#e8983c" }] },
              ]}
            />
          </ChartCard>
        </>
      )}

      {tab === "Ticket" && (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Tickets" value={tickets.length} />
            <StatCard label="Open" value={tickets.filter((t) => t.status === "Open").length} />
            <StatCard label="Pending" value={tickets.filter((t) => t.status === "Pending").length} />
            <StatCard label="Resolved" value={tickets.filter((t) => t.status === "Resolved" || t.status === "Closed").length} />
          </div>
          <ChartCard title="Unresolved Tickets by Priority">
            <Donut
              centerLabel="tickets"
              segments={[
                { label: "High", value: tickets.filter((t) => t.priority === "High" && t.status === "Open").length, color: "#e85d51" },
                { label: "Medium", value: tickets.filter((t) => t.priority === "Medium" && t.status !== "Closed" && t.status !== "Resolved").length, color: "#e8983c" },
                { label: "Low", value: tickets.filter((t) => t.priority === "Low" && t.status !== "Closed" && t.status !== "Resolved").length, color: "#1fa971" },
              ]}
            />
          </ChartCard>
        </>
      )}

      {tab === "Finance" && (
        <>
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Earnings" value={money(earned)} />
            <StatCard label="Total Expenses" value={money(spent)} />
            <StatCard label="Amount Owed" value={money(invoices.reduce((a, i) => a + (i.total - i.paid), 0))} />
            <StatCard label="Avg Daily Receipt" value={money(41865.17)} />
          </div>
          <ChartCard title="Invoice Status">
            <Donut
              centerLabel="invoices"
              segments={[
                { label: "Paid", value: invoices.filter((i) => i.status === "Paid").length, color: "#1fa971" },
                { label: "Partially Paid", value: invoices.filter((i) => i.status === "Partially Paid").length, color: "#e8983c" },
                { label: "Unpaid", value: invoices.filter((i) => i.status === "Unpaid").length, color: "#8b94a7" },
                { label: "Overdue", value: invoices.filter((i) => i.status === "Overdue").length, color: "#e85d51" },
                { label: "Draft", value: invoices.filter((i) => i.status === "Draft").length, color: "#3fa9f5" },
              ]}
            />
          </ChartCard>
        </>
      )}
    </>
  );
}
