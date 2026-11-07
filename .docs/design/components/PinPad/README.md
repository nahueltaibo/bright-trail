# PinPad

The 4-digit parent PIN pad, in create, confirm and enter modes.

Provide `mode` (`create`, `confirm`, `enter`), `onComplete(pin)`, `error`.

| Mode | Title | Hint |
| --- | --- | --- |
| create | Pick a parent PIN | Pick 4 digits your kids don't know |
| confirm | Confirm your PIN | Enter the PIN again |
| enter | Parent PIN | Grown-ups only past this point |

- Errors: "Those PINs didn't match. Start again." (back to create) and "Wrong PIN. Try again." Dots turn `p-danger` and clear.
- Calm parent styling, but 76px keys so a parent can tap it one-handed.
