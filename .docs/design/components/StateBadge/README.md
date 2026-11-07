# StateBadge

The six skill states as badges: an icon, a word and a colour, so no state relies on colour alone.

Provide `state` (`unknown assumed gap learning mastered review`) and optional `compact` (icon only, word kept for screen readers). `StateLegend` lists all six with a one-line meaning; pass `inline` for a single wrapping row.

| State | Icon | Border | Tokens |
| --- | --- | --- | --- |
| Unknown | question mark | dashed | `state-unknown` on `state-unknown-bg` |
| Assumed | half circle | dotted | `state-assumed` on `state-assumed-bg` |
| Gap | broken ring | solid | `state-gap` on `state-gap-bg` (orange, never red) |
| Learning | sprout | solid | `state-learning` on `state-learning-bg` |
| Mastered | star | thick | `state-mastered` on `state-mastered-bg` |
| Review due | circular arrow | solid | `state-review` on `state-review-bg` |

- Parent zone only. Kids see stars and stones on the trail, never these words.
