import type { Choice } from '@bright-trail/shared';

/** What to say for an answer choice. Pictures carry their own spoken label. */
export function choiceText(choice: Choice): string {
  switch (choice.kind) {
    case 'text':
      return choice.text;
    case 'number':
      return String(choice.value);
    case 'visual':
      return choice.narration;
  }
}
