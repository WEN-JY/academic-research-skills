---
name: docx-thesis-format
description: "Detect and fix formatting issues in existing Word (.docx) thesis documents for Zhejiang University Engineering College requirements. Use when the user wants a deterministic Node.js workflow to inspect and automatically repair docx formatting, including body text, headings, section-title spacing, equation numbering, figure/table captions, three-line tables, headers/footers checks, and references."
description_zh: 对现有 `.docx` 学位论文进行格式检测与自动修复，输出修复后的文档、Markdown 报告与 JSON 报告。
---

# DOCX Thesis Format

## Overview

Use this skill to inspect and repair existing `.docx` thesis files. The workflow is script-first: Node.js reads the Word OOXML, reports non-compliant formatting, and automatically fixes safe items without relying on model rewriting.

The default profile targets Zhejiang University Engineering College Master of Engineering Management thesis formatting, extending the common rules used by `markdown-to-word`.

## Core Commands

All scripts are bundled in `skills/docx-thesis-format/`.

### Check Only

```bash
skills/docx-thesis-format/check_docx_format.sh \
  --out report.md \
  --json report.json \
  input.docx
```

### Fix

```bash
skills/docx-thesis-format/fix_docx_format.sh \
  -o output.formatted.docx \
  --report fix-report.md \
  --json fix-report.json \
  input.docx
```

### Check → Fix → Recheck

```bash
skills/docx-thesis-format/format_docx.sh \
  -o output.formatted.docx \
  --report format-report.md \
  --json format-report.json \
  input.docx
```

The fixer never overwrites the input file unless the user explicitly passes the same output path.

## Rule Profile

Default rules live at:

```text
skills/docx-thesis-format/rules/engineering-college.json
```

Use a custom profile with:

```bash
skills/docx-thesis-format/check_docx_format.sh --rules custom-rules.json input.docx
```

## Current Automated Checks and Fixes

- **Body text**: 小四仿宋, English/numbers Times New Roman, 1.5 line spacing, spacing before/after 0 pt, 2-character first-line indent, justified alignment.
- **Chapter headings**: `第1章` style, centered, bold, 小三仿宋.
- **Section headings**: `2.1  节标题`, exactly two spaces after the number; the space run uses 宋体.
- **Subsection headings**: `2.1.1 小节标题`, exactly one space after the number; the space run uses 宋体.
- **Equations**: chapter-based numbering such as `（1-1）`; existing wrong numbers are replaced; math paragraphs are centered and receive a right tab for the number.
- **Figure captions**: `图1.1 图题`, chapter-local numbering; captions are centered and should be below nearby figures.
- **Table captions**: `表1.1 表题`, chapter-local numbering; captions are centered and should be above tables.
- **Tables**: convert table borders to a basic three-line-table pattern; table-cell content is horizontally left-aligned.
- **References**: continuous `[1]` numbering and type-code detection such as `[J]`, `[M]`, `[D]`, `[EB/OL]`.
- **Headers/footers**: header line is justified with `浙江大学硕士学位论文` on the left and the current part title on the right; detect missing footer `PAGE` fields.

## Manual Review Items

The script reports but does not confidently repair:

- Header text, page-number placement, front-matter Roman page numbering.
- Cover/title-page exact layout.
- Semantic quality of Chinese/English abstracts and keyword accuracy.
- Reference authenticity, author names, publication metadata.
- Figure/table copyright or source legitimacy.
- Complex floating images, multi-part subfigures, complex merged-cell tables, and image-based formulas.

## Implementation Notes

The script modifies `.docx` in place at the OOXML layer:

```text
.docx zip → word/document.xml + styles/header/footer XML → detect/fix → repack .docx
```

It reuses bundled dependencies from `markdown-to-word/node_modules` to avoid network installation during normal use.
