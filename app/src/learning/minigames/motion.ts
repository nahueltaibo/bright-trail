export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Calls `step` with 0..1 on each frame, for motion Animated can't drive, like arcs and bites.
 * Stops early, without another step, once `alive` turns false.
 */
export function frames(ms: number, step: (k: number) => void, alive: () => boolean = () => true) {
  return new Promise<void>((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (!alive()) {
        resolve();
        return;
      }
      const k = ms <= 0 ? 1 : Math.min(1, (Date.now() - start) / ms);
      step(k);
      if (k < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}
