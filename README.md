# 学术研究技能集

面向学术研究场景的 Agent Skills 集合，聚焦“研究流程可视化、技术路线梳理”等高频需求，提供可复用、可扩展的技能模板。

## 已支持技能

<!-- SKILLS:START -->
- `graphviz-word-flowchart` - 使用 Graphviz DOT 绘制 Word 风格流程图，强调黑白样式、正交连线与严格对齐，适合研究技术路线与复杂流程整理。
<!-- SKILLS:END -->

## 一键安装与文档更新

在任意目录执行（无需克隆仓库）：

```bash
curl -fsSL https://raw.githubusercontent.com/WEN-JY/academic-research-skills/main/scripts/install.sh | sh
```

默认安装目录：`$CODEX_HOME/skills` 或 `~/.codex/skills`，默认使用软链接（便于更新）。

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

- 在对话中直接点名技能：`graphviz-word-flowchart`
- 示例：
  - “使用 graphviz-word-flowchart 把下面的研究流程整理成 Word 风格流程图，并输出 DOT + 图片。”

## 文档

- `docs/README.md`（中文）
- `docs/README.en.md`（English）
- `docs/skills/graphviz-word-flowchart.md`（中文）
- `docs/skills/graphviz-word-flowchart.en.md`（English）
