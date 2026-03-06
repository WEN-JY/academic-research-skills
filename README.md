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
- 示例：
  - "使用 word-flowchart 把下面的研究流程整理成 Word 风格流程图，并输出 DOT + 图片。"

## 文档

- `docs/README.md`（中文）
- `docs/README.en.md`（English）
- `docs/skills/word-flowchart.md`（中文）
- `docs/skills/word-flowchart.en.md`（English）