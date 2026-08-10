"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import { useLiveTables } from "../../lib/realtime";
import { useAuth } from "../providers";
import { PassengerShell } from "./shells";
import { LiveDot, Mono, Status } from "./ui";

type Booking = {
  id: string;
  reference: string;
  booking_status: string;
  payment_status: string;
  total: number | string;
  created_at: string;
  trip_id: string;
  trip?: {
    departure_at: string;
    arrival_at: string;
    gate: string | null;
    organization: { name: string } | null;
    route: { origin: { name: string; city: string } | null; destination: { name: string; city: string } | null } | null;
  } | null;
};
type Seat = { seat_id: string; seat_code: string; seat_class: string; is_accessibility: boolean; seat_state: string };
type Hold = { id: string; trip_id: string; expires_at: string; trip_seats: { seat_code: string } | null };
type Notification = { id: string; type: string; title: string; body: string; action_path: string | null; read_at: string | null; created_at: string };

function errorText(value: unknown) { return value instanceof Error ? value.message : "The database request could not be completed."; }

export function PassengerDashboard() {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    try {
      const [bookingResult, notificationResult] = await Promise.all([
        client.from("bookings").select("id,reference,booking_status,payment_status,total,created_at,trip_id").order("created_at", { ascending: false }).limit(3),
        client.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
      ]);
      if (bookingResult.error) throw bookingResult.error;
      if (notificationResult.error) throw notificationResult.error;
      setBookings((bookingResult.data ?? []) as Booking[]);
      setUnread(notificationResult.count ?? 0);
    } catch (reason) {
      setError(errorText(reason));
    }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  // A staff status change or a mock payment reaches this screen without a reload.
  useLiveTables(["bookings", "notifications"], load);
  return <PassengerShell><section className="passenger-greeting"><div><span>Welcome back,</span><h1>{profile?.full_name || "Passenger"}</h1></div><Link className="weather-chip" href="/passenger/alerts">{unread} unread</Link></section><div className="passenger-real-actions"><Link className="button button-primary large full" href="/passenger/trips">Search a new trip</Link></div><div className="passenger-dashboard-grid"><section className="mobile-section"><div className="section-mini-title"><h2>Recent bookings</h2><Link href="/passenger/bookings">View all</Link></div>{error ? <div className="form-message error">{error}</div> : null}{bookings.length ? <div className="passenger-live-list">{bookings.map((booking) => <Link href={`/passenger/ticket?reference=${booking.reference}`} key={booking.id}><span><Mono>{booking.reference}</Mono><small>{new Date(booking.created_at).toLocaleDateString("en-PH", { dateStyle: "medium" })}</small></span><span><Status tone={booking.booking_status === "confirmed" ? "success" : "warning"}>{booking.booking_status}</Status><Mono>₱{Number(booking.total).toLocaleString("en-PH")}</Mono></span></Link>)}</div> : !error ? <div className="real-empty"><h3>No bookings yet</h3><p>Your real VanGO bookings will appear here after you reserve and confirm a trip.</p></div> : null}</section><section className="mock-payment-note"><strong>Mock payment only</strong><p>VanGO never contacts a bank or wallet in this development version. No real money is charged.</p></section></div></PassengerShell>;
}

export function LiveSeatBooking() {
  const params = useSearchParams();
  const tripId = params.get("trip") ?? "";
  const requestedPassengers = Math.min(8, Math.max(1, Number(params.get("passengers") ?? 1)));
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  const load = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client || !tripId) { setLoading(false); return; }
    const { data, error: queryError } = await client.rpc("get_trip_seat_map", { target_trip_id: tripId });
    if (queryError) setError(queryError.message);
    const nextSeats = (data ?? []) as Seat[];
    setSeats(nextSeats);
    setSelected((current) => current.filter((code) => nextSeats.some((seat) => seat.seat_code === code && seat.seat_state === "available")));
    setLoading(false);
  }, [tripId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  // Seats another passenger holds turn unavailable here while this page is open.
  const seatStatus = useLiveTables(["trip_seats", "seat_holds", "trips"], load);

  function toggle(seat: Seat) {
    if (seat.seat_state !== "available") return;
    setSelected((current) => current.includes(seat.seat_code) ? current.filter((code) => code !== seat.seat_code) : current.length < requestedPassengers ? [...current, seat.seat_code] : current);
  }
  async function continueBooking() {
    const client = getSupabaseBrowserClient();
    if (!client || selected.length !== requestedPassengers) return;
    setLoading(true); setError("");
    const { data, error: holdError } = await client.rpc("hold_trip_seats", { target_trip_id: tripId, seat_codes: selected, ttl_seconds: 600 });
    if (holdError) { setError(holdError.message); await load(); setLoading(false); return; }
    const hold = data as { hold_group: string };
    router.push(`/passenger/checkout?hold=${hold.hold_group}`);
  }

  return <PassengerShell title="Choose seats" back="/passenger/trips"><div className="step-heading"><div><span>STEP 1 OF 3</span><h1>Select {requestedPassengers} seat{requestedPassengers === 1 ? "" : "s"}</h1></div></div>{!tripId ? <div className="real-empty"><h3>No trip selected</h3><p>Search for a published trip before choosing seats.</p><Link className="button button-primary" href="/passenger/trips">Search trips</Link></div> : null}{error ? <div className="form-message error">{error}</div> : null}{loading ? <div className="real-empty"><h3>Checking seat availability…</h3></div> : null}{!loading && tripId ? <><div className="seat-legend"><span><i className="available" />Available</span><span><i className="selected" />Selected</span><span><i className="occupied" />Unavailable</span><span><i className="reserved" />Accessibility</span><LiveDot status={seatStatus} /></div><div className="vehicle-shell"><div className="driver-row"><span className="wheel">◎</span><small>FRONT</small></div><div className="live-seat-grid">{seats.map((seat) => <button type="button" key={seat.seat_id} className={`seat ${selected.includes(seat.seat_code) ? "selected" : ""} ${seat.seat_state !== "available" ? "occupied" : ""} ${seat.is_accessibility ? "reserved" : ""}`} disabled={seat.seat_state !== "available"} aria-pressed={selected.includes(seat.seat_code)} onClick={() => toggle(seat)}>{seat.seat_code}</button>)}</div></div><div className="sticky-booking-bar"><div><span>{selected.length} of {requestedPassengers} selected</span><strong>{selected.join(", ") || "Choose available seats"}</strong></div><button className="button button-primary" type="button" disabled={selected.length !== requestedPassengers || loading} onClick={() => void continueBooking()}>Hold seats</button></div></> : null}</PassengerShell>;
}

export function LiveCheckout() {
  const holdGroup = useSearchParams().get("hold") ?? "";
  const [holds, setHolds] = useState<Hold[]>([]);
  const [tripFare, setTripFare] = useState(0);
  const [expiresAt, setExpiresAt] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(Boolean(holdGroup));
  const router = useRouter();

  const load = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client || !holdGroup) return;
    try {
      setError("");
      const { data, error: holdError } = await client
        .from("seat_holds")
        .select("id,trip_id,expires_at,trip_seats(seat_code)")
        .eq("hold_group", holdGroup)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString());
      if (holdError) throw holdError;
      const activeHolds = (data ?? []) as unknown as Hold[];
      setHolds(activeHolds);
      setExpiresAt(activeHolds[0]?.expires_at ?? "");
      if (activeHolds[0]) {
        const { data: trip, error: tripError } = await client.from("trips").select("fare").eq("id", activeHolds[0].trip_id).maybeSingle();
        if (tripError) throw tripError;
        setTripFare(Number((trip as { fare: number | string } | null)?.fare ?? 0));
      } else {
        setTripFare(0);
      }
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }, [holdGroup]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useLiveTables(["seat_holds", "trips"], load);
  useEffect(() => {
    if (!expiresAt) return;
    const delay = Math.max(0, new Date(expiresAt).getTime() - Date.now() + 150);
    const timer = window.setTimeout(() => void load(), delay);
    return () => window.clearTimeout(timer);
  }, [expiresAt, load]);

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client || !holdGroup) return;
    setBusy(true); setError("");
    try {
      const form = new FormData(event.currentTarget);
      const passengers = holds.map((hold, index) => ({
        full_name: String(form.get(`name-${index}`) ?? "").trim(),
        mobile_e164: String(form.get(`mobile-${index}`) ?? "").trim(),
        age: Number(form.get(`age-${index}`) ?? 0),
        seat_code: hold.trip_seats?.seat_code,
      }));
      const { data: quote, error: quoteError } = await client.rpc("quote_booking", { target_hold_group: holdGroup, promotion_code: promoCode.trim() || null });
      if (quoteError) throw quoteError;
      const { data: booking, error: bookingError } = await client.rpc("confirm_booking", { target_quote_id: (quote as { id: string }).id, passengers });
      if (bookingError) throw bookingError;
      const bookingResult = booking as { booking_id: string; reference: string };
      const { error: paymentError } = await client.rpc("complete_mock_payment", { target_booking_id: bookingResult.booking_id });
      if (paymentError) throw paymentError;
      router.replace(`/passenger/ticket?reference=${bookingResult.reference}`);
    } catch (reason) { setError(errorText(reason)); setBusy(false); }
  }

  const total = tripFare * holds.length;
  return <PassengerShell title="Checkout" back="/passenger/seats"><div className="step-heading compact"><div><span>STEP 2 OF 3</span><h1>Passenger details</h1></div>{expiresAt ? <div className="hold-chip">Held until {new Date(expiresAt).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</div> : null}</div>{busy ? <div className="real-empty"><h3>Loading secure checkout…</h3></div> : null}{error ? <div className="form-message error">{error}</div> : null}{!busy && !holds.length ? <div className="real-empty"><h3>Seat hold expired or missing</h3><p>Return to trip search and select available seats again.</p><Link className="button button-primary" href="/passenger/trips">Search trips</Link></div> : null}{holds.length ? <form onSubmit={confirm}>{holds.map((hold, index) => <section className="form-card" key={hold.id}><div className="form-card-title"><b>{hold.trip_seats?.seat_code}</b><strong>{index === 0 ? "Lead passenger" : `Passenger ${index + 1}`}</strong></div><label className="field"><span>Full name</span><input name={`name-${index}`} autoComplete={index === 0 ? "name" : "off"} required /></label><div className="field-row"><label className="field"><span>Mobile</span><input name={`mobile-${index}`} type="tel" required /></label><label className="field small"><span>Age</span><input name={`age-${index}`} type="number" min="0" max="120" required /></label></div></section>)}<section className="form-card"><label className="field"><span>Promo code (optional)</span><input value={promoCode} onChange={(event) => setPromoCode(event.target.value.toUpperCase())} maxLength={40} placeholder="Enter an active VanGO code" /></label><small>The server validates dates, scope, limits, and discount amount before confirming.</small></section><section className="mock-payment-card"><span>VANGO MOCK PAYMENT</span><h2>No real money will be charged</h2><p>This test payment immediately records a successful mock transaction and confirms the booking in Supabase.</p></section><section className="fare-card"><h2>Fare breakdown</h2><p><span>Seat fare · {holds.length} × ₱{tripFare.toLocaleString("en-PH")}</span><b>₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</b></p><div><span>Total mock amount</span><strong>Final quote is calculated securely</strong></div></section><button className="button button-primary large full" type="submit" disabled={busy}>{busy ? "Confirming…" : "Confirm with Mock Payment"}</button></form> : null}</PassengerShell>;
}

function PassengerRefundRequest({ booking, onDone }: { booking: Booking; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseBrowserClient(); if (!client) return;
    setBusy(true); setError(""); setNotice("");
    const { error: rpcError } = await client.rpc("request_refund", { target_booking_id: booking.id, requested_reason: reason.trim() });
    if (rpcError) setError(rpcError.message);
    else { setNotice("Mock refund requested. VanGO support will review it."); setReason(""); await onDone(); }
    setBusy(false);
  }

  if (!open) return <button className="button button-outline full" type="button" onClick={() => setOpen(true)}>Request mock refund</button>;
  return <form className="refund-request" onSubmit={submit}><label className="field"><span>Refund reason</span><textarea minLength={4} maxLength={1000} required value={reason} onChange={(event) => setReason(event.target.value)} /></label><small>No real money will move; this requests a simulated refund record.</small>{notice ? <div className="form-message success">{notice}</div> : null}{error ? <div className="form-message error">{error}</div> : null}<div className="case-actions"><button className="button button-outline" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="button button-primary" disabled={busy} type="submit">{busy ? "Requesting…" : "Submit request"}</button></div></form>;
}

export function LiveBookings() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => { const client = getSupabaseBrowserClient(); if (!client) return; const { data, error: queryError } = await client.from("bookings").select("id,reference,booking_status,payment_status,total,created_at,trip_id").order("created_at", { ascending: false }); if (queryError) setError(queryError.message); else setError(""); setRows((data ?? []) as Booking[]); }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useLiveTables(["bookings", "payment_intents", "refunds"], load);
  return <PassengerShell><div className="mobile-page-title"><span>YOUR JOURNEYS</span><h1>My bookings</h1></div>{error ? <div className="form-message error">{error}</div> : null}<div className="passenger-booking-grid">{rows.map((booking) => <article className="booking-card" key={booking.id}><div className="booking-card-top"><Mono>{booking.reference}</Mono><Status tone={booking.booking_status === "confirmed" ? "success" : "warning"}>{booking.booking_status}</Status></div><p>Created {new Date(booking.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</p><div className="booking-meta"><span><small>PAYMENT</small><b>{booking.payment_status.replaceAll("_", " ")}</b></span><span><small>TOTAL</small><Mono>₱{Number(booking.total).toLocaleString("en-PH")}</Mono></span></div><Link className="button button-primary full" href={`/passenger/ticket?reference=${booking.reference}`}>Open booking</Link>{["paid", "partially_refunded"].includes(booking.payment_status) ? <PassengerRefundRequest booking={booking} onDone={load} /> : null}</article>)}</div>{!rows.length && !error ? <div className="real-empty"><h3>No bookings yet</h3><p>Confirmed and pending bookings from your account will appear here.</p><Link className="button button-primary" href="/passenger/trips">Book a trip</Link></div> : null}</PassengerShell>;
}

export function LiveTicket() {
  const reference = useSearchParams().get("reference") ?? "";
  const [booking, setBooking] = useState<Booking | null>(null);
  const [passengers, setPassengers] = useState<Array<{ full_name: string; seat_code: string }>>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client || !reference) return;
    try {
      const { data, error: bookingError } = await client.from("bookings").select("id,reference,booking_status,payment_status,total,created_at,trip_id,trip:trips(departure_at,arrival_at,gate,organization:organizations(name),route:routes(origin:terminals!routes_origin_terminal_id_fkey(name,city),destination:terminals!routes_destination_terminal_id_fkey(name,city)))").eq("reference", reference).maybeSingle();
      if (bookingError) throw bookingError;
      const current = data as Booking | null;
      setBooking(current);
      if (!current) return;
      const result = await client.from("booking_passengers").select("full_name,seat_code").eq("booking_id", current.id);
      if (result.error) throw result.error;
      setPassengers((result.data ?? []) as Array<{ full_name: string; seat_code: string }>);
    } catch (reason) {
      setError(errorText(reason));
    }
  }, [reference]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  // Staff cancelling or completing this booking updates the ticket in place.
  useLiveTables(["bookings", "payment_intents"], load);
  return <PassengerShell title="E-ticket" back="/passenger/bookings">{error ? <div className="form-message error">{error}</div> : null}{!reference ? <div className="real-empty"><h3>No booking selected</h3><Link className="button button-primary" href="/passenger/bookings">My bookings</Link></div> : null}{booking ? <><article className="ticket-card"><div className="ticket-head"><div><span>BOOKING REFERENCE</span><Mono>{booking.reference}</Mono></div><Status tone={booking.booking_status === "confirmed" ? "success" : "warning"}>{booking.booking_status}</Status></div><div className="ticket-real-code"><span>VANGO</span><Mono>{booking.id}</Mono><p>Present this booking reference at the terminal.</p></div>{booking.trip ? <div className="ticket-trip"><div><small>ROUTE</small><h2>{booking.trip.route?.origin?.city || "Origin"} → {booking.trip.route?.destination?.city || "Destination"}</h2><p>{booking.trip.route?.origin?.name} to {booking.trip.route?.destination?.name}</p></div><div><small>DEPARTURE</small><strong>{new Date(booking.trip.departure_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</strong><span>{booking.trip.organization?.name || "VanGO operator"} · Gate {booking.trip.gate || "TBA"}</span></div></div> : null}<div className="ticket-grid"><span><small>PASSENGERS</small><b>{passengers.length}</b></span><span><small>SEATS</small><b>{passengers.map((item) => item.seat_code).join(", ")}</b></span><span><small>PAYMENT</small><b>{booking.payment_status.replaceAll("_", " ")}</b></span><span><small>MOCK TOTAL</small><Mono>₱{Number(booking.total).toLocaleString("en-PH")}</Mono></span></div></article><section className="mock-payment-note"><strong>Mock payment receipt</strong><p>This booking used a simulated payment. No bank, wallet, card, or real monetary charge was involved.</p></section><Link className="button button-primary large full" href="/passenger/bookings">View my bookings</Link></> : reference && !error ? <div className="real-empty"><h3>Loading booking…</h3></div> : null}</PassengerShell>;
}

export function LiveProfile() {
  const { profile, refreshContext, signOut } = useAuth();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const client = getSupabaseBrowserClient(); if (!client) return; const form = new FormData(event.currentTarget); const { error: updateError } = await client.from("profiles").update({ full_name: String(form.get("full_name") ?? ""), mobile_e164: String(form.get("mobile_e164") ?? "") }).eq("id", profile?.id ?? ""); if (updateError) setError(updateError.message); else { setMessage("Profile updated."); await refreshContext(); } }
  return <PassengerShell><div className="mobile-page-title"><span>ACCOUNT</span><h1>My profile</h1></div><form className="form-card" onSubmit={save}><label className="field"><span>Full name</span><input name="full_name" defaultValue={profile?.full_name ?? ""} required /></label><label className="field"><span>Mobile number</span><input name="mobile_e164" type="tel" defaultValue={profile?.mobile_e164 ?? ""} /></label>{message ? <div className="form-message success">{message}</div> : null}{error ? <div className="form-message error">{error}</div> : null}<button className="button button-primary full" type="submit">Save profile</button></form><button className="button button-outline danger large full" type="button" onClick={() => void signOut()}>Sign out</button></PassengerShell>;
}

export function LiveAlerts() {
  const [rows, setRows] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => { const client = getSupabaseBrowserClient(); if (!client) return; const { data, error: queryError } = await client.from("notifications").select("id,type,title,body,action_path,read_at,created_at").order("created_at", { ascending: false }); if (queryError) setError(queryError.message); setRows((data ?? []) as Notification[]); }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useLiveTables(["notifications"], load);
  async function markRead(id: string) { const client = getSupabaseBrowserClient(); if (!client) return; await client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id); await load(); }
  return <PassengerShell><div className="mobile-page-title"><span>UPDATES</span><h1>Notifications</h1></div>{error ? <div className="form-message error">{error}</div> : null}<div className="alert-list">{rows.map((item) => <article className={item.read_at ? "" : "unread"} key={item.id}><i /><div><Status tone="info">{item.type.replaceAll("_", " ")}</Status><h2>{item.title}</h2><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</small><div className="alert-actions">{item.action_path ? <Link className="button button-primary" href={item.action_path}>Open</Link> : null}{!item.read_at ? <button className="button button-outline" type="button" onClick={() => void markRead(item.id)}>Mark as read</button> : null}</div></div></article>)}</div>{!rows.length && !error ? <div className="real-empty"><h3>No notifications</h3><p>Booking confirmations and trip updates will appear here.</p></div> : null}</PassengerShell>;
}
