import {
  describeVisual,
  type Item,
  type Skill,
  type StoryNugget,
  type Visual,
} from '@bright-trail/shared';
import { GRADE_ORDER } from '../graph/sources';
import type { ContentRun, SkillOutcome } from './pipeline';
import { GENERATOR_MODEL, REVIEWER_MODEL } from './prompts';
import type { CheckLevel } from './solver';
import { spokenChoice } from './validate';

const TYPES = ['tap', 'keypad', 'number-line'] as const;
const LEVEL_LABEL: Record<CheckLevel, string> = {
  solved: 'solved by code',
  linked: 'solved by code, link confirmed by reviewer',
  unchecked: 'reviewer only',
};

function visual(v: Visual | undefined): string {
  if (!v) return '';
  if (v.kind === 'emoji') return v.emoji;
  if (v.kind === 'objects') return `${v.count} × ${v.emoji}`;
  if (v.kind === 'fraction') return `${describeVisual(v)}${v.label ? `, label "${v.label}"` : ''}`;
  return `ten-frame, ${v.filled} filled`;
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function renderNugget(nugget: StoryNugget): string {
  const rows = nugget.cards.map(
    (c, i) => `| ${i + 1} | ${cell(c.narration)} | ${cell(c.text ?? '')} | ${visual(c.visual)} |`,
  );
  return ['| # | Narration | Screen text | Picture |', '| - | --- | --- | --- |', ...rows].join(
    '\n',
  );
}

function renderItem(item: Item, level: CheckLevel): string {
  const lines = [
    `**${item.id}** · ${item.type} · difficulty ${item.difficulty} · ${LEVEL_LABEL[level]}`,
    '',
    `- Narration: ${item.narration}`,
    `- Screen: ${item.prompt}`,
  ];
  if (item.type === 'tap') {
    if (item.visual) lines.push(`- Picture: ${visual(item.visual)}`);
    const choices = item.choices.map((c) => {
      const label =
        c.kind === 'visual' ? `${visual(c.visual)} ("${c.narration}")` : spokenChoice(c);
      return c.id === item.answerChoiceId ? `**${label}**` : label;
    });
    lines.push(`- Choices: ${choices.join(' · ')}`);
  } else if (item.type === 'keypad') {
    if (item.visual) lines.push(`- Picture: ${visual(item.visual)}`);
    lines.push(`- Answer: ${item.answer}`);
  } else {
    lines.push(`- Line: ${item.min} to ${item.max}, step ${item.step}. Target: ${item.target}`);
  }
  lines.push(`- Why: ${item.why}`);
  return lines.join('\n');
}

const retries = (o: SkillOutcome) => o.attempts.length - 1;

function levelCounts(outcomes: readonly SkillOutcome[]): Record<CheckLevel, number> {
  const counts: Record<CheckLevel, number> = { solved: 0, linked: 0, unchecked: 0 };
  for (const o of outcomes) for (const level of o.levels.values()) counts[level]++;
  return counts;
}

function notesSection(outcomes: readonly SkillOutcome[]): string[] {
  const lines: string[] = [];
  for (const o of outcomes) {
    if (o.reviewNotes.length === 0 && !o.reviewSummary.trim()) continue;
    const edited = new Set((o.edits ?? []).map((e) => e.target));
    lines.push(`- **${o.skill.id}**${o.reviewSummary.trim() ? `: ${o.reviewSummary.trim()}` : ''}`);
    for (const n of o.reviewNotes) {
      const mark = edited.has(n.target) ? ' Edited by hand after review.' : '';
      lines.push(`  - ${n.target} (${n.severity}, ${n.category}):${mark} ${n.note}`);
    }
  }
  return lines.length ? lines : ['None.'];
}

function editsSection(outcomes: readonly SkillOutcome[]): string[] {
  const lines = outcomes.flatMap((o) =>
    (o.edits ?? []).map(
      (e) =>
        `- \`${e.target === 'story' ? `${o.skill.id} story card ${e.card}` : e.target}\` (${Object.keys(e.set).join(', ')}): ${e.reason}`,
    ),
  );
  return lines.length ? lines : ['None.'];
}

/** Picks one item of each type, preferring difficulty 2, so the pilot shows the range. */
export function sampleItems(items: readonly Item[]): Item[] {
  return TYPES.flatMap((type) => {
    const ofType = items.filter((i) => i.type === type);
    return ofType.find((i) => i.difficulty === 2) ?? ofType[0] ?? [];
  });
}

export function renderPilotReport(run: ContentRun): string {
  const sections = run.outcomes.map((o) => {
    const header = `## ${o.skill.id} · ${o.skill.grade === 'K' ? 'Kindergarten' : `Grade ${o.skill.grade}`} · ${o.skill.title}`;
    const counts = levelCounts([o]);
    const status =
      o.status === 'passed'
        ? `Passed after ${retries(o)} ${retries(o) === 1 ? 'retry' : 'retries'}. Answers: ${counts.solved} solved by code, ${counts.linked} linked, ${counts.unchecked} reviewer only.`
        : `**Failed** after ${retries(o)} retries. Last problems:\n\n${o.attempts
            .at(-1)!
            .problems.map((p) => `- ${p}`)
            .join('\n')}`;
    const story = o.nugget ? `### Story\n\n${renderNugget(o.nugget)}` : '';
    const items = sampleItems(o.items)
      .map((item) => renderItem(item, o.levels.get(item.id) ?? 'unchecked'))
      .join('\n\n');
    const history = o.attempts
      .slice(0, -1)
      .map(
        (a, i) =>
          `- Attempt ${i + 1}: ${a.problems.slice(0, 6).join('; ')}${a.problems.length > 6 ? `; and ${a.problems.length - 6} more` : ''}`,
      );
    const notes = o.reviewNotes.map((n) => `- ${n.target} (${n.category}): ${n.note}`);
    return [
      header,
      status,
      history.length ? `### Retries\n\n${history.join('\n')}` : '',
      story,
      items ? `### Sample items\n\n${items}` : '',
      `### Reviewer\n\n${o.reviewSummary.trim() || 'No summary.'}${notes.length ? `\n\n${notes.join('\n')}` : ''}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  });
  const passed = run.outcomes.filter((o) => o.status === 'passed').length;
  return `# Content Pilot Report

Generated by \`npm run content:generate -- --pilot\` with ${GENERATOR_MODEL}, reviewed by ${REVIEWER_MODEL}. Each skill shows its full story and one item of each type. Don't edit it by hand.

**${passed} of ${run.outcomes.length} pilot skills passed.** ${run.outcomes.reduce((n, o) => n + o.calls, 0)} LLM requests.

${sections.join('\n\n')}
`;
}

export interface ReportScope {
  /** Empty when the bundle holds every skill. */
  targets: readonly string[];
  generatedOutside: number;
  extraRetries: Readonly<Record<string, number>>;
}

export function renderContentReport(
  skills: readonly Skill[],
  run: ContentRun,
  bundleBytes: number | null,
  scope: ReportScope = { targets: [], generatedOutside: 0, extraRetries: {} },
): string {
  const { outcomes } = run;
  const extra = Object.entries(scope.extraRetries);
  const scopeSection = scope.targets.length
    ? `## Scope

The bundle holds the targets in \`content/bundle-scope.json\` and every skill they depend on, down to Kindergarten, so placement and walk-back always find content. Add targets there to grow it.

- **Targets (${scope.targets.length}):** ${scope.targets.map((t) => `\`${t}\``).join(', ')}
- **Closure (${skills.length} skills):** ${skills.map((s) => `\`${s.id}\``).join(', ')}
- **Outside the closure:** ${scope.generatedOutside} skills already have a cached first draft, so adding them later costs little.${
        extra.length
          ? `
- **Extra retries:** ${extra.map(([id, n]) => `\`${id}\` gets ${n} more`).join(', ')}, because the bundle needs its content.`
          : ''
      }

`
    : '';
  const passed = outcomes.filter((o) => o.status === 'passed');
  const failed = outcomes.filter((o) => o.status === 'failed');
  const items = passed.flatMap((o) => o.items);

  const gradeRows = GRADE_ORDER.filter((g) => skills.some((s) => s.grade === g)).map((grade) => {
    const inGrade = outcomes.filter((o) => o.skill.grade === grade);
    const ok = inGrade.filter((o) => o.status === 'passed');
    const its = ok.flatMap((o) => o.items);
    const total = skills.filter((s) => s.grade === grade).length;
    const byType = TYPES.map((t) => its.filter((i) => i.type === t).length);
    const byDifficulty = [1, 2, 3].map((d) => its.filter((i) => i.difficulty === d).length);
    return `| ${grade} | ${ok.length} / ${total} | ${its.length} | ${byType.join(' | ')} | ${byDifficulty.join(' / ')} | ${inGrade.reduce((n, o) => n + retries(o), 0)} |`;
  });
  const totals = TYPES.map((t) => items.filter((i) => i.type === t).length);

  const counts = levelCounts(passed);
  const toConfirm = passed.flatMap((o) =>
    o.items
      .filter((i) => o.levels.get(i.id) !== 'solved')
      .map((i) => ({ i, level: o.levels.get(i.id)! })),
  );

  const retried = outcomes.filter((o) => retries(o) > 0);
  const retryLines = retried.map((o) => {
    const reasons = o.attempts.slice(0, -1).flatMap((a) => a.problems);
    const shown = reasons.slice(0, 4).join('; ');
    return `- **${o.skill.id}** (${retries(o)}, ${o.status}): ${shown}${reasons.length > 4 ? `; and ${reasons.length - 4} more` : ''}`;
  });
  const failedLines = failed.map(
    (o) => `- **${o.skill.id}**: ${o.attempts.at(-1)?.problems.join('; ') ?? 'no attempt'}`,
  );
  const calls = outcomes.reduce((n, o) => n + o.calls, 0);
  const reviews = outcomes.reduce((n, o) => n + o.attempts.filter((a) => a.reviewed).length, 0);

  const stopped = run.stoppedBy
    ? `\n**The run stopped early:** ${run.stoppedBy.slice(0, 300)}\n\n${run.pending.length} skills are still to do: ${run.pending.map((s) => `\`${s.id}\``).join(', ')}. Rerun \`npm run content:generate\` after the limit resets. Finished skills come from the cache at no cost.\n`
    : '';
  const size =
    bundleBytes === null ? '' : ` The bundle is ${(bundleBytes / 1024 / 1024).toFixed(2)} MB.`;

  return `# Content Report

Generated by \`npm run content:generate\` with ${GENERATOR_MODEL}, reviewed by ${REVIEWER_MODEL}. Don't edit it by hand. Rerun the build instead.

**${passed.length} of ${skills.length} skills passed** with ${passed.length} stories and ${items.length} items.${size}
${stopped}
${scopeSection}## Counts

| Grade | Skills passed | Items | Tap | Keypad | Number line | Difficulty 1 / 2 / 3 | Retries |
| ----- | ------------- | ----- | --- | ------ | ----------- | -------------------- | ------- |
${gradeRows.join('\n')}
| **Total** | **${passed.length} / ${skills.length}** | **${items.length}** | ${totals.join(' | ')} | | **${outcomes.reduce((n, o) => n + retries(o), 0)}** |

## Answer Checks

- **${counts.solved}** items solved by code from the numbers the child sees or hears.
- **${counts.linked}** items solved by code, where the model declared what a choice means. The reviewer confirmed each one.
- **${counts.unchecked}** items code can't check. Only the reviewer checked them.

${toConfirm.length ? `<details><summary>Items not fully solved by code (${toConfirm.length})</summary>\n\n${toConfirm.map(({ i, level }) => `- \`${i.id}\` (${level}): ${i.narration}`).join('\n')}\n\n</details>` : ''}

## Failed Skills

These have no story or items in the bundle.

${failedLines.length ? failedLines.join('\n') : 'None.'}

## Retries

${retryLines.length ? retryLines.join('\n') : 'None.'}

## Reviewer Notes

Notes don't fail a skill. "Code disagrees" marks a wrong-answer claim on an answer code recomputed.

${notesSection(passed).join('\n')}

## Hand Edits

Fixes from \`content/content-edits.json\`, applied after review. Code checks ran again on each one.

${editsSection(passed).join('\n')}

## LLM Calls

${calls} requests behind this content: ${outcomes.reduce((n, o) => n + o.attempts.length, 0)} to generate and ${reviews} to review. Responses cache in \`content/cache/llm/\`, so a rerun only calls the CLI for prompts that changed.
`;
}
