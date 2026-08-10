import { LiveModule } from "../../components/live-console";

export default function Page() {
  return (
    <LiveModule
      consoleType="superadmin"
      eyebrow="PLATFORM / NETWORK"
      title="Terminals"
      copy="Terminals are the shared origin and destination points every route is built from. Passengers search against the active ones."
      table="terminals"
      orderBy="city"
      ascending
      watch={["routes"]}
      allowEdit
      columns={[
        { key: "city", label: "City" },
        { key: "name", label: "Terminal" },
        { key: "province", label: "Province" },
        { key: "is_active", label: "Active" },
        { key: "created_at", label: "Created", format: "date" },
      ]}
      createLabel="Add terminal"
      createFields={[
        { key: "name", label: "Terminal name", required: true },
        { key: "city", label: "City", required: true },
        { key: "province", label: "Province" },
        { key: "address", label: "Address" },
      ]}
      allowDelete
    />
  );
}
