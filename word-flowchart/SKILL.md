---
name: word-flowchart
description: Create Word-style flowcharts in Graphviz DOT with black/white styling, orthogonal arrows, and clean alignment. Use when converting text or images into flowcharts, refining DOT layout/spacing, enforcing strict alignment, or building complex parent-child expansions with dashed correspondence links and module boxes.
description_zh: 使用 Graphviz DOT 绘制 Word 风格流程图，强调黑白样式、正交连线与严格对齐，适合研究技术路线与复杂流程整理。
---

# Word Flowchart

## Overview

Generate clean, Word-style flowcharts using Graphviz DOT with precise alignment, orthogonal arrows, and consistent black/white styling. Apply fixed positioning when layouts are complex or require strict centering and symmetry.

## Workflow

1. Extract structure
- Identify main flow (linear order), expansions (parent → children), and correspondence links (cross-layer mapping).
- Capture constraints: columns, rows, symmetry, alignment, and which edges must be orthogonal.

2. Choose layout engine
- Use `dot` for simple ranked flows.
- Use `neato + pos + pin=true` for strict alignment, centering, or complex multi-row modules.

3. Define Word-style defaults
- Black borders/text, white background.
- All nodes use white fill unless explicitly requested otherwise.
- Main flow edges solid; correspondence edges dashed.

4. Plan coordinates when fixed layout is required
- Assign row `y` values and column `x` values on a fixed grid.
- Default gaps (points): vertical `60`, horizontal `100`.
- For nested blocks (A contains B/C), default inner gaps: vertical `30`, horizontal `30`.
- Keep equal vertical spacing for main rows.
- Center child rows on the parent node and space children evenly.
- 当连线出现交叉/绕行时，必须改为显式栅格 + 折点方案：用固定 `x/y` 栅格坐标放置节点，用不可见 bend 点拉直折线路径，避免 Graphviz 自动绕线。
- 逻辑判断节点的子节点水平间距规则：
  - 子节点到逻辑节点中心的水平距离必须 ≥ 逻辑节点宽度的一半。
  - True 分支必须沿逻辑节点正下方布局，水平距离为 0；False 分支水平展开。
  - 若 True 分支为正下方直连，则允许首段垂直向下；False 分支仍保持“先水平后竖直”的拐弯方向规则。

5. Build orthogonal edges
- Set `splines=ortho`.
- Prefer a single edge for a turned arrow. Use `tailport`/`headport`, `minlen`, and `constraint=false` to control the bend without splitting.
- If a bend must be forced with a point, use one invisible bend node and ensure only the final edge has an arrowhead:
  - `A -> bend [arrowhead=none]` then `bend -> B`
- To avoid visible gaps at bends, make bend nodes effectively zero-size:
  - `shape=point, width=0.001, height=0.001, fixedsize=true, style=invis`
- If a gap still appears, add a micro-overlap by inserting a tiny segment (two bend points 2–4pt apart in the first-segment direction) so the corner visually connects.
- Preferred fix for bend discontinuity:
  - Keep a single bend node and disable clipping on both segments:
    - `A -> bend [arrowhead=none, headclip=false, tailclip=false]`
    - `bend -> B [headclip=false, tailclip=false]`
  - This forces the two segments to visually overlap at the bend.
- Use invisible midpoint nodes to force right-angle forks from parent to children.
- Use invisible bend points for orthogonal dashed links.
- For turn direction, force the first segment using ports:
  - Left-then-down: `tailport=w`, `headport=n`
  - Right-then-down: `tailport=e`, `headport=n`
  - Left-then-up: `tailport=w`, `headport=s`
  - Right-then-up: `tailport=e`, `headport=s`
- When possible, keep a single edge and let Graphviz auto-generate the bend; avoid multi-segment edges that create visible gaps.
- Anchor points rule:
  - Decision (diamond) nodes must connect on exact vertices: top/right/bottom/left points.
  - Rectangle/ellipse nodes must connect at edge midpoints (top/right/bottom/left), not corners.
- Resolve direction conflicts by edge type:
  - Branches from decision nodes: first segment horizontal (left/right), then vertical to target.
  - Converging into a shared target below: first segment vertical down, then horizontal into the target side.
- 方向规则优先级：
  - True 分支正下方直连优先于“先水平后竖直”，避免人为制造拐弯。
  - False 分支必须先水平后竖直，确保分叉方向一致。
- 强化执行：若默认路由不满足首段方向，必须插入不可见 bend 点强制拐弯，且仅最终边保留箭头。
- 间距要求：优先使用默认栅格间距（纵向60、横向100），只有在节点重叠时才等比放大；禁止过度留白。
- 栅格放大上限：在无重叠的前提下，等比放大不超过 1.2x；超过则必须先重新排布节点。
- 连线起点视觉缝隙修正：
  - 若逻辑分支的起始边与逻辑节点边缘出现可见 gap，必须在起点方向插入“微折点”两段（2–4pt 间距），并设置 `headclip=false, tailclip=false`，让起点线段与逻辑节点边缘视觉重合。
  - 微折点仅用于逻辑节点的起始分支，普通节点禁止使用，避免短线段导致斜线或错位。
- 分支标签放置规则：
  - 禁止让“是/否”标签与节点或线段重叠。
  - 优先使用独立标签节点（`shape=none` + 固定 `pos`）放置在分支线段旁侧；避免使用 `xlabel` 造成贴线/重叠。
  - 标签节点必须透明（`color=none, fillcolor=none, penwidth=0`），避免出现不透明背景块。
  - True 分支（垂直向下）的“是”标签应放在该竖直线段的垂直中点附近，且轻微偏离连线（如 x 方向 10–20pt）。
  - 标签与对应线段的最短距离应 ≤ 20pt；超过则必须移动标签或缩短分支横向距离。
- 斜线排查路径：
  - 先检查标签是否与线段/节点发生重叠或贴线。
  - 再检查目标节点是否偏离栅格 `x/y` 轴（导致 ortho 失效）。
  - 最后检查 bend 点是否与线段同线重叠（必要时微移 2–4pt）。
- 回环/返回连线与元素位置关系：
  - 回环通道应放在最右侧“最小可行列”，即在不穿越任何节点边界的前提下，选择距离最右侧节点最近的列。
  - 回环竖线与最右侧节点的水平净距应 ≥ 该节点宽度的一半 + 10pt，以保证不贴边、不穿过节点。
  - 若可与栅格对齐则优先对齐；无法对齐时允许半步位移以减少空白。

6. Add module boxes (optional)
- Use four corner points connected with dashed edges to draw a rectangular module boundary.
- Ensure the box covers parent + child row with balanced padding.

7. Render and adjust
- Render with `neato -n2` when positions are fixed.
- Tighten or loosen child spacing, then resize the module box accordingly.
- 调整顺序建议：先调标签位置 → 再调分支横距 → 最后才整体缩放栅格。
8. Pre-delivery review
- Check layout overlap: render once and confirm nodes/boxes are not stacked or touching.
- If overlap occurs or Graphviz warns about “touching” boxes, scale all `pos` values up uniformly (e.g., x/y * 1.2) or increase the default gaps, then re-render.
- Ensure no edge is represented as multiple arrows; only one arrowhead should appear per logical edge.
9. Final delivery
- Provide both the DOT code and a rendered image as the final output.

## Word-Style DOT Defaults (Recommended)

```dot
graph [layout=neato, splines=ortho, overlap=false, outputorder=edgesfirst, bgcolor="white"];
node  [shape=box, style="filled", color="black", fontcolor="black", fillcolor="white", fontsize=11, margin="0.12,0.05"];
edge  [color="black", arrowsize=0.7, fontsize=11];
```

Use `style=dashed` for correspondence edges and module boxes.

## Alignment Rules for Complex Layouts

- Keep every row on the same `y`.
- Keep every column on the same `x`.
- Use the default grid gaps (vertical `60`, horizontal `100`) unless the user specifies otherwise.
- For nested blocks, use inner gaps (vertical `30`, horizontal `30`) and keep the block centered on the parent.
- For child rows, place children symmetrically around the parent:
  - 2 children: `x = xc ± d`
  - 3 children: `x = xc - d, xc, xc + d`
  - 4 children: `x = xc - 1.5d, xc - 0.5d, xc + 0.5d, xc + 1.5d`
- Align correspondence edges to the centerline of the target node.

For full coordinate patterns, see `references/graphviz-layout.md`.

## Resources (optional)

### references/
Use `references/graphviz-layout.md` for coordinate grids, orthogonal edge patterns, and module box templates.
