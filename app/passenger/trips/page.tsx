import { PublicBookingSearch } from "../../components/public-booking";
import { PassengerShell } from "../../components/shells";
export default function Page() { return <PassengerShell title="Search trips" back="/passenger"><PublicBookingSearch /></PassengerShell>; }
