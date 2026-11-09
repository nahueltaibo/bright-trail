import { z } from 'zod';

/** Most hops a play-out makes. More takes too long to watch. */
export const MAX_HOPS = 20;

export const HopLegSchema = z.object({
  /** Hop size. Negative hops go back. */
  by: z.number().refine((v) => v !== 0, 'a hop must move'),
  times: z.number().int().min(1).max(MAX_HOPS),
});

/** The frog's path after an answer: it starts at `start`, then makes each leg's hops in turn. */
export const HopsSchema = z.object({
  start: z.number(),
  legs: z.array(HopLegSchema).max(4),
});
export type Hops = z.infer<typeof HopsSchema>;

type Line = { min: number; max: number; step: number; target: number };

const tidy = (v: number) => Number(v.toFixed(9));
const onStep = (v: number, l: Line) => {
  const k = (v - l.min) / l.step;
  return Math.abs(k - Math.round(k)) < 1e-6;
};

/** Where the frog lands after each hop, in order. */
export function hopLandings(h: Hops): number[] {
  const out: number[] = [];
  let v = h.start;
  for (const leg of h.legs) {
    for (let i = 0; i < leg.times; i++) {
      v = tidy(v + leg.by);
      out.push(v);
    }
  }
  return out;
}

/** Why the path can't play on this line. Empty when it can. */
export function hopsProblems(line: Line, h: Hops): string[] {
  const problems: string[] = [];
  const landings = hopLandings(h);
  const end = landings.at(-1) ?? h.start;
  if (Math.abs(end - line.target) > 1e-9) {
    problems.push(`the frog lands on ${end} but the answer is ${line.target}`);
  }
  if (landings.length > MAX_HOPS) problems.push(`${landings.length} hops is more than ${MAX_HOPS}`);
  for (const v of [h.start, ...landings]) {
    if (v < line.min - 1e-9 || v > line.max + 1e-9) {
      problems.push(`${v} is off the line`);
      break;
    }
    if (!onStep(v, line)) {
      problems.push(`${v} is between the line's steps`);
      break;
    }
  }
  return problems;
}

/**
 * A path for a plain "move the frog to N": from the line's start, hop by the line's step, or by
 * place value when that takes too many hops. 165 on a line of 5s is 3 hops of 50, then 3 of 5.
 */
export function defaultHops(line: Line): Hops {
  const steps = Math.round((line.target - line.min) / line.step);
  const sign = Math.sign(steps);
  let left = Math.abs(steps);
  const legs: Hops['legs'] = [];
  if (left <= 10) {
    if (left > 0) legs.push({ by: tidy(sign * line.step), times: left });
    return { start: line.min, legs };
  }
  for (const k of [1000, 100, 10, 1]) {
    const times = Math.floor(left / k);
    if (times > 0) legs.push({ by: tidy(sign * k * line.step), times });
    left -= times * k;
  }
  return { start: line.min, legs };
}
