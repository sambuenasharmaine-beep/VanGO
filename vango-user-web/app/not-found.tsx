import Link from "next/link";
import { Brand } from "./components/ui";

export default function NotFound() {
  return <main className="route-state"><Brand /><span>404</span><h1>This stop is not on the route.</h1><p>The page may have moved or the address may be incorrect.</p><Link className="primary-button" href="/user">Return home</Link></main>;
}
