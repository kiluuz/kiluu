"use client";

import { useEffect } from "react";
import { LogoMark } from "@/components/brand/LogoMark";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route rendering failed", error);
  }, [error]);

  return (
    <main className="kiluu-message">
      <LogoMark size={72} />
      <h1>Something went wrong</h1>
      <p>Please try again. The error has been recorded for review.</p>
      <button type="button" onClick={reset}>Try again</button>
    </main>
  );
}
