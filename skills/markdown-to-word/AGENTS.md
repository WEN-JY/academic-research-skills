# Markdown to Word Conversion

Convert Markdown files with LaTeX math, tables, and images to Word (`.docx`) using the bundled Node.js converter. The default output style is aimed at the common body-text rules of the Zhejiang University Master of Engineering Management thesis format.

## When to Use

- User wants to convert a `.md` file (especially academic papers) to `.docx`
- Document contains LaTeX math, tables, images, or mixed Chinese/English text
- User wants 正文小四仿宋、1.5 倍行距、章标题小三加黑、两端对齐、三线表等论文格式

## Core Command

All scripts are bundled in `skills/markdown-to-word/`.

```bash
skills/markdown-to-word/convert_md_to_docx.sh [-o output.docx] input.md
```

## Default Formatting Profile

- 正文：小四号、仿宋、首行缩进 2 字符
- 段落：段前 0 磅、段后 0 磅、1.5 倍行距、两端对齐
- 一级标题：小三号、仿宋、加黑
- 二级标题：四号、仿宋、加黑
- 三级标题：小四号、仿宋
- 表格：三线表
- 英文与数字：`Times New Roman`

## Pipeline

```
input.md → 预处理（制表符表格 / 段落断行 / 中文标点） → markdown-it 解析 → docx 生成 → output.docx
```

## Key Behaviors

- 支持标题、段落、列表、引用块、代码块
- 支持行内公式与块公式
- 支持 Markdown 表格，并默认输出三线表
- 支持本地图片插入
- 支持 `^[1]`、`^[2,3]`、`^[4-6]` 形式的数字引文上标
- 生成完成后自动打开 Word 文件预览

## Main Files

- `skills/markdown-to-word/convert_md_to_docx.sh`
- `skills/markdown-to-word/md2docx.mjs`
- `skills/markdown-to-word/latex2math.mjs`

## Dependencies

- Node.js
