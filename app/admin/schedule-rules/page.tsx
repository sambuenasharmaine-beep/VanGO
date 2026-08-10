import { LiveModule } from "../../components/live-console";

export default function Page() {
  return <LiveModule
    consoleType="admin"
    eyebrow="OPERATIONS / SCHEDULES"
    title="Schedule rules"
    copy="Publish recurring departures by route, branch, weekday, capacity, and effective dates. Weekdays use 0 for Sunday through 6 for Saturday."
    table="schedule_rules"
    orderBy="effective_from"
    allowEdit
    allowDelete
    columns={[
      { key: "route_id", label: "Route", format: "mono" },
      { key: "weekdays", label: "Weekdays" },
      { key: "departure_time", label: "Departure" },
      { key: "effective_from", label: "Starts", format: "date" },
      { key: "fare", label: "Fare", format: "money" },
      { key: "capacity", label: "Seats", format: "mono" },
      { key: "status", label: "Status", format: "status" },
    ]}
    createLabel="Add schedule rule"
    createFields={[
      { key: "organization_id", label: "Organization", required: true, reference: { table: "organizations", labelColumns: ["name"] } },
      { key: "branch_id", label: "Branch", required: true, reference: { table: "branches", labelColumns: ["name", "code"], filterBy: "organization_id" } },
      { key: "route_id", label: "Route", required: true, reference: { table: "routes", labelColumns: ["origin.city", "destination.city"], filterBy: "organization_id", select: "id,organization_id,origin:terminals!routes_origin_terminal_id_fkey(city),destination:terminals!routes_destination_terminal_id_fkey(city)" } },
      { key: "weekdays", label: "Weekdays", type: "weekdays", required: true, placeholder: "1,2,3,4,5" },
      { key: "departure_time", label: "Departure time", type: "time", required: true },
      { key: "effective_from", label: "Effective from", type: "date", required: true },
      { key: "effective_until", label: "Effective until", type: "date" },
      { key: "fare", label: "Fare", type: "number", required: true },
      { key: "capacity", label: "Capacity", type: "number", required: true },
      { key: "status", label: "Status", options: [{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }, { value: "paused", label: "Paused" }, { value: "archived", label: "Archived" }] },
    ]}
  />;
}
