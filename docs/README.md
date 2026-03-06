# 文档索引

本目录提供技能安装与使用说明，中文为主。

## 快速上手

1. 将技能目录复制或软链接到 `$CODEX_HOME/skills` 或 `~/.codex/skills`
2. 重启/重载你的 Agent 环境
3. 在对话中点名技能并给出结构化需求

## 自动化脚本

```bash
curl -fsSL https://raw.githubusercontent.com/WEN-JY/academic-research-skills/main/scripts/install.sh | sh
```

默认安装到 `$CODEX_HOME/skills` 或 `~/.codex/skills`，并更新 `README.md` 与 `docs/README.md` 的技能列表。

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
<!-- SKILLS:END -->
