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

Local install/update:

```bash
sh scripts/install_and_update.sh --source-root .
```

Example with arguments:

```bash
curl -fsSL https://raw.githubusercontent.com/WEN-JY/academic-research-skills/main/scripts/install.sh | sh -s -- --mode copy
```

## Dependencies

- Graphviz is recommended for rendering images (`dot`/`neato`)
- DOT generation works without the rendering toolchain

## Skill List

<!-- SKILLS:START -->
- `cites-review` - Review, organize, and format academic references and citations following GB/T 7714-2015 and other standards. This skill should be used when users need to: (1) Check and fix reference formatting errors, (2) Standardize citation styles, (3) Extract references from CNKI (知网) using browser scripts or Playwright automation, (4) Cross-check in-text citation numbers against the reference list, (5) Reorganize and renumber references after document restructuring.
- `docx-thesis-format` - Detect and fix formatting issues in existing Word (.docx) thesis documents for Zhejiang University Engineering College requirements. Use when the user wants a deterministic Node.js workflow to inspect and automatically repair docx formatting, including body text, headings, section-title spacing, equation numbering, figure/table captions, three-line tables, headers/footers checks, and references.
- `html-slide` - Generate HTML-based presentation slides for academic defense and professional presentations. This skill should be used when users need to create HTML slide pages with a consistent academic design system: navy-gold header, dot-pattern background, white content cards, KPI banners, data tables, and formula blocks. Each slide is a standalone 1280x720px HTML file that can be viewed in browser or converted to PPTX via html2pptx.js.
- `literature-review` - Search and synthesize high-quality literature for a research topic, expand literature review sections, and output citation-ordered references in GB/T 7714-2015 style. Use this skill when users need to: (1) retrieve recent high-quality papers around a theme, (2) supplement or rewrite a literature review based on an outline or draft, (3) merge new citations into an existing numbered reference list, (4) produce Markdown that stays compatible with cites-review and markdown-to-word.
- `markdown-to-word` - Convert Markdown files with LaTeX math, tables, and images to professionally formatted Word (.docx) documents. This skill should be used when users need to convert markdown academic papers to Word format, especially those following Zhejiang University Master of Engineering Management thesis body-format requirements such as FangSong body text, 1.5 line spacing, justified paragraphs, and three-line tables.
- `word-flowchart` - Create Word-style flowcharts in Graphviz DOT with black/white styling, orthogonal arrows, and clean alignment. Use when converting text or images into flowcharts, refining DOT layout/spacing, enforcing strict alignment, or building complex parent-child expansions with dashed correspondence links and module boxes.
<!-- SKILLS:END -->

## Notes

- `markdown-to-word` now includes 0 pt spacing before/after body paragraphs, normalized section/subsection spacing, chapter-based figure/table captions, and chapter-based display-equation numbering.
- `docx-thesis-format` now includes page-size/section-margin checks, TOC-order checks, justified-header checks, and three-line-table repair with left-aligned cell content.
