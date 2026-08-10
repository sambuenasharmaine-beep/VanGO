import { LiveModule } from "../../components/live-console";

export default function Page() {
  return (
    <LiveModule
      consoleType="admin"
      eyebrow="GROWTH / CAMPAIGNS"
      title="Promotions"
      copy="Real promotion rules and validity windows enforced during server-side quoting."
      table="promotions"
      orderBy="created_at"
      watch={["promotion_redemptions"]}
      allowEdit
      columns={[
        { key: "code", label: "Code", format: "mono" },
        { key: "title", label: "Campaign" },
        { key: "discount_type", label: "Type" },
        { key: "discount_value", label: "Value", format: "mono" },
        { key: "starts_at", label: "Starts", format: "date" },
        { key: "ends_at", label: "Ends", format: "date" },
        { key: "status", label: "Status", format: "status" },
      ]}
      createLabel="Create promotion"
      createFields={[
        { key: "organization_id", label: "Organization", required: true, reference: { table: "organizations", labelColumns: ["name"] } },
        { key: "branch_id", label: "Branch", reference: { table: "branches", labelColumns: ["name", "code"], filterBy: "organization_id" } },
        { key: "code", label: "Promo code", required: true, placeholder: "SUMMER25" },
        { key: "title", label: "Campaign title", required: true },
        {
          key: "discount_type",
          label: "Discount type",
          required: true,
          options: [
            { value: "fixed", label: "Fixed peso amount" },
            { value: "percent", label: "Percent of subtotal" },
          ],
        },
        { key: "discount_value", label: "Discount value", type: "number", required: true },
        { key: "minimum_subtotal", label: "Minimum subtotal", type: "number" },
        { key: "per_user_limit", label: "Redemptions per passenger", type: "number" },
        { key: "starts_at", label: "Starts", type: "datetime-local", required: true },
        { key: "ends_at", label: "Ends", type: "datetime-local", required: true },
        {
          key: "status",
          label: "Status",
          required: true,
          options: [
            { value: "draft", label: "Draft" },
            { value: "live", label: "Live" },
            { value: "paused", label: "Paused" },
            { value: "ended", label: "Ended" },
          ],
        },
      ]}
      allowDelete
    />
  );
}
