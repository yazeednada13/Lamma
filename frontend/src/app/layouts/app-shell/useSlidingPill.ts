import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

/**
 * The sidebar's sliding active "pill" (prototype): measures the active `.sb__item` inside the nav and moves the
 * pill to it. First placement jumps; later moves glide. Re-measures when `layoutKey` changes, fonts load, or the
 * nav resizes.
 */
export function useSlidingPill(layoutKey: string) {
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  const place = useCallback(() => {
    const active = navRef.current?.querySelector<HTMLElement>(".sb__item.is-active");
    const pill = pillRef.current;
    if (!pill) {
      return;
    }

    if (!active) {
      pill.style.opacity = "0";
      return;
    }

    const first = !placed.current;
    if (first) {
      pill.style.transition = "none";
    }

    pill.style.height = `${active.offsetHeight}px`;
    pill.style.transform = `translateY(${active.offsetTop}px)`;
    pill.style.opacity = "1";
    if (first) {
      void pill.offsetHeight; // commit the position before re-enabling transitions
      pill.style.transition = "";
      placed.current = true;
    }
  }, []);

  // Re-place whenever the caller's layout inputs (active section, collapsed state) change.
  useLayoutEffect(place, [place, layoutKey]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) {
      return;
    }

    void document.fonts?.ready.then(place);
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(place);
    observer.observe(nav);
    nav.querySelectorAll(".sb__sub").forEach((sub) => observer.observe(sub));
    return () => observer.disconnect();
  }, [place]);

  return { navRef, pillRef };
}
