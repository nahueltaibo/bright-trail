# ConfirmButton

A destructive action with an inline confirm step that states the consequence.

Provide `label`, `question`, `consequence` (one sentence on what is lost and what stays), `confirmLabel`, `onConfirm`, `tone: 'danger'`, optional `open`.

- Closed: a `secondary-danger` button. Open: a `p-danger-soft` panel with the question in bold, the consequence, a `danger` confirm and a Cancel.
- The confirm label repeats the action ("Delete Maya"), never "OK" or "Yes".
