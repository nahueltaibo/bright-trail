# KidButton

The big pill button of the kid zone: an icon carries the meaning and the label is spoken, not read.

Provide `icon` and `label`. `label` becomes `aria-label` and is hidden unless `showLabel` is set. `variant` is `primary` (trail fill, one per screen) or `plain`. `size: 'xl'` is for the one start or next action on end screens.

- Minimum 64pt (`tap-kid`), 1.4× on tablets via `--s`.
- Press feedback is the ledge (`shadow-ledge-trail`) dropping away, never a scale or a glow.
- Show the caption only where the icon alone is ambiguous: Done, Start, Keep going, Story again.
- Never two primary buttons side by side. Pair one primary with one plain.
