import { LogoMark } from "./LogoMark";

export function PageLoader({
  title = "Kiluu",
  caption = "Loading…",
  fullScreen = true,
}: {
  title?: string;
  caption?: string;
  fullScreen?: boolean;
}) {
  return (
    <div
      className={fullScreen ? "kiluu-loader kiluu-loader--screen" : "kiluu-loader"}
      role="status"
      aria-live="polite"
      aria-label={`${title}: ${caption}`}
    >
      <LogoMark size={88} animated="loop" />
      <h1 className="kiluu-loader__title">{title}</h1>
      <p className="kiluu-loader__caption">{caption}</p>
    </div>
  );
}

