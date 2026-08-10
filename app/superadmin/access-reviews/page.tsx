import { LiveModule } from "../../components/live-console";

export default function Page() {
  return <LiveModule
    consoleType="superadmin"
    eyebrow="SECURITY / REVIEWS"
    title="Access reviews"
    copy="Schedule and record periodic reviews of organization and branch access."
    table="access_reviews"
    orderBy="due_at"
    allowEdit
    allowDelete
    columns={[
      { key: "organization_id", label: "Organization", format: "mono" },
      { key: "branch_id", label: "Branch", format: "mono" },
      { key: "due_at", label: "Due", format: "datetime" },
      { key: "result", label: "Result", format: "status" },
      { key: "completed_at", label: "Completed", format: "datetime" },
      { key: "notes", label: "Notes" },
    ]}
    createLabel="Schedule access review"
    createFields={[
      { key: "organization_id", label: "Organization", reference: { table: "organizations", labelColumns: ["name"] } },
      { key: "branch_id", label: "Branch", reference: { table: "branches", labelColumns: ["name", "code"], filterBy: "organization_id" } },
      { key: "due_at", label: "Due at", type: "datetime-local", required: true },
      { key: "completed_at", label: "Completed at", type: "datetime-local" },
      { key: "result", label: "Result", options: [{ value: "approved", label: "Approved" }, { value: "changes_required", label: "Changes required" }, { value: "revoked", label: "Revoked" }] },
      { key: "notes", label: "Notes", type: "textarea" },
    ]}
  />;
}
