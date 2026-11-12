import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { API, CURRICULA, KINDERGARTEN, KINDERGARTEN_SPLIT } from './curricula';
import {
  checkKindergartenSplit,
  kindergartenStrands,
  overallCodes,
  planCourses,
  renderGrade,
  renderKindergarten,
  strandsUrl,
  type ApiResponse,
} from './render';

const { values } = parseArgs({ options: { subject: { type: 'string', multiple: true } } });
const wanted = values.subject ?? CURRICULA.map((c) => c.subject);
const unknown = wanted.filter((s) => !CURRICULA.some((c) => c.subject === s));
if (unknown.length) {
  throw new Error(
    `No curriculum for ${unknown.join(', ')}. Pick from ${CURRICULA.map((c) => c.subject).join(', ')}`,
  );
}

const sourcesDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'sources');
const retrieved = new Date().toISOString().slice(0, 10);

async function get(url: string): Promise<ApiResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as ApiResponse;
}

for (const curriculum of CURRICULA.filter((c) => wanted.includes(c.subject))) {
  const top = await get(`${API}${curriculum.codename}?language=en-CA&depth=2`);
  const dir = join(sourcesDir, curriculum.subject);
  await mkdir(dir, { recursive: true });
  for (const plan of planCourses(top, curriculum)) {
    const markdown = renderGrade(await get(strandsUrl(plan.strands)), {
      curriculum,
      plan,
      retrieved,
    });
    await writeFile(join(dir, plan.file), markdown);
    console.log(`${curriculum.subject}/${plan.file}`);
  }
}

const kindergartenSubjects = CURRICULA.map((c) => c.subject).filter(
  (s) => wanted.includes(s) && KINDERGARTEN_SPLIT[s],
);
if (kindergartenSubjects.length) {
  const strands = kindergartenStrands(
    await get(`${API}${KINDERGARTEN.codename}?language=en-CA&depth=1`),
  );
  const res = await get(strandsUrl(strands));
  checkKindergartenSplit(overallCodes(res));
  for (const subject of kindergartenSubjects) {
    await writeFile(
      join(sourcesDir, subject, 'kindergarten.md'),
      renderKindergarten(res, { subject, strands, retrieved }),
    );
    console.log(`${subject}/kindergarten.md`);
  }
}
