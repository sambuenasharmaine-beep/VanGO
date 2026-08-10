import { LiveModule } from "../../components/live-console";

export default function Page() {
  return <LiveModule
    consoleType="admin"
    eyebrow="OPERATIONS / FLEET"
    title="Drivers"
    copy="Maintain driver identity, license validity, duty state, and branch scope."
    table="drivers"
    orderBy="updated_at"
    allowEdit
    columns={[
      { key: "full_name", label: "Driver" },
      { key: "mobile_e164", label: "Mobile" },
      { key: "license_number", label: "License", format: "mono" },
      { key: "license_expiry", label: "Expiry", format: "date" },
      { key: "status", label: "Status", format: "status" },
    ]}
    createLabel="Add driver"
    createFields={[
      { key: "organization_id", label: "Organization", required: true, reference: { table: "organizations", labelColumns: ["name"] } },
      { key: "branch_id", label: "Branch", reference: { table: "branches", labelColumns: ["name", "code"], filterBy: "organization_id" } },
      { key: "full_name", label: "Full name", required: true },
      { key: "mobile_e164", label: "Mobile number", placeholder: "+63…" },
      { key: "license_number", label: "License number", required: true },
      { key: "license_expiry", label: "License expiry", type: "date", required: true },
      { key: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "off_duty", label: "Off duty" }, { value: "suspended", label: "Suspended" }, { value: "inactive", label: "Inactive" }] },
    ]}
  />;
}
