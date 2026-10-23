"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { LogoMark, type LogoAnimation, type LogoTheme } from "@/components/brand/LogoMark";

export type LogoState = "idle" | "playing" | "intro";

export interface LogoProps {
  variant?: "full" | "mark";
  theme?: "dark" | "light" | "mono";
  size?: number;
  animated?: boolean;
  state?: LogoState;
  tagline?: boolean;
  className?: string;
  style?: CSSProperties;
  href?: string;
  onClick?: () => void;
  "aria-label"?: string;
}

export function Logo({
  variant = "full",
  theme,
  size = 36,
  animated = true,
  state = "idle",
  tagline = false,
  className,
  style,
  href,
  onClick,
  "aria-label": ariaLabel = "Kiluu",
}: LogoProps) {
  const animation: LogoAnimation = !animated
    ? "none"
    : state === "intro"
      ? "draw"
      : "loop";
  const markTheme: LogoTheme = theme === "mono" ? "dark" : theme ?? "auto";
  const sharedClassName = cn("kiluu-logo-control", tagline && "kiluu-logo-control--tagline", className);
  const content = (
    <>
      <LogoMark
        variant={variant === "full" ? "lockup" : "mark"}
        size={size}
        animated={animation}
        theme={markTheme}
        decorative
      />
      {tagline && <span className="kiluu-logo-tagline">STREAM · COLLECT · GIFT</span>}
    </>
  );

  if (href) {
    return (
      <a href={href} onClick={onClick} className={sharedClassName} style={style} aria-label={ariaLabel}>
        {content}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={sharedClassName} style={style} aria-label={ariaLabel}>
        {content}
      </button>
    );
  }
  return (
    <span className={sharedClassName} style={style} role="img" aria-label={ariaLabel}>
      {content}
    </span>
  );
}
