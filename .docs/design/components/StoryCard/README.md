# StoryCard

One card of a narrated story: an optional visual, an optional short text (often a number) and the narration line.

Provide `narration` (always: it is spoken), optional `text` and `visual` (an `EmojiVisual`), `readingMode`.

- Narration shows as a soft caption for early readers. In reading mode it grows to 24pt in `kid-ink`.
- The card is the only element with `shadow-lift`.
- The third example shows the dyslexia font (`.bt-dys` on an ancestor).
