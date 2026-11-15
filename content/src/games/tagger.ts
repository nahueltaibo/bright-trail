import type { ContentBundle, Item } from '@bright-trail/shared';
import type { LlmClient, LlmRequest } from '../graph/llm';

/** One minigame's content tagger: which items to ask about, how to ask, and what to keep. */
export type Tagger<I extends Item = Item, G = unknown> = {
  /** The reviewed source of truth under content/, such as `join.json`. */
  file: string;
  /** What a tag makes an item do, as in "80 items play as join scenes". */
  outcome: string;
  /** Prefixes each tag the bundle build drops because it no longer fits. */
  label: string;
  /** Skills with fewer candidates are skipped, since a few hits are word matches in another topic. */
  minPerSkill: number;
  candidates(items: readonly Item[]): I[];
  request(skillId: string, items: readonly I[]): LlmRequest;
  accept(
    items: readonly I[],
    output: unknown,
  ): { tagged: Record<string, G>; rejected: Record<string, string> };
  apply(
    bundle: ContentBundle,
    tagged: Readonly<Record<string, G>>,
  ): { bundle: ContentBundle; dropped: string[] };
};

export type TagRun<G> = {
  /** Tags by item id, sorted by id. */
  tagged: Record<string, G>;
  /** `itemId: why` for each item the LLM tagged but the checks refused, sorted. */
  rejected: string[];
  /** `skillId: message` for each call that failed. */
  failed: string[];
};

/**
 * The tagger's candidates by skill, one LLM call each. `few` holds the candidates of skills
 * below `minPerSkill`, which get no call.
 */
export function groupCandidates<I extends Item>(
  tagger: Pick<Tagger<I>, 'candidates' | 'minPerSkill'>,
  items: readonly Item[],
): { bySkill: Map<string, I[]>; few: I[] } {
  const bySkill = new Map<string, I[]>();
  for (const item of tagger.candidates(items)) {
    bySkill.set(item.skillId, [...(bySkill.get(item.skillId) ?? []), item]);
  }
  const few: I[] = [];
  for (const [id, group] of bySkill) {
    if (group.length >= tagger.minPerSkill) continue;
    few.push(...group);
    bySkill.delete(id);
  }
  return { bySkill, few };
}

/**
 * Groups the tagger's candidates by skill, then makes one LLM call per skill. Reports
 * `skillId: n of m tagged` or the failure as each call finishes.
 */
export async function tagItems<I extends Item, G>(
  tagger: Tagger<I, G>,
  items: readonly Item[],
  llm: LlmClient,
  concurrency: number,
  report: (line: string) => void = () => {},
): Promise<TagRun<G>> {
  const { bySkill } = groupCandidates(tagger, items);
  const tagged: Record<string, G> = {};
  const rejected: string[] = [];
  const failed: string[] = [];
  const queue = [...bySkill.entries()];
  async function worker() {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [skillId, group] = next;
      try {
        const result = tagger.accept(group, await llm.call(tagger.request(skillId, group)));
        Object.assign(tagged, result.tagged);
        for (const [id, why] of Object.entries(result.rejected)) rejected.push(`${id}: ${why}`);
        report(`${skillId}: ${Object.keys(result.tagged).length} of ${group.length} tagged`);
      } catch (error) {
        const line = `${skillId}: ${(error as Error).message}`;
        failed.push(line);
        report(line);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  const sorted = Object.fromEntries(Object.entries(tagged).sort(([a], [b]) => a.localeCompare(b)));
  return { tagged: sorted, rejected: rejected.sort(), failed };
}
