---
name: markdown-to-word
description: "Convert Markdown files with LaTeX math, tables, and images to professionally formatted Word (.docx) documents. This skill should be used when users need to convert markdown academic papers to Word format, especially those following Zhejiang University Master of Engineering Management thesis body-format requirements such as FangSong body text, 1.5 line spacing, justified paragraphs, and three-line tables."
description_zh: 将 Markdown 学术文稿转换为 Word 文档，支持公式、表格与图片，默认对齐浙江大学工程管理硕士学位论文常用正文格式。
---

# Markdown to Word Conversion

## Overview

Convert Markdown (`.md`) files to Word (`.docx`) documents using the bundled Node.js converter. The current default style profile is aimed at the common body-format requirements of the Zhejiang University Master of Engineering Management thesis, especially for 正文、标题、段落和表格。

## Core Tool

All scripts are bundled inside this skill directory:

```
skills/markdown-to-word/
├── convert_md_to_docx.sh        # Main entry point
├── md2docx.mjs                  # Markdown → docx main converter
├── latex2math.mjs               # LaTeX math → docx math objects
├── SKILL.md
└── AGENTS.md
```

**Usage:**

```bash
skills/markdown-to-word/convert_md_to_docx.sh [-o output.docx] input.md
```

- If `-o` is omitted, output defaults to `input.docx`
- The script calls the bundled Node.js converter directly
- After generation, the resulting `.docx` is opened automatically for preview on the local machine

## Default Formatting Profile

- 正文：小四号、仿宋、首行缩进 2 字符
- 段落：1.5 倍行距、两端对齐
- 一级标题：小三号、仿宋、加黑
- 二级标题：四号、仿宋、加黑
- 三级标题：小四号、仿宋
- 表格：三线表
- 英文与数字：`Times New Roman`

These defaults are intended to match the common body-text conventions of the Zhejiang University Master of Engineering Management thesis format. Cover pages, declarations, headers/footers, page numbers, TOC, and some school-specific front/back matter may still need manual finishing in Word.

## Pipeline Architecture

```bash
input.md
  ↓ preprocessTabTables       # 制表符表格 → Markdown 表格
  ↓ ensureParagraphBreaks     # 补全段落断行
  ↓ fixChinesePunctuation     # 中文语境标点规范化
  ↓ markdown-it parse         # 解析标题、段落、列表、表格、公式、图片
  ↓ docx build                # 应用正文/标题/表格样式
  ↓ output.docx
```

## Key Behaviors

### 1. Paragraph Normalization

- Converts tab-separated pseudo-tables to standard Markdown tables
- Inserts missing paragraph breaks for Chinese academic drafts where lines are separated but blank lines are omitted
- Normalizes Chinese-context punctuation outside code and math spans

### 2. Typography Rules

- Body text uses 仿宋 for East Asian text and `Times New Roman` for Latin text
- Normal paragraphs use 2-character first-line indent
- Body paragraphs use justified alignment, 1.5 line spacing, and 0 pt spacing before/after
- Level-2 headings are normalized to `2.1  标题` with two 宋体 spaces after the number
- Level-3 headings are normalized to `2.1.1 标题` with one 宋体 space after the number
- Figure captions are normalized to `图1.1 图题`, rendered in 五号 + 单倍行距, and increase within each chapter
- Table captions are normalized to `表1.1 表题`, rendered in 五号 + 单倍行距, and increase within each chapter
- When a caption is immediately followed by an English `Figure ...` or `Table ...` line, the converter emits a centered bilingual two-line caption with the English line in `Times New Roman`
- Heading 1 is centered; heading 2 and heading 3 are left aligned

### 3. Table Rendering

- Markdown tables are converted to three-line tables
- Table-cell content is left aligned by default
- Vertical borders are removed by default
- Header row and bottom rule are emphasized to fit thesis-style tables
- Table captions are centered and renumbered by chapter when written as caption paragraphs

### 4. Formula Rendering

- Supports inline math `$...$`
- Supports display math `$$...$$`
- Display equations are numbered by chapter as `（1-1）`, `（1-2）`
- The formula body is centered and the equation number is right aligned
- Converts LaTeX expressions into docx math objects through `latex2math.mjs`

### 5. Citation And References

- Supports numeric citation markers written as `^[1]`, `^[2,3]`, `^[4-6]`
- Converts these markers into Word superscript citations such as `[1]`
- When a `参考文献` section exists, renumbers citations by first appearance in the body
- Reorders the bibliography to match citation order, keeps numbering continuous, and warns when entries are missing type labels or body citations do not match the bibliography

### 6. Page Layout And Image Rendering

- Sets A4 portrait page size with 工程师学院正文页边距: 上/下 2.54 cm, 左/右 3.17 cm
- Supports local PNG and JPEG images
- Auto-detects image size from file headers
- Scales down oversized images to fit the page width

## Preview Workflow

When the user asks for conversion preview images:

1. Update the target Markdown documentation page first.
2. Run `skills/markdown-to-word/convert_md_to_docx.sh` on that Markdown file.
3. Open both the Markdown source and the generated Word document side by side.
4. Let the user capture “before / after” screenshots from the local machine.

## File Structure

All bundled in `skills/markdown-to-word/` (see Core Tool section above).

## Dependencies

- **Node.js**: required for `md2docx.mjs`
