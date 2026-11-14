import { PICTURES, type Item, type Picture } from '@bright-trail/shared';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createRef, type ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { GAME_VIEWS } from '../games';
import { ItemView } from '../ItemView';
import { LABEL_DEMO_ITEMS } from '../label/demo';
import { layoutOf as labelLayout, SPOTS } from '../label/layout';
import { LabelStage } from '../label/LabelStage';
import { ORDER_DEMO_ITEMS } from '../order/demo';
import { layoutOf as orderLayout } from '../order/layout';
import { OrderStage } from '../order/OrderStage';
import { SORT_DEMO_ITEMS } from '../sort/demo';
import { binOf, layoutOf as sortLayout, START } from '../sort/layout';
import { SortStage } from '../sort/SortStage';
import type { CardStageHandle } from './CardGame';
import { STAGE_H, STAGE_W, toWorld, within, type Box } from './stage';

const game = <K extends 'sort' | 'order' | 'label'>(items: Item[], kind: K, id: string) => {
  const g = items.find((i) => i.id === id)!.game;
  if (g?.kind !== kind) throw new Error(`${id} has no ${kind} game`);
  return g as Extract<NonNullable<Item['game']>, { kind: K }>;
};

const inside = (b: Box) =>
  b.x - b.w / 2 >= 0 && b.x + b.w / 2 <= STAGE_W && b.y - b.h / 2 >= 0 && b.y + b.h / 2 <= STAGE_H;
const overlap = (a: Box, b: Box) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;

describe('sort layout', () => {
  it('fits every bin and card on the stage, with room for the asked card in each bin', () => {
    for (const item of SORT_DEMO_ITEMS) {
      const s = game(SORT_DEMO_ITEMS, 'sort', item.id);
      const l = sortLayout(s);
      expect([...l.bins, ...l.sorted, ...l.landing].every(inside)).toBe(true);
      l.landing.forEach((b, i) => {
        expect(overlap(b, l.bins[i])).toBe(true);
        l.sorted.forEach((c) => expect(overlap(b, c)).toBe(false));
      });
    }
  });

  it('finds the picked bin without case, and falls back to the right one', () => {
    const s = game(SORT_DEMO_ITEMS, 'sort', 'demo-sort-matter');
    expect(binOf(s, 'gas')).toBe(2);
    expect(binOf(s, 'Plasma')).toBe(1);
  });
});

describe('order layout', () => {
  it('fits a row of six cards with arrows between, and loops only cycles', () => {
    const s = game(ORDER_DEMO_ITEMS, 'order', 'demo-order-frog');
    const six = { ...s, cards: [...s.cards, { text: 'Pond' }, { text: 'Lily' }] };
    const l = orderLayout(six);
    expect(l.slots.every(inside)).toBe(true);
    expect(l.arrows).toHaveLength(5);
    l.arrows.forEach(([x0, x1]) => expect(x1).toBeGreaterThan(x0));
    expect(l.loop).toBeNull();
    expect(orderLayout(game(ORDER_DEMO_ITEMS, 'order', 'demo-order-seasons')).loop).toMatch(/^M /);
  });
});

describe('label layout', () => {
  it('has a spot on the stage for every part each picture names', () => {
    for (const picture of Object.keys(PICTURES) as Picture[]) {
      const spots: Record<string, { x: number; y: number }> = SPOTS[picture];
      expect(Object.keys(spots).sort()).toEqual([...PICTURES[picture]].sort());
      for (const p of Object.values(spots)) {
        expect(p.x).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(STAGE_H);
      }
    }
  });

  it('keeps every tag of a full picture on the stage, without overlaps', () => {
    for (const picture of Object.keys(PICTURES) as Picture[]) {
      const tags = PICTURES[picture].map((part) => ({ part, text: part }));
      const l = labelLayout({ kind: 'label', picture, tags, asked: 0 });
      expect(l.map((t) => t.box).every(inside)).toBe(true);
      l.forEach((a, i) => l.slice(i + 1).forEach((b) => expect(overlap(a.box, b.box)).toBe(false)));
    }
  });
});

/** Lays the stage out, plays the pick to its end, and returns the moving card's text. */
async function playOut(
  stage: ReactElement,
  testID: string,
  handle: { current: CardStageHandle | null },
  picked: string,
) {
  await render(stage);
  await act(async () => {
    screen
      .getByTestId(testID)
      .props.onLayout({ nativeEvent: { layout: { width: 360, height: 300 } } });
  });
  let done = false;
  await act(async () => {
    void handle.current!.play(picked).then(() => (done = true));
  });
  while (!done) {
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
  }
}

describe('card stages', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('sort: a miss moves the card on to its right bin', async () => {
    const handle = createRef<CardStageHandle>();
    const s = game(SORT_DEMO_ITEMS, 'sort', 'demo-sort-matter');
    await playOut(<SortStage scene={s} handle={handle} />, 'sort-stage', handle, 'Gas');
    const card = screen.getByTestId('sort-card');
    const landing = sortLayout(s).landing[1];
    expect(StyleSheet.flatten(card.props.style).left).toBeCloseTo(landing.x - landing.w / 2);
    expect(screen.getAllByText('Liquid').length).toBeGreaterThan(1);
  });

  it('order: a miss is swapped for the right card, and reset empties the gap', async () => {
    const handle = createRef<CardStageHandle>();
    const s = game(ORDER_DEMO_ITEMS, 'order', 'demo-order-frog');
    await playOut(<OrderStage scene={s} handle={handle} />, 'order-stage', handle, 'Chick');
    expect(screen.queryByText('Chick')).toBeNull();
    expect(screen.getAllByText('Froglet').length).toBeGreaterThan(0);
    await act(async () => {
      const r = handle.current!.reset();
      jest.advanceTimersByTime(100);
      await r;
    });
    expect(screen.queryByTestId('order-card')).toBeNull();
  });

  it('label: the right tag lands on the asked spot', async () => {
    const handle = createRef<CardStageHandle>();
    const s = game(LABEL_DEMO_ITEMS, 'label', 'demo-label-plant');
    await playOut(<LabelStage scene={s} handle={handle} />, 'label-stage', handle, 'stem');
    const tag = screen.getByTestId('label-tag');
    const asked = labelLayout(s)[s.asked].box;
    expect(StyleSheet.flatten(tag.props.style).top).toBeCloseTo(asked.y - asked.h / 2);
    expect(screen.getByText('stem')).toBeTruthy();
  });
});

describe('drops', () => {
  it('maps a screen point into the centred, scaled world', () => {
    expect(toWorld({ x: 10, y: 20, w: 720, h: 600 }, 10 + 360, 20 + 300)).toEqual({
      x: 180,
      y: 150,
    });
    // A wide box leaves bars at the sides, so its left edge is left of the world.
    expect(toWorld({ x: 0, y: 0, w: 960, h: 300 }, 300, 0).x).toBeCloseTo(0);
  });

  it('counts a point near a box as over it, only within the slack', () => {
    const b: Box = { x: 100, y: 100, w: 40, h: 20 };
    expect(within(b, { x: 119, y: 109 })).toBe(true);
    expect(within(b, { x: 125, y: 100 })).toBe(false);
    expect(within(b, { x: 125, y: 100 }, 6)).toBe(true);
  });

  it('sort: the card can be dragged only while the child can still answer', async () => {
    const s = game(SORT_DEMO_ITEMS, 'sort', 'demo-sort-matter');
    const lay = async () =>
      act(async () => {
        screen
          .getByTestId('sort-stage')
          .props.onLayout({ nativeEvent: { layout: { width: 360, height: 300 } } });
      });
    const { rerender } = await render(<SortStage scene={s} onPick={() => {}} />);
    await lay();
    expect(screen.getByTestId('sort-drag')).toBeTruthy();
    await rerender(<SortStage scene={s} />);
    expect(screen.queryByTestId('sort-drag')).toBeNull();
  });

  it('sort: dropping the card on a bin answers with its name', async () => {
    const s = game(SORT_DEMO_ITEMS, 'sort', 'demo-sort-matter');
    const onPick = jest.fn();
    await render(<SortStage scene={s} onPick={onPick} />);
    await act(async () => {
      screen
        .getByTestId('sort-stage')
        .props.onLayout({ nativeEvent: { layout: { width: STAGE_W, height: STAGE_H } } });
    });
    const bin = sortLayout(s).bins[s.bin];
    const page = (x: number, y: number) => ({ nativeEvent: { pageX: x, pageY: y } });
    const drag = screen.getByTestId('sort-drag');
    drag.props.onStartShouldSetResponderCapture(page(START.x, START.y));
    expect(drag.props.onMoveShouldSetResponder(page(START.x + 4, START.y + 4))).toBe(false);
    expect(drag.props.onMoveShouldSetResponder(page(START.x, bin.y))).toBe(true);
    await act(async () => drag.props.onResponderRelease(page(bin.x, bin.y)));
    expect(onPick).toHaveBeenCalledWith(s.bins[s.bin].text);
  });
});

describe('card games', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it.each(['sort', 'order', 'label'] as const)('%s takes a word answer as right', async (kind) => {
    const onAnswer = jest.fn();
    const item = GAME_VIEWS[kind].demo[0];
    if (item.type !== 'tap') throw new Error('card demos are tap items');
    const answer = item.choices.find((c) => c.id === item.answerChoiceId)!;
    await render(<ItemView item={item} shuffleSeed="test" onAnswer={onAnswer} />);
    fireEvent.press(
      screen.getByRole('button', { name: answer.kind === 'text' ? answer.text : '' }),
    );
    expect(onAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: item.id, answer: answer.id, correct: true }),
    );
  });
});

describe('choice fitting', () => {
  const frog = ORDER_DEMO_ITEMS.find((i) => i.id === 'demo-order-frog')!;
  const layOut = async (width: number) => {
    await render(<ItemView item={frog} shuffleSeed="test" />);
    const button = screen.getByRole('button', { name: 'Caterpillar' });
    const tile = button.parent!;
    await act(() =>
      fireEvent(tile.parent!, 'layout', { nativeEvent: { layout: { width, height: 100 } } }),
    );
    return {
      tile: StyleSheet.flatten(
        screen.getByRole('button', { name: 'Caterpillar' }).parent!.props.style,
      ),
      button: StyleSheet.flatten(screen.getByRole('button', { name: 'Caterpillar' }).props.style),
    };
  };

  it('keeps three choices in one row when they fit', async () => {
    expect((await layOut(750)).tile.flexBasis).toBeUndefined();
  });

  it('wraps to two columns on a narrow phone, keeping the full tap height', async () => {
    const { tile, button } = await layOut(360);
    expect(tile.flexBasis).toBe('40%');
    // A flex share on the button would let its column squash this height.
    expect(button.flex).toBeUndefined();
    expect(button.height).toBeGreaterThanOrEqual(64);
  });
});
