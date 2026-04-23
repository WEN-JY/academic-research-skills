[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python Version](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![GitHub Stars](https://img.shields.io/github/stars/WEN-JY/academic-research-skills?style=social)](https://github.com/WEN-JY/academic-research-skills)
[![GitHub Forks](https://img.shields.io/github/forks/WEN-JY/academic-research-skills?style=social)](https://github.com/WEN-JY/academic-research-skills)
[![GitHub Issues](https://img.shields.io/github/issues/WEN-JY/academic-research-skills)](https://github.com/WEN-JY/academic-research-skills/issues)
[![GitHub Last Commit](https://img.shields.io/github/last-commit/WEN-JY/academic-research-skills)](https://github.com/WEN-JY/academic-research-skills/commits/main)

# 学术研究技能集

面向学术研究场景的 Agent Skills 集合，聚焦"研究流程可视化、技术路线图"等高频需求，提供可复用、可扩展的技能模板。

仓库中的 skill 源码统一存放在 `skills/` 目录下。

## 已支持技能

<!-- SKILLS:START -->
- `word-flowchart` - 自主绘制 Microsoft Word 风格流程图（Graphviz DOT），强调黑白样式、正交连线与严格对齐；支持将 Mermaid 流程图作为输入进行转换。
- `cites-review` - 审查、整理并规范参考文献与正文引用，重点支持 GB/T 7714-2015，也可用于知网文献提取、引文核对与重编号。
- `html-slide` - 生成答辩汇报与专业展示场景的 HTML 幻灯片，内置统一的学术风格版式、指标卡片、表格与公式展示组件。
- `literature-review` - 围绕研究主题检索近年高质量文献、补写文献综述，并按正文引用顺序输出与 GB/T 7714-2015 兼容的参考文献列表。
- `markdown-to-word` - 将包含公式、表格、图片的 Markdown 学术文稿转换为 Word 文档，默认对齐浙江大学工程管理硕士学位论文常用正文格式。
- `docx-thesis-format` - 对现有 `.docx` 学位论文进行格式检查与自动修复，覆盖正文、章/节/小节标题、公式编号、图表题、三线表、目录与页眉页脚等学院规范项。
<!-- SKILLS:END -->

## 一键安装与文档更新

在任意目录执行（无需克隆仓库）：

```bash
curl -fsSL https://raw.githubusercontent.com/WEN-JY/academic-research-skills/main/scripts/install.sh | sh
```

默认安装目录：`$CODEX_HOME/skills` 或 `~/.codex/skills`，默认使用软链接（便于更新）；远程安装时会先缓���仓库快照到 `~/.codex/.cache/academic-research-skills/repo`（若设置了 `CODEX_HOME`，则使用对应缓存目录）。

常用参数（追加在命令末尾）：
- `--dest /path/to/skills` 指定安装目录
- `--mode copy` 使用复制安装（不使用软链接）
- `--docs-only` 仅更新文档
- `--install-only` 仅安装技能

示例：

```bash
curl -fsSL https://raw.githubusercontent.com/WEN-JY/academic-research-skills/main/scripts/install.sh | sh -s -- --mode copy
```

## 使用

- 在对话中直接点名技能：`word-flowchart`
- 常见使用场景：
  - `word-flowchart`：把研究流程、技术路线、决策分支整理成 Word 风格流程图
  - `cites-review`：检查参考文献格式、核对正文引文编号、整理知网文献条目
  - `html-slide`：制作论文答辩、阶段汇报、项目展示用的 HTML 幻灯片
  - `literature-review`：围绕研究主题补检索、补文献综述，并生成可直接落入论文的编号引文与参考文献
  - `markdown-to-word`：把 Markdown 论文稿快速转换为可提交或可继续排版的 Word 文档
  - `docx-thesis-format`：检查并修复现有 Word 论文的排版细节，输出修复后文档与格式报告
- 示例：
  - "使用 word-flowchart 把下面的研究流程整理成 Word 风格流程图，并输出 DOT + 图片。"
  - "使用 cites-review 检查这份参考文献是否符合 GB/T 7714-2015。"
  - "使用 html-slide 生成一页论文答辩 HTML 幻灯片，展示研究背景与创新点。"
  - "使用 literature-review 围绕项目风险管理补充近3年文献综述，并按 GB/T 7714-2015 输出参考文献。"
  - "使用 markdown-to-word 把这份 Markdown 章节稿转换成 Word 文档。"
  - "使用 docx-thesis-format 检查并修复这份 `.docx` 学位论文格式，输出修复版文档和报告。"

## markdown-to-word 转换预览

`markdown-to-word` 默认按浙江大学工程管理硕士学位论文常用正文格式输出，覆盖正文小四号仿宋、段前段后 0 磅、1.5 倍行距、章标题小三号仿宋加黑、节/小节标题空格规范、公式编号、图表题按章编号与三线表等排版要素。

![markdown-to-word 转换前后对比](docs/skills/markdown-to-word.png)

详细说明见 `docs/skills/markdown-to-word.md`。

## docx-thesis-format 能力摘要

`docx-thesis-format` 面向已有 `.docx` 学位论文，采用 Node.js + OOXML 方式进行确定性检测与自动修复，当前已覆盖：

- 页面大小、分节边距、文档网格、前置罗马页码与正文页码切换
- 页眉页脚检测，支持“浙江大学硕士学位论文”左侧固定、当前部分标题右侧对齐的页眉规则
- 目录域与目录顺序检测
- 正文段落、章/节/小节标题、块公式编号 `（1-1）`
- 图题 `图1.1`、表题 `表1.1` 按章内自增
- 三线表边框与单元格内容水平居左
- 参考文献编号与类型标识基础检测

相关文档：

- `docs/skills/docx-thesis-format-review.md`
- `docs/skills/docx-thesis-format-extracted-rules.md`

## 文档

- `docs/README.md`（中文）
- `docs/README.en.md`（English）
- `docs/skills/docx-thesis-format-review.md`（中文）
- `docs/skills/docx-thesis-format-extracted-rules.md`（中文）
- `docs/skills/markdown-to-word.md`（中文）
- `docs/skills/markdown-to-word.en.md`（English）
- `docs/skills/word-flowchart.md`（中文）
- `docs/skills/word-flowchart.en.md`（English）
