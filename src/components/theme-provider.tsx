"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// React 19 / Next.js 16 compatibility:
// next-themes injects an inline script to prevent theme flash (FOUC).
// React 19 warns with "Encountered a script tag while rendering React component",
// which Next.js development server turns into an error overlay.
if (typeof console !== "undefined") {
  const origError = console.error;
  if (!(origError as any).__scriptTagFiltered) {
    const filteredConsoleError = (...args: unknown[]) => {
      if (
        typeof args[0] === "string" &&
        args[0].includes("Encountered a script tag while rendering React component")
      ) {
        return;
      }
      origError.apply(console, args);
    };
    (filteredConsoleError as any).__scriptTagFiltered = true;
    console.error = filteredConsoleError;
  }
}

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
