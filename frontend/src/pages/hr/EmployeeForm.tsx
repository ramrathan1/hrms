import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import {
  CheckboxInput, DateInput, Field, FileDrop, FormCard, FormGrid, RichText, SaveBar, SelectInput, TextInput,
} from "@/components/FormKit";
import { employees } from "@/data/core";
import { api } from "@/lib/api";
import { todayISO } from "@/lib/format";

export default function EmployeeForm() {
  const nav = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const save = () => {
    const v = Object.fromEntries(new FormData(formRef.current!).entries());
    const employee = {
      // Keep everything the form collected, then pin the fields the app relies on.
      ...Object.fromEntries(Object.entries(v).map(([k, val]) => [k, String(val)])),
      id: `e${employees.length + 1}-${Date.now().toString(36)}`,
      name: String(v.name || "New Employee"),
      designation: String(v.designation || "Trainee"),
      department: String(v.department || "Engineering"),
      email: String(v.email || ""),
      phone: String(v.phone || ""),
      status: "Active" as const,
      joined: String(v.joined || todayISO()),
      hourly: Number(v.hourly || 50),
    };
    employees.push(employee);
    api.create("employees", employee);

    /* The optimistic row is taken back off the list if the server refuses, so
       waiting for the write to land and looking for it again is how we know
       whether this actually saved. Throwing leaves the user on the filled-in
       form with the API's error toast, rather than on an empty list. */
    return api.settled().then(() => {
      if (!employees.some((e) => e.email === employee.email)) {
        throw new Error("Employee was rejected by the server");
      }
      nav("/hr/employees");
    });
  };
  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()}>
      <PageHeader title="Add Employee" crumbs={["HR", "Employees"]} />
      <FormCard title="Account Details">
        <FormGrid>
          <Field label="Employee ID" required><TextInput name="employeeId" defaultValue="E11" /></Field>
          <Field label="Full Name" required><TextInput placeholder="e.g. John Doe" name="name" /></Field>
          <Field label="Email" required><TextInput placeholder="e.g. johndoe@example.com" name="email" /></Field>
          <Field label="Profile Picture"><FileDrop /></Field>
          <Field label="Date of Birth"><DateInput name="dob" defaultValue="1998-04-12" /></Field>
          <Field label="Designation" required><SelectInput options={["Team Lead", "Project Manager", "Senior Developer", "Junior Developer", "QA Engineer", "Junior Designer", "Trainee", "Recruiter"]} withAdd name="designation" /></Field>
          <Field label="Department" required><SelectInput options={["Engineering", "Design", "Delivery", "Human Resource"]} withAdd name="department" /></Field>
          <Field label="Country"><SelectInput name="country" options={["United States", "United Kingdom", "India", "Germany"]} /></Field>
          <Field label="Mobile"><TextInput placeholder="e.g. 1234567890" name="phone" /></Field>
          <Field label="Gender"><SelectInput name="gender" options={["Male", "Female", "Others"]} /></Field>
          <Field label="Joining Date" required><DateInput name="joined" /></Field>
          <Field label="Reporting To"><SelectInput name="reportsTo" options={["--", ...employees.map((e) => e.name)]} /></Field>
          <Field label="Language"><SelectInput name="language" options={["English", "Spanish", "French"]} /></Field>
          <Field label="User Role"><SelectInput name="role" options={["Employee", "Manager", "App Administrator"]} /></Field>
          <Field label="Address" span><RichText name="address" rows={3} /></Field>
          <Field label="About" span><RichText name="about" rows={3} /></Field>
        </FormGrid>
      </FormCard>
      <div className="h-5" />
      <FormCard title="Other Details">
        <FormGrid>
          <Field label="Login Allowed?"><SelectInput name="loginAllowed" options={["Yes", "No"]} /></Field>
          <Field label="Receive email notifications?"><SelectInput name="emailNotifications" options={["Yes", "No"]} /></Field>
          <Field label="Hourly Rate"><TextInput defaultValue="50" name="hourly" /></Field>
          <Field label="Slack Member ID"><TextInput name="slackId" placeholder="@member_name" /></Field>
          <Field label="Skills"><TextInput name="skills" placeholder="e.g. react, laravel" /></Field>
          <Field label="Probation End Date"><DateInput name="probationEnd" /></Field>
          <Field label="Notice Period Start Date"><DateInput name="noticeStart" /></Field>
          <Field label="Notice Period End Date"><DateInput name="noticeEnd" /></Field>
          <Field label="Employment Type"><SelectInput name="employmentType" options={["Full Time", "Part Time", "Contract", "Intern", "Trainee"]} /></Field>
          <Field label="Marital Status"><SelectInput name="maritalStatus" options={["Single", "Married"]} /></Field>
          <Field label="Business Address"><SelectInput options={["Worksuite HQ"]} /></Field>
          <Field label=" "><CheckboxInput label="Customise login permissions" /></Field>
        </FormGrid>
        <SaveBar toast="Employee saved" onSave={save} extra={<button type="button" className="btn-outline" onClick={save}>Save &amp; Add More</button>} />
      </FormCard>
    </form>
  );
}
