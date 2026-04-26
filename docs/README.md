# 文档索引

本目录提供中文文档入口，重点补充根目录 `README.md` 中放不下的技能细节、样例和规则说明。

## 快速开始

### 安装

远程安装：

```bash
curl -fsSL https://raw.githubusercontent.com/WEN-JY/academic-research-skills/main/scripts/install.sh | sh
```

本地仓库安装：

```bash
sh scripts/install_and_update.sh --source-root .
```

默认安装位置为 `$CODEX_HOME/skills` 或 `~/.codex/skills`。安装脚本默认使用软链接；如果希望复制安装，可追加 `--mode copy`。

### 使用

在对话中直接点名 skill 名称，并说明输入、目标和输出格式，例如：

- `使用 literature-review 围绕项目风险管理补充近3年文献综述，并输出参考文献`
- `使用 docx-thesis-format 检查并修复这份 docx 学位论文`
- `使用 word-flowchart 把下面流程整理成 Word 风格流程图`

## 技能列表

<!-- SKILLS:START -->
- `cites-review` - 审查、整理并规范参考文献与正文引用，适用于 GB/T 7714-2015 校验、知网文献提取、引文核对与重编号。
- `docx-thesis-format` - 对现有 `.docx` 学位论文进行格式检测与自动修复，输出修复后的文档、Markdown 报告与 JSON 报告。
- `html-slide` - 生成学术答辩与汇报场景的 HTML 幻灯片，提供统一视觉风格、图文布局、表格与公式展示组件。
- `literature-review` - 结合研究主题、提纲或草稿检索近年高质量文献，补写文献综述，并生成按正文顺序编号的 GB/T 7714-2015 参考文献。
- `markdown-to-word` - 将 Markdown 学术文稿转换为 Word 文档，支持公式、表格与图片，默认对齐浙江大学工程管理硕士学位论文常用正文格式。
- `word-flowchart` - 使用 Graphviz DOT 绘制 Word 风格流程图，强调黑白样式、正交连线与严格对齐，适合研究技术路线与复杂流程整理。
<!-- SKILLS:END -->

## 能力边界摘要

| Skill | 核心能力 | 主要边界 |
|------|------|------|
| `word-flowchart` | 规范流程图与技术路线图 | 不面向重视觉品牌设计或自由信息图 |
| `cites-review` | 参考文献规范化、重编号、引文核对 | 不保证文献真实性与数据库权威性 |
| `literature-review` | 主题检索、综述补写、参考文献合并 | 不替代研究者阅读全文和理论判断 |
| `html-slide` | 学术答辩 HTML 页面与可导出 PPTX 的素材结构 | 不直接覆盖复杂动画和重品牌 PPT 设计 |
| `markdown-to-word` | Markdown 到 Word 的正文级转换 | 不负责封面、声明页和复杂版面完全还原 |
| `docx-thesis-format` | 现有论文 docx 的确定性格式修复 | 不负责语义质量、封面精排和复杂对象修复 |

## 推荐阅读顺序

1. 先看根目录 `README.md`，了解安装、使用方式和 skill 边界
2. 再按具体需求进入对应 skill 文档
3. 涉及论文排版时，优先同时查看 `markdown-to-word` 与 `docx-thesis-format` 两类文档

## 重点文档

- `docs/skills/word-flowchart.md`
- `docs/skills/word-flowchart.en.md`
- `docs/skills/markdown-to-word.md`
- `docs/skills/markdown-to-word.en.md`
- `docs/skills/docx-thesis-format-review.md`
- `docs/skills/docx-thesis-format-extracted-rules.md`
- `skills/docx-thesis-format/README.md`

## 维护说明

如果新增或删除了 skill，请运行：

```bash
sh scripts/install_and_update.sh --docs-only --source-root .
```

这会自动更新本页和根目录 `README.md` 中 `SKILLS` 标记块内的技能列表。
