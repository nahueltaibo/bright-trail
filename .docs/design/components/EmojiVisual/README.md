# EmojiVisual

Pictures from data: one emoji, a row of N emoji grouped in fives, or ten-frames with N dots.

Provide `kind` (`single`, `row`, `tenframe`, `slot`), `emoji`, `count`, `label` (spoken noun: "fish"), optional `frames` for ten-frames.

- Rows break into pills of five on `kid-surface`, like a ten-frame row, so counting can start from 5.
- Ten-frames: `kid-ink` frame, `kid-line-strong` cell lines, `counter` dots. A second frame appears past 10.
- `slot` is the 16:9 placeholder where illustrations will go. Keep the same box when art arrives.
- Spoken as "7 fish" or "7 dots in a ten-frame". Never rely on the picture alone.
