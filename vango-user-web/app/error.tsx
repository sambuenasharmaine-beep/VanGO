"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="route-state"><span>VANGO</span><h1>We could not load this stop.</h1><p>Your account data was not replaced with sample content. Try the request again.</p><button className="primary-button" type="button" onClick={reset}>Try again</button></main>;
}
