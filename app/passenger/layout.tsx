import { redirect } from "next/navigation";

export default function PassengerLayout({ children }: { children: React.ReactNode }) {
  redirect("/user");
}
