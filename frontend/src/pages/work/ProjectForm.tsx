import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import {
  CheckboxInput, DateInput, Field, FileDrop, FormCard, FormGrid, RichText, SaveBar, SelectInput, TextInput,
} from "@/components/FormKit";
import { clients, employees } from "@/data/core";
import { projects } from "@/data/work";
import { api } from "@/lib/api";
import { todayISO } from "@/lib/format";
import { CURRENT_USER } from "@/lib/store";

export default function ProjectForm() {
  const nav = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const save = () => {
    const v = Object.fromEntries(new FormData(formRef.current!).entries());
    const chosenClient = clients.find((c) => c.company === String(v.client));
    const chosenMember = employees.find((e) => e.name === String(v.members));
    const project = {
      ...Object.fromEntries(Object.entries(v).map(([k, val]) => [k, String(val)])),
      id: `p-${Date.now().toString(36)}`,
      code: String(v.code || "PRJ"),
      name: String(v.name || "New Project"),
      clientId: chosenClient?.id ?? clients[0].id,
      members: chosenMember ? [chosenMember.id] : [CURRENT_USER.id],
      start: String(v.start || todayISO()),
      deadline: String(v.deadline || "2026-12-01"),
      progress: 0,
      status: "Not Started" as const,
      budget: Number(v.budget || 0),
      category: String(v.category || "Web"),
    };
    projects.push(project);
    void api.create("projects", project);
    nav("/work/projects");
  };
  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()}>
      <PageHeader title="Add Project" crumbs={["Work", "Projects"]} />
      <FormCard title="Project Details">
        <FormGrid>
          <Field label="Short Code" required><TextInput placeholder="e.g. CRM" name="code" /></Field>
          <Field label="Project Name" required><TextInput placeholder="e.g. Customer relationship portal" name="name" /></Field>
          <Field label="Start Date" required><DateInput name="start" /></Field>
          <Field label="Deadline"><DateInput defaultValue="2026-12-01" name="deadline" /></Field>
          <Field label="Category"><SelectInput name="category" options={["Web", "Platform", "Service"]} withAdd /></Field>
          <Field label="Department"><SelectInput name="department" options={["Engineering", "Design", "Delivery"]} /></Field>
          <Field label="Client"><SelectInput name="client" options={["--", ...clients.map((c) => c.company)]} withAdd /></Field>
          <Field label="Project Members"><SelectInput name="members" options={employees.map((e) => e.name)} /></Field>
          <Field label="Currency"><SelectInput name="currency" options={["USD ($)", "GBP (£)", "EUR (€)", "INR (₹)"]} /></Field>
          <Field label="Project Budget"><TextInput placeholder="e.g. 30000" name="budget" /></Field>
          <Field label="Hours Estimate"><TextInput name="hoursEstimate" placeholder="e.g. 500" /></Field>
          <Field label=" "><CheckboxInput label="Client can manage tasks" /></Field>
          <Field label="Project Summary" span><RichText name="summary" /></Field>
          <Field label="Add File" span><FileDrop /></Field>
        </FormGrid>
        <SaveBar toast="Project saved" onSave={save} extra={<button type="button" className="btn-outline" onClick={save}>Save As Template</button>} />
      </FormCard>
    </form>
  );
}
