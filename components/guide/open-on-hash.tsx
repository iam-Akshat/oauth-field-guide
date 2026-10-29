"use client";

import { useEffect } from "react";

/** Opens the collapsed section that holds the URL's #target, e.g. a cited source. */
export function OpenOnHash() {
  useEffect(() => {
    const reveal = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const el = id ? document.getElementById(id) : null;
      const details = el?.closest("details");
      if (el && details && !details.open) {
        details.open = true;
        el.scrollIntoView({ block: "start" });
      }
    };
    // Same-hash clicks don't fire hashchange, so also check after in-page link clicks.
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('a[href^="#"]')) requestAnimationFrame(reveal);
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", reveal);
      document.removeEventListener("click", onClick);
    };
  }, []);
  return null;
}
