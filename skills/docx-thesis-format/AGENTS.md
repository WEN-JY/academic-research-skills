# DOCX Thesis Format

对已有 `.docx` 学位论文进行格式检测与自动修复，目标规则为浙江大学工程师学院工程管理硕士论文规范。所有执行优先使用 bundled Node.js 脚本，避免依赖模型直接改 Word 内容。

## When to Use

- 用户有已有 Word 文档，需要检测是否符合学院格式
- 用户需要自动修复正文、标题、公式、图表、参考文献等格式
- 用户要求输出可复核检测报告

## Core Commands

```bash
skills/docx-thesis-format/check_docx_format.sh [--out report.md] [--json report.json] input.docx
skills/docx-thesis-format/fix_docx_format.sh [-o output.docx] [--report report.md] input.docx
skills/docx-thesis-format/format_docx.sh [-o output.docx] [--report report.md] input.docx
```

## Key Rules

- 正文：小四仿宋，英文数字 Times New Roman，1.5 倍行距，首行缩进 2 字符，两端对齐
- 节标题：`2.1  节标题`，编号后两个宋体空格
- 小节标题：`2.1.1 小节标题`，编号后一个宋体空格
- 公式：`（1-1）`、`（1-2）`，按章内自增，公式居中、编号右对齐
- 图题：`图1.1 图题`，按章内自增，图题位于图下方并居中
- 表题：`表1.1 表题`，按章内自增，表题位于表上方并居中
- 表格：三线表，单元格内容水平居左对齐
- 参考文献：`[1]` 连续编号，检测文献类型标识
- 页眉：两端对齐，左侧为 `浙江大学硕士学位论文`，右侧为当前部分标题，如 `图目录`

## Main Files

- `skills/docx-thesis-format/docx-format.mjs`
- `skills/docx-thesis-format/check_docx_format.sh`
- `skills/docx-thesis-format/fix_docx_format.sh`
- `skills/docx-thesis-format/format_docx.sh`
- `skills/docx-thesis-format/rules/engineering-college.json`
