export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Calls `step` with 0..1 on each frame, for motion Animated can't drive, like arcs and bites. */
export function frames(ms: number, step: (k: number) => void) {
  return new Promise<void>((resolve) => {
    const start = Date.now();
    const tick = () => {
      const k = ms <= 0 ? 1 : Math.min(1, (Date.now() - start) / ms);
      step(k);
      if (k < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}
