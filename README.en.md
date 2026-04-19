# Academic Research Skills

A curated set of agent skills for academic research, focused on visualizing research workflows and technical roadmaps.

Skill sources in this repo are organized under the `skills/` directory.

## Supported Skills

<!-- SKILLS:START -->
- `word-flowchart` - Create Microsoft Word-style flowcharts in Graphviz DOT with black/white styling, orthogonal arrows, and clean alignment; Mermaid conversion is supported as a use case.
- `cites-review` - Review, organize, and standardize references and in-text citations, especially for GB/T 7714-2015, CNKI extraction, citation cross-checking, and renumbering.
- `html-slide` - Generate HTML slides for thesis defense and professional presentations with a consistent academic design system, KPI cards, tables, and formula blocks.
- `markdown-to-word` - Convert Markdown academic drafts with formulas, tables, and images into Word documents for further editing, submission, or formatting.
<!-- SKILLS:END -->

## One-Click Install & Docs Update

Run from anywhere (no repo clone needed):

```bash
curl -fsSL https://raw.githubusercontent.com/WEN-JY/academic-research-skills/main/scripts/install.sh | sh
```

Default install directory: `$CODEX_HOME/skills` or `~/.codex/skills`. The script uses symlinks by default; for remote installs it first caches a repo snapshot at `~/.codex/.cache/academic-research-skills/repo` (or under `CODEX_HOME` when set).

Common options (append to the command):
- `--dest /path/to/skills` set install directory
- `--mode copy` use copy instead of symlink
- `--docs-only` update docs only
- `--install-only` install skills only

Example:

```bash
curl -fsSL https://raw.githubusercontent.com/WEN-JY/academic-research-skills/main/scripts/install.sh | sh -s -- --mode copy
```

## Usage

- Mention the skill name directly: `word-flowchart`
- Common use cases:
  - `word-flowchart`: turn research workflows, technical routes, and decision branches into Word-style flowcharts
  - `cites-review`: check reference formatting, verify in-text citation numbers, and organize CNKI references
  - `html-slide`: build HTML slides for thesis defense, progress reports, and project presentations
  - `markdown-to-word`: convert Markdown paper drafts into editable Word documents
- Example:
  - “Use word-flowchart to convert the following research workflow into a Word-style flowchart and output DOT + image.”
  - “Use cites-review to check whether these references follow GB/T 7714-2015.”
  - “Use html-slide to generate one HTML defense slide for research background and contributions.”
  - “Use markdown-to-word to convert this Markdown chapter draft into a Word document.”

## Docs

- `docs/README.md` (Chinese)
- `docs/README.en.md` (English)
- `docs/skills/word-flowchart.md` (Chinese)
- `docs/skills/word-flowchart.en.md` (English)
