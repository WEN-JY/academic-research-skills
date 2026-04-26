# Academic Research Skills

A curated set of agent skills for academic research, focused on visualizing research workflows and technical roadmaps.

Skill sources in this repo are organized under the `skills/` directory.

## Supported Skills

<!-- SKILLS:START -->
- `cites-review` - Review, organize, and format academic references and citations following GB/T 7714-2015 and other standards. This skill should be used when users need to: (1) Check and fix reference formatting errors, (2) Standardize citation styles, (3) Extract references from CNKI (知网) using browser scripts or Playwright automation, (4) Cross-check in-text citation numbers against the reference list, (5) Reorganize and renumber references after document restructuring.
- `docx-thesis-format` - Detect and fix formatting issues in existing Word (.docx) thesis documents for Zhejiang University Engineering College requirements. Use when the user wants a deterministic Node.js workflow to inspect and automatically repair docx formatting, including body text, headings, section-title spacing, equation numbering, figure/table captions, three-line tables, headers/footers checks, and references.
- `html-slide` - Generate HTML-based presentation slides for academic defense and professional presentations. This skill should be used when users need to create HTML slide pages with a consistent academic design system: navy-gold header, dot-pattern background, white content cards, KPI banners, data tables, and formula blocks. Each slide is a standalone 1280x720px HTML file that can be viewed in browser or converted to PPTX via html2pptx.js.
- `literature-review` - Search and synthesize high-quality literature for a research topic, expand literature review sections, and output citation-ordered references in GB/T 7714-2015 style. Use this skill when users need to: (1) retrieve recent high-quality papers around a theme, (2) supplement or rewrite a literature review based on an outline or draft, (3) merge new citations into an existing numbered reference list, (4) produce Markdown that stays compatible with cites-review and markdown-to-word.
- `markdown-to-word` - Convert Markdown files with LaTeX math, tables, and images to professionally formatted Word (.docx) documents. This skill should be used when users need to convert markdown academic papers to Word format, especially those following Zhejiang University Master of Engineering Management thesis body-format requirements such as FangSong body text, 1.5 line spacing, justified paragraphs, and three-line tables.
- `word-flowchart` - Create Word-style flowcharts in Graphviz DOT with black/white styling, orthogonal arrows, and clean alignment. Use when converting text or images into flowcharts, refining DOT layout/spacing, enforcing strict alignment, or building complex parent-child expansions with dashed correspondence links and module boxes.
<!-- SKILLS:END -->

## One-Click Install & Docs Update

Run from anywhere (no repo clone needed):

```bash
curl -fsSL https://raw.githubusercontent.com/WEN-JY/academic-research-skills/main/scripts/install.sh | sh
```

Default install directory: `$CODEX_HOME/skills` or `~/.codex/skills`. The script uses symlinks by default; for remote installs it first caches a repo snapshot at `~/.codex/.cache/academic-research-skills/repo` (or under `CODEX_HOME` when set).

Requirements:
- `curl` or `wget` for remote bootstrap
- POSIX `sh`

Common options (append to the command):
- `--dest /path/to/skills` set install directory
- `--mode copy` use copy instead of symlink
- `--docs-only` update docs only
- `--install-only` install skills only

Example:

```bash
curl -fsSL https://raw.githubusercontent.com/WEN-JY/academic-research-skills/main/scripts/install.sh | sh -s -- --mode copy
```

Run from a local clone:

```bash
sh scripts/install_and_update.sh --source-root .
```

## Usage

- Mention the skill name directly: `word-flowchart`
- Common use cases:
  - `word-flowchart`: turn research workflows, technical routes, and decision branches into Word-style flowcharts
  - `cites-review`: check reference formatting, verify in-text citation numbers, and organize CNKI references
  - `html-slide`: build HTML slides for thesis defense, progress reports, and project presentations
  - `literature-review`: expand literature review sections with recent references and numbered citations
  - `markdown-to-word`: convert Markdown paper drafts into editable Word documents
  - `docx-thesis-format`: inspect and repair existing thesis `.docx` files and output a fixed document plus reports
- Example:
  - “Use word-flowchart to convert the following research workflow into a Word-style flowchart and output DOT + image.”
  - “Use cites-review to check whether these references follow GB/T 7714-2015.”
  - “Use html-slide to generate one HTML defense slide for research background and contributions.”
  - “Use literature-review to expand a recent project risk management review section and output GB/T 7714-2015 references.”
  - “Use markdown-to-word to convert this Markdown chapter draft into a Word document.”
  - “Use docx-thesis-format to check and repair this thesis `.docx`, then output the formatted file and report.”

## markdown-to-word Highlights

`markdown-to-word` now covers FangSong body text, 0 pt spacing before/after, 1.5 line spacing, normalized section/subsection spacing, chapter-based figure/table captions, chapter-based display-equation numbering, and three-line tables with left-aligned cell content.

## docx-thesis-format Highlights

`docx-thesis-format` works on existing `.docx` thesis files through deterministic Node.js + OOXML processing. The current rule set includes:

- page size, section margins, document grid, Roman-numbered front matter, and body page numbering
- TOC field and TOC-order checks
- header/footer checks, including a justified header with a fixed left thesis label and a right-aligned current section title
- body paragraphs, heading spacing, chapter-based display-equation numbering
- chapter-based figure/table caption numbering
- three-line-table borders and left-aligned table-cell content
- reference numbering and type-marker checks

## Docs

- `docs/README.md` (Chinese)
- `docs/README.en.md` (English)
- `docs/skills/docx-thesis-format-review.md` (Chinese)
- `docs/skills/docx-thesis-format-extracted-rules.md` (Chinese)
- `docs/skills/markdown-to-word.md` (Chinese)
- `docs/skills/markdown-to-word.en.md` (English)
- `docs/skills/word-flowchart.md` (Chinese)
- `docs/skills/word-flowchart.en.md` (English)
