---
name: markdown-to-word
description: "Convert Markdown files with LaTeX math, tables, and SVG images to professionally formatted Word (.docx) documents. This skill should be used when users need to convert markdown academic papers to Word format, especially those containing mathematical formulas, equation numbering, and Chinese/English mixed content. Uses a custom pandoc pipeline with Lua filters for math cleaning, equation number extraction, SVG rasterization, and OMML post-processing."
---

# Markdown to Word Conversion

## Overview

Convert Markdown (.md) files to Word (.docx) documents using a custom Pandoc pipeline specifically designed for academic papers with LaTeX math, Chinese typography, SVG figures, and equation numbering. The pipeline includes Lua filters and Python post-processors to ensure clean rendering in Word.

## Core Tool

All scripts are bundled inside this skill directory (self-contained):

```
.claude/skills/markdown-to-word/
├── convert_md_to_docx.sh        # Main entry point
├── filters/
│   ├── auto-math.lua            # Plain-text math → TeX
│   ├── math-clean.lua           # TeX spacing sanitization
│   ├── move-eqnum.lua           # Equation number extraction
│   └── svg-to-png.lua           # SVG → PNG rasterization
├── scripts/
│   ├── clean_docx_omml.mjs       # OMML post-processor
│   └── svg2png.sh               # Chrome-based SVG renderer
├── SKILL.md
└── AGENTS.md
```

**Usage:**

```bash
.claude/skills/markdown-to-word/convert_md_to_docx.sh [-o output.docx] input.md
```

- If `-o` is omitted, output defaults to `input.docx`
- The script auto-resolves `filters/` and `scripts/` relative to its own location via `$BASH_SOURCE`
- Resolves pandoc via `PANDOC_BIN` env var, system PATH, or local `./pandoc-*/bin/pandoc`

## Pipeline Architecture

```
input.md
  ↓ sed: \tag{x-y} → \text{(x-y)}
  ↓ pandoc with Lua filters:
  │   1. auto-math.lua    → heuristic plain-text math to TeX
  │   2. math-clean.lua   → sanitize TeX spacing commands & Unicode spaces
  │   3. svg-to-png.lua   → rasterize SVG images via Chrome
  │   4. move-eqnum.lua   → extract equation numbers from InlineMath
  ↓ pandoc output → .docx
  ↓ clean_docx_omml.mjs   → post-process OMML math text runs
  ↓ output.docx
```

## Pandoc Arguments

```bash
pandoc input.md \
  --from "markdown+tex_math_dollars+tex_math_single_backslash+raw_tex+pipe_tables+grid_tables+multiline_tables+table_captions+superscript+subscript-smart" \
  --to docx \
  --output output.docx \
  --resource-path "$input_dir:$input_dir/..:$script_dir:$script_dir/figs" \
  --lua-filter filters/auto-math.lua \
  --lua-filter filters/math-clean.lua \
  --lua-filter filters/svg-to-png.lua \
  --lua-filter filters/move-eqnum.lua
```

Key features:
- `-smart` disabled to avoid Unicode typographic punctuation near math
- `tex_math_dollars + tex_math_single_backslash` for full LaTeX math support
- `pipe_tables + grid_tables + multiline_tables` for all table formats
- `--resource-path` searches input dir, parent dir, script dir, and figs/

## Lua Filters

### 1. auto-math.lua
Heuristically converts plain-text math (common in CN PDF/Word exports) to TeX:
- Unicode math symbols: `∑ → \sum`, `∏ → \prod`, `× → \times`, `≤ → \le`, `≥ → \ge`, `→ → \to`
- Overbar notation: `R‾ → \bar{R}`
- Subscripts/superscripts: `COP_(i,t) → COP_{i,t}`, `TP_k^i → TP_{k}^{i}`
- Piecewise functions: `■( ... @ ... )┤ → \begin{cases} ... \\ ... \end{cases}`
- Equation numbers: `（2-1） → \text{（2-1）}`
- Only triggers on lines that look like formulas (has `=` or `∑/∏`, short enough, has index patterns)
- Can be disabled: `PANDOC_AUTO_MATH=0`

### 2. math-clean.lua
Sanitizes math text before OMML output (docx target only):
- Replaces TeX spacing commands (`\,`, `\;`, `\:`, `\!`, `\quad`, `\qquad`) with regular spaces
- Cleans Unicode typographic spaces (U+2000–U+200A, U+202F) and zero-width characters
- Normalizes fullwidth brackets `（）` to halfwidth `()` in math environments
- Collapses consecutive spaces

### 3. svg-to-png.lua
Converts SVG images to PNG for Word compatibility:
- Uses `scripts/svg2png.sh` (headless Chrome renderer)
- Extracts dimensions from SVG `width/height` attributes or `viewBox`
- Falls back to `rsvg-convert` if available
- Chrome path: `CHROME_BIN` env var (defaults to macOS Chrome.app)

### 4. move-eqnum.lua
Extracts equation numbers from InlineMath to avoid OMML rendering issues:
- Moves trailing `（4-8）` or `\text{（4-8）}` from math environment to plain text
- Only affects InlineMath (DisplayMath keeps numbers for centered display)
- Strips trailing TeX spacing commands before extracting

## Post-Processing

### clean_docx_omml.mjs (Node.js)
```bash
node scripts/clean_docx_omml.mjs output.docx
```
- Pure Node.js, no external npm dependencies (uses `unzip`/`zip` CLI for docx manipulation)
- Operates on `<m:t>...</m:t>` elements inside `word/*.xml` files in the DOCX zip
- Replaces thin/typographic spaces (U+2000–U+200A, U+202F) with regular spaces
- Replaces zero-width characters (U+200B, U+200C, U+200D, U+2060, U+FEFF, U+00A0)
- Fixes U+FFFD equation number encoding artifacts: `FFFD 4-8 FFFD → （4-8）`
- Atomic file replacement via temp directory
- Can be disabled: `DOCX_OMML_POSTCLEAN=0`

### svg2png.sh
```bash
scripts/svg2png.sh input.svg output.png [width height]
```
- Uses headless Google Chrome for rendering
- Auto-extracts dimensions from SVG attributes or viewBox
- Caps output at 4000x4000px
- Creates temporary HTML wrapper for Chrome screenshot

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PANDOC_BIN` | system pandoc | Override pandoc path |
| `PANDOC_AUTO_MATH` | `1` | Set `0` to disable auto-math filter |
| `DOCX_OMML_POSTCLEAN` | `1` | Set `0` to disable OMML post-cleaning |
| `CHROME_BIN` | `/Applications/Google Chrome.app/...` | Chrome binary for SVG rendering |
| `SVG2PNG_BIN` | `scripts/svg2png.sh` | SVG to PNG converter script |

## File Structure

All bundled in `.claude/skills/markdown-to-word/` (see Core Tool section above).

## Dependencies

- **pandoc**: `brew install pandoc`
- **Node.js**: For OMML post-processing (`clean_docx_omml.mjs`)
- **Google Chrome**: For SVG rendering (headless)
