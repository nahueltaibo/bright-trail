# Icon

Line icons on a 24px grid, drawn as stroked paths in `currentColor`, plus a two-tone `Star`.

Provide `name` (one of `speaker flag home lock back next check backspace pause play plus share chevron sprout refresh question half gap star moon book close alert tree list bookmark`), optional `size` and `stroke`. The icon is `1em` square, so size it with the parent's font-size.

- Kid zone strokes run 2.6 to 3.2 so they hold up at 64pt. Parent icons use the default 2.4.
- `Star` is the reward mark: `star` fill with a `star-ink` outline, so it reads on every ground. Use it for stars only, never as decoration.
- Icons are always `aria-hidden`. The button around them carries the label.
