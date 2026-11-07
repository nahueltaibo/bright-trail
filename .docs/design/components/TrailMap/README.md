# TrailMap

The child's trail: skills as stones along a path, stars on mastered ones, the next stop glowing.

Provide `stops` (`{ title, state, onClick }`, oldest first), `avatar`, `orientation` (`vertical` on phones, `horizontal` on tablets), `rowHeight` or `height`.

Stop states:
- `mastered`: a star on a `star-ink` ringed stone.
- `review`: a mastered stone with a `state-review` ring and a circular-arrow badge.
- `next`: a big trail stone with a play mark, a `sun` glow and the avatar standing on it.
- `ahead`: a numbered stone. `locked`: a dashed stone with a lock.

- The walked trail is solid `trail`. The trail ahead is a dotted `kid-line-strong` line.
- Show the next 2 or 3 stops after `next`, then one `locked`. Do not show the whole tree to a child.
- Place it on a `meadow` panel (`.bt-trailpanel`).
