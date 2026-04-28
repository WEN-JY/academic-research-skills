# 文档索引

本目录提供技能安装与使用说明，中文为主。仓库中的 skill 源码统一存放在 `skills/` 目录下。

## 快速上手

1. 将技能目录复制或软链接到 `$CODEX_HOME/skills` 或 `~/.codex/skills`
2. 重启/重载你的 Agent 环境
3. 在对话中点名技能并给出结构化需求

如果你是第一次接触终端，建议先看仓库根目录的 `新手指南.md`。

## 自动化脚本

```bash
curl -fsSL https://raw.githubusercontent.com/WEN-JY/academic-research-skills/main/scripts/install.sh | sh
```

默认安装到 `$CODEX_HOME/skills` 或 `~/.codex/skills`，并更新 `README.md` 与 `docs/README.md` 的技能列表；远程安装时会先缓存仓库快照到 `~/.codex/.cache/academic-research-skills/repo`（若设置了 `CODEX_HOME`，则使用对应缓存目录）。

追加参数示例：

```bash
curl -fsSL https://raw.githubusercontent.com/WEN-JY/academic-research-skills/main/scripts/install.sh | sh -s -- --mode copy
```

## 环境依赖

- 渲染图像建议安装 Graphviz（`dot`/`neato`）
- 若只需要 DOT 代码，可不安装渲染环境

## 技能列表

<!-- SKILLS:START -->
- `authorial-rewrite` - 将 AI 辅助生成的论文草稿重写为更具作者判断、证据支撑和学科特征的学术文本，用于诊断机器腔、加强论点与证据匹配、减少模板化表达，并服务于合规的论文深度修订。
- `word-flowchart` - 自主绘制 Microsoft Word 风格流程图（Graphviz DOT），强调黑白样式、正交连线与严格对齐；支持将 Mermaid 流程图作为输入进行转换。
- `cites-review` - 审查、整理并规范参考文献与正文引用，适用于 GB/T 7714-2015 校验、知网文献提取、引文核对与重编号。
- `html-slide` - 生成学术答辩与汇报场景的 HTML 幻灯片，提供统一视觉风格、图文布局、表格与公式展示组件。
- `literature-review` - 结合研究主题、提纲或草稿检索近年高质量文献，补写文献综述，并生成按正文顺序编号的 GB/T 7714-2015 参考文献。
- `markdown-to-word` - 将 Markdown 学术文稿转换为 Word 文档，支持公式、表格与图片，默认对齐浙江大学工程管理硕士学位论文常用正文格式。
- `docx-thesis-format` - 对现有 `.docx` 学位论文进行格式检测与自动修复，输出修复后的文档、Markdown 报告与 JSON 报告。
<!-- SKILLS:END -->

## 评审与说明

- `docs/skills/docx-thesis-format-review.md`（Word 学位论文格式检测与转换规则评审稿）
- `docs/skills/docx-thesis-format-extracted-rules.md`（从样本文档提取的页面、目录与页眉页脚规则）
- `markdown-to-word` 已补充正文段前段后 0 磅、节/小节标题空格规范、图表题按章编号、块公式按章编号与右对齐编号等规则。
- `docx-thesis-format` 已支持页面大小、分节边距、目录顺序、页眉页脚、三线表与参考文献等检测与自动修复能力。
