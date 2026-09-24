import { useEffect, useRef } from 'react';

// Attaches an IntersectionObserver to every ".reveal" element inside the
// returned container ref, adding "is-visible" once each scrolls into view.
// Re-scans whenever `deps` changes (e.g. a tab switch or new items being
// added), so freshly-mounted cards are picked up correctly.
export default function useRevealObserver(deps = []) {
  const containerRef = useRef(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      root.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    const elements = root.querySelectorAll('.reveal:not(.is-visible)');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return containerRef;
}
