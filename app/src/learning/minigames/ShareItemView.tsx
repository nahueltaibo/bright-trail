import { choiceTextValue, formatAmount, itemAnswer, type Choice } from '@bright-trail/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { questionSpeech } from '../speech';
import { shuffleChoices } from '../TapItemView';
import type { ItemViewProps } from '../types';
import { problemFromScene } from './share';
import { ShareGame, type ShareInput } from './ShareGame';

/** Number-line items talk about the frog. The game answers them on a keypad instead. */
export function keypadNarration(text: string): string {
  return text.replace(/\b(hop|move|drag) the frog to\b/gi, 'Type');
}

const label = (c: Choice) =>
  c.kind === 'number' ? formatAmount(c.value) : c.kind === 'text' ? c.text : c.narration;

/** Plays an item that has a scene as the sharing minigame. */
export function ShareItemView(props: ItemViewProps & { shuffleSeed?: string }) {
  const { item, shuffleSeed } = props;
  const scene = item.scene!;
  const problem = useMemo(() => problemFromScene(scene, item.id), [scene, item.id]);
  const [seed] = useState(() => shuffleSeed ?? Math.random().toString(36).slice(2));
  const input = useMemo<ShareInput>(
    () =>
      item.type === 'tap'
        ? {
            kind: 'choices',
            choices: shuffleChoices(item.choices, seed).map((c) => ({
              id: c.id,
              label: label(c),
              value: c.kind === 'number' ? c.value : choiceTextValue(label(c))!,
            })),
          }
        : { kind: 'keypad' },
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

  return (
    <ShareGame
      problem={problem}
      prompt={item.prompt}
      question={question}
      answer={itemAnswer(item)!}
      input={input}
      retry={!props.measuring}
      narrate={props.narrate}
      onFlag={() => props.onFlag?.({ contentKind: 'item', contentId: item.id, cardIndex: null })}
      onNext={props.onNext}
      onAnswer={(picked, correct, replays) =>
        props.onAnswer?.({
          itemId: item.id,
          answer: picked.choiceId ?? (picked.value as number),
          correct,
          msToAnswer: Math.max(0, Math.round(Date.now() - startedAt.current)),
          replays,
        })
      }
    />
  );
}
