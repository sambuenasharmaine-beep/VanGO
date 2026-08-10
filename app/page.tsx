import Link from "next/link";
import { PublicBookingSearch } from "./components/public-booking";
import { Brand } from "./components/ui";

export default function Home() {
  return (
    <main className="public-home">
      <header className="public-nav"><Brand inverse /><nav aria-label="Public navigation"><a href="#booking">Book a trip</a><a href="#how-it-works">How it works</a><Link className="button button-primary" href="/login">Sign in</Link></nav></header>
      <section className="public-hero" id="booking"><div className="public-copy"><div className="eyebrow amber">PHILIPPINE PROVINCIAL TRAVEL</div><h1>Your next journey starts here.</h1><p>Search published trips, reserve an available seat, and keep your confirmed ticket in one secure account.</p></div><PublicBookingSearch /></section>
      <section className="how-grid" id="how-it-works"><article><span>01</span><h2>Search live schedules</h2><p>Choose real terminals and dates published by connected transport operators.</p></article><article><span>02</span><h2>Hold your seat</h2><p>Selected seats are protected by a timed database hold to prevent double booking.</p></article><article><span>03</span><h2>Confirm safely</h2><p>Complete the mock payment flow. No real money is charged, while your booking and ticket are recorded.</p></article></section>
      <footer className="public-footer"><Brand inverse /><p>VanGO passenger transport platform</p><Link href="/login">Staff sign in</Link></footer>
    </main>
  );
}
