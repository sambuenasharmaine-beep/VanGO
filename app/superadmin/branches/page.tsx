import { LiveModule } from "../../components/live-console";

export default function Page() {
  return (
    <LiveModule
      consoleType="superadmin"
      eyebrow="PLATFORM / NETWORK"
      title="Branches"
      copy="Real operator branches and terminal operating scopes."
      table="branches"
      orderBy="created_at"
      watch={["organizations"]}
      allowEdit
      columns={[
        { key: "name", label: "Branch" },
        { key: "code", label: "Code", format: "mono" },
        { key: "address", label: "Address" },
        { key: "timezone", label: "Timezone" },
        { key: "status", label: "Status", format: "status" },
      ]}
      createLabel="Add branch"
      createFields={[
        { key: "organization_id", label: "Organization", required: true, reference: { table: "organizations", labelColumns: ["name"] } },
        { key: "name", label: "Branch name", required: true },
        { key: "code", label: "Branch code", required: true, placeholder: "MNL-01" },
        { key: "address", label: "Address" },
        {
          key: "status",
          label: "Status",
          options: [
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
            { value: "review", label: "Review" },
          ],
        },
      ]}
    />
  );
}
