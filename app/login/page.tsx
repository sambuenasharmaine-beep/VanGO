import { Brand } from "../components/ui";
import { AuthForm } from "../components/auth-form";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <div className="auth-aside">
        <Brand inverse />
        <div><div className="eyebrow amber">WELCOME BACK</div><h1>Your next trip is already closer.</h1><p>Book, manage, and operate journeys from one trusted transport platform.</p></div>
        <span>Secure passenger and staff access</span>
      </div>
      <div><div className="mobile-brand"><Brand /></div><AuthForm /></div>
    </main>
  );
}
