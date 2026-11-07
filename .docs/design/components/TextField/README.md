# TextField

A labelled text input with a hint or an error.

Provide `label`, `value`, `placeholder`, `hint`, `error`, `type`, `inputMode`, `onChange`.

- The label sits above, always visible. Placeholders show an example, never the label.
- Errors: a 2px `p-danger` border, an alert icon and one sentence that says how to fix it. Announced via `role="alert"`.
