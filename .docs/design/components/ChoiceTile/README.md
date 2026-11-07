# ChoiceTile

A big answer tile for tap-the-answer items. Answers on tap, no confirm step.

Provide `label` (a number or emoji), `state` and `onClick`. Pass `ariaLabel` for emoji answers ("two apples").

States after an answer:
- `right`: `hit-bg`, `hit-ink` border and a check badge. Always the correct tile, whatever was tapped.
- `missed`: `miss-bg` calm blue with a sprout badge. Never red.
- `rest`: dashed border, faded label, no ledge. No longer tappable.

- 2 to 4 tiles in a row. Each at least 104 × 88pt.
- Shape tells the states apart (badge icon, dashed border), so they work without colour.
