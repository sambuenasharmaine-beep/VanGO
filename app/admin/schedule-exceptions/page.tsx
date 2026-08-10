import { LiveModule } from "../../components/live-console";

export default function Page() {
  return <LiveModule
    consoleType="admin"
    eyebrow="OPERATIONS / SCHEDULES"
    title="Schedule exceptions"
    copy="Cancel, override, or add a departure for a specific service date without changing its recurring rule."
    table="schedule_exceptions"
    orderBy="service_date"
    allowEdit
    allowDelete
    columns={[
      { key: "schedule_rule_id", label: "Rule", format: "mono" },
      { key: "service_date", label: "Service date", format: "date" },
      { key: "action", label: "Action", format: "status" },
      { key: "departure_time", label: "Departure" },
      { key: "fare", label: "Fare", format: "money" },
      { key: "capacity", label: "Seats", format: "mono" },
      { key: "reason", label: "Reason" },
    ]}
    createLabel="Add schedule exception"
    createFields={[
      { key: "schedule_rule_id", label: "Schedule rule", required: true, reference: { table: "schedule_rules", labelColumns: ["departure_time", "effective_from"] } },
      { key: "service_date", label: "Service date", type: "date", required: true },
      { key: "action", label: "Action", required: true, options: [{ value: "cancel", label: "Cancel" }, { value: "override", label: "Override" }, { value: "extra", label: "Extra departure" }] },
      { key: "departure_time", label: "Departure time", type: "time" },
      { key: "fare", label: "Fare", type: "number" },
      { key: "capacity", label: "Capacity", type: "number" },
      { key: "reason", label: "Reason", type: "textarea", required: true },
    ]}
  />;
}
