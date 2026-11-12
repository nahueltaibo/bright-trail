import { choiceTextValue, formatAmount, itemAnswer, type Choice } from '@bright-trail/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { questionSpeech } from '../speech';
import { shuffleChoices } from '../TapItemView';
import type { ItemViewProps } from '../types';
import type { GameFrameProps, GameInput } from './GameFrame';

/** Number-line items talk about the frog. The game answers them on a keypad instead. */
export function keypadNarration(text: string): string {
  return text.replace(/\b(hop|move|drag) the frog to\b/gi, 'Type');
}

const label = (c: Choice) =>
  c.kind === 'number' ? formatAmount(c.value) : c.kind === 'text' ? c.text : c.narration;

/**
 * An item's question, choices or keypad, and answer reporting, as a minigame takes them. Tap
 * items keep their choices, shuffled. Keypad and number-line items get the keypad.
 */
export function useGameProps(props: ItemViewProps & { shuffleSeed?: string }): GameFrameProps {
  const { item, shuffleSeed } = props;
  const [seed] = useState(() => shuffleSeed ?? Math.random().toString(36).slice(2));
  const input = useMemo<GameInput>(
    () =>
      item.type === 'tap'
        ? {
            kind: 'choices',
            choices: shuffleChoices(item.choices, seed).map((c) => ({
              id: c.id,
              label: label(c),
              value: c.kind === 'number' ? c.value : (choiceTextValue(label(c)) ?? label(c)),
            })),
          }
        : { kind: 'keypad', decimal: !Number.isInteger(itemAnswer(item)) },
    [item, seed],
  );
  const question = useMemo(
    () =>
      item.type === 'number-line'
        ? [keypadNarration(item.narration)]
        : questionSpeech(
            item,
            item.type === 'tap' && input.kind === 'choices'
              ? input.choices.map((c) => item.choices.find((x) => x.id === c.id)!)
              : undefined,
          ),
    [item, input],
  );

  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  return {
    prompt: item.prompt,
    question,
    answer: itemAnswer(item)!,
    input,
    retry: !props.measuring,
    narrate: props.narrate,
    onFlag: () => props.onFlag?.({ contentKind: 'item', contentId: item.id, cardIndex: null }),
    onNext: props.onNext,
    progress: props.progress,
    onAnswer: (picked, correct, replays) =>
      props.onAnswer?.({
        itemId: item.id,
        answer: picked.choiceId ?? (picked.value as number),
        correct,
        msToAnswer: Math.max(0, Math.round(Date.now() - startedAt.current)),
        replays,
      }),
  };
}
