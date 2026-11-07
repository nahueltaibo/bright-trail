# Device

A device frame for screen boards: phone portrait (390 × 844), phone landscape (844 × 390) or tablet landscape (1194 × 834).

Provide `kind`, `label`, `zone` (`kid` or `parent`), optional `dyslexic`, `scroll` (`'end'` scrolls a parent frame to its end). Kid tablets get `.bt-tab`, which sets `--s` to `scale-tablet`.

- Design-time only. The app does not ship it.
