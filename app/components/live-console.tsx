"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import { useLiveTables } from "../../lib/realtime";
import { useAuth } from "../providers";
import { ConsoleShell } from "./shells";
import { LiveDot, Metric, Mono, PageTitle, Status } from "./ui";

type Primitive = string | number | boolean | null;
type Row = Record<string, unknown>;
type Option = { value: string; label: string; filterValue?: string };

export type LiveColumn = { key: string; label: string; format?: "money" | "date" | "datetime" | "status" | "mono" };
export type CreateField = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "time" | "datetime-local" | "select" | "textarea" | "weekdays" | "json";
  required?: boolean;
  placeholder?: string;
  /** Fixed choices, for columns constrained by a database check constraint. */
  options?: { value: string; label: string }[];
  /**
   * Loads the choices from a related table instead of asking an operator to
   * paste a UUID. Row Level Security already limits the rows returned, so the
   * dropdown only ever offers records inside the operator's own scope.
   */
  reference?: {
    table: string;
    /** Column names, or dotted paths into an embedded relation such as `origin.city`. */
    labelColumns: string[];
    filterBy?: string;
    /** Raw PostgREST select when the label needs related rows embedded. */
    select?: string;
  };
};
/** Optimistic-concurrency status transitions exposed as row buttons. */
export type StatusFlow = { rpc: string; versionKey: string; transitions: Record<string, string[]> };

type LiveModuleProps = {
  consoleType: "admin" | "superadmin";
  eyebrow: string;
  title: string;
  copy: string;
  table: string;
  columns: LiveColumn[];
  orderBy?: string;
  ascending?: boolean;
  createLabel?: string;
  createFields?: CreateField[];
  allowEdit?: boolean;
  allowDelete?: boolean;
  statusFlow?: StatusFlow;
  /** Extra tables whose changes should also refresh this view. */
  watch?: string[];
};

function scalar(value: unknown): Primitive {
  if (value === null || value === undefined) return null;
  if (["string", "number", "boolean"].includes(typeof value)) return value as Primitive;
  return JSON.stringify(value);
}

function tone(value: string) {
  const normalized = value.toLowerCase();
  if (["active", "approved", "paid", "confirmed", "connected", "completed", "succeeded", "resolved", "published", "ready"].some((item) => normalized.includes(item))) return "success" as const;
  if (["failed", "rejected", "suspended", "cancelled", "expired", "critical", "overdue"].some((item) => normalized.includes(item))) return "danger" as const;
  if (["review", "pending", "processing", "warning", "degraded", "draft", "held"].some((item) => normalized.includes(item))) return "warning" as const;
  return "info" as const;
}

function displayValue(value: unknown, format?: LiveColumn["format"]) {
  const normalized = scalar(value);
  if (normalized === null || normalized === "") return "—";
  if (format === "money") return `₱${Number(normalized).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (format === "date" || format === "datetime") {
    const date = new Date(String(normalized));
    if (!Number.isNaN(date.valueOf())) return date.toLocaleString("en-PH", format === "date" ? { dateStyle: "medium" } : { dateStyle: "medium", timeStyle: "short" });
  }
  if (typeof normalized === "boolean") return normalized ? "Yes" : "No";
  return String(normalized).replaceAll("_", " ");
}

function errorText(reason: unknown) {
  return reason instanceof Error ? reason.message : "The database rejected the request.";
}

/** Reads `origin.city` style paths, tolerating PostgREST one-to-one embeds returned as arrays. */
function pickPath(row: Row, path: string): string {
  const found = path.split(".").reduce<unknown>((value, part) => {
    const step = Array.isArray(value) ? value[0] : value;
    return step && typeof step === "object" ? (step as Row)[part] : undefined;
  }, row);
  const flattened = Array.isArray(found) ? found[0] : found;
  return flattened === null || flattened === undefined ? "" : String(flattened);
}

export function LiveModule(props: LiveModuleProps) {
  const { memberships } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<Record<string, Option[]>>({});
  const [busyRow, setBusyRow] = useState("");
  const [editingId, setEditingId] = useState("");

  const load = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setError("");
    let request = client.from(props.table).select("*").limit(100);
    if (props.orderBy) request = request.order(props.orderBy, { ascending: props.ascending ?? false });
    const { data, error: queryError } = await request;
    if (queryError) setError(queryError.message);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }, [props.ascending, props.orderBy, props.table]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  // Any write by a passenger, another operator, or a database RPC refreshes
  // this table for everyone watching it.
  const watched = useMemo(() => [props.table, ...(props.watch ?? [])], [props.table, props.watch]);
  const liveStatus = useLiveTables(watched, load);

  const createFields = props.createFields;
  const referenceKey = useMemo(
    () => JSON.stringify((createFields ?? []).map((field) => [field.key, field.reference])),
    [createFields],
  );
  const defaultOrganization = memberships.find((membership) => membership.organization_id)?.organization_id ?? "";
  const defaultBranch = memberships.find((membership) => membership.branch_id)?.branch_id ?? "";

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    const fields = (JSON.parse(referenceKey) as [string, CreateField["reference"]][]).filter(([, reference]) => reference);
    if (!client || !fields.length) return;
    let active = true;
    void (async () => {
      const loaded: Record<string, Option[]> = {};
      for (const [key, reference] of fields) {
        if (!reference) continue;
        const columns = ["id", ...reference.labelColumns, ...(reference.filterBy ? [reference.filterBy] : [])];
        const selection = reference.select ?? [...new Set(columns)].join(",");
        const primary = await client.from(reference.table).select(selection).limit(200);
        // An embedded label (a related table) can be rejected; the picker is
        // still more useful listing plain identifiers than not rendering.
        const fallback = primary.error ? await client.from(reference.table).select("*").limit(200) : null;
        const data = primary.error ? fallback?.data : primary.data;
        loaded[key] = ((data ?? []) as unknown as Row[])
          .map((row) => ({
            value: String(row.id ?? ""),
            label: reference.labelColumns.map((column) => pickPath(row, column)).filter(Boolean).join(" · ") || String(row.id ?? ""),
            filterValue: reference.filterBy ? String(row[reference.filterBy] ?? "") : undefined,
          }))
          .sort((first, second) => first.label.localeCompare(second.label));
      }
      if (active) setOptions(loaded);
    })();
    return () => { active = false; };
  }, [referenceKey]);

  // Scope fields are answered by the operator's own membership, never typed.
  function valueOf(key: string) {
    const entered = values[key];
    if (entered !== undefined) return entered;
    if (key === "organization_id") return defaultOrganization;
    if (key === "branch_id") return defaultBranch;
    return "";
  }

  function optionsFor(field: CreateField): Option[] {
    if (field.options) return field.options.map((option) => ({ value: option.value, label: option.label }));
    const available = options[field.key] ?? [];
    const filterBy = field.reference?.filterBy;
    if (!filterBy) return available;
    const filterValue = valueOf(filterBy);
    if (!filterValue) return available;
    return available.filter((option) => !option.filterValue || option.filterValue === filterValue);
  }

  function changeField(key: string, value: string) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (props.table === "memberships" && key === "role" && value === "superadmin") {
        delete next.organization_id;
        delete next.branch_id;
      }
      for (const field of createFields ?? []) {
        if (field.reference?.filterBy === key) delete next[field.key];
      }
      return next;
    });
  }

  const filtered = useMemo(() => rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase())), [query, rows]);
  const statusCount = rows.filter((row) => ["active", "confirmed", "paid", "connected", "approved", "published"].includes(String(row.status ?? row.booking_status ?? row.payment_status ?? "").toLowerCase())).length;
  const newest = rows.reduce<string | null>((latest, row) => {
    const value = String(row.created_at ?? row.updated_at ?? "");
    return value && (!latest || value > latest) ? value : latest;
  }, null);

  function closeForm() {
    setShowCreate(false);
    setEditingId("");
    setValues({});
  }

  function beginEdit(row: Row) {
    const nextValues: Record<string, string> = {};
    for (const field of createFields ?? []) {
      const raw = row[field.key];
      if (raw === null || raw === undefined) continue;
      if (field.type === "datetime-local") {
        const date = new Date(String(raw));
        nextValues[field.key] = Number.isNaN(date.valueOf()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
      } else nextValues[field.key] = field.type === "json" ? JSON.stringify(raw, null, 2) : String(raw);
    }
    setValues(nextValues);
    setEditingId(String(row.id ?? ""));
    setShowCreate(true);
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client || !createFields) return;
    setSaving(true);
    setError("");
    const payload: Record<string, unknown> = {};
    try {
      for (const field of createFields) {
        const value = valueOf(field.key).trim();
        if (value) {
          payload[field.key] = field.type === "number"
            ? Number(value)
            : field.type === "datetime-local"
              ? new Date(value).toISOString()
              : field.type === "weekdays"
                ? value.split(",").map((day) => Number(day.trim())).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
                : field.type === "json"
                  ? JSON.parse(value)
                  : value;
        }
      }
    } catch {
      setError("JSON fields must contain valid JSON.");
      setSaving(false);
      return;
    }
    if (props.table === "memberships") {
      if (payload.role === "superadmin") {
        delete payload.organization_id;
        delete payload.branch_id;
      } else if (!payload.organization_id) {
        setError("Choose an organization for this staff role.");
        setSaving(false);
        return;
      }
    }
    const request = editingId
      ? client.from(props.table).update(payload).eq("id", editingId)
      : client.from(props.table).insert(payload);
    const { error: writeError } = await request;
    if (writeError) setError(writeError.message);
    else {
      setNotice(editingId ? "Record updated successfully." : `${props.createLabel ?? "Record"} saved successfully.`);
      closeForm();
      await load();
    }
    setSaving(false);
  }

  async function deleteRecord(row: Row) {
    const client = getSupabaseBrowserClient();
    const id = scalar(row.id);
    if (!client || !id || !window.confirm("Delete this record? This action is controlled by Supabase permissions.")) return;
    const { error: deleteError } = await client.from(props.table).delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else {
      setNotice("Record deleted.");
      await load();
    }
  }

  async function advanceStatus(row: Row, nextStatus: string) {
    const client = getSupabaseBrowserClient();
    const flow = props.statusFlow;
    const id = String(row.id ?? "");
    if (!client || !flow || !id) return;
    setBusyRow(id);
    setError("");
    const { error: rpcError } = await client.rpc(flow.rpc, {
      target_trip_id: id,
      next_status: nextStatus,
      expected_version: Number(row[flow.versionKey] ?? 0),
      change_reason: `Set to ${nextStatus} from the ${props.consoleType} console`,
    });
    if (rpcError) setError(rpcError.message);
    else setNotice(`Trip moved to ${nextStatus}.`);
    setBusyRow("");
    await load();
  }

  const hasRowTools = props.allowDelete || props.allowEdit;
  const gridTemplate = `repeat(${props.columns.length}, minmax(90px, 1fr))${props.statusFlow ? " minmax(150px, auto)" : ""}${hasRowTools ? " minmax(88px, auto)" : ""}`;

  return (
    <ConsoleShell consoleType={props.consoleType}>
      <PageTitle eyebrow={props.eyebrow} title={props.title} copy={props.copy} action={createFields ? <button className="button button-primary" type="button" onClick={() => showCreate ? closeForm() : setShowCreate(true)}>{showCreate ? "Close form" : props.createLabel ?? "Add record"}</button> : undefined} />
      <div className="metric-grid four live-metrics"><Metric label="Records in scope" value={loading ? "…" : String(rows.length)} note="Limited to your Supabase access" /><Metric label="Active/current" value={loading ? "…" : String(statusCount)} note="Based on current record states" /><Metric label="Visible results" value={loading ? "…" : String(filtered.length)} note={query ? "After local filtering" : "No filter applied"} /><Metric label="Latest update" value={newest ? new Date(newest).toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : "—"} note="Database timestamp" /></div>
      {showCreate && createFields ? (
        <form className="panel live-create-form" onSubmit={saveRecord}>
          <div className="panel-head"><div><span>{editingId ? "EDIT DATABASE RECORD" : "NEW DATABASE RECORD"}</span><h2>{editingId ? `Edit ${props.title}` : props.createLabel}</h2></div></div>
          <div className="form-grid">
            {createFields.map((field) => {
              if (props.table === "memberships" && valueOf("role") === "superadmin" && ["organization_id", "branch_id"].includes(field.key)) return null;
              const choices = field.options || field.reference ? optionsFor(field) : null;
              const required = field.required || (props.table === "memberships" && field.key === "organization_id" && valueOf("role") !== "superadmin");
              return (
                <label className="field" key={field.key}>
                  <span>{field.label}</span>
                  {choices ? (
                    <select
                      name={field.key}
                      required={required}
                      value={valueOf(field.key)}
                      onChange={(event) => changeField(field.key, event.target.value)}
                    >
                      <option value="">{choices.length ? `Select ${field.label.toLowerCase()}` : "No records available yet"}</option>
                      {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                    </select>
                  ) : field.type === "textarea" || field.type === "json" ? (
                    <textarea
                      name={field.key}
                      required={required}
                      placeholder={field.placeholder}
                      value={valueOf(field.key)}
                      onChange={(event) => changeField(field.key, event.target.value)}
                    />
                  ) : (
                    <input
                      name={field.key}
                      type={field.type === "weekdays" ? "text" : field.type ?? "text"}
                      required={required}
                      placeholder={field.placeholder}
                      value={valueOf(field.key)}
                      onChange={(event) => changeField(field.key, event.target.value)}
                    />
                  )}
                </label>
              );
            })}
          </div>
          <div className="live-form-actions"><button className="button button-outline" type="button" onClick={closeForm}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Save record"}</button></div>
        </form>
      ) : null}
      <div className="record-toolbar table-spacer"><label className="console-search">⌕<input aria-label={`Search ${props.title}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${props.title.toLowerCase()}…`} /></label><LiveDot status={liveStatus} /><button className="button button-outline" type="button" onClick={() => void load()} disabled={loading}>Refresh</button></div>
      {notice ? <div className="form-message success" role="status">{notice}</div> : null}
      {error ? <div className="live-error" role="alert"><strong>Database request failed</strong><p>{error}</p><button type="button" onClick={() => void load()}>Try again</button></div> : null}
      {!error ? (
        <div className="data-card">
          <div className="data-table live-table">
            <div className="data-row data-head" style={{ gridTemplateColumns: gridTemplate }}>
              {props.columns.map((column) => <span key={column.key}>{column.label}</span>)}
              {props.statusFlow ? <span>Actions</span> : null}
              {hasRowTools ? <span>Manage</span> : null}
            </div>
            {filtered.map((row, index) => {
              const rowId = String(row.id ?? index);
              const nextStates = props.statusFlow?.transitions[String(row.status ?? "")] ?? [];
              return (
                <div className="data-row" style={{ gridTemplateColumns: gridTemplate }} key={rowId}>
                  {props.columns.map((column) => {
                    const shown = displayValue(row[column.key], column.format);
                    return <span data-label={column.label} key={column.key}>{column.format === "status" ? <Status tone={tone(shown)}>{shown}</Status> : column.format === "mono" || column.format === "money" ? <Mono>{shown}</Mono> : shown}</span>;
                  })}
                  {props.statusFlow ? (
                    <span data-label="Actions" className="row-actions">
                      {nextStates.length ? nextStates.map((next) => (
                        <button className="status-action" type="button" key={next} disabled={busyRow === rowId} onClick={() => void advanceStatus(row, next)}>{next}</button>
                      )) : <small>—</small>}
                    </span>
                  ) : null}
                  {hasRowTools ? <span data-label="Manage" className="row-tools">{props.allowEdit ? <button className="row-action" type="button" aria-label="Edit record" onClick={() => beginEdit(row)}>Edit</button> : null}{props.allowDelete ? <button className="row-action danger" type="button" aria-label="Delete record" onClick={() => void deleteRecord(row)}>×</button> : null}</span> : null}
                </div>
              );
            })}
          </div>
          {!loading && !filtered.length ? <div className="real-empty"><h3>No records yet</h3><p>This is a real empty state. Add data in VanGO or Supabase; no demo rows are inserted.</p></div> : null}
          {loading ? <div className="real-empty"><h3>Loading live data…</h3><p>Checking the records allowed by your account and Row Level Security.</p></div> : null}
        </div>
      ) : null}
    </ConsoleShell>
  );
}

export function LiveDashboard({ consoleType }: { consoleType: "admin" | "superadmin" }) {
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [error, setError] = useState("");
  const resources = useMemo(
    () => (consoleType === "admin" ? ["bookings", "trips", "vehicles", "support_cases"] : ["organizations", "branches", "bookings", "incidents"]),
    [consoleType],
  );

  const load = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    try {
      const entries = await Promise.all(resources.map(async (resource) => {
        const { count, error: queryError } = await client.from(resource).select("id", { count: "exact", head: true });
        if (queryError) throw queryError;
        return [resource, count ?? 0] as const;
      }));
      setCounts(Object.fromEntries(entries));
      setError("");
    } catch (reason) {
      setError(errorText(reason));
    }
  }, [resources]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const liveStatus = useLiveTables(resources, load);

  const labels = consoleType === "admin" ? ["Scoped bookings", "Upcoming trips", "Fleet records", "Open support"] : ["Organizations", "Branches", "Platform bookings", "Incidents"];
  return (
    <ConsoleShell consoleType={consoleType}>
      <PageTitle
        eyebrow={consoleType === "admin" ? "OPERATIONS / LIVE DATABASE" : "PLATFORM / LIVE DATABASE"}
        title={consoleType === "admin" ? "Operations overview" : "Platform overview"}
        copy="Every number below is queried from Supabase and limited by your authenticated access."
        action={<LiveDot status={liveStatus} />}
      />
      <div className="metric-grid four">{resources.map((resource, index) => <Metric key={resource} label={labels[index]} value={counts[resource] === undefined ? "…" : String(counts[resource])} note="Live count from Supabase" />)}</div>
      {error ? <div className="live-error"><strong>Dashboard unavailable</strong><p>{error}</p></div> : null}
      <section className="panel live-dashboard-note"><span>REAL DATA MODE</span><h2>No sample operations are displayed</h2><p>Populate terminals, routes, schedules, vehicles, trips, and bookings after running the SQL bootstrap. Totals update the moment another console or a passenger writes to the database.</p></section>
    </ConsoleShell>
  );
}
