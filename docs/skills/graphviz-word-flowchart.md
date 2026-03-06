# graphviz-word-flowchart

用于自主绘制 Microsoft Word 风格流程图的技能，输出 Graphviz DOT 代码与可渲染结构；支持将 Mermaid 流程图作为输入进行转换。

## 适用场景

- 研究技术路线图
- 论文方法流程图
- 复杂流程的分支/合并逻辑

## 输入与输出

- 输入：结构化文字描述、分层步骤、已有草图，或 Mermaid 流程图
- 输出：
  - Graphviz DOT 代码
  - （可选）渲染图片

## 使用示例

- “使用 graphviz-word-flowchart 将以下研究流程整理为 Word 风格流程图，要求黑白、正交连线、严格对齐，并给出 DOT + 图片。”
- “使用 graphviz-word-flowchart 将下面的 Mermaid 流程图转换为 Word 风格，并输出 DOT + 图片。”

## 渲染建议

- 固定坐标布局时建议使用：`neato -n2`
- 简单流程可使用：`dot`
- 详细布局规则见：`graphviz-word-flowchart/references/graphviz-layout.md`
