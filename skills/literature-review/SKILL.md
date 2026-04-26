---
name: literature-review
description: "Search and synthesize high-quality literature for a research topic, expand literature review sections, and output citation-ordered references in GB/T 7714-2015 style. Use this skill when users need to: (1) retrieve recent high-quality papers around a theme, (2) supplement or rewrite a literature review based on an outline or draft, (3) merge new citations into an existing numbered reference list, (4) produce Markdown that stays compatible with cites-review and markdown-to-word."
description_zh: 结合研究主题、提纲或草稿检索近年高质量文献，补写文献综述，并生成按正文顺序编号的 GB/T 7714-2015 参考文献。
---

# Literature Review Expansion

## Overview

围绕用户给定的研究主题、研究问题、已有文稿或章节大纲，检索并筛选高质量文献，补写或重写文献综述内容，并输出与正文引用顺序一致的 GB/T 7714-2015 参考文献列表。

本 skill 默认与 `cites-review`、`markdown-to-word` 联动：

- `cites-review`：负责 GB/T 7714-2015 格式校验、重编号、引用顺序核对
- `markdown-to-word`：负责将 Markdown 中的引文标记转换为 Word 中右上角数字引文

## When to Use

- 用户给出“研究主题 + 近3年/近5年”并要求补充文献综述
- 用户已有一段综述草稿，希望补检索、补论证、补引用
- 用户已有参考文献列表，需要合并新增文献并按首次出现顺序重排
- 用户希望最终结果能直接进入 Markdown → Word 流程

## Required Inputs

优先收集以下信息；缺失时可做最小合理假设并明确说明：

- 研究主题、研究对象、核心变量、应用场景
- 时间范围，如“近3年”应明确为绝对日期区间
- 学科偏好，如项目管理、风险管理、工程管理、金融、供应链
- 输出语言：中文综述 / 英文综述 / 中英混合
- 已有材料：章节标题、提纲、草稿、现有参考文献
- 期望补充数量：如 10 篇、20 篇、每个子主题 3–5 篇

## Retrieval Strategy

### 1. 拆解主题

将用户主题拆解为 3 类检索词，并同时构建中英文表达：

- **核心主题词**：如 `project risk management`
- **机制/方法词**：如 `assessment`、`identification`、`mitigation`、`BIM`、`machine learning`
- **场景词**：如 `construction`、`R&D project`、`PPP`、`supply chain`

### 2. 质量优先级

优先保留以下文献：

- 近 3–5 年高相关综述、systematic review、bibliometric review
- 项目管理、工程管理、风险管理领域主流期刊论文
- 有 DOI、正式期刊页、摘要和页码信息完整的论文
- 对用户主题有直接变量、方法或情境对应关系的研究

降级或剔除以下文献：

- 与主题仅表面相关、无法支撑论点的论文
- 仅有题录、缺少正式出处信息的条目
- 低质量、重复、明显非学术来源的材料

### 3. 补写原则

补写综述时不要只堆叠摘要，应按“主题—观点—差距”组织：

1. 先写研究脉络或主题分组
2. 再归纳代表性观点、方法、结论
3. 最后指出不足、争议、空白与本文切入点

## Output Contract

默认输出 4 个部分：

### 1. 检索说明

- 主题拆解
- 时间范围（必须写绝对日期）
- 文献筛选口径

### 2. 补充后的文献综述正文

- 直接给出可粘贴进论文的段落
- 在句内首次需要引文的位置插入编号型引用标记
- 引用标记使用与 `markdown-to-word` 兼容的写法：`^[1]`、`^[2,3]`、`^[4-6]`

### 3. 引用映射表

如用户已有原始编号，给出：

| 旧编号 | 新编号 | 文献题名 | 说明 |
|---|---|---|---|
| [8] | [11] | ... | 首次出现位置后移 |

### 4. 参考文献

- 按正文首次出现顺序编号：`[1]`、`[2]`、`[3]`
- 按 `cites-review` 的 GB/T 7714-2015 规则整理
- 优先输出期刊、综述、学位论文、会议论文等正式类型

## Markdown Citation Convention

为兼容当前仓库中的 `markdown-to-word`，正文数字引文统一写为：

```md
项目风险识别通常需要结合组织经验与数据驱动方法进行联合判断。^[1]

近年来，项目组合风险管理逐渐从静态识别转向动态评估与价值创造视角。^[2,3]

相关研究主要集中在风险识别、风险评估与风险响应三个阶段。^[4-6]
```

约定如下：

- `^[1]` → 单篇引文
- `^[2,3]` → 多篇并列引文
- `^[4-6]` → 连续编号引文
- 文末参考文献列表仍使用普通编号：`[1] ...`

不要在正文中混用 `[@key]`、脚注式 `[^1]` 或作者年份制，除非用户明确要求切换体系。

## Integration Rules

### With `cites-review`

当需要合并到现有论文时：

1. 先抽取正文已有引文顺序
2. 将新增文献插入到首次引用位置
3. 对全文编号做一次全局重排
4. 按 GB/T 7714-2015 校验作者、题名、刊名、年份、卷期、页码、DOI

### With `markdown-to-word`

当前推荐链路：

1. 用本 skill 生成补写后的 Markdown 综述
2. 正文引文统一使用 `^[n]` 语法
3. 文末附 `[n]` 编号参考文献列表
4. 再调用 `markdown-to-word` 转为 `.docx`

## Quality Checklist

交付前至少检查：

1. 时间范围是否与用户要求一致，并写明绝对日期
2. 每一处引文是否都能在参考文献列表中找到
3. 参考文献顺序是否与正文首次出现顺序一致
4. 综述是否体现“已有研究—不足—本文切入点”
5. 是否避免伪造 DOI、页码、卷期和作者信息
