import { LiveModule } from "../../components/live-console";

export default function Page() {
  return (
    <LiveModule
      consoleType="admin"
      eyebrow="OPERATIONS / FLEET"
      title="Fleet & drivers"
      copy="Vehicles available within your organization and branch scope."
      table="vehicles"
      orderBy="updated_at"
      watch={["trip_assignments"]}
      allowEdit
      columns={[
        { key: "plate_number", label: "Plate", format: "mono" },
        { key: "model", label: "Vehicle" },
        { key: "capacity", label: "Seats", format: "mono" },
        { key: "seat_layout_code", label: "Layout" },
        { key: "status", label: "Status", format: "status" },
      ]}
      createLabel="Add vehicle"
      createFields={[
        { key: "organization_id", label: "Organization", required: true, reference: { table: "organizations", labelColumns: ["name"] } },
        { key: "branch_id", label: "Branch", reference: { table: "branches", labelColumns: ["name", "code"], filterBy: "organization_id" } },
        { key: "plate_number", label: "Plate number", required: true },
        { key: "model", label: "Vehicle model" },
        { key: "capacity", label: "Capacity", type: "number", required: true },
        {
          key: "status",
          label: "Status",
          options: [
            { value: "active", label: "Active" },
            { value: "maintenance", label: "Maintenance" },
            { value: "inactive", label: "Inactive" },
            { value: "suspended", label: "Suspended" },
          ],
        },
      ]}
    />
  );
}
