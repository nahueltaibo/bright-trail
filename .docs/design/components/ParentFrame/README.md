# ParentFrame

The one frame every parent screen shares: a back link, a title and a scrolling column of sections.

Provide `back` (the label of where it goes, e.g. "Kids' home"; `false` hides it), `onBack`, `title`, `children` (sections), `wide` for tablets.

- The back link names its destination. Never just "Back" when the destination is known.
- On tablets wrap sections in `.bt-pcols` (two columns) or `.bt-pnarrow` (forms, 640px).
