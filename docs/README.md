# 文档索引

本目录提供技能安装与使用说明，中文为主。仓库中的 skill 源码统一存放在 `skills/` 目录下。

## 快速上手

1. 将技能目录复制或软链接到 `$CODEX_HOME/skills` 或 `~/.codex/skills`
2. 重启/重载你的 Agent 环境
3. 在对话中点名技能并给出结构化需求

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
- `word-flowchart` - 自主绘制 Microsoft Word 风格流程图（Graphviz DOT），强调黑白样式、正交连线与严格对齐；支持将 Mermaid 流程图作为输入进行转换。
- `cites-review` - 审查、整理并规范参考文献与正文引用，适用于 GB/T 7714-2015 校验、知网文献提取、引文核对与重编号。
- `html-slide` - 生成学术答辩与汇报场景的 HTML 幻灯片，提供统一视觉风格、图文布局、表格与公式展示组件。
- `markdown-to-word` - 将 Markdown 学术文稿转换为 Word 文档，支持公式、表格与图片，适合论文写作与章节导出。
<!-- SKILLS:END -->
