# graphviz-word-flowchart

A skill that converts research workflows/technical roadmaps into Word-style flowcharts, producing Graphviz DOT output.

## When To Use

- Research roadmaps
- Method flowcharts for papers
- Complex branching/merging workflows

## Input & Output

- Input: structured text, layered steps, or a rough sketch
- Output:
  - Graphviz DOT code
  - (Optional) rendered image

## Example Prompt

- “Use graphviz-word-flowchart to convert the following research workflow into a Word-style flowchart, with black/white styling, orthogonal edges, strict alignment, and output DOT + image.”

## Rendering Notes

- Use `neato -n2` for fixed coordinates
- Use `dot` for simple flows
- Layout guide: `graphviz-word-flowchart/references/graphviz-layout.md`
