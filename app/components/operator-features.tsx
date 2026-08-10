"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import { useLiveTables } from "../../lib/realtime";
import { useAuth } from "../providers";
import { ConsoleShell, PassengerShell } from "./shells";
import { LiveDot, Mono, PageTitle, Status } from "./ui";

type AssignmentOption = { id: string; label: string; status?: string; capacity?: number };
type Assignment = { id: string; trip_id: string; vehicle_id: string; driver_id: string; version: number; updated_at: string };
type BookingOption = { id: string; reference: string; payment_status: string; total: number | string };
type Refund = { id: string; booking_id: string; amount: number | string; reason: string; status: string; created_at: string };
type SupportCase = { id: string; case_number: string; booking_id: string | null; subject: string; category: string; priority: string; status: string; created_at: string };
type SupportMessage = { id: string; case_id: string; author_id: string; visibility: string; body: string; created_at: string };
type ComplianceDocument = { id: string; organization_id: string; entity_type: string; entity_id: string; requirement_id: string; storage_path: string; issued_at: string | null; expires_at: string | null; review_status: string; review_notes: string | null; created_at: string };
type NamedOption = { id: string; name: string; organization_id?: string; entity_type?: string; document_type?: string };

function tone(value: string) {
  if (["active", "approved", "succeeded", "resolved", "closed"].includes(value)) return "success" as const;
  if (["failed", "rejected", "suspended", "expired", "urgent"].includes(value)) return "danger" as const;
  if (["requested", "pending", "processing", "high", "waiting_customer", "waiting_internal"].includes(value)) return "warning" as const;
  return "info" as const;
}

export function AssignmentsConsole() {
  const [trips, setTrips] = useState<AssignmentOption[]>([]);
  const [vehicles, setVehicles] = useState<AssignmentOption[]>([]);
  const [drivers, setDrivers] = useState<AssignmentOption[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tripId, setTripId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const [tripResult, vehicleResult, driverResult, assignmentResult] = await Promise.all([
      client.from("trips").select("id,route_id,departure_at,status,capacity").in("status", ["scheduled", "ready", "boarding"]).order("departure_at"),
      client.from("vehicles").select("id,plate_number,model,status,capacity").eq("status", "active").order("plate_number"),
      client.from("drivers").select("id,full_name,license_number,status").eq("status", "active").order("full_name"),
      client.from("trip_assignments").select("id,trip_id,vehicle_id,driver_id,version,updated_at").order("updated_at", { ascending: false }),
    ]);
    const failed = [tripResult, vehicleResult, driverResult, assignmentResult].find((result) => result.error)?.error;
    if (failed) { setError(failed.message); return; }
    setTrips((tripResult.data ?? []).map((row) => ({ id: row.id, label: `${new Date(row.departure_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })} · ${row.status}`, status: row.status, capacity: row.capacity })));
    setVehicles((vehicleResult.data ?? []).map((row) => ({ id: row.id, label: `${row.plate_number} · ${row.model || "Vehicle"} · ${row.capacity} seats`, status: row.status, capacity: row.capacity })));
    setDrivers((driverResult.data ?? []).map((row) => ({ id: row.id, label: `${row.full_name} · ${row.license_number}`, status: row.status })));
    setAssignments((assignmentResult.data ?? []) as Assignment[]);
    setError("");
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const liveStatus = useLiveTables(["trips", "trip_assignments", "vehicles", "drivers"], load);
  const tripLabels = useMemo(() => Object.fromEntries(trips.map((item) => [item.id, item.label])), [trips]);
  const vehicleLabels = useMemo(() => Object.fromEntries(vehicles.map((item) => [item.id, item.label])), [vehicles]);
  const driverLabels = useMemo(() => Object.fromEntries(drivers.map((item) => [item.id, item.label])), [drivers]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setBusy(true); setError(""); setNotice("");
    const current = assignments.find((item) => item.trip_id === tripId);
    const { error: rpcError } = await client.rpc("assign_trip_resources", {
      target_trip_id: tripId,
      target_vehicle_id: vehicleId,
      target_driver_id: driverId,
      expected_version: current?.version ?? null,
    });
    if (rpcError) setError(rpcError.message);
    else { setNotice(current ? "Trip assignment updated." : "Trip resources assigned."); await load(); }
    setBusy(false);
  }

  return <ConsoleShell consoleType="admin">
    <PageTitle eyebrow="OPERATIONS / DISPATCH" title="Trip assignments" copy="Assign an active driver and capacity-safe vehicle through a permission-checked database operation." />
    <form className="panel feature-form" onSubmit={save}>
      <div className="form-grid">
        <label className="field full"><span>Trip</span><select required value={tripId} onChange={(event) => setTripId(event.target.value)}><option value="">Select trip</option>{trips.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
        <label className="field"><span>Vehicle</span><select required value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}><option value="">Select active vehicle</option>{vehicles.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
        <label className="field"><span>Driver</span><select required value={driverId} onChange={(event) => setDriverId(event.target.value)}><option value="">Select active driver</option>{drivers.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
      </div>
      <div className="live-form-actions"><LiveDot status={liveStatus} /><button className="button button-primary" disabled={busy} type="submit">{busy ? "Assigning…" : "Save assignment"}</button></div>
    </form>
    {notice ? <div className="form-message success">{notice}</div> : null}{error ? <div className="form-message error">{error}</div> : null}
    <div className="data-card table-spacer"><div className="data-table live-table"><div className="data-row data-head feature-table"><span>Trip</span><span>Vehicle</span><span>Driver</span><span>Version</span><span>Updated</span></div>{assignments.map((item) => <div className="data-row feature-table" key={item.id}><span data-label="Trip">{tripLabels[item.trip_id] || item.trip_id}</span><span data-label="Vehicle">{vehicleLabels[item.vehicle_id] || item.vehicle_id}</span><span data-label="Driver">{driverLabels[item.driver_id] || item.driver_id}</span><span data-label="Version"><Mono>{item.version}</Mono></span><span data-label="Updated">{new Date(item.updated_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</span></div>)}</div>{!assignments.length && !error ? <div className="real-empty"><h3>No assignments yet</h3><p>Select an upcoming trip, vehicle, and driver above.</p></div> : null}</div>
  </ConsoleShell>;
}

export function RefundConsole({ consoleType }: { consoleType: "admin" | "superadmin" }) {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [bookings, setBookings] = useState<BookingOption[]>([]);
  const [bookingId, setBookingId] = useState("");
  const [reason, setReason] = useState("");
  const [reviewReason, setReviewReason] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const client = getSupabaseBrowserClient(); if (!client) return;
    const [refundResult, bookingResult] = await Promise.all([
      client.from("refunds").select("id,booking_id,amount,reason,status,created_at").order("created_at", { ascending: false }),
      client.from("bookings").select("id,reference,payment_status,total").in("payment_status", ["paid", "partially_refunded"]).order("created_at", { ascending: false }),
    ]);
    if (refundResult.error || bookingResult.error) { setError(refundResult.error?.message ?? bookingResult.error?.message ?? "Unable to load refunds."); return; }
    setRefunds((refundResult.data ?? []) as Refund[]); setBookings((bookingResult.data ?? []) as BookingOption[]); setError("");
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const liveStatus = useLiveTables(["refunds", "bookings", "payment_intents"], load);
  const bookingLabels = useMemo(() => Object.fromEntries(bookings.map((item) => [item.id, item.reference])), [bookings]);

  async function requestRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const client = getSupabaseBrowserClient(); if (!client) return;
    setBusy("request"); setError(""); setNotice("");
    const { error: rpcError } = await client.rpc("request_refund", { target_booking_id: bookingId, requested_reason: reason.trim() });
    if (rpcError) setError(rpcError.message); else { setNotice("Mock refund request created."); setReason(""); setBookingId(""); await load(); }
    setBusy("");
  }

  async function transition(refund: Refund, nextStatus: string) {
    const client = getSupabaseBrowserClient(); if (!client) return;
    setBusy(refund.id); setError(""); setNotice("");
    const { error: rpcError } = await client.rpc("transition_refund_status", { target_refund_id: refund.id, next_status: nextStatus, review_reason: reviewReason[refund.id]?.trim() || null });
    if (rpcError) setError(rpcError.message); else { setNotice(`Mock refund moved to ${nextStatus}. No real money was transferred.`); await load(); }
    setBusy("");
  }

  function nextStates(status: string) {
    if (status === "requested") return ["approved", "rejected"];
    if (status === "approved") return ["processing", "rejected"];
    if (status === "processing") return ["succeeded", "failed"];
    return [];
  }

  return <ConsoleShell consoleType={consoleType}>
    <PageTitle eyebrow="FINANCE / MOCK REFUNDS" title="Refund operations" copy="Request and review simulated refunds. These controls never contact a bank, card, wallet, or real payment provider." />
    <section className="mock-payment-note"><strong>Mock-only financial workflow</strong><p>Approval and completion change Supabase records only. No real currency is transferred.</p></section>
    <form className="panel feature-form table-spacer" onSubmit={requestRefund}><div className="form-grid"><label className="field"><span>Paid booking</span><select required value={bookingId} onChange={(event) => setBookingId(event.target.value)}><option value="">Select booking</option>{bookings.map((item) => <option value={item.id} key={item.id}>{item.reference} · ₱{Number(item.total).toLocaleString("en-PH")}</option>)}</select></label><label className="field"><span>Reason</span><input required minLength={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is a refund needed?" /></label></div><div className="live-form-actions"><LiveDot status={liveStatus} /><button className="button button-primary" disabled={busy === "request"} type="submit">Request mock refund</button></div></form>
    {notice ? <div className="form-message success">{notice}</div> : null}{error ? <div className="form-message error">{error}</div> : null}
    <div className="refund-grid">{refunds.map((refund) => <article className="panel refund-card" key={refund.id}><div className="panel-head"><div><span>{bookingLabels[refund.booking_id] || refund.booking_id}</span><h2>₱{Number(refund.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</h2></div><Status tone={tone(refund.status)}>{refund.status}</Status></div><p>{refund.reason}</p><small>{new Date(refund.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</small>{nextStates(refund.status).length ? <><label className="field"><span>Review note (required for rejection/failure)</span><input value={reviewReason[refund.id] ?? ""} onChange={(event) => setReviewReason((current) => ({ ...current, [refund.id]: event.target.value }))} /></label><div className="case-actions">{nextStates(refund.status).map((next) => <button className={`button ${next === "rejected" || next === "failed" ? "button-outline danger" : "button-primary"}`} disabled={busy === refund.id} type="button" onClick={() => void transition(refund, next)} key={next}>{next}</button>)}</div></> : null}</article>)}</div>{!refunds.length && !error ? <div className="real-empty"><h3>No refund requests</h3><p>Refund requests from passengers and authorized staff appear here.</p></div> : null}
  </ConsoleShell>;
}

export function SupportWorkspace({ consoleType }: { consoleType?: "admin" | "superadmin" }) {
  const { user } = useAuth();
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [bookings, setBookings] = useState<BookingOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [reply, setReply] = useState("");
  const [visibility, setVisibility] = useState("customer");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const client = getSupabaseBrowserClient(); if (!client) return;
    const [caseResult, messageResult, bookingResult] = await Promise.all([
      client.from("support_cases").select("id,case_number,booking_id,subject,category,priority,status,created_at").order("created_at", { ascending: false }),
      client.from("support_messages").select("id,case_id,author_id,visibility,body,created_at").order("created_at"),
      client.from("bookings").select("id,reference,payment_status,total").order("created_at", { ascending: false }),
    ]);
    const failed = caseResult.error ?? messageResult.error ?? bookingResult.error;
    if (failed) { setError(failed.message); return; }
    const nextCases = (caseResult.data ?? []) as SupportCase[];
    setCases(nextCases); setMessages((messageResult.data ?? []) as SupportMessage[]); setBookings((bookingResult.data ?? []) as BookingOption[]);
    setSelectedId((current) => current && nextCases.some((item) => item.id === current) ? current : nextCases[0]?.id ?? ""); setError("");
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const liveStatus = useLiveTables(["support_cases", "support_messages"], load);
  const selected = cases.find((item) => item.id === selectedId);
  const selectedMessages = messages.filter((item) => item.case_id === selectedId);

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const client = getSupabaseBrowserClient(); if (!client) return;
    const form = new FormData(event.currentTarget); setBusy(true); setError(""); setNotice("");
    const { data, error: rpcError } = await client.rpc("create_support_case", {
      target_booking_id: String(form.get("booking_id") ?? "") || null,
      case_subject: String(form.get("subject") ?? "").trim(),
      case_category: String(form.get("category") ?? "general").trim(),
      case_priority: String(form.get("priority") ?? "normal"),
      first_message: String(form.get("message") ?? "").trim(),
    });
    if (rpcError) setError(rpcError.message); else { setNotice("Support case created."); (event.currentTarget as HTMLFormElement).reset(); const created = data as SupportCase; setSelectedId(created.id); await load(); }
    setBusy(false);
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const client = getSupabaseBrowserClient(); if (!client || !user || !selected || !reply.trim()) return;
    setBusy(true); setError("");
    const { error: insertError } = await client.from("support_messages").insert({ case_id: selected.id, author_id: user.id, visibility: consoleType ? visibility : "customer", body: reply.trim() });
    if (insertError) setError(insertError.message); else { setReply(""); setNotice("Reply sent."); await load(); }
    setBusy(false);
  }

  async function setCaseStatus(status: string) {
    const client = getSupabaseBrowserClient(); if (!client || !selected || !consoleType) return;
    setBusy(true); setError("");
    const { error: updateError } = await client.from("support_cases").update({ status, resolved_at: status === "resolved" ? new Date().toISOString() : null }).eq("id", selected.id);
    if (updateError) setError(updateError.message); else { setNotice(`Case moved to ${status}.`); await load(); }
    setBusy(false);
  }

  const content = <>
    <PageTitle eyebrow={consoleType ? "SERVICE / SUPPORT" : "HELP & SUPPORT"} title={consoleType ? "Support inbox" : "Contact VanGO"} copy={consoleType ? "Reply to scoped passenger cases and manage their lifecycle in real time." : "Create a case tied to a booking, then continue the conversation with support."} />
    <details className="panel support-new-case" open={!cases.length}><summary>Open a new support case</summary><form onSubmit={createCase}><div className="form-grid"><label className="field"><span>Booking (optional)</span><select name="booking_id"><option value="">General concern</option>{bookings.map((item) => <option value={item.id} key={item.id}>{item.reference}</option>)}</select></label><label className="field"><span>Category</span><select name="category" defaultValue="general"><option value="general">General</option><option value="booking">Booking</option><option value="trip">Trip</option><option value="refund">Refund</option><option value="account">Account</option></select></label><label className="field"><span>Subject</span><input name="subject" minLength={4} maxLength={160} required /></label><label className="field"><span>Priority</span><select name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label className="field full"><span>Message</span><textarea name="message" minLength={4} maxLength={5000} required /></label></div><div className="live-form-actions"><button className="button button-primary" disabled={busy} type="submit">Create case</button></div></form></details>
    {notice ? <div className="form-message success">{notice}</div> : null}{error ? <div className="form-message error">{error}</div> : null}
    <div className="record-toolbar table-spacer"><LiveDot status={liveStatus} /><button className="button button-outline" type="button" onClick={() => void load()}>Refresh</button></div>
    <section className="support-workspace"><div className="support-queue">{cases.map((item) => <button className={`ticket-item${selectedId === item.id ? " selected" : ""}`} onClick={() => setSelectedId(item.id)} type="button" key={item.id}><span><Mono>{item.case_number}</Mono><Status tone={tone(item.priority)}>{item.priority}</Status></span><strong>{item.subject}</strong><span><small>{item.category}</small><Status tone={tone(item.status)}>{item.status}</Status></span></button>)}{!cases.length ? <div className="real-empty"><h3>No support cases</h3></div> : null}</div><div className="case-panel">{selected ? <><div className="case-head"><div><Mono>{selected.case_number}</Mono><h2>{selected.subject}</h2><p>{selected.category} · opened {new Date(selected.created_at).toLocaleDateString("en-PH", { dateStyle: "medium" })}</p></div><Status tone={tone(selected.status)}>{selected.status}</Status></div><div className="case-thread">{selectedMessages.map((message) => <article className={`case-message${message.author_id === user?.id ? " mine" : ""}`} key={message.id}><span>{message.visibility} · {new Date(message.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</span><p>{message.body}</p></article>)}</div><form className="case-reply" onSubmit={sendReply}><label htmlFor="support-reply">Reply</label><textarea id="support-reply" maxLength={5000} required value={reply} onChange={(event) => setReply(event.target.value)} />{consoleType ? <label className="field"><span>Visibility</span><select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="customer">Customer reply</option><option value="internal">Internal note</option></select></label> : null}<div className="case-actions">{consoleType ? <><button className="button button-outline" disabled={busy} type="button" onClick={() => void setCaseStatus("waiting_customer")}>Wait for customer</button><button className="button button-outline" disabled={busy} type="button" onClick={() => void setCaseStatus("resolved")}>Resolve</button></> : null}<button className="button button-primary" disabled={busy} type="submit">Send reply</button></div></form></> : <div className="real-empty"><h3>Select a support case</h3></div>}</div></section>
  </>;

  return consoleType ? <ConsoleShell consoleType={consoleType}>{content}</ConsoleShell> : <PassengerShell>{content}</PassengerShell>;
}

export function ComplianceConsole() {
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [organizations, setOrganizations] = useState<NamedOption[]>([]);
  const [branches, setBranches] = useState<NamedOption[]>([]);
  const [requirements, setRequirements] = useState<NamedOption[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [entityType, setEntityType] = useState("organization");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const client = getSupabaseBrowserClient(); if (!client) return;
    const [documentResult, organizationResult, branchResult, requirementResult] = await Promise.all([
      client.from("compliance_documents").select("id,organization_id,entity_type,entity_id,requirement_id,storage_path,issued_at,expires_at,review_status,review_notes,created_at").order("created_at", { ascending: false }),
      client.from("organizations").select("id,name").order("name"),
      client.from("branches").select("id,name,organization_id").order("name"),
      client.from("compliance_requirements").select("id,entity_type,document_type").eq("is_active", true).order("document_type"),
    ]);
    const failed = documentResult.error ?? organizationResult.error ?? branchResult.error ?? requirementResult.error;
    if (failed) { setError(failed.message); return; }
    setDocuments((documentResult.data ?? []) as ComplianceDocument[]); setOrganizations((organizationResult.data ?? []) as NamedOption[]); setBranches((branchResult.data ?? []) as NamedOption[]); setRequirements((requirementResult.data ?? []).map((item) => ({ id: item.id, name: item.document_type, entity_type: item.entity_type }))); setError("");
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const liveStatus = useLiveTables(["compliance_documents", "compliance_requirements"], load);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const client = getSupabaseBrowserClient(); if (!client) return;
    const form = new FormData(event.currentTarget); const file = form.get("document") as File; const entityId = String(form.get("entity_id") ?? ""); const requirementId = String(form.get("requirement_id") ?? "");
    if (!file?.size) { setError("Choose a PDF, JPG, or PNG document."); return; }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-"); const path = `${organizationId}/${entityType}/${entityId}/${crypto.randomUUID()}-${safeName}`;
    setBusy("upload"); setError(""); setNotice("");
    const uploaded = await client.storage.from("compliance-documents").upload(path, file, { upsert: false });
    if (uploaded.error) { setError(uploaded.error.message); setBusy(""); return; }
    const branchId = entityType === "branch" ? entityId : String(form.get("branch_id") ?? "") || null;
    const inserted = await client.from("compliance_documents").insert({ organization_id: organizationId, branch_id: branchId, entity_type: entityType, entity_id: entityId, requirement_id: requirementId, storage_path: path, issued_at: String(form.get("issued_at") ?? "") || null, expires_at: String(form.get("expires_at") ?? "") || null });
    if (inserted.error) { await client.storage.from("compliance-documents").remove([path]); setError(inserted.error.message); }
    else { setNotice("Compliance document uploaded for review."); (event.currentTarget as HTMLFormElement).reset(); await load(); }
    setBusy("");
  }

  async function review(document: ComplianceDocument, status: string) {
    const client = getSupabaseBrowserClient(); if (!client) return;
    setBusy(document.id); setError("");
    const { error: rpcError } = await client.rpc("review_compliance_document", { target_document_id: document.id, next_status: status, review_notes: reviewNotes[document.id]?.trim() || null });
    if (rpcError) setError(rpcError.message); else { setNotice(`Document marked ${status}.`); await load(); }
    setBusy("");
  }

  async function openDocument(path: string) {
    const client = getSupabaseBrowserClient(); if (!client) return;
    const { data, error: signedError } = await client.storage.from("compliance-documents").createSignedUrl(path, 60);
    if (signedError) setError(signedError.message); else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const entityOptions = entityType === "organization" ? organizations.filter((item) => item.id === organizationId) : entityType === "branch" ? branches.filter((item) => item.organization_id === organizationId) : [];
  return <ConsoleShell consoleType="superadmin"><PageTitle eyebrow="GOVERNANCE / COMPLIANCE" title="Compliance review" copy="Upload protected evidence, track expiry, and record permission-checked reviews." />
    <form className="panel feature-form" onSubmit={upload}><div className="form-grid"><label className="field"><span>Organization</span><select required value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="">Select organization</option>{organizations.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Entity type</span><select value={entityType} onChange={(event) => setEntityType(event.target.value)}><option value="organization">Organization</option><option value="branch">Branch</option><option value="vehicle">Vehicle UUID</option><option value="driver">Driver UUID</option></select></label><label className="field"><span>Entity</span>{entityOptions.length ? <select name="entity_id" required><option value="">Select entity</option>{entityOptions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select> : <input name="entity_id" required placeholder={organizationId ? "Entity UUID" : "Select an organization first"} value={entityType === "organization" ? organizationId : undefined} readOnly={entityType === "organization"} />}</label><label className="field"><span>Requirement</span><select name="requirement_id" required><option value="">Select requirement</option>{requirements.filter((item) => item.entity_type === entityType).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Issued date</span><input name="issued_at" type="date" /></label><label className="field"><span>Expiry date</span><input name="expires_at" type="date" /></label><label className="field full"><span>Protected document</span><input name="document" type="file" accept="application/pdf,image/jpeg,image/png" required /></label></div><div className="live-form-actions"><LiveDot status={liveStatus} /><button className="button button-primary" disabled={busy === "upload" || !organizationId} type="submit">{busy === "upload" ? "Uploading…" : "Upload document"}</button></div></form>
    {notice ? <div className="form-message success">{notice}</div> : null}{error ? <div className="form-message error">{error}</div> : null}
    <div className="compliance-grid table-spacer">{documents.map((document) => <article className="panel compliance-card" key={document.id}><div className="panel-head"><div><span>{document.entity_type}</span><h2>{requirements.find((item) => item.id === document.requirement_id)?.name || "Compliance document"}</h2></div><Status tone={tone(document.review_status)}>{document.review_status}</Status></div><p><Mono>{document.entity_id}</Mono></p><small>{document.expires_at ? `Expires ${new Date(document.expires_at).toLocaleDateString("en-PH", { dateStyle: "medium" })}` : "No expiry date"}</small><label className="field"><span>Review notes</span><input value={reviewNotes[document.id] ?? document.review_notes ?? ""} onChange={(event) => setReviewNotes((current) => ({ ...current, [document.id]: event.target.value }))} /></label><div className="case-actions"><button className="button button-outline" type="button" onClick={() => void openDocument(document.storage_path)}>View file</button><button className="button button-primary" disabled={busy === document.id} type="button" onClick={() => void review(document, "approved")}>Approve</button><button className="button button-outline danger" disabled={busy === document.id} type="button" onClick={() => void review(document, "rejected")}>Reject</button></div></article>)}</div>{!documents.length && !error ? <div className="real-empty"><h3>No compliance documents</h3><p>Upload the first protected document above.</p></div> : null}
  </ConsoleShell>;
}

type SettingRow = { branch_id?: string; key: string; value: unknown; version: number; updated_at: string };

export function SettingsConsole({ consoleType }: { consoleType: "admin" | "superadmin" }) {
  const table = consoleType === "admin" ? "branch_settings" : "platform_settings";
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [branches, setBranches] = useState<NamedOption[]>([]);
  const [branchId, setBranchId] = useState("");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("{}");
  const [editingVersion, setEditingVersion] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const client = getSupabaseBrowserClient(); if (!client) return;
    const settingResult = await client.from(table).select("*").order("updated_at", { ascending: false });
    const branchResult = consoleType === "admin" ? await client.from("branches").select("id,name,organization_id").order("name") : null;
    if (settingResult.error || branchResult?.error) { setError(settingResult.error?.message ?? branchResult?.error?.message ?? "Unable to load settings."); return; }
    setRows((settingResult.data ?? []) as SettingRow[]); setBranches((branchResult?.data ?? []) as NamedOption[]); setError("");
  }, [consoleType, table]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const liveStatus = useLiveTables([table], load);

  function edit(row: SettingRow) {
    setBranchId(row.branch_id ?? ""); setKey(row.key); setValue(JSON.stringify(row.value, null, 2)); setEditingVersion(row.version); setNotice(""); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const client = getSupabaseBrowserClient(); if (!client) return;
    let parsed: unknown;
    try { parsed = JSON.parse(value); } catch { setError("Value must be valid JSON."); return; }
    setBusy(true); setError(""); setNotice("");
    const result = consoleType === "admin"
      ? await client.rpc("set_branch_setting", { target_branch_id: branchId, setting_key: key.trim(), setting_value: parsed, expected_version: editingVersion })
      : await client.rpc("set_platform_setting", { setting_key: key.trim(), setting_value: parsed, expected_version: editingVersion });
    if (result.error) setError(result.error.message);
    else { setNotice("Setting published with a new version."); setKey(""); setValue("{}"); setEditingVersion(null); await load(); }
    setBusy(false);
  }

  return <ConsoleShell consoleType={consoleType}><PageTitle eyebrow={consoleType === "admin" ? "WORKSPACE / SETTINGS" : "PLATFORM / CONFIGURATION"} title={consoleType === "admin" ? "Branch settings" : "Global configuration"} copy="Create and update versioned JSON settings through an optimistic-concurrency database operation." />
    <form className="panel feature-form" onSubmit={save}><div className="form-grid">{consoleType === "admin" ? <label className="field"><span>Branch</span><select required value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">Select branch</option>{branches.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label> : null}<label className="field"><span>Setting key</span><input required minLength={2} maxLength={80} value={key} readOnly={editingVersion !== null} onChange={(event) => setKey(event.target.value)} placeholder="booking_policy" /></label><label className="field full"><span>JSON value</span><textarea required value={value} onChange={(event) => setValue(event.target.value)} spellCheck={false} /></label></div><div className="live-form-actions"><LiveDot status={liveStatus} />{editingVersion !== null ? <button className="button button-outline" type="button" onClick={() => { setEditingVersion(null); setKey(""); setValue("{}"); }}>Cancel edit</button> : null}<button className="button button-primary" disabled={busy || (consoleType === "admin" && !branchId)} type="submit">{busy ? "Publishing…" : editingVersion === null ? "Create setting" : "Publish change"}</button></div></form>
    {notice ? <div className="form-message success">{notice}</div> : null}{error ? <div className="form-message error">{error}</div> : null}
    <div className="data-card table-spacer"><div className="data-table live-table"><div className="data-row data-head settings-data-row"><span>Setting</span><span>Value</span><span>Version</span><span>Updated</span><span>Manage</span></div>{rows.map((row) => <div className="data-row settings-data-row" key={`${row.branch_id ?? "platform"}:${row.key}`}><span data-label="Setting"><strong>{row.key}</strong>{row.branch_id ? <Mono>{row.branch_id}</Mono> : null}</span><span data-label="Value"><Mono>{JSON.stringify(row.value)}</Mono></span><span data-label="Version"><Mono>{row.version}</Mono></span><span data-label="Updated">{new Date(row.updated_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</span><span data-label="Manage"><button className="button button-outline" type="button" onClick={() => edit(row)}>Edit</button></span></div>)}</div>{!rows.length && !error ? <div className="real-empty"><h3>No settings in scope</h3></div> : null}</div>
  </ConsoleShell>;
}

type AccessInvitation = { id: string; email: string; role: string; organization_id: string | null; branch_id: string | null; expires_at: string; accepted_at: string | null; revoked_at: string | null; created_at: string };

export function AccessInvitationsConsole() {
  const [rows, setRows] = useState<AccessInvitation[]>([]);
  const [organizations, setOrganizations] = useState<NamedOption[]>([]);
  const [branches, setBranches] = useState<NamedOption[]>([]);
  const [role, setRole] = useState("organization_admin");
  const [organizationId, setOrganizationId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const client = getSupabaseBrowserClient(); if (!client) return;
    const [inviteResult, organizationResult, branchResult] = await Promise.all([
      client.from("access_invitations").select("id,email,role,organization_id,branch_id,expires_at,accepted_at,revoked_at,created_at").order("created_at", { ascending: false }),
      client.from("organizations").select("id,name").order("name"),
      client.from("branches").select("id,name,organization_id").order("name"),
    ]);
    const failed = inviteResult.error ?? organizationResult.error ?? branchResult.error;
    if (failed) { setError(failed.message); return; }
    setRows((inviteResult.data ?? []) as AccessInvitation[]); setOrganizations((organizationResult.data ?? []) as NamedOption[]); setBranches((branchResult.data ?? []) as NamedOption[]); setError("");
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const liveStatus = useLiveTables(["access_invitations"], load);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const client = getSupabaseBrowserClient(); if (!client) return;
    const form = new FormData(event.currentTarget); setBusy("create"); setError(""); setNotice("");
    const { error: rpcError } = await client.rpc("create_access_invitation", { invite_email: String(form.get("email") ?? ""), invite_role: role, target_organization_id: role === "superadmin" ? null : organizationId || null, target_branch_id: role === "superadmin" ? null : String(form.get("branch_id") ?? "") || null, expires_hours: Number(form.get("expires_hours") ?? 72) });
    if (rpcError) setError(rpcError.message); else { setNotice("Invitation record created. No email is sent until an email provider or Supabase admin invite is connected."); (event.currentTarget as HTMLFormElement).reset(); await load(); }
    setBusy("");
  }

  async function revoke(id: string) {
    const client = getSupabaseBrowserClient(); if (!client) return;
    setBusy(id); setError(""); const { error: updateError } = await client.from("access_invitations").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (updateError) setError(updateError.message); else { setNotice("Invitation revoked."); await load(); } setBusy("");
  }

  function invitationStatus(item: AccessInvitation) {
    if (item.revoked_at) return "revoked";
    if (item.accepted_at) return "accepted";
    if (new Date(item.expires_at) < new Date()) return "expired";
    return "pending";
  }

  return <ConsoleShell consoleType="superadmin"><PageTitle eyebrow="SECURITY / INVITATIONS" title="Access invitations" copy="Create scoped, expiring invitation records and revoke them. Email delivery remains disabled until a provider is configured." />
    <form className="panel feature-form" onSubmit={create}><div className="form-grid"><label className="field"><span>Email</span><input name="email" type="email" required /></label><label className="field"><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value)}><option value="organization_admin">Organization admin</option><option value="branch_admin">Branch admin</option><option value="dispatcher">Dispatcher</option><option value="cashier">Cashier</option><option value="support">Support</option><option value="analyst">Analyst</option><option value="superadmin">Superadmin</option></select></label>{role !== "superadmin" ? <><label className="field"><span>Organization</span><select required value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="">Select organization</option>{organizations.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label className="field"><span>Branch (optional)</span><select name="branch_id"><option value="">Organization-wide</option>{branches.filter((item) => item.organization_id === organizationId).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></> : null}<label className="field"><span>Expires after (hours)</span><input name="expires_hours" type="number" min="1" max="720" defaultValue="72" required /></label></div><div className="live-form-actions"><LiveDot status={liveStatus} /><button className="button button-primary" disabled={busy === "create"} type="submit">Create invitation record</button></div></form>
    {notice ? <div className="form-message success">{notice}</div> : null}{error ? <div className="form-message error">{error}</div> : null}<div className="data-card table-spacer"><div className="data-table live-table"><div className="data-row data-head invitation-data-row"><span>Email</span><span>Role</span><span>Scope</span><span>Expires</span><span>Status</span><span>Manage</span></div>{rows.map((item) => { const status = invitationStatus(item); return <div className="data-row invitation-data-row" key={item.id}><span data-label="Email">{item.email}</span><span data-label="Role">{item.role.replaceAll("_", " ")}</span><span data-label="Scope"><Mono>{item.branch_id || item.organization_id || "platform"}</Mono></span><span data-label="Expires">{new Date(item.expires_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</span><span data-label="Status"><Status tone={tone(status)}>{status}</Status></span><span data-label="Manage">{status === "pending" ? <button className="button button-outline danger" disabled={busy === item.id} type="button" onClick={() => void revoke(item.id)}>Revoke</button> : "—"}</span></div>; })}</div></div>
  </ConsoleShell>;
}

type Settlement = { id: string; organization_id: string; period_start: string; period_end: string; gross_amount: number | string; fee_amount: number | string; adjustment_amount: number | string; payout_amount: number | string; status: string; created_at: string };

export function SettlementConsole() {
  const [rows, setRows] = useState<Settlement[]>([]);
  const [organizations, setOrganizations] = useState<NamedOption[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const client = getSupabaseBrowserClient(); if (!client) return;
    const [settlementResult, organizationResult] = await Promise.all([
      client.from("settlements").select("id,organization_id,period_start,period_end,gross_amount,fee_amount,adjustment_amount,payout_amount,status,created_at").order("created_at", { ascending: false }),
      client.from("organizations").select("id,name").order("name"),
    ]);
    if (settlementResult.error || organizationResult.error) { setError(settlementResult.error?.message ?? organizationResult.error?.message ?? "Unable to load settlements."); return; }
    setRows((settlementResult.data ?? []) as Settlement[]); setOrganizations((organizationResult.data ?? []) as NamedOption[]); setError("");
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const liveStatus = useLiveTables(["settlements", "settlement_items"], load);

  function nextStates(status: string) {
    if (status === "draft") return ["review", "held"];
    if (status === "review") return ["approved", "held", "draft"];
    if (status === "approved") return ["processing", "held"];
    if (status === "processing") return ["paid", "held"];
    if (status === "held") return ["review"];
    return [];
  }

  async function transition(row: Settlement, status: string) {
    const client = getSupabaseBrowserClient(); if (!client) return;
    setBusy(row.id); setError(""); setNotice("");
    const { error: rpcError } = await client.rpc("transition_settlement_status", { target_settlement_id: row.id, next_status: status, change_reason: reasons[row.id]?.trim() || null });
    if (rpcError) setError(rpcError.message); else { setNotice(`Mock settlement moved to ${status}. No real payout was sent.`); await load(); }
    setBusy("");
  }

  return <ConsoleShell consoleType="superadmin"><PageTitle eyebrow="PLATFORM / MOCK FINANCE" title="Settlement governance" copy="Review and advance mock settlement records. A paid state is a simulation only and never sends a real payout." />
    <section className="mock-payment-note"><strong>Mock settlements only</strong><p>Every status transition is audited in Supabase. No bank or payment provider receives an instruction.</p></section>
    <div className="record-toolbar table-spacer"><LiveDot status={liveStatus} /><button className="button button-outline" type="button" onClick={() => void load()}>Refresh</button></div>{notice ? <div className="form-message success">{notice}</div> : null}{error ? <div className="form-message error">{error}</div> : null}
    <div className="refund-grid">{rows.map((row) => <article className="panel refund-card" key={row.id}><div className="panel-head"><div><span>{organizations.find((item) => item.id === row.organization_id)?.name || row.organization_id}</span><h2>₱{Number(row.payout_amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</h2></div><Status tone={tone(row.status)}>{row.status}</Status></div><p>{new Date(row.period_start).toLocaleDateString("en-PH", { dateStyle: "medium" })} – {new Date(row.period_end).toLocaleDateString("en-PH", { dateStyle: "medium" })}</p><div className="settlement-amounts"><span><small>GROSS</small><Mono>₱{Number(row.gross_amount).toLocaleString("en-PH")}</Mono></span><span><small>FEE</small><Mono>₱{Number(row.fee_amount).toLocaleString("en-PH")}</Mono></span><span><small>ADJUSTMENT</small><Mono>₱{Number(row.adjustment_amount).toLocaleString("en-PH")}</Mono></span></div>{nextStates(row.status).length ? <><label className="field"><span>Governance note (required when holding)</span><input value={reasons[row.id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [row.id]: event.target.value }))} /></label><div className="case-actions">{nextStates(row.status).map((status) => <button className={`button ${status === "held" ? "button-outline danger" : "button-primary"}`} disabled={busy === row.id} type="button" onClick={() => void transition(row, status)} key={status}>{status}</button>)}</div></> : null}</article>)}</div>{!rows.length && !error ? <div className="real-empty"><h3>No settlement records</h3><p>Real empty state: settlement generation is not fabricated by the interface.</p></div> : null}
  </ConsoleShell>;
}
