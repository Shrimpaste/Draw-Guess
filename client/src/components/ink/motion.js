import { useEffect, useState } from "react";

const query = "(prefers-reduced-motion: reduce)";
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof matchMedia === "function" && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return undefined;
    const media = matchMedia(query);
    const update = () => setReduced(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  return reduced;
}
