# Graphviz Word-Style Layout Reference

## When to Use Fixed Positioning (neato)
Use `layout=neato` with `pos="x,y!"` and `pin=true` when:
- The layout must match a reference image.
- Columns or rows must be perfectly aligned.
- Parent/child expansions must be symmetric and centered.

Recommended render:
```bash
neato -n2 -Tpng flow.gv -o flow.png
```

## Coordinate Planning

1. Choose a base grid:
- Column x values: equal spacing (e.g., 100, 400, 700)
- Row y values: equal spacing for main nodes (e.g., 1000, 840, 700, ...)

2. Child rows:
- Use a consistent child-row y value slightly below the parent.
- Keep all children on the same y value.

## Symmetric Child Placement
Let parent center be `xc`.

- 2 children: `xc - d`, `xc + d`
- 3 children: `xc - d`, `xc`, `xc + d`
- 4 children: `xc - 1.5d`, `xc - 0.5d`, `xc + 0.5d`, `xc + 1.5d`

Use a single `d` value across the whole diagram for visual consistency.

## Orthogonal Edges (Parent → Children)
Use invisible points to force right angles.

Pattern:
```
Parent -> Midpoint (arrowhead=none)
Midpoint -> Junction_i (arrowhead=none)
Junction_i -> Child_i
```

Place `Midpoint` above the child row, and `Junction_i` directly above each child.

## Orthogonal Dashed Links
For correspondence edges or cross-column links:
- Use dashed edges.
- If a right angle is needed, insert a bend point at the target row y.

## Module Boxes (Dashed)
Avoid clusters when exact control is needed. Draw a rectangle using four corner points:
```
TL -> TR -> BR -> BL -> TL
```

Guidelines:
- Box should cover parent node and child row.
- Keep padding symmetric on all sides.
- Adjust box if child spacing changes.

## Word-Style Defaults (Black/White)
```
node [shape=box, style=filled, color=black, fontcolor=black, fillcolor=white];
edge [color=black, arrowsize=0.7];
```

Correspondence edges: `style=dashed`
Module boxes: dashed edges, no arrowheads.
