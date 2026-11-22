import { LammaArt } from "@/assets/illustrations/lammaArt";
import { prefersReducedMotion } from "../CountUp";

/**
 * Flies a brand sticker on an arc from a rectangle (where something was) to a target element (where it went), then
 * bumps the target. Decorative and fire-and-forget: it does nothing with reduced motion or without the Web Animations
 * API, and the element removes itself when done.
 */
export function flyTo(from: DOMRect, target: Element | null, sticker = "parcel"): void {
  if (!target || prefersReducedMotion() || typeof document.body.animate !== "function") return;
  const to = target.getBoundingClientRect();
  const size = 44;
  const x0 = from.left + from.width / 2 - size / 2;
  const y0 = from.top + from.height / 2 - size / 2;
  const x1 = to.left + to.width / 2 - size / 2;
  const y1 = to.top + to.height / 2 - size / 2;
  const lift = Math.min(160, 60 + Math.abs(x1 - x0) * 0.25);

  const el = document.createElement("span");
  el.className = "flyer";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = LammaArt.sticker(sticker); // static brand SVG, never user input
  el.style.left = `${x0}px`;
  el.style.top = `${y0}px`;
  document.body.appendChild(el);

  const dx = x1 - x0;
  const dy = y1 - y0;
  const flight = el.animate(
    [
      { transform: "translate(0, 0) scale(.6) rotate(0deg)", opacity: 0 },
      { transform: "translate(0, -14px) scale(1.1) rotate(-8deg)", opacity: 1, offset: 0.12 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) scale(1) rotate(-200deg)`, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(.55) rotate(-360deg)`, opacity: 1 },
    ],
    { duration: 820, easing: "cubic-bezier(.45, 0, .25, 1)" },
  );
  flight.onfinish = () => {
    el.remove();
    target.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(.97)" }, { transform: "scale(1)" }],
      { duration: 420, easing: "ease-out" },
    );
  };
  flight.oncancel = () => el.remove();
}
