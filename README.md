[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Stars](https://img.shields.io/github/stars/WEN-JY/academic-research-skills?style=social)](https://github.com/WEN-JY/academic-research-skills)
[![GitHub Forks](https://img.shields.io/github/forks/WEN-JY/academic-research-skills?style=social)](https://github.com/WEN-JY/academic-research-skills)
[![GitHub Issues](https://img.shields.io/github/issues/WEN-JY/academic-research-skills)](https://github.com/WEN-JY/academic-research-skills/issues)
[![GitHub Last Commit](https://img.shields.io/github/last-commit/WEN-JY/academic-research-skills)](https://github.com/WEN-JY/academic-research-skills/commits/main)

# 论文skills

面向ZJU MEM场景的 Agent Skills 仓库，聚焦文献综述、参考文献整理、论文排版、答辩材料生成与研究流程可视化。仓库中的 skill 源码统一放在 `skills/` 目录，每个 skill 至少包含一个 `SKILL.md`，供支持 skill 机制的智能体按名称调用。
 0606 开始支持宁波大学的MPA格式转换

这个仓库既包含提示型工作流，也包含可直接执行的脚本、模板和规则文件：

- `word-flowchart`、`cites-review`、`literature-review` 以提示工作流为主
- `markdown-to-word`、`docx-thesis-format`、`html-slide` 额外附带本地脚本或模板资产

## 适用场景

- 把研究技术路线、流程、机制图整理成规范的 Word 风格流程图
- 围绕主题补检索、补综述，并整理成 GB/T 7714-2015 兼容的参考文献
- 把 Markdown 论文草稿转换成可继续排版的 Word 文档
- 对现有 `.docx` 论文做格式体检、自动修复和复查
- 生成答辩或阶段汇报用的 HTML 幻灯片

## 当前技能

<!-- SKILLS:START -->
- `authorial-rewrite` - 用于降低 AI 率和机器腔的改写 skill，将 AI 辅助生成的论文草稿调整为更自然、更贴近作者表达的学术文本。
- `cites-review` - 审查、整理并规范参考文献与正文引用，适用于 GB/T 7714-2015 校验、知网文献提取、引文核对与重编号。
- `docx-thesis-format` - 对现有 `.docx` 学位论文进行格式检测与自动修复，输出修复后的文档、Markdown 报告与 JSON 报告。
- `html-slide` - 生成学术答辩与汇报场景的 HTML 幻灯片，提供统一视觉风格、图文布局、表格与公式展示组件。
- `literature-review` - 结合研究主题、提纲或草稿检索近年高质量文献，补写文献综述，并生成按正文顺序编号的 GB/T 7714-2015 参考文献。
- `markdown-to-word` - 将 Markdown 学术文稿转换为 Word 文档，支持公式、表格与图片，默认对齐浙江大学工程管理硕士学位论文常用正文格式。
- `word-flowchart` - 使用 Graphviz DOT 绘制 Word 风格流程图，强调黑白样式、正交连线与严格对齐，适合研究技术路线与复杂流程整理。
<!-- SKILLS:END -->

## 技能速览

| Skill | 典型输入 | 典型输出 | 本地脚本/资产 |
|------|------|------|------|
| `authorial-rewrite` | AI 草稿、段落片段、已有提纲、导师意见 | 降低 AI 率后的学术文本、改写策略、问题诊断 | 以工作流为主 |
| `word-flowchart` | 文字流程、手绘草图、截图、Mermaid | DOT 源码、流程图图片 | Graphviz 渲染环境可选 |
| `cites-review` | 参考文献列表、正文引文、知网页面 | 规范化参考文献、重编号结果、核对意见 | 以工作流为主 |
| `html-slide` | 论文提纲、答辩稿、章节内容 | `slides/*.html`、`slides/大纲.md`、可选 PPTX | 模板、导出脚本 |
| `literature-review` | 研究主题、已有综述、章节提纲 | 补写后的综述正文、引用映射表、参考文献列表 | 以工作流为主 |
| `markdown-to-word` | `.md` 文稿、图片、本地公式 | `.docx` 文档 | `convert_md_to_docx.sh` |
| `docx-thesis-format` | 现有 `.docx` 论文 | 修复后 `.docx`、检查报告、JSON 报告 | `check/fix/format_docx.sh` |

## 安装

### 方式一：远程一键安装

适合直接把 skill 安装到本机的 Codex/Agent 技能目录。

```bash
curl -fsSL https://raw.githubusercontent.com/WEN-JY/academic-research-skills/main/scripts/install.sh | sh
```

安装脚本要求：

- 需要 `curl` 或 `wget`
- 需要 POSIX `sh`
- 默认安装到 `$CODEX_HOME/skills` 或 `~/.codex/skills`
- 默认使用软链接安装，便于后续同步更新
- 远程执行时会先缓存仓库快照到 `~/.codex/.cache/academic-research-skills/repo`

常用参数：

| 参数 | 作用 |
|------|------|
| `--dest /path/to/skills` | 指定安装目录 |
| `--mode symlink` | 软链接安装，默认值 |
| `--mode copy` | 复制安装，适合不希望依赖源仓库路径的场景 |
| `--docs-only` | 只更新仓库文档中的 skill 列表，不执行安装 |
| `--install-only` | 只安装 skills，不更新文档 |
| `--source-root /path/to/repo` | 指定本地仓库作为安装源 |

示例：

```bash
curl -fsSL https://raw.githubusercontent.com/WEN-JY/academic-research-skills/main/scripts/install.sh | sh -s -- --mode copy
```

### 方式二：本地仓库安装或更新

适合已经克隆本仓库、希望从本地目录安装或维护文档的人。

```bash
sh scripts/install_and_update.sh
```

常见用法：

```bash
# 安装到自定义目录
sh scripts/install_and_update.sh --dest ~/.codex/skills

# 只刷新 README 中的 skill 列表
sh scripts/install_and_update.sh --docs-only --source-root .

# 从当前仓库复制安装
sh scripts/install_and_update.sh --mode copy --source-root .
```

### 运行依赖建议

不同 skill 的本地依赖不同，建议按需准备：

- `Node.js`：`markdown-to-word`、`docx-thesis-format`、`html-slide` 需要
- `Graphviz`：`word-flowchart` 在需要输出图片时建议安装 `dot` 或 `neato`
- 浏览器 / Office：用于人工预览导出的 HTML、DOCX 或截图结果

## 如何使用

### 1. 在对话中直接点名 skill

最直接的方式是在提示词中明确写出 skill 名称，并补足输入材料、目标格式和输出要求。例如：

- `使用 authorial-rewrite 重写这段文献综述，降低机器腔并保留原有论证结构。`
- `使用 word-flowchart 把下面的研究流程整理成 Word 风格流程图，并输出 DOT 和 PNG。`
- `使用 cites-review 检查这组参考文献是否符合 GB/T 7714-2015，并给出修正稿。`
- `使用 literature-review 围绕项目风险管理补充近3年文献综述，并输出参考文献。`
- `使用 markdown-to-word 把这份 Markdown 章节稿转换成 Word。`
- `使用 docx-thesis-format 检查并修复这份论文 docx，输出修复版和报告。`
- `使用 html-slide 生成 8 页答辩 HTML 幻灯片，并附可导出 PPTX 的目录结构。`

### 2. 推荐输入模板

为减少来回补充信息，建议按下面结构描述任务：

```text
技能名：
输入材料：
目标：
输出格式：
约束条件：
```

示例：

```text
技能名：literature-review
输入材料：研究主题“工程项目韧性与风险响应”，已有二级标题和5篇旧参考文献
目标：补足近3年综述，并与旧编号合并
输出格式：Markdown 正文 + 引用映射表 + GB/T 7714-2015 参考文献
约束条件：中文写作，优先 SSCI/SCI 或中文核心
```

### 3. 可直接执行的本地命令

`markdown-to-word`：

```bash
skills/markdown-to-word/convert_md_to_docx.sh [-o output.docx] input.md
```

`docx-thesis-format`：

```bash
skills/docx-thesis-format/check_docx_format.sh --out report.md --json report.json input.docx
skills/docx-thesis-format/fix_docx_format.sh -o output.formatted.docx --report fix-report.md --json fix-report.json input.docx
skills/docx-thesis-format/format_docx.sh -o output.formatted.docx --report format-report.md --json format-report.json input.docx
```

`html-slide` 的辅助脚本：

```bash
node skills/html-slide/scripts/validate-html-slide.mjs slides/slide-01.html
node skills/html-slide/scripts/add-slide-keyboard-nav.mjs slides
node skills/html-slide/scripts/export-slides-to-pptx.mjs slides
```

如果你是第一次在本地运行这些 Node.js 工具，通常需要先在对应 skill 目录安装依赖，例如：

```bash
cd skills/html-slide && npm install
cd skills/markdown-to-word && npm install
```

`docx-thesis-format` 默认会复用 `skills/markdown-to-word/node_modules`，因此首次在本地运行 `docx-thesis-format` 前，建议先完成一次 `skills/markdown-to-word` 的依赖安装。

## 技能能力边界

这个仓库强调“高频学术任务的可复用流程”，不是“任何学术问题的一站式自动化系统”。使用前建议先看清每个 skill 的边界。

### 通用边界

- 这些 skills 只能覆盖已经显式设计过的任务路径，超出规则范围的情形仍需人工判断
- 文献真实性、版权合规、学校最新格式细则是否变化，原则上仍需要人工复核
- 带脚本的 skill 更偏确定性排版与结构处理，不承担学术观点正确性的保证
- 纯工作流型 skill 更依赖输入质量；如果题目、提纲、旧稿不完整，输出质量会明显受限

### 分 skill 边界

| Skill | 擅长处理 | 不适合或需人工复核 |
|------|------|------|
| `authorial-rewrite` | 降低 AI 率、减少机器腔、统一作者表达风格 | 不替代研究本身的事实核验与新增证据；如果原稿论证空洞，仍需人工补证据 |
| `word-flowchart` | 黑白、正交、严格对齐的研究流程图、技术路线图、机制图 | 不适合品牌化彩色设计、自由排版海报、复杂信息图；布局极复杂时仍需人工微调 |
| `cites-review` | GB/T 7714-2015 格式核查、重编号、引文顺序核对、知网条目整理 | 不能凭空确认文献真实性、DOI 是否真实、数据库收录状态；跨库去重仍建议人工复核 |
| `literature-review` | 主题拆解、补检索、综述补写、与现有编号体系合并 | 不能替代研究者阅读全文后的理论判断；若缺少可访问文献源，结论深度会受限 |
| `html-slide` | 规范的学术答辩 HTML 页面、统一视觉系统、后续导出 PPTX 的素材准备 | 不直接等于成熟 PPT 母版工程；复杂动画、交互式大屏、重度品牌定制不在主要范围内 |
| `markdown-to-word` | Markdown 正文转 `.docx`、公式编号、三线表、图表题和参考文献顺序整理 | 不负责封面、声明、学校模板细节、复杂分页对象、浮动图文的完全还原 |
| `docx-thesis-format` | 已有 `.docx` 的确定性格式检查与自动修复 | 不负责摘要质量、封面精确版式、复杂跨页图表、图片公式语义、文献真实性判断 |

## 仓库结构

```text
academic-research-skills/
├── skills/                         # 所有 skill 源码
│   ├── word-flowchart/
│   ├── cites-review/
│   ├── literature-review/
│   ├── html-slide/
│   ├── markdown-to-word/
│   └── docx-thesis-format/
├── docs/                           # 补充文档与技能说明
├── scripts/install.sh              # 远程安装入口
├── scripts/install_and_update.sh   # 本地安装与 README 列表更新
├── README.md
└── README.en.md
```

## 维护与扩展

如果你要向仓库中新增或维护 skill，建议遵循下面的最小约定：

1. 在 `skills/<skill-name>/` 下放置 `SKILL.md`
2. 若 skill 需要本地脚本、模板或规则文件，一并收口在该目录
3. 更新或新增说明文档到 `docs/skills/`
4. 运行下面的命令刷新 README 中的 skill 列表：

```bash
sh scripts/install_and_update.sh --docs-only --source-root .
```

## 文档入口

- `docs/README.md`：中文文档索引
- `docs/README.en.md`：英文文档索引
- `docs/skills/word-flowchart.md`：`word-flowchart` 中文说明
- `docs/skills/word-flowchart.en.md`：`word-flowchart` 英文说明
- `docs/skills/markdown-to-word.md`：`markdown-to-word` 中文说明
- `docs/skills/markdown-to-word.en.md`：`markdown-to-word` 英文说明
- `skills/docx-thesis-format/README.md`：`docx-thesis-format` 详细能力覆盖
- `docs/skills/docx-thesis-format-review.md`：`docx-thesis-format` 规则评审稿
- `docs/skills/docx-thesis-format-extracted-rules.md`：从样本文档提取的规则

## 说明

README 中 `<!-- SKILLS:START -->` 到 `<!-- SKILLS:END -->` 之间的 skill 列表会被 `scripts/install_and_update.sh` 自动更新。若只想手工改写其他段落，请尽量保留这两个标记。
