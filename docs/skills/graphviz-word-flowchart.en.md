# graphviz-word-flowchart

A skill for creating Microsoft Word-style flowcharts, producing Graphviz DOT output; Mermaid conversion is supported as a use case.

## When To Use

- Research roadmaps
- Method flowcharts for papers
- Complex branching/merging workflows

## Input & Output

- Input: structured text, layered steps, a rough sketch, or Mermaid flowcharts
- Output:
  - Graphviz DOT code
  - (Optional) rendered image

## Example Prompt

- “Use graphviz-word-flowchart to convert the following research workflow into a Word-style flowchart, with black/white styling, orthogonal edges, strict alignment, and output DOT + image.”
- “Use graphviz-word-flowchart to convert the following Mermaid flowchart into a Word-style flowchart and output DOT + image.”

## Rendering Notes

- Use `neato -n2` for fixed coordinates
- Use `dot` for simple flows
- Layout guide: `graphviz-word-flowchart/references/graphviz-layout.md`
