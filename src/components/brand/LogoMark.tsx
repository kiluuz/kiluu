import { useId, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { ENSO_PATH, KANJI_PATH, KANJI_SHADOW_PATH } from "./logo-paths";

export type LogoVariant = "mark" | "icon" | "lockup";
export type LogoAnimation = "none" | "draw" | "loop";
export type LogoTheme = "auto" | "dark" | "light" | "system";

export interface LogoMarkProps {
  size?: number;
  variant?: LogoVariant;
  animated?: LogoAnimation;
  theme?: LogoTheme;
  className?: string;
  style?: CSSProperties;
  decorative?: boolean;
  "aria-label"?: string;
}

export function LogoMark({
  size = 40,
  variant = "mark",
  animated = "none",
  theme = "auto",
  className,
  style,
  decorative = false,
  "aria-label": ariaLabel = "Kiluu",
}: LogoMarkProps) {
  const icon = variant === "icon";
  const lockup = variant === "lockup";
  const gradientId = `kiluu-icon-paper-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const rootStyle = {
    "--logo-size": `${size}px`,
    ...style,
  } as CSSProperties;

  return (
    <span
      className={cn("kiluu-logo", className)}
      data-animation={animated}
      data-theme={theme}
      data-variant={variant}
      style={rootStyle}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : ariaLabel}
      aria-hidden={decorative || undefined}
    >
      <svg
        className="kiluu-logo__svg"
        viewBox="0 0 200 200"
        width={size}
        height={size}
        focusable="false"
        aria-hidden="true"
      >
        {icon && (
          <>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#f7f0e0" />
                <stop offset="1" stopColor="#ddd0b2" />
              </linearGradient>
            </defs>
            <rect width="200" height="200" rx="46" fill={`url(#${gradientId})`} />
          </>
        )}
        <g className="kiluu-logo__enso">
          <path d={ENSO_PATH} fill={icon ? "#15110e" : "var(--logo-enso)"} />
        </g>
        <g className="kiluu-logo__kanji">
          <path
            d={KANJI_SHADOW_PATH}
            fill="var(--logo-accent-shadow)"
            transform="translate(60 136.92) scale(.084 -.084)"
          />
          <path
            d={KANJI_PATH}
            fill="var(--logo-accent)"
            transform="translate(58 133.92) scale(.084 -.084)"
          />
        </g>
      </svg>
      {lockup && <span className="kiluu-logo__wordmark">Kiluu</span>}
    </span>
  );
}
