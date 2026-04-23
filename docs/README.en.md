# Docs Index

This folder provides installation and usage notes for each skill. Skill sources in this repo are organized under the `skills/` directory.

## Quick Start

1. Copy or symlink skill folders to `$CODEX_HOME/skills` or `~/.codex/skills`
2. Reload your agent runtime
3. Mention the skill name in your prompt and provide a structured request

## Automation Script

```bash
curl -fsSL https://raw.githubusercontent.com/WEN-JY/academic-research-skills/main/scripts/install.sh | sh
```

Installs skills (symlink by default) and updates the skill lists in `README.md` and `docs/README.md`; for remote installs it first caches a repo snapshot at `~/.codex/.cache/academic-research-skills/repo` (or under `CODEX_HOME` when set).

Example with arguments:

```bash
curl -fsSL https://raw.githubusercontent.com/WEN-JY/academic-research-skills/main/scripts/install.sh | sh -s -- --mode copy
```

## Dependencies

- Graphviz is recommended for rendering images (`dot`/`neato`)
- DOT generation works without the rendering toolchain

## Skill List

<!-- SKILLS:START -->
- `word-flowchart` - Create Microsoft Word-style flowcharts in Graphviz DOT with black/white styling, orthogonal arrows, and clean alignment; Mermaid conversion is supported as a use case.
- `cites-review` - Review and normalize references and in-text citations for GB/T 7714-2015, CNKI extraction, citation cross-checking, and renumbering workflows.
- `html-slide` - Generate HTML slides for academic defense and reporting with a consistent visual system, content cards, tables, and formula blocks.
- `literature-review` - Retrieve recent high-quality literature for a research topic, expand literature review sections, and output GB/T 7714-2015 compatible references in citation order.
- `markdown-to-word` - Convert Markdown academic writing into Word documents with support for formulas, tables, and images, with a default body-style profile aligned to Zhejiang University Master of Engineering Management thesis formatting.
- `docx-thesis-format` - Inspect and auto-fix existing thesis `.docx` files, covering body text, headings, equation numbering, captions, three-line tables, TOC, headers, and footers with report outputs.
<!-- SKILLS:END -->

## Notes

- `markdown-to-word` now includes 0 pt spacing before/after body paragraphs, normalized section/subsection spacing, chapter-based figure/table captions, and chapter-based display-equation numbering.
- `docx-thesis-format` now includes page-size/section-margin checks, TOC-order checks, justified-header checks, and three-line-table repair with left-aligned cell content.
