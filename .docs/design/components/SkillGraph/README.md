# SkillGraph

The skill tree as a graph: one column per grade, arrows from a skill to the skills it unlocks.

Provide `nodes` (`{ id, title, state, x, y }` in a `width` × `height` space), `edges` (`[fromId, toId]`), `columns` (`{ x, label }`), optional `nodeWidth`.

- Tablet and web only. Phones keep the grouped list.
- Node borders follow the badge rules (dashed unknown, dotted assumed), so the graph reads in greyscale.
- Lay out with a layered graph layout (grade = column). The POC hand-places nodes.
