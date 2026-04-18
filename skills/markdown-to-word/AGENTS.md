# Markdown to Word Conversion

Convert Markdown files with LaTeX math, tables, and SVG images to Word (.docx) using a custom Pandoc pipeline with Lua filters and OMML post-processing.

## When to Use

- User wants to convert a `.md` file (especially academic papers) to `.docx`
- Document contains LaTeX math, equation numbering, or SVG images
- Chinese/English mixed content with typographic space issues in Word

## Core Command

All scripts bundled in `.claude/skills/markdown-to-word/` (self-contained).

```bash
.claude/skills/markdown-to-word/convert_md_to_docx.sh [-o output.docx] input.md
```

## Pipeline

```
input.md → sed(\tag→\text) → pandoc + 4 Lua filters → .docx → clean_docx_omml.mjs → output.docx
```

### Lua Filters (in order):
1. **auto-math.lua** - Heuristic plain-text math → TeX (Unicode symbols, subscripts, piecewise). Disable: `PANDOC_AUTO_MATH=0`
2. **math-clean.lua** - Sanitize `\,\;\:\!` spacing commands and U+2000–U+200A Unicode spaces in math (docx only)
3. **svg-to-png.lua** - Rasterize SVG via headless Chrome (`svg2png.sh`)
4. **move-eqnum.lua** - Extract equation numbers `（4-8）` from InlineMath to plain text

### Post-processor:
- **clean_docx_omml.mjs** - Remove thin/zero-width spaces from `<m:t>` OMML runs, fix U+FFFD artifacts. Disable: `DOCX_OMML_POSTCLEAN=0`

## Pandoc From Format

```
markdown+tex_math_dollars+tex_math_single_backslash+raw_tex+pipe_tables+grid_tables+multiline_tables+table_captions+superscript+subscript-smart
```

## Environment Variables

- `PANDOC_BIN` - Override pandoc path
- `PANDOC_AUTO_MATH=0` - Disable auto-math filter
- `DOCX_OMML_POSTCLEAN=0` - Disable OMML post-cleaning
- `CHROME_BIN` - Chrome binary for SVG rendering (default: macOS Chrome.app)

## File Structure

All bundled in `.claude/skills/markdown-to-word/` — see SKILL.md for full tree.

## Dependencies

- pandoc, Node.js, Google Chrome (for SVG)
