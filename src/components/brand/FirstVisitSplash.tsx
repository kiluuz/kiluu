import { LogoMark } from "./LogoMark";

export function FirstVisitSplash() {
  return (
    <div id="kiluu-first-visit" className="kiluu-splash" aria-hidden="true">
      <div className="kiluu-splash__content">
        <LogoMark size={96} animated="draw" decorative />
        <strong>Kiluu</strong>
        <span>STREAM · COLLECT · GIFT</span>
      </div>
    </div>
  );
}

