---
name: markdown-to-nbu-mpa
description: "Convert Markdown academic drafts into Ningbo University MPA-style .docx files. Use when users need a scriptable workflow for Markdown to Word conversion with Ningbo University MPA body formatting, heading hierarchy, page margins, figure/table captions, equation numbering, and reference layout."
description_zh: 将 Markdown 学术文稿转换为宁波大学 MPA 学位论文风格的 `.docx`，适用于需要按宁波大学专业硕士论文要求统一正文、标题、图表题、公式、页边距和参考文献格式的场景。
---

# Markdown to Ningbo University MPA

## Overview

本 skill 使用独立的宁波大学 MPA 后处理脚本：

- `skills/markdown-to-nbu-mpa/nbu-md2docx.mjs`：先把 Markdown 转成基础 `.docx`
- `skills/markdown-to-nbu-mpa/nbu-docx-format.mjs`：再按宁波大学 MPA 规则进行二次格式化

为避免影响浙江大学等其他格式化流程，NBU 维护自己的基础转换器源码；仅通过 `node_modules` 符号链接复用 `skills/markdown-to-word` 已安装的依赖包。

当前自动化重点覆盖：

- 正文中文宋体、西文 `Times New Roman`、小四号、`1.3` 倍行距
- A4 版式与宁波大学要求的页边距
- `# 第1章` / `## 1.1` / `### 1.1.1` 三级标题格式
- 奇偶页页眉、居中页码、自动目录
- 图题、表题、三线表、参考文献、公式编号、脚注
- 图片默认转换为上下环绕、版心 100% 宽度，图题前后无额外空行
- 表格默认转换为三线表，内竖线为虚线

不把本 skill 视为“学校模板的完全替代品”。封面、英文封面、独创性声明、前置部分罗马页码等，仍需结合学院模板或人工复核。

## Core Command

```bash
skills/markdown-to-nbu-mpa/convert_md_to_nbu_mpa.sh input.md
```

如果不传 `-o`，默认输出 `input.docx`。默认不生成 `report.md` 或 `report.json`；只有调试格式问题时才显式传入 `--report` / `--json`。

## Markdown Conventions

为提高自动格式化命中率，优先按下面的结构写 Markdown：

- 论文题目不要占用 `#` 标题层级，放在文档开头 YAML front matter：
  ```yaml
  ---
  title: 象山县小学生近视防控协同治理研究
  ---
  ```
  该题目用于偶数页页眉；也可以用命令行 `--title "论文中文题目"` 覆盖。
- 一级标题用 `#`，建议直接写成：
  - `# 摘要`
  - `# Abstract`
  - `# 目  录`
  - `# 引言`
  - `# 第1章 XXX`
  - `# 第2章 XXX`
  - `# 参考文献`
  - `# 在学研究成果`
  - `# 致谢`
- 二级标题用 `## 1.1 XXX`
- 三级标题用 `### 1.1.1 XXX`
- 中文关键词单独成行：`关键词：关键词1，关键词2，关键词3`
- 英文关键词单独成行：`Keywords: keyword1, keyword2, keyword3`
- 块公式使用 `$$ ... $$`，编号由格式化脚本统一处理
- 图题单独成段，放在图片后；表题单独成段，放在表格前
- 脚注使用标准 Markdown 脚注语法：
  ```markdown
  正文内容需要脚注[^1]，后面继续正文。

  [^1]: 姚先国：《民营经济发展与劳资关系调整》，《浙江社会科学》2005年第2期，第78-85页。
  ```
  转换后正文标注会变成 Word 原生上标脚注编号。脚注编号使用宋体小五号；页底脚注内容中文用宋体小五号、英文用 Times New Roman 小五号，顶格、单倍行距，编号后空一格；正文与脚注之间插入空行和细横线分隔。
- 若文档没有单独的 `# 参考文献` 章节，脚本会根据 `[^1]: ...` 这类脚注定义在文末自动生成 `# 参考文献`，同时保留页底脚注。缩进续行会自动合并：
  ```markdown
  [^1]: 姚先国：《民营经济发展与劳资关系调整》，《浙江社会科学》
    2005年第2期，第78-85页。
  ```
  自动生成的参考文献标题为小三号黑体居中，标题后保留一行小三号空行；中文条目用宋体小四，外文条目用 Times New Roman 小四，字符间距标准、1.3 倍行距。参考文献会自动去掉脚注中的页码；外文期刊名、书名可继续用 `*...*` 标记，转换后会保留为斜体。

## Workflow

1. 运行 `convert_md_to_nbu_mpa.sh input.md` 先生成中间 `.docx`。
2. 脚本自动调用宁波大学 MPA 规则文件做二次修复。
3. 如需排查格式问题，可临时加 `--report output.report.md --json output.report.json` 查看未自动修复项。
4. 若需送审版，再把结果文档套入学院封面、声明页和页眉页脚模板。

## Rule File

宁波大学 MPA 规则文件位于：

```text
skills/markdown-to-nbu-mpa/rules/ningbo-mpa.json
```

若学院最终采用不同的公式编号形式，可直接调整：

- 当前默认：`（{chapter}-{index}）`
- 若需点号编号：改成 `（{chapter}.{index}）`

## References

学校格式摘要放在：

```text
skills/markdown-to-nbu-mpa/references/ningbo-mpa-format.md
```

仅当需要核对学校细则或继续扩展自动化范围时再读取该文件。

## Manual Review Items

以下内容默认只做提示，不保证全自动正确：

- 封面、英文封面、独创性声明
- 中文摘要与英文摘要是否分到独立页
- 自动目录域与目录页码刷新
- 在学研究成果的具体著录格式
- 复杂跨页大表、合并单元格表、多分图图题
