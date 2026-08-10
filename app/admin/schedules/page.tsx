import { LiveModule } from "../../components/live-console";

export default function Page() {
  return (
    <LiveModule
      consoleType="admin"
      eyebrow="OPERATIONS / PLANNING"
      title="Routes"
      copy="Routes connect two terminals and must exist before a trip can be scheduled. Only published routes are visible to passengers."
      table="routes"
      orderBy="created_at"
      watch={["terminals", "trips"]}
      allowEdit
      columns={[
        { key: "typical_duration_minutes", label: "Duration (min)", format: "mono" },
        { key: "base_fare", label: "Base fare", format: "money" },
        { key: "status", label: "Status", format: "status" },
        { key: "created_at", label: "Created", format: "date" },
      ]}
      createLabel="Add route"
      createFields={[
        { key: "organization_id", label: "Organization", required: true, reference: { table: "organizations", labelColumns: ["name"] } },
        { key: "origin_terminal_id", label: "Origin terminal", required: true, reference: { table: "terminals", labelColumns: ["city", "name"] } },
        { key: "destination_terminal_id", label: "Destination terminal", required: true, reference: { table: "terminals", labelColumns: ["city", "name"] } },
        { key: "typical_duration_minutes", label: "Typical duration (minutes)", type: "number", required: true },
        { key: "base_fare", label: "Base fare", type: "number", required: true },
        {
          key: "status",
          label: "Status",
          required: true,
          options: [
            { value: "draft", label: "Draft" },
            { value: "published", label: "Published" },
            { value: "archived", label: "Archived" },
          ],
        },
      ]}
      allowDelete
    />
  );
}
