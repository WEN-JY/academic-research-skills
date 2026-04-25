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

`docx-thesis-format` 面向已有 `.docx` 学位论文，采用 Node.js + OOXML 方式进行确定性检测与自动修复。下面按工程师学院论文格式要求的细分章节汇总当前已实现能力。

当前共梳理 `48` 项能力点，其中 `41` 项支持自动检查与修复，`2` 项支持检测但仍以人工复核为主，`5` 项尚待实现，主要集中在语义类校对、复杂跨页对象处理以及文献与正文引用的一致性交叉核对。

| 模块 | 要求 | 已实现能力 | 状态 |
|------|------|------|------|
| 页面与版心 | A4 纵向页面 | 检查并修复页面尺寸 `pgSz` | ✅ |
| 页面与版心 | 上下 2.54cm、左右 3.17cm | 多档页边距模板匹配与修复 | ✅ |
| 页面与版心 | 文档网格行距基准 | `docGrid` 检查与修复 | ✅ |
| 正文格式 | 中文仿宋、西文 `Times New Roman`、小四 | 正文段落与 run 级字体字号检查修复 | ✅ |
| 正文格式 | 段前 0、段后 0 | 段落间距检查修复 | ✅ |
| 正文格式 | 1.5 倍行距 | 行距检查修复 | ✅ |
| 正文格式 | 两端对齐 | 对齐方式检查修复 | ✅ |
| 正文格式 | 首行缩进 2 字符 | 首行缩进检查修复 | ✅ |
| 正文格式 | 无意义空行删除 | 纯空白段落检测与移除 | ✅ |
| 正文格式 | 中文标点规范、术语统一、物理量符号规范 | 暂未实现语义层检查 | ❌ |
| 标题层级 | 章标题：小三仿宋加粗居中、段前分页 | 识别 `第N章` 与一级标题样式并修复 | ✅ |
| 标题层级 | 节标题：`N.N  标题` | 编号后 2 空格、宋体空格、四号仿宋加粗、左对齐 | ✅ |
| 标题层级 | 小节标题：`N.N.N 标题` | 编号后 1 空格、宋体空格、小四仿宋、左对齐 | ✅ |
| 标题层级 | 标题层级联动章号 | 从章/节/小节编号同步当前章号 | ✅ |
| 公式格式 | 块公式居中 | 公式对象内部居中、外层段落 tab 布局修复 | ✅ |
| 公式格式 | 公式编号右对齐 | 中间 tab + 右侧编号 tab 排版 | ✅ |
| 公式格式 | 按章编号 `（1-1）` | 正文章节内连续编号、跨章重置 | ✅ |
| 公式格式 | 附录编号 `（A-1）` | 附录公式编号支持 | ✅ |
| 公式格式 | 错号、重复号、旧号残留 | 替换错误编号、清除重复编号与尾部旧编号 | ✅ |
| 公式格式 | 图片公式、复杂语义公式 | 仅有限检测，仍需人工复核 | ⚠️ |
| 图题与插图 | 图题 `图N.N 图题` 按章编号 | 图题编号检查修复 | ✅ |
| 图题与插图 | 图题位于图下方、居中 | 位置与对齐检查修复 | ✅ |
| 图题与插图 | 五号仿宋 / `Times New Roman`、单倍行距 | 字体字号行距检查修复 | ✅ |
| 图题与插图 | 缺失图题 | 可自动补全占位图题 | ✅ |
| 图题与插图 | 图片清晰度、版权、尺寸适配 | 暂未实现 | ❌ |
| 表题与表格 | 表题 `表N.N 表题` 按章编号 | 中文表题编号检查修复 | ✅ |
| 表题与表格 | 英文表题 `Table N.N ...` | 识别为同一张表的英文副标题并检查样式 | ✅ |
| 表题与表格 | 表题位于表上方、居中 | 位置与对齐检查修复 | ✅ |
| 表题与表格 | 五号仿宋 / `Times New Roman`、单倍行距 | 中英文表题字体字号行距检查修复 | ✅ |
| 表题与表格 | 三线表 | 边框转换为三线表样式 | ✅ |
| 表题与表格 | 单元格内容水平左对齐 | 表内段落对齐检查修复 | ✅ |
| 表题与表格 | 表文五号仿宋 / `Times New Roman` | 表内段落与 run 级字体字号检查修复 | ✅ |
| 表题与表格 | 跨页重复标题行 | 设置重复表头 `tblHeader` | ✅ |
| 表题与表格 | 缺失表题 | 可自动补全占位表题 | ✅ |
| 表题与表格 | 自动续表拆分、每页底线 | 暂未实现 | ❌ |
| 参考文献 | 顺序编码 `[1][2][3]` 连续 | 编号连续性检查修复 | ✅ |
| 参考文献 | 类型标识 `[J]/[M]/[D]/[EB/OL]` 等 | 类型正则检测 | ✅ |
| 参考文献 | 小四仿宋 / `Times New Roman` | 字体字号检查修复 | ✅ |
| 参考文献 | 1.5 倍行距 | 行距检查修复 | ✅ |
| 参考文献 | 正文引用号与文后编号一致性 | 暂未实现交叉核对 | ❌ |
| 参考文献 | 文献真实性与著录完整性 | 暂未实现 | ❌ |
| 目录、页眉、页脚与页码 | 目录顺序 | `致谢 → 摘要 → Abstract → 图目录 → 表目录 → …` 顺序检测 | ✅ |
| 目录、页眉、页脚与页码 | TOC 域 | 自动目录域检测 | ✅ |
| 目录、页眉、页脚与页码 | 页眉规则 | “浙江大学硕士学位论文 + 当前部分标题”检测 | ✅ |
| 目录、页眉、页脚与页码 | 页眉字体字号 | 仿宋、小五检测 | ✅ |
| 目录、页眉、页脚与页码 | 页脚页码域 | `PAGE` 域检测 | ✅ |
| 目录、页眉、页脚与页码 | 前置罗马页码、正文阿拉伯页码 | 分节页码格式检查修复 | ✅ |
| 目录、页眉、页脚与页码 | 页眉具体文字回写、复杂前置分节 | 仍以人工复核为主 | ⚠️ |

相关文档：

- `skills/docx-thesis-format/README.md`
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
