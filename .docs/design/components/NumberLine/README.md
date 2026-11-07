# NumberLine

A horizontal number line: the child drags the marker or nudges it, then taps check.

Provide `min`, `max`, `step`, `onSubmit(value)`. After answering pass `revealed` and `answer`.

- The marker snaps to `step`. Left and right buttons move one step, for kids who can't drag yet.
- Labels show on every tick up to 10 steps, then on every second or tenth.
- Revealed: the correct spot gets a `hit` pin with its number. A miss keeps the child's pin, dashed in `miss-ink`.
- It is an ARIA slider. Arrow keys move it.
