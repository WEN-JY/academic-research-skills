# Academic Research Skills

A curated set of agent skills for academic research, focused on visualizing research workflows and technical roadmaps.

## Supported Skills

<!-- SKILLS:START -->
- `graphviz-word-flowchart` - Create Microsoft Word-style flowcharts in Graphviz DOT with black/white styling, orthogonal arrows, and clean alignment; Mermaid conversion is supported as a use case.
<!-- SKILLS:END -->

## One-Click Install & Docs Update

Run from anywhere (no repo clone needed):

```bash
curl -fsSL https://raw.githubusercontent.com/WEN-JY/academic-research-skills/main/scripts/install.sh | sh
```

Default install directory: `$CODEX_HOME/skills` or `~/.codex/skills`. The script uses symlinks by default.

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

- Mention the skill name directly: `graphviz-word-flowchart`
- Example:
  - “Use graphviz-word-flowchart to convert the following research workflow into a Word-style flowchart and output DOT + image.”

## Docs

- `docs/README.md` (Chinese)
- `docs/README.en.md` (English)
- `docs/skills/graphviz-word-flowchart.md` (Chinese)
- `docs/skills/graphviz-word-flowchart.en.md` (English)
