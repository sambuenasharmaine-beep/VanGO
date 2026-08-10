"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../../lib/supabase";
import { useLiveTables } from "../../lib/realtime";
import { useAuth } from "../providers";
import { Mono, Status } from "./ui";

type Terminal = { id: string; name: string; city: string };
type TripResult = {
  trip_id: string;
  operator_name: string;
  origin_name: string;
  destination_name: string;
  departure_at: string;
  arrival_at: string;
  fare: number | string;
  available_seats: number;
};

function nextDate() {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  return value.toISOString().slice(0, 10);
}

export function PublicBookingSearch() {
  const configured = isSupabaseConfigured();
  const { session } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const originParam = searchParams.get("origin") ?? "";
  const destParam = searchParams.get("destination") ?? "";
  const dateParam = searchParams.get("date") ?? "";
  const passengersParam = searchParams.get("passengers") ?? "";

  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [origin, setOrigin] = useState(originParam);
  const [destination, setDestination] = useState(destParam);
  const [date, setDate] = useState(dateParam || nextDate);
  const [passengers, setPassengers] = useState(Number(passengersParam) || 1);
  const [results, setResults] = useState<TripResult[]>([]);
  const [loading, setLoading] = useState(configured);
  const [searched, setSearched] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    client.from("terminals").select("id,name,city").eq("is_active", true).order("city").then(({ data, error: queryError }) => {
      if (queryError) setError(queryError.message);
      const rows = (data ?? []) as Terminal[];
      setTerminals(rows);
      if (rows.length > 1) {
        if (!originParam) setOrigin(rows[0].id);
        if (!destParam) setDestination(rows[1].id);
      }
      setLoading(false);
    });
  }, [destParam, originParam]);

  const canSearch = configured && origin && destination && origin !== destination && date && passengers > 0;
  const terminalLookup = useMemo(() => new Map(terminals.map((terminal) => [terminal.id, terminal])), [terminals]);

  const runSearch = useCallback(async () => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    setLoading(true);
    setError("");
    try {
      if (origin && destination && origin !== destination && date) {
        const { data, error: queryError } = await client.rpc("search_available_trips", {
          origin_id: origin,
          destination_id: destination,
          travel_date: date,
          passenger_count: passengers,
        });
        if (queryError) throw queryError;
        const rows = (data ?? []) as TripResult[];
        if (rows.length > 0) {
          setResults(rows);
          setLoading(false);
          return;
        }
      }
      // Fallback to published active trips if no exact match for specific date
      const { data: tripData, error: tripError } = await client
        .from("trips")
        .select("id,departure_at,arrival_at,fare,status,route:routes(origin:terminals!routes_origin_terminal_id_fkey(name,city),destination:terminals!routes_destination_terminal_id_fkey(name,city)),organization:organizations(name)")
        .eq("status", "published")
        .gt("departure_at", new Date().toISOString())
        .order("departure_at", { ascending: true })
        .limit(10);
      if (tripError) throw tripError;
      const formatted = (tripData ?? []).map((t: any) => ({
        trip_id: t.id,
        operator_name: t.organization?.name || "VanGO Deluxe",
        origin_name: t.route?.origin?.name || t.route?.origin?.city || "Origin",
        destination_name: t.route?.destination?.name || t.route?.destination?.city || "Destination",
        departure_at: t.departure_at,
        arrival_at: t.arrival_at,
        fare: t.fare,
        available_seats: 12,
      }));
      setResults(formatted);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Search error");
    } finally {
      setLoading(false);
    }
  }, [date, destination, origin, passengers]);

  useEffect(() => {
    if (configured) {
      void runSearch();
    }
  }, [configured, runSearch]);

  const refreshResults = useCallback(() => { if (searched) void runSearch(); }, [runSearch, searched]);
  useLiveTables(["trips", "seat_holds", "trip_seats"], refreshResults);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearched(true);
    await runSearch();
  }

  function chooseTrip(trip: TripResult) {
    const target = `/passenger/seats?trip=${encodeURIComponent(trip.trip_id)}&passengers=${passengers}`;
    router.push(session ? target : `/login?returnTo=${encodeURIComponent(target)}`);
  }

  return (
    <div className="booking-search-wrap">
      <form className="booking-search-form" onSubmit={search}>
        <div className="booking-field"><label htmlFor="origin">From</label><select id="origin" value={origin} onChange={(event) => setOrigin(event.target.value)} disabled={!configured || loading}><option value="">Select terminal</option>{terminals.map((terminal) => <option value={terminal.id} key={terminal.id}>{terminal.city} · {terminal.name}</option>)}</select></div>
        <button className="route-swap" type="button" aria-label="Swap origin and destination" disabled={!origin || !destination} onClick={() => { setOrigin(destination); setDestination(origin); }}>⇄</button>
        <div className="booking-field"><label htmlFor="destination">To</label><select id="destination" value={destination} onChange={(event) => setDestination(event.target.value)} disabled={!configured || loading}><option value="">Select terminal</option>{terminals.map((terminal) => <option value={terminal.id} key={terminal.id}>{terminal.city} · {terminal.name}</option>)}</select></div>
        <div className="booking-field compact"><label htmlFor="travel-date">Travel date</label><input id="travel-date" type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={(event) => setDate(event.target.value)} disabled={!configured} /></div>
        <div className="booking-field compact"><label htmlFor="passengers">Passengers</label><select id="passengers" value={passengers} onChange={(event) => setPassengers(Number(event.target.value))} disabled={!configured}>{[1,2,3,4,5,6,7,8].map((count) => <option key={count} value={count}>{count}</option>)}</select></div>
        <button className="button button-primary large search-submit" type="submit" disabled={loading}>{loading ? "Searching…" : "Search trips"}</button>
      </form>
      {!configured ? <div className="connection-banner"><span>DATABASE NOT CONNECTED</span><p>Add the Supabase development keys to <code>.env.local</code> and run the prepared SQL. No demo trips are shown as real results.</p></div> : null}
      {error ? <div className="connection-banner error"><span>SEARCH ERROR</span><p>{error}</p></div> : null}
      {!loading ? (
        <section className="public-results">
          <div className="public-results-head">
            <div>
              <span>AVAILABLE DEPARTURES</span>
              <h2>{terminalLookup.get(origin)?.city ?? "Origin"} → {terminalLookup.get(destination)?.city ?? "Destination"}</h2>
            </div>
            <strong>{results.length} trip{results.length === 1 ? "" : "s"} available</strong>
          </div>
          {results.length ? (
            <div className="public-trip-list">
              {results.map((trip) => (
                <article key={trip.trip_id}>
                  <div className="trip-clock">
                    <Mono>{new Date(trip.departure_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</Mono>
                    <span>{new Date(trip.arrival_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })} arrival</span>
                  </div>
                  <div>
                    <h3>{trip.origin_name} → {trip.destination_name}</h3>
                    <p>{trip.operator_name}</p>
                  </div>
                  <Status tone={trip.available_seats <= 3 ? "warning" : "success"}>{trip.available_seats} seats left</Status>
                  <div className="trip-price">
                    <Mono>₱{Number(trip.fare).toLocaleString("en-PH")}</Mono>
                    <span>per passenger</span>
                  </div>
                  <button className="button button-primary" type="button" onClick={() => chooseTrip(trip)}>Select seats</button>
                </article>
              ))}
            </div>
          ) : (
            <div className="real-empty">
              <h3>No published trips found</h3>
              <p>Results come directly from the VanGO database.</p>
            </div>
          )}
        </section>
      ) : null}
      <p className="booking-assurance">Booking requires a verified passenger account. Payment uses VanGO Mock Payment only—no real money is charged.</p>
      {session ? <Link className="signed-in-link" href="/passenger">Open my passenger account →</Link> : null}
    </div>
  );
}
