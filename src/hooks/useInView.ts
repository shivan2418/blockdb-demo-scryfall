import { useEffect, useRef, useState } from "react";

/**
 * Reports once an element first reaches the viewport, then stops observing.
 *
 * `loading="lazy"` alone is only a hint — browsers fetch well past the fold
 * with it — so image `src` is gated on this instead, keeping a 60-card page to
 * the handful of requests the user can actually see.
 */
export function useInView<T extends Element>(rootMargin = "200px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}
