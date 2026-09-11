import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import {
  DateInput, Field, FileDrop, FormCard, FormGrid, RichText, SaveBar, SelectInput, TextInput,
} from "@/components/FormKit";
import { clients } from "@/data/core";
import { api } from "@/lib/api";
import { todayISO } from "@/lib/format";

export default function ClientForm() {
  const nav = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const save = () => {
    const v = Object.fromEntries(new FormData(formRef.current!).entries());
    // Everything the form collected, not just the six fields the list needs.
    const client = {
      ...Object.fromEntries(Object.entries(v).map(([k, val]) => [k, String(val)])),
      id: `c-${Date.now()}`,
      name: String(v.name || "New Client"),
      company: String(v.company || v.name || "—"),
      email: String(v.email || ""),
      phone: String(v.phone || ""),
      category: String(v.category || "SMB"),
      added: String(v.added || todayISO()),
      status: "Active" as const,
    };
    clients.push(client);
    void api.create("clients", client);
    nav("/clients");
  };
  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()}>
      <PageHeader title="Add Client" crumbs={["Clients"]} />
      <FormCard title="Account Details">
        <FormGrid>
          <Field label="Client Name" required><TextInput placeholder="e.g. John Doe" name="name" /></Field>
          <Field label="Email" required><TextInput placeholder="e.g. johndoe@example.com" name="email" /></Field>
          <Field label="Country"><SelectInput name="country" options={["United States", "United Kingdom", "India", "Germany", "Australia"]} /></Field>
          <Field label="Mobile"><TextInput placeholder="e.g. 1234567890" name="phone" /></Field>
          <Field label="Gender"><SelectInput options={["Male", "Female", "Others"]} /></Field>
          <Field label="Change Language"><SelectInput options={["English", "Spanish", "French"]} /></Field>
          <Field label="Client Category"><SelectInput options={["Enterprise", "SMB", "Agency"]} withAdd name="category" /></Field>
          <Field label="Client Sub Category"><SelectInput name="subCategory" options={["--", "Gold", "Silver"]} withAdd /></Field>
          <Field label="Login Allowed?"><SelectInput options={["Yes", "No"]} /></Field>
          <Field label="Receive email notifications?"><SelectInput options={["Yes", "No"]} /></Field>
          <Field label="Added On"><DateInput name="added" /></Field>
          <Field label="Profile Picture"><FileDrop /></Field>
        </FormGrid>
      </FormCard>
      <div className="h-5" />
      <FormCard title="Company Details">
        <FormGrid>
          <Field label="Company Name"><TextInput placeholder="e.g. Acme Corporation" name="company" /></Field>
          <Field label="Official Website"><TextInput name="website" placeholder="e.g. https://www.example.com" /></Field>
          <Field label="Tax Name"><TextInput placeholder="e.g. GST/VAT" /></Field>
          <Field label="GST/VAT Number"><TextInput name="taxNumber" placeholder="e.g. 18AABCU960" /></Field>
          <Field label="Office Phone Number"><TextInput name="officePhone" /></Field>
          <Field label="City"><TextInput name="city" /></Field>
          <Field label="State"><TextInput name="state" /></Field>
          <Field label="Postal Code"><TextInput name="postalCode" /></Field>
          <Field label="Company Address" span><RichText name="address" rows={3} placeholder="e.g. 132, My Street, Kingston, New York 12401" /></Field>
          <Field label="Shipping Address" span><RichText name="shippingAddress" rows={3} /></Field>
          <Field label="Note" span><RichText name="note" rows={3} /></Field>
        </FormGrid>
        <SaveBar
          toast="Client saved"
          onSave={save}
          extra={
            <button
              type="button"
              className="btn-outline"
              onClick={() => {
                save();
                nav("/clients/new");
              }}
            >
              Save &amp; Add More
            </button>
          }
        />
      </FormCard>
    </form>
  );
}
