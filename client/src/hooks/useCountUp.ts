import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Eases a figure from its previous value to `target` over `duration` ms and
 * returns the value for the current frame. Under reduced motion, or without
 * requestAnimationFrame, it returns `target` straight away.
 *
 * Only the drawn digits animate: callers keep the real number in the
 * accessible name so a screen reader never announces a half-counted value.
 */
export function useCountUp(target: number, duration = 600): number {
  const animate = !prefersReducedMotion() && typeof requestAnimationFrame === 'function' && duration > 0;
  const [value, setValue] = useState(animate ? 0 : target);
  const shown = useRef(value);

  useEffect(() => {
    if (!animate) {
      shown.current = target;
      setValue(target);
      return;
    }
    const from = shown.current;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const next = Math.round(from + (target - from) * eased);
      shown.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, animate]);

  return value;
}
