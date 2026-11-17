import { useEffect, useState } from "react";

const COLLAPSE_KEY = "lamma-collapsed";
const AUTO_COLLAPSE_BELOW = 1280;

function readCollapsePreference(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Sidebar collapse: the owner's saved choice on wide screens, and an automatic icon rail below 1280px. */
export function useSidebarCollapse() {
  const [preferCollapsed, setPreferCollapsed] = useState(readCollapsePreference);
  const [narrow, setNarrow] = useState(() => window.innerWidth < AUTO_COLLAPSE_BELOW);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < AUTO_COLLAPSE_BELOW);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const toggle = () => {
    setPreferCollapsed((value) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1");
      } catch {
        // Storage can be unavailable (private mode); the preference just won't persist.
      }

      return !value;
    });
  };

  return { collapsed: preferCollapsed || narrow, toggle };
}
