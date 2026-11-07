# IconButton

A round icon-only button for screen chrome: replay, home, pause and the grown-ups lock.

Provide `icon` and `label` (spoken and shown as a tooltip). `variant`: `kid` (soft surface with a ledge), `quiet` (no fill, `kid-ink-soft`, smaller glyph) or `parent` (48px).

- `ReplayButton` is this button with the speaker icon. Put it top-left on every kid screen. Its `label` is the line it replays.
- Use `quiet` for controls aimed at grown-ups: the lock on the profile picker, the flag. They keep the 64pt target but sit back visually.
