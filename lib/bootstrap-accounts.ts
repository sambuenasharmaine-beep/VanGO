import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type BootstrapConfig = {
  url: string;
  serviceRoleKey: string;
  superadminEmail: string;
  superadminPassword: string;
  adminEmail: string;
  adminPassword: string;
};

type BootstrapResult = { status: "disabled" | "complete" | "failed"; message?: string };

let provisioning: Promise<BootstrapResult> | undefined;

function readConfig(): BootstrapConfig | null {
  const values = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "",
    superadminEmail: process.env.VANGO_SUPERADMIN_EMAIL?.trim().toLowerCase() ?? "",
    superadminPassword: process.env.VANGO_SUPERADMIN_PASSWORD ?? "",
    adminEmail: process.env.VANGO_ADMIN_EMAIL?.trim().toLowerCase() ?? "",
    adminPassword: process.env.VANGO_ADMIN_PASSWORD ?? "",
  };
  return Object.values(values).every(Boolean) ? values : null;
}

function validateConfig(config: BootstrapConfig) {
  if (config.superadminEmail === config.adminEmail) throw new Error("Superadmin and Admin must use different email addresses.");
  if (config.superadminPassword.length < 12 || config.adminPassword.length < 12) throw new Error("Bootstrap passwords must contain at least 12 characters.");
}

async function findUserByEmail(client: SupabaseClient, email: string): Promise<User | null> {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
  throw new Error("Unable to locate the bootstrap account in the Auth user directory.");
}

async function ensureAuthUser(client: SupabaseClient, email: string, password: string, fullName: string) {
  const existing = await findUserByEmail(client, email);
  if (existing) {
    const { error: updateError } = await client.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (updateError) throw updateError;
    return existing;
  }
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw error ?? new Error(`Unable to create ${fullName}.`);
  return data.user;
}

async function provision() : Promise<BootstrapResult> {
  const config = readConfig();
  if (!config) return { status: "disabled" };
  try {
    validateConfig(config);
    const client = createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const state = await client
      .from("system_bootstrap_state")
      .select("superadmin_user_id,admin_user_id,completed_at")
      .eq("key", "privileged_accounts_v1")
      .maybeSingle();
    if (state.error) throw state.error;
    if (state.data?.completed_at && state.data.superadmin_user_id && state.data.admin_user_id) return { status: "complete" };

    const organization = await client.from("organizations").select("id").eq("slug", "vango-transport").single();
    if (organization.error) throw organization.error;
    const branch = await client.from("branches").select("id").eq("organization_id", organization.data.id).eq("code", "MAIN").single();
    if (branch.error) throw branch.error;

    const [superadmin, admin] = await Promise.all([
      ensureAuthUser(client, config.superadminEmail, config.superadminPassword, "VanGO Superadmin"),
      ensureAuthUser(client, config.adminEmail, config.adminPassword, "VanGO Administrator"),
    ]);
    const profiles = await client.from("profiles").upsert([
      { id: superadmin.id, email: config.superadminEmail, full_name: "VanGO Superadmin", account_status: "active" },
      { id: admin.id, email: config.adminEmail, full_name: "VanGO Administrator", account_status: "active" },
    ], { onConflict: "id" });
    if (profiles.error) throw profiles.error;

    const memberships = await client.from("memberships").upsert([
      { user_id: superadmin.id, organization_id: null, branch_id: null, role: "superadmin", status: "active" },
      { user_id: admin.id, organization_id: organization.data.id, branch_id: branch.data.id, role: "branch_admin", status: "active" },
    ], { onConflict: "user_id,organization_id,branch_id,role" });
    if (memberships.error) throw memberships.error;

    const marker = await client.from("system_bootstrap_state").upsert({
      key: "privileged_accounts_v1",
      superadmin_user_id: superadmin.id,
      admin_user_id: admin.id,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });
    if (marker.error) throw marker.error;
    return { status: "complete" };
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Unknown bootstrap failure";
    console.error("VanGO privileged-account provisioning failed:", message);
    return { status: "failed", message };
  }
}

/** Runs once per server instance and becomes a no-op after the SQL marker is complete. */
export function ensureBootstrapAccounts() {
  provisioning ??= provision();
  return provisioning;
}
