import { PassengerShell } from "../../components/shells";

export default function Page() {
  return (
    <PassengerShell>
      <div className="mobile-page-title">
        <span>HELP & SUPPORT</span>
        <h1>Support center</h1>
      </div>
      <section className="settings-card">
        <h2>NEED HELP WITH A BOOKING?</h2>
        <p>
          <span>Frequently Asked Questions</span>
          <b>View FAQ</b>
        </p>
        <p>
          <span>Baggage Allowance Policy</span>
          <b>15kg per seat</b>
        </p>
        <p>
          <span>Cancellation Policy</span>
          <b>Free cancellation up to 6 hrs</b>
        </p>
      </section>
      <section className="settings-card">
        <h2>CONTACT US</h2>
        <p>
          <span>Hotline</span>
          <b>+63 (02) 8888-VANGO</b>
        </p>
        <p>
          <span>Email Support</span>
          <b>support@vango.ph</b>
        </p>
      </section>
    </PassengerShell>
  );
}
