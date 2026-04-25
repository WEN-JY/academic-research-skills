# docx-thesis-format

对现有 `.docx` 学位论文进行格式检测与自动修复，目标规范为浙江大学工程师学院硕士学位论文格式要求。

## 快速上手

```bash
# 仅检查，输出报告
skills/docx-thesis-format/check_docx_format.sh \
  --out report.md --json report.json input.docx

# 自动修复，输出新文档
skills/docx-thesis-format/fix_docx_format.sh \
  -o output.formatted.docx --report fix-report.md input.docx

# 检查 → 修复 → 复查（推荐）
skills/docx-thesis-format/format_docx.sh \
  -o output.formatted.docx --report format-report.md input.docx
```

使用自定义规则文件：

```bash
skills/docx-thesis-format/check_docx_format.sh --rules custom-rules.json input.docx
```

默认规则文件：`skills/docx-thesis-format/rules/engineering-college.json`

---

## 功能覆盖

以下各节对照格式要求文档，逐条列出脚本的检测与修复能力。

---

### 第3章 页面与版心

| 要求 | 条目 | 脚本实现 | 状态 |
|------|------|----------|------|
| A4 纵向 210×297mm | §3.1 | `analyzeSection` → `pgSz` 检查+修复 | ✅ |
| 上下 2.54cm / 左右 3.17cm | §3.2 | `allowedMarginProfiles` 多档匹配+修复 | ✅ |
| 文档网格行距基准 | §3.1 | `docGridLinePitch=360` 检查+修复 | ✅ |

---

### 第4章 正文格式

| 要求 | 条目 | 脚本实现 | 状态 |
|------|------|----------|------|
| 中文仿宋、西文 Times New Roman、小四 | §4.1 | `checkAndFixBodyParagraph` 检查段落+run字体 | ✅ |
| 段前 0、段后 0 | §4.2 | `spacingBefore=0` / `spacingAfter=0` | ✅ |
| 1.5 倍行距 | §4.2 | `lineTwips=360` | ✅ |
| 两端对齐 | §4.2 | `alignment=both` | ✅ |
| 首行缩进 2 字符 | §4.2 | `firstLineTwips=480` | ✅ |
| 无意义空行删除 | §4.2 | `cleanupMeaninglessBlankParagraphs` 检查+修复 | ✅ |
| 中文标点规范 | §4.3 | 未检查 | ❌ |
| 名词术语统一 | §4.4 | 未检查 | ❌ |
| 物理量符号规范 | §4.5 | 未检查 | ❌ |

---

### 第5章 标题层级

| 要求 | 条目 | 脚本实现 | 状态 |
|------|------|----------|------|
| 章标题：`第N章 标题`，小三仿宋，加粗，居中 | §5.1 | `analyzeChapterHeading` 检查+修复 | ✅ |
| 节标题：`N.N  标题`，编号后 2 空格，四号仿宋，加粗，左对齐 | §5.2 | `analyzeSectionHeading` + `spaceFont=宋体` | ✅ |
| 小节标题：`N.N.N 标题`，编号后 1 空格，小四仿宋，左对齐 | §5.3 | `analyzeSubsectionHeading` + `spaceFont=宋体` | ✅ |
| 标题层级不超过三级、不跳级 | §5.4 | 未检查 | ❌ |

---

### 第6章 公式格式

| 要求 | 条目 | 脚本实现 | 状态 |
|------|------|----------|------|
| 块公式居中排版 | §6.1 | `equationAlignment=center` 检查+修复 | ✅ |
| 公式编号右对齐，格式 `（N-N）` | §6.2 | `rightTabTwips` + 编号格式修复 | ✅ |
| 按章内连续编号 | §6.3 | `equationIndex` 按章重置，错误编号替换 | ✅ |
| 附录公式编号 `（A-N）` | §6.3 | `appendixNumberFormat` 支持 | ✅ |
| 公式不得使用图片代替 | §6.4 | 未检查 | ❌ |

---

### 第7章 图题与插图

| 要求 | 条目 | 脚本实现 | 状态 |
|------|------|----------|------|
| 图题格式 `图N.N 图题`，按章编号 | §7.1 | `analyzeFigureCaption` 检查+修复编号 | ✅ |
| 图题位于图下方，居中 | §7.1 | `captionPosition=below`，`alignment=center` | ✅ |
| 图题字号：五号仿宋 | §7.1 | `fontSizeHalfPoints=21`，`font=仿宋` | ✅ |
| 图题行距：单倍行距 | §7.1 | `lineTwips=240` | ✅ |
| 缺失图题自动补全 | §7.1 | `insertMissingCaptions` | ✅ |
| 图片清晰度、尺寸与版权 | §7.2 | 未检查 | ❌ |

---

### 第8章 表题与表格

| 要求 | 条目 | 脚本实现 | 状态 |
|------|------|----------|------|
| 表题格式 `表N.N 表题`，按章编号 | §8.1 | `analyzeTableCaption` 检查+修复编号 | ✅ |
| 表题位于表上方，居中 | §8.1 | `captionPosition=above`，`alignment=center` | ✅ |
| 表题字号：五号仿宋 | §8.1 | `captionFontSizeHalfPoints=21`，`captionFont=仿宋` | ✅ |
| 表题行距：单倍行距 | §8.1 | `captionLineTwips=240` | ✅ |
| 三线表（无竖线，保留三横线）| §8.2 | `style=three-line-table` 转换 | ✅ |
| 单元格水平左对齐 | §8.2 | `cellAlignment=left` | ✅ |
| 表文字号：五号仿宋 | §8.2 | `bodyFontSizeHalfPoints=21`，`bodyFont=仿宋` | ✅ |
| 跨页续表重复首行表头 | §8.3 | `repeatHeaderRow=true` | ✅ |
| 缺失表题自动补全 | §8.1 | `insertMissingCaptions` | ✅ |
| 跨页表、合并单元格、超宽表 | §8.3 | 未检查 | ❌ |

---

### 第9章 参考文献

| 要求 | 条目 | 脚本实现 | 状态 |
|------|------|----------|------|
| 顺序编码 `[1][2][3]`，连续不跳号 | §9.1 | `referenceIndex` 连续性检测+修复 | ✅ |
| 文后排序与引用顺序一致 | §9.1 | `orderByCitation=true` | ✅ |
| 类型标识 `[J][M][D][EB/OL]` 等 | §9.2 | `typePattern` 正则检测 | ✅ |
| 字号小四仿宋、1.5 倍行距 | §9.4 | `font/size/lineTwips` 检查+修复 | ✅ |
| 正文引用号与文后编号一致性 | §9.3 | 未检查 | ❌ |
| 文献著录完整性与真实性 | §9.3 | 未检查 | ❌ |

---

### 第10章 摘要与关键词

| 要求 | 条目 | 脚本实现 | 状态 |
|------|------|----------|------|
| 中文关键词数量 4～8 个 | §10.1 | `chineseKeywordsMin/Max` 检测 | ✅ |
| 英文摘要西文字体 Times New Roman | §10.2 | `englishFont=Times New Roman` 配置 | ✅ |
| 摘要内容质量（语义） | §10.1 | 未检查 | ❌ |

---

### 第11章 目录、页眉、页脚与页码

| 要求 | 条目 | 脚本实现 | 状态 |
|------|------|----------|------|
| 目录覆盖顺序（致谢→摘要→附录）| §11.1 | `toc.requiredOrder` 顺序检测 | ✅ |
| 页眉左"浙大硕士学位论文"右当前章标题 | §11.2 | `headerLayout=left-prefix-right-current-title` 检测 | ✅ |
| 页眉字体仿宋、字号小五 | §11.2 | `headerFont=仿宋`，`headerFontSizeHalfPoints=18` | ✅ |
| 页脚含页码域 | §11.3 | `requirePageFieldInFooters` 检测 | ✅ |
| 前置部分罗马数字、正文阿拉伯数字 | §11.3 | `frontMatterFormat=upperRoman` 配置（仅检测，不修复） | ⚠️ |
| 页眉具体文字内容修复 | §11.2 | 仅检测，不自动修复 | ⚠️ |

---

### 第12章 重点人工复核项

以下内容脚本报告但不自动修复，需人工核查：

| 复核项 | 条目 |
|--------|------|
| 封面与题名页精确版式 | §12.1 |
| 前置部分分节与页码切换 | §12.1 |
| 页眉文字与当前部分是否完全一致 | §12.1 |
| 目录、图目录、表目录完整性与更新状态 | §12.1 |
| 中英文摘要内容质量与关键词准确性 | §12.2 |
| 复杂跨页表格、子图、合并单元格 | §12.2 |
| 图片清晰度、版权与来源标注 | §12.2 |
| 文献真实性、著录完整性与类型标识正确性 | §12.2 |

---

## 状态说明

| 符号 | 含义 |
|------|------|
| ✅ | 自动检测并修复 |
| ⚠️ | 仅检测，报告问题，不自动修复 |
| ❌ | 未实现，需人工核查 |
