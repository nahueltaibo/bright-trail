import { blocksProblems, type BlocksScene } from '@bright-trail/shared';
import { BLOCKS_DEMO_ITEMS } from './demo';
import { blocksPlan, layoutMat, sceneFrame, STAGE_H, STAGE_W, startMat, tenParts } from './layout';
import { blocksWords, matWords } from './words';

const scene = (s: Omit<BlocksScene, 'kind'>): BlocksScene => ({ kind: 'blocks', ...s });
const demo = (id: string) => {
  const game = BLOCKS_DEMO_ITEMS.find((i) => i.id === `demo-blocks-${id}`)!.game;
  if (game?.kind !== 'blocks') throw new Error(`demo-blocks-${id} has no blocks game`);
  return game;
};
const steps = (s: BlocksScene) =>
  blocksPlan(s).map((p) =>
    [
      'place' in p ? `${p.kind} ${p.place}` : p.kind,
      `${p.mat.hundreds}/${p.mat.tens}/${p.mat.ones}`,
    ].join(' '),
  );

const twoTrades = scene({
  ask: 'add',
  hundreds: 0,
  tens: 9,
  ones: 5,
  second: { hundreds: 0, tens: 0, ones: 7 },
});
const twoBreaks = scene({
  ask: 'take',
  hundreds: 1,
  tens: 2,
  ones: 0,
  second: { hundreds: 0, tens: 5, ones: 5 },
});

describe('BLOCKS_DEMO_ITEMS', () => {
  it('each pass the shared check', () => {
    for (const item of BLOCKS_DEMO_ITEMS) {
      if (item.game?.kind !== 'blocks') throw new Error(`${item.id} has no blocks game`);
      expect(blocksProblems(item, item.game)).toEqual([]);
    }
  });
});

describe('blocksPlan', () => {
  it('trades ten ones, then ten tens, before counting a total', () => {
    expect(steps(demo('trade'))).toEqual([
      'trade ones 0/10/5',
      'trade tens 1/0/5',
      'count hundreds 1/0/5',
      'count ones 1/0/5',
    ]);
  });

  it('breaks hundreds into tens for a make ask', () => {
    expect(steps(demo('make'))).toEqual(['break hundreds 0/15/0', 'count tens 0/15/0']);
  });

  it('counts by the place value for worth and by one for count', () => {
    const [worth] = blocksPlan(demo('worth'));
    expect(worth).toMatchObject({ kind: 'count', place: 'tens', by: 10 });
    const [count] = blocksPlan(demo('count'));
    expect(count).toMatchObject({ kind: 'count', place: 'ones', by: 1, from: 0 });
  });

  it('joins the second number, then trades and counts for an add', () => {
    expect(startMat(demo('add'))).toEqual({ hundreds: 0, tens: 2, ones: 11 });
    expect(steps(demo('add'))).toEqual([
      'join 0/2/11',
      'trade ones 0/3/1',
      'count tens 0/3/1',
      'count ones 0/3/1',
    ]);
  });

  it('breaks a ten when the ones run short, then takes away and counts', () => {
    expect(steps(demo('take'))).toEqual(['break tens 0/2/14', 'take 0/0/6', 'count ones 0/0/6']);
    const hundred = scene({
      ask: 'take',
      hundreds: 3,
      tens: 0,
      ones: 0,
      second: { hundreds: 0, tens: 0, ones: 1 },
    });
    expect(steps(hundred).slice(0, 3)).toEqual([
      'break hundreds 2/10/0',
      'break tens 2/9/10',
      'take 2/9/9',
    ]);
  });

  it('breaks a hundred when a broken ten still leaves too few tens', () => {
    expect(steps(twoBreaks)).toEqual([
      'break tens 1/1/10',
      'break hundreds 0/11/10',
      'take 0/6/5',
      'count tens 0/6/5',
      'count ones 0/6/5',
    ]);
  });

  it('trades ones, then tens, when a sum passes 99', () => {
    expect(steps(twoTrades)).toEqual([
      'join 0/9/12',
      'trade ones 0/10/2',
      'trade tens 1/0/2',
      'count hundreds 1/0/2',
      'count ones 1/0/2',
    ]);
  });

  it('joins or takes with no trade when no place passes 9 or runs short', () => {
    expect(steps(demo('add-plain'))).toEqual([
      'join 0/2/8',
      'count tens 0/2/8',
      'count ones 0/2/8',
    ]);
    expect(steps(demo('take-plain'))).toEqual([
      'take 0/2/4',
      'count tens 0/2/4',
      'count ones 0/2/4',
    ]);
  });

  it('counts a total on from the bigger places', () => {
    const plan = blocksPlan(demo('hundreds'));
    expect(plan.filter((p) => p.kind === 'count').map((p) => [p.place, p.from])).toEqual([
      ['hundreds', 0],
      ['tens', 300],
      ['ones', 340],
    ]);
  });
});

describe('layout', () => {
  it('fits every mat of the play-out on the stage, with no blocks overlapping', () => {
    const big = scene({ ask: 'total', hundreds: 9, tens: 9, ones: 9 });
    const many = scene({ ask: 'make', hundreds: 3, tens: 0, ones: 0, place: 'tens' });
    const widest = scene({
      ask: 'add',
      hundreds: 0,
      tens: 9,
      ones: 9,
      second: { hundreds: 0, tens: 9, ones: 9 },
    });
    expect(startMat(widest)).toEqual({ hundreds: 0, tens: 18, ones: 18 });
    const scenes = [big, many, widest, ...BLOCKS_DEMO_ITEMS.map((i) => i.game as BlocksScene)];
    for (const s of scenes) {
      const { plan, frame } = sceneFrame(s);
      for (const m of [s, startMat(s), ...plan.map((p) => p.mat)]) {
        const rects = Object.values(layoutMat(m, frame).slots).flat();
        for (const r of rects) {
          expect(r.x).toBeGreaterThanOrEqual(0);
          expect(r.x + r.w).toBeLessThanOrEqual(STAGE_W);
          expect(r.y).toBeGreaterThanOrEqual(0);
          expect(r.y + r.h).toBeLessThanOrEqual(STAGE_H);
        }
        for (const a of rects) {
          for (const b of rects) {
            if (a === b) continue;
            const apart =
              a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
            expect(apart).toBe(true);
          }
        }
      }
    }
  });

  it('shows the tens and ones for a two-digit number, even with no ones', () => {
    expect(sceneFrame(scene({ ask: 'total', hundreds: 0, tens: 3, ones: 0 })).frame.places).toEqual(
      ['tens', 'ones'],
    );
  });

  it('splits a rod into cubes and a flat into rods that tile it', () => {
    const rod = { x: 10, y: 20, w: 8, h: 80 };
    expect(tenParts(rod, 'tens')[9]).toEqual({ x: 10, y: 92, w: 8, h: 8 });
    const flat = { x: 0, y: 0, w: 80, h: 80 };
    expect(tenParts(flat, 'hundreds')[1]).toEqual({ x: 8, y: 0, w: 8, h: 80 });
  });
});

describe('blocksWords', () => {
  it('says what the play-out showed', () => {
    expect(matWords({ hundreds: 8, tens: 0, ones: 5 })).toBe('8 hundreds, 0 tens, and 5 ones');
    expect(blocksWords(demo('total'))).toBe('3 tens and 5 ones make 35.');
    expect(blocksWords(demo('trade'))).toBe(
      '10 ones trade for 1 ten, and 10 tens trade for 1 hundred. 1 hundred, 0 tens, and 5 ones make 105.',
    );
    expect(blocksWords(demo('count'))).toBe(
      '164 is 1 hundred, 5 tens, and 14 ones, so it has 14 ones.',
    );
    expect(blocksWords(demo('worth'))).toBe('The 8 in 583 stands for 8 tens, so it is worth 80.');
    expect(blocksWords(demo('make'))).toBe('Each hundred breaks into 10 tens. 150 makes 15 tens.');
    expect(blocksWords(demo('add'))).toBe(
      '25 and 6 make 2 tens and 11 ones. 10 ones trade for 1 ten. 3 tens and 1 one make 31.',
    );
    expect(blocksWords(demo('add-plain'))).toBe('23 and 5 make 2 tens and 8 ones, which is 28.');
    expect(blocksWords(demo('take-plain'))).toBe(
      '36 take away 12 leaves 2 tens and 4 ones, which is 24.',
    );
    expect(blocksWords(demo('take'))).toBe(
      '1 ten breaks into 10 ones. 34 take away 28 leaves 6 ones.',
    );
  });

  it('says each trade and break of a sum, and a take that leaves nothing', () => {
    expect(blocksWords(twoTrades)).toBe(
      '95 and 7 make 9 tens and 12 ones. 10 ones trade for 1 ten, and 10 tens trade for 1 hundred. 1 hundred, 0 tens, and 2 ones make 102.',
    );
    expect(blocksWords(twoBreaks)).toBe(
      '1 hundred breaks into 10 tens, and 1 ten breaks into 10 ones. 120 take away 55 leaves 6 tens and 5 ones, which is 65.',
    );
    const all = scene({
      ask: 'take',
      hundreds: 0,
      tens: 3,
      ones: 4,
      second: { hundreds: 0, tens: 3, ones: 4 },
    });
    expect(blocksWords(all)).toBe('34 take away 34 leaves 0.');
    expect(steps(all)).toEqual(['take 0/0/0']);
  });
});
