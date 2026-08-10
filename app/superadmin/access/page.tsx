import { LiveModule } from "../../components/live-console";

export default function Page() {
  return (
    <LiveModule
      consoleType="superadmin"
      eyebrow="SECURITY / IDENTITY"
      title="Users & access"
      copy="Active and suspended role assignments across the platform. A Superadmin membership must leave organization and branch empty."
      table="memberships"
      orderBy="created_at"
      watch={["organizations", "branches"]}
      allowEdit
      columns={[
        { key: "user_id", label: "User UUID", format: "mono" },
        { key: "role", label: "Role" },
        { key: "organization_id", label: "Organization", format: "mono" },
        { key: "branch_id", label: "Branch", format: "mono" },
        { key: "status", label: "Status", format: "status" },
        { key: "created_at", label: "Created", format: "date" },
      ]}
      createLabel="Create membership"
      createFields={[
        { key: "user_id", label: "User account", required: true, reference: { table: "profiles", labelColumns: ["full_name", "email"] } },
        {
          key: "role",
          label: "Role",
          required: true,
          options: [
            { value: "organization_admin", label: "Organization admin" },
            { value: "branch_admin", label: "Branch admin" },
            { value: "dispatcher", label: "Dispatcher" },
            { value: "cashier", label: "Cashier" },
            { value: "support", label: "Support" },
            { value: "analyst", label: "Analyst" },
            { value: "superadmin", label: "Superadmin (platform)" },
          ],
        },
        { key: "organization_id", label: "Organization", reference: { table: "organizations", labelColumns: ["name"] } },
        { key: "branch_id", label: "Branch", reference: { table: "branches", labelColumns: ["name", "code"], filterBy: "organization_id" } },
        {
          key: "status",
          label: "Status",
          options: [
            { value: "active", label: "Active" },
            { value: "invited", label: "Invited" },
            { value: "suspended", label: "Suspended" },
            { value: "expired", label: "Expired" },
          ],
        },
      ]}
      allowDelete
    />
  );
}
