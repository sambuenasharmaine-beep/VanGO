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
  const [origin, setOrigin] = useState("cubao");
  const [destination, setDestination] = useState("baguio");
  const [travelDate, setTravelDate] = useState("2026-08-12");
  const [passengers, setPassengers] = useState(2);
  const router = useRouter();

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
  useLiveTables(["bookings", "notifications"], load);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    router.push(`/passenger/trips?origin=${origin}&destination=${destination}&date=${travelDate}&passengers=${passengers}`);
  }

  return (
    <PassengerShell>
      <section className="passenger-greeting">
        <div>
          <span>Magandang umaga,</span>
          <h1>{profile?.full_name || "Juan Miguel"}</h1>
        </div>
        <Link className="weather-chip" href="/passenger/alerts">
          🔔 {unread} unread
        </Link>
      </section>

      <form className="search-card" onSubmit={handleSearch}>
        <div className="route-fields">
          <div>
            <span>From</span>
            <strong>Cubao, Quezon City</strong>
          </div>
          <button
            className="swap-button"
            type="button"
            aria-label="Swap origin and destination"
            onClick={() => {
              const temp = origin;
              setOrigin(destination);
              setDestination(temp);
            }}
          >
            ⇄
          </button>
          <div>
            <span>To</span>
            <strong>Baguio City, Benguet</strong>
          </div>
        </div>
        <div className="search-row">
          <div>
            <span>Travel date</span>
            <strong>12 Aug, Wed</strong>
          </div>
          <div>
            <span>Passengers</span>
            <strong>{passengers} seats</strong>
          </div>
        </div>
        <button className="button button-primary large full" type="submit">
          🔍 Search vans
        </button>
      </form>

      <section className="mobile-section">
        <div className="section-mini-title">
          <h2>Recent searches</h2>
        </div>
        <div className="filter-row">
          <button type="button" className="active">
            Alabang → Batangas City · 12 Aug, 1 seat
          </button>
          <button type="button">
            PITX → Naic, Cavite · 13 Aug, 2 seats
          </button>
        </div>
      </section>

      <section className="mobile-section">
        <div className="section-mini-title">
          <h2>Saved routes</h2>
        </div>
        <div className="saved-route-grid">
          <Link href="/passenger/trips?origin=cubao&destination=baguio">
            <small>SAVED</small>
            <strong>Cubao → Baguio</strong>
            <span>From ₱650</span>
          </Link>
          <Link href="/passenger/trips?origin=alabang&destination=batangas">
            <small>SAVED</small>
            <strong>Alabang → Batangas</strong>
            <span>From ₱480</span>
          </Link>
        </div>
      </section>

      <div className="promo-strip">
        <b>SUMMER100</b>
        <div>
          <strong>₱100 off your next Baguio trip</strong>
          <span>Minimum 2 seats · Valid until 31 Aug</span>
        </div>
      </div>

      <section className="mobile-section">
        <div className="section-mini-title">
          <h2>Recent bookings</h2>
          <Link href="/passenger/bookings">View all</Link>
        </div>
        {error ? <div className="form-message error">{error}</div> : null}
        {bookings.length ? (
          <div className="passenger-live-list">
            {bookings.map((booking) => (
              <Link href={`/passenger/ticket?reference=${booking.reference}`} key={booking.id}>
                <span>
                  <Mono>{booking.reference}</Mono>
                  <small>{new Date(booking.created_at).toLocaleDateString("en-PH", { dateStyle: "medium" })}</small>
                </span>
                <span>
                  <Status tone={booking.booking_status === "confirmed" ? "success" : "warning"}>{booking.booking_status}</Status>
                  <Mono>₱{Number(booking.total).toLocaleString("en-PH")}</Mono>
                </span>
              </Link>
            ))}
          </div>
        ) : !error ? (
          <div className="real-empty">
            <h3>No bookings yet</h3>
            <p>Your real VanGO bookings will appear here after you reserve and confirm a trip.</p>
          </div>
        ) : null}
      </section>
    </PassengerShell>
  );
}

export function LiveSeatBooking() {
  const params = useSearchParams();
  const tripId = params.get("trip") ?? "";
  const requestedPassengers = Math.min(8, Math.max(1, Number(params.get("passengers") ?? 2)));
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

  return (
    <PassengerShell title="Choose your seats" back="/passenger/trips">
      <div className="step-heading">
        <div>
          <span>STEP 1 OF 3</span>
          <h1>Choose your seats</h1>
        </div>
      </div>
      {!tripId ? (
        <div className="real-empty">
          <h3>No trip selected</h3>
          <p>Search for a published trip before choosing seats.</p>
          <Link className="button button-primary" href="/passenger/trips">Search trips</Link>
        </div>
      ) : null}
      {error ? <div className="form-message error">{error}</div> : null}
      {loading ? <div className="real-empty"><h3>Checking seat availability…</h3></div> : null}
      {!loading && tripId ? (
        <>
          <div className="seat-legend">
            <span><i className="available" />Available</span>
            <span><i className="selected" />Selected</span>
            <span><i className="occupied" />Occupied</span>
            <span><i className="reserved" />PWD / senior</span>
            <LiveDot status={seatStatus} />
          </div>
          <div className="vehicle-shell">
            <div className="driver-row">
              <span className="wheel">◎</span>
              <small>DRIVER · FRONT</small>
            </div>
            <div className="live-seat-grid">
              {seats.map((seat) => (
                <button
                  type="button"
                  key={seat.seat_id}
                  className={`seat ${selected.includes(seat.seat_code) ? "selected" : ""} ${seat.seat_state !== "available" ? "occupied" : ""} ${seat.is_accessibility ? "reserved" : ""}`}
                  disabled={seat.seat_state !== "available"}
                  aria-pressed={selected.includes(seat.seat_code)}
                  onClick={() => toggle(seat)}
                >
                  {seat.seat_code}
                </button>
              ))}
            </div>
          </div>
          <div className="sticky-booking-bar">
            <div>
              <span>{selected.length} of {requestedPassengers} selected</span>
              <strong>{selected.join(", ") || "Choose available seats"}</strong>
            </div>
            <button
              className="button button-primary"
              type="button"
              disabled={selected.length !== requestedPassengers || loading}
              onClick={() => void continueBooking()}
            >
              Continue
            </button>
          </div>
        </>
      ) : null}
    </PassengerShell>
  );
}

export function LiveCheckout() {
  const holdGroup = useSearchParams().get("hold") ?? "";
  const [holds, setHolds] = useState<Hold[]>([]);
  const [tripFare, setTripFare] = useState(650);
  const [expiresAt, setExpiresAt] = useState("");
  const [promoCode, setPromoCode] = useState("SUMMER100");
  const [paymentMethod, setPaymentMethod] = useState("gcash");
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
        setTripFare(Number((trip as { fare: number | string } | null)?.fare ?? 650));
      }
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }, [holdGroup]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useLiveTables(["seat_holds", "trips"], load);

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

  const subtotal = tripFare * (holds.length || 2);
  const bookingFee = 30;
  const discount = promoCode === "SUMMER100" ? 100 : 0;
  const total = subtotal + bookingFee - discount;

  return (
    <PassengerShell title="Passenger details" back="/passenger/seats">
      <div className="step-heading compact">
        <div>
          <span>STEP 2 OF 3</span>
          <h1>Passenger details</h1>
        </div>
        {expiresAt ? <div className="hold-chip">Seats 3A, 3B held for 09:58</div> : null}
      </div>
      {busy ? <div className="real-empty"><h3>Loading secure checkout…</h3></div> : null}
      {error ? <div className="form-message error">{error}</div> : null}
      {!busy && !holds.length ? (
        <div className="real-empty">
          <h3>Seat hold expired or missing</h3>
          <p>Return to trip search and select available seats again.</p>
          <Link className="button button-primary" href="/passenger/trips">Search trips</Link>
        </div>
      ) : null}
      {holds.length ? (
        <form onSubmit={confirm}>
          {holds.map((hold, index) => (
            <section className="form-card" key={hold.id}>
              <div className="form-card-title">
                <b>{hold.trip_seats?.seat_code ?? `3${String.fromCharCode(65 + index)}`}</b>
                <strong>{index === 0 ? "Lead passenger" : `Second passenger`}</strong>
                {index === 0 ? <button type="button">Use my info</button> : null}
              </div>
              <label className="field">
                <span>Full name</span>
                <input name={`name-${index}`} defaultValue={index === 0 ? "Juan Miguel Dela Cruz" : "Maria Clara Reyes"} required />
              </label>
              <div className="field-row">
                <label className="field">
                  <span>Mobile</span>
                  <input name={`mobile-${index}`} type="tel" defaultValue={index === 0 ? "+63 917 845 2218" : "+63 926 771 8808"} required />
                </label>
                <label className="field small">
                  <span>Age</span>
                  <input name={`age-${index}`} type="number" defaultValue={index === 0 ? 32 : 29} required />
                </label>
              </div>
            </section>
          ))}

          <section className="form-card">
            <h2>Payment method</h2>
            <div className="payment-grid">
              <button type="button" className={paymentMethod === "gcash" ? "active" : ""} onClick={() => setPaymentMethod("gcash")}>
                <b>📲</b>
                <span>
                  <strong>GCash</strong>
                  <small>Instant confirmation</small>
                </span>
                <i />
              </button>
              <button type="button" className={paymentMethod === "maya" ? "active" : ""} onClick={() => setPaymentMethod("maya")}>
                <b>💳</b>
                <span>
                  <strong>Maya</strong>
                  <small>E-wallet</small>
                </span>
                <i />
              </button>
              <button type="button" className={paymentMethod === "card" ? "active" : ""} onClick={() => setPaymentMethod("card")}>
                <b>💳</b>
                <span>
                  <strong>Credit or debit card</strong>
                  <small>Visa / Mastercard</small>
                </span>
                <i />
              </button>
            </div>
          </section>

          <section className="fare-card">
            <h2>Fare breakdown</h2>
            <p>
              <span>Seat fare · {holds.length} × ₱{tripFare.toLocaleString("en-PH")}</span>
              <b>₱{subtotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</b>
            </p>
            <p>
              <span>Booking fee</span>
              <b>₱{bookingFee.toFixed(2)}</b>
            </p>
            {discount ? (
              <p className="discount">
                <span>Promo SUMMER100</span>
                <b>-₱{discount.toFixed(2)}</b>
              </p>
            ) : null}
            <div>
              <span>Total</span>
              <strong>₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong>
            </div>
          </section>

          <div className="terms-row">
            <input type="checkbox" id="terms" required defaultChecked />
            <label htmlFor="terms">I have read the terms and cancellation policy. Free cancellation up to 6 hours before departure.</label>
          </div>

          <button className="button button-primary large full" type="submit" disabled={busy}>
            {busy ? "Confirming…" : `Pay now · ₱${total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}
          </button>
        </form>
      ) : null}
    </PassengerShell>
  );
}

export function LiveTicket() {
  const reference = useSearchParams().get("reference") ?? "VG-8H2K41";
  const [booking, setBooking] = useState<Booking | null>(null);
  const [passengers, setPassengers] = useState<Array<{ full_name: string; seat_code: string }>>([
    { full_name: "Juan Miguel Dela Cruz", seat_code: "3A" },
    { full_name: "Maria Clara Reyes", seat_code: "3B" },
  ]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client || !reference) return;
    try {
      const { data, error: bookingError } = await client.from("bookings").select("id,reference,booking_status,payment_status,total,created_at,trip_id,trip:trips(departure_at,arrival_at,gate,organization:organizations(name),route:routes(origin:terminals!routes_origin_terminal_id_fkey(name,city),destination:terminals!routes_destination_terminal_id_fkey(name,city)))").eq("reference", reference).maybeSingle();
      if (bookingError) throw bookingError;
      const current = data as Booking | null;
      if (current) {
        setBooking(current);
        const result = await client.from("booking_passengers").select("full_name,seat_code").eq("booking_id", current.id);
        if (!result.error && result.data?.length) {
          setPassengers(result.data as Array<{ full_name: string; seat_code: string }>);
        }
      }
    } catch (reason) {
      setError(errorText(reason));
    }
  }, [reference]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useLiveTables(["bookings", "payment_intents"], load);

  return (
    <PassengerShell title="Booking confirmed" back="/passenger/bookings">
      <div className="setup-notice">
        <span className="status success">✓ CONFIRMED</span>
        <h1>Booking confirmed</h1>
        <p>We texted your e-ticket to +63 917 845 2218</p>
      </div>

      <article className="ticket-card">
        <div className="ticket-head">
          <div>
            <span>SHOW THIS AT TERMINAL GATE</span>
            <Mono>{reference}</Mono>
          </div>
          <Status tone="success">Confirmed</Status>
        </div>

        <div className="ticket-qr">
          <div className="fake-qr">
            {Array.from({ length: 144 }).map((_, i) => (
              <i key={i} className={(i * 17 + 5) % 3 === 0 ? "on" : ""} />
            ))}
          </div>
          <p>Scan code at Cubao Terminal Gate 3</p>
        </div>

        {booking?.trip ? (
          <div className="ticket-trip">
            <div>
              <small>ROUTE</small>
              <h2>{booking.trip.route?.origin?.city || "Origin"} → {booking.trip.route?.destination?.city || "Destination"}</h2>
              <p>{booking.trip.route?.origin?.name} to {booking.trip.route?.destination?.name}</p>
            </div>
            <div>
              <small>DEPARTURE</small>
              <strong>{new Date(booking.trip.departure_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</strong>
              <span>{booking.trip.organization?.name || "VanGO operator"} · Gate {booking.trip.gate || "TBA"}</span>
            </div>
          </div>
        ) : null}

        <div className="ticket-grid">
          <span>
            <small>DATE</small>
            <b>12 AUG 2026</b>
          </span>
          <span>
            <small>SEATS</small>
            <b>{passengers.map((p) => p.seat_code).join(", ") || "3A, 3B"}</b>
          </span>
          <span>
            <small>VAN</small>
            <b className="mono">NBC-4821</b>
          </span>
          <span>
            <small>TOTAL</small>
            <b className="mono">₱1,230.00</b>
          </span>
        </div>
      </article>

      <div className="ticket-actions">
        <button className="button button-primary large full" type="button">
          📥 Download e-ticket
        </button>
        <button className="button button-outline large full" type="button">
          📅 Add to calendar
        </button>
      </div>

      <Link className="button button-quiet full" href="/passenger/bookings">
        View in My Bookings →
      </Link>
    </PassengerShell>
  );
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
  const [tab, setTab] = useState<"upcoming" | "completed" | "cancelled">("upcoming");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { data, error: queryError } = await client.from("bookings").select("id,reference,booking_status,payment_status,total,created_at,trip_id").order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setError("");
    setRows((data ?? []) as Booking[]);
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useLiveTables(["bookings", "payment_intents", "refunds"], load);

  return (
    <PassengerShell>
      <div className="mobile-page-title">
        <span>MY TRIPS</span>
        <h1>My bookings</h1>
      </div>

      <div className="segmented">
        <button type="button" className={tab === "upcoming" ? "active" : ""} onClick={() => setTab("upcoming")}>
          Upcoming ({rows.length || 1})
        </button>
        <button type="button" className={tab === "completed" ? "active" : ""} onClick={() => setTab("completed")}>
          Completed
        </button>
        <button type="button" className={tab === "cancelled" ? "active" : ""} onClick={() => setTab("cancelled")}>
          Cancelled
        </button>
      </div>

      {error ? <div className="form-message error">{error}</div> : null}

      {tab === "upcoming" ? (
        <>
          {rows.length ? (
            <div className="passenger-booking-grid">
              {rows.map((booking) => (
                <article className="booking-card" key={booking.id}>
                  <div className="booking-card-top">
                    <Mono>{booking.reference}</Mono>
                    <Status tone={booking.booking_status === "confirmed" ? "success" : "warning"}>{booking.booking_status}</Status>
                  </div>
                  <p>Created {new Date(booking.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</p>
                  <div className="booking-meta">
                    <span><small>PAYMENT</small><b>{booking.payment_status.replaceAll("_", " ")}</b></span>
                    <span><small>TOTAL</small><Mono>₱{Number(booking.total).toLocaleString("en-PH")}</Mono></span>
                  </div>
                  <Link className="button button-primary full" href={`/passenger/ticket?reference=${booking.reference}`}>Open booking</Link>
                  {["paid", "partially_refunded"].includes(booking.payment_status) ? <PassengerRefundRequest booking={booking} onDone={load} /> : null}
                </article>
              ))}
            </div>
          ) : (
            <article className="booking-card featured">
              <div className="booking-card-top">
                <Status tone="success">CONFIRMED</Status>
                <Mono>VG-8H2K41</Mono>
              </div>
              <span>DEPARTS IN 18 HOURS</span>
              <h2>Cubao → Baguio</h2>
              <p>12 AUG 2026 · 04:30 AM</p>
              <div className="booking-meta">
                <span>
                  <small>VAN OPERATOR</small>
                  <b>Victory Liner</b>
                </span>
                <span>
                  <small>SEATS</small>
                  <b className="mono">3A, 3B</b>
                </span>
                <span>
                  <small>TOTAL</small>
                  <b className="mono">₱1,230.00</b>
                </span>
              </div>
              <Link className="button button-primary full" href="/passenger/ticket?reference=VG-8H2K41">
                View e-ticket
              </Link>
            </article>
          )}
        </>
      ) : (
        <div className="real-empty">
          <h3>No {tab} bookings</h3>
          <p>Bookings will appear here as you travel with VanGO.</p>
        </div>
      )}
    </PassengerShell>
  );
}

export function LiveProfile() {
  const { profile, refreshContext, signOut } = useAuth();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const form = new FormData(event.currentTarget);
    const { error: updateError } = await client.from("profiles").update({ full_name: String(form.get("full_name") ?? ""), mobile_e164: String(form.get("mobile_e164") ?? "") }).eq("id", profile?.id ?? "");
    if (updateError) setError(updateError.message);
    else { setMessage("Profile updated."); await refreshContext(); }
  }

  return (
    <PassengerShell>
      <div className="profile-head">
        <div className="profile-avatar">JM</div>
        <div>
          <h1>{profile?.full_name || "Juan Miguel Dela Cruz"}</h1>
          <Mono>{profile?.mobile_e164 || "+63 917 845 2218"}</Mono>
        </div>
        <button type="button">Edit</button>
      </div>

      <div className="profile-metrics">
        <div>
          <strong>24</strong>
          <span>Trips taken</span>
        </div>
        <div>
          <strong>₱14K</strong>
          <span>Spent in 2026</span>
        </div>
        <div>
          <strong>4.9</strong>
          <span>Your rating</span>
        </div>
      </div>

      <div className="settings-card">
        <h2>PERSONAL INFO</h2>
        <p>
          <span>Email</span>
          <b>juan.delacruz@gmail.com</b>
        </p>
        <p>
          <span>Mobile</span>
          <b>+63 917 845 2218</b>
        </p>
        <p>
          <span>PWD / senior ID</span>
          <small>Not added</small>
        </p>
      </div>

      <div className="settings-card">
        <h2>SAVED PAYMENT</h2>
        <p>
          <span>GCash · Juan D.</span>
          <small>Default</small>
        </p>
        <p>
          <span>BPI Debit</span>
          <small>Card</small>
        </p>
      </div>

      <div className="settings-card">
        <h2>NOTIFICATIONS</h2>
        <div className="toggle-row">
          <span>
            <b>Trip reminders</b>
            <small>2 hours before departure</small>
          </span>
          <input type="checkbox" defaultChecked />
        </div>
        <div className="toggle-row">
          <span>
            <b>Delay and gate changes</b>
          </span>
          <input type="checkbox" defaultChecked />
        </div>
        <div className="toggle-row">
          <span>
            <b>Promotions and offers</b>
          </span>
          <input type="checkbox" />
        </div>
      </div>

      <button className="logout-button" type="button" onClick={() => void signOut()}>
        Log out
      </button>
    </PassengerShell>
  );
}

export function LiveAlerts() {
  const [rows, setRows] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => { const client = getSupabaseBrowserClient(); if (!client) return; const { data, error: queryError } = await client.from("notifications").select("id,type,title,body,action_path,read_at,created_at").order("created_at", { ascending: false }); if (queryError) setError(queryError.message); setRows((data ?? []) as Notification[]); }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useLiveTables(["notifications"], load);
  async function markRead(id: string) { const client = getSupabaseBrowserClient(); if (!client) return; await client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id); await load(); }
  return (
    <PassengerShell>
      <div className="mobile-page-title">
        <span>UPDATES</span>
        <h1>Notifications</h1>
      </div>
      {error ? <div className="form-message error">{error}</div> : null}
      <div className="alert-list">
        {rows.map((item) => (
          <article className={item.read_at ? "" : "unread"} key={item.id}>
            <i />
            <div>
              <Status tone="info">{item.type.replaceAll("_", " ")}</Status>
              <h2>{item.title}</h2>
              <p>{item.body}</p>
              <small>{new Date(item.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</small>
              <div className="alert-actions">
                {item.action_path ? <Link className="button button-primary" href={item.action_path}>Open</Link> : null}
                {!item.read_at ? <button className="button button-outline" type="button" onClick={() => void markRead(item.id)}>Mark as read</button> : null}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!rows.length && !error ? (
        <div className="real-empty">
          <h3>No notifications</h3>
          <p>Booking confirmations and trip updates will appear here.</p>
        </div>
      ) : null}
    </PassengerShell>
  );
}
