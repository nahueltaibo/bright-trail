# Keypad

Number entry: a display, 0 to 9 keys, delete and a check-mark submit.

Provide `onSubmit(value)`, optional `onChange`, `decimal` (adds the decimal key), `result` (`hit` or `miss` colours the display and locks it), `layout` (`stack` or `side`), `hideKeys`.

- Show the decimal key only for decimal answers. Otherwise its slot stays empty, so keys never move.
- `side` puts the display and submit beside the keys: phone landscape and tablet landscape.
- After an answer, hide the keys on phones and show the feedback panel in their place.
- Submit stays disabled until a digit is typed. No timers, no auto-submit.
