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
<!-- SKILLS:END -->
