---
name: cites-review
description: "Review, organize, and format academic references and citations following GB/T 7714-2015 and other standards. This skill should be used when users need to: (1) Check and fix reference formatting errors, (2) Standardize citation styles, (3) Extract references from CNKI (知网) using browser scripts or Playwright automation, (4) Cross-check in-text citation numbers against the reference list, (5) Reorganize and renumber references after document restructuring."
description_zh: 审查、整理并规范参考文献与正文引用，适用于 GB/T 7714-2015 校验、知网文献提取、引文核对与重编号。
---

# Citation & Reference Review

## Overview

Review, validate, format, and reorganize academic references. Focuses on GB/T 7714-2015 (Chinese standard) with support for APA, IEEE, Harvard, and Chicago. Includes CNKI literature extraction tools and reference renumbering workflows.

## GB/T 7714-2015 Formatting Rules

### Core Principles
- References numbered in citation order: `[1]`, `[2]`, `[3]`...
- **Punctuation**: English punctuation + half-width; Chinese punctuation + full-width
- Author names: must be written in full (no abbreviations)
- Chinese authors: up to 3, then add `等`; English: `Last, First, and First Last` format
- No accidental spaces in English references

### Document Type Codes

| Code | Type | Code | Type |
|------|------|------|------|
| [J] | Journal article | [R] | Report |
| [M] | Book (monograph) | [S] | Standard |
| [D] | Dissertation/Thesis | [P] | Patent |
| [C] | Conference paper | [N] | Newspaper |
| [A] | Extracted from collection | [EB/OL] | Online resource |
| [DB] | Database | [CP] | Computer program |

### Format Templates

```
[序号] 期刊作者．题名[J]．刊名．出版年，卷(期): 起止页码.
[序号] 专著作者．书名[M]．版次(第一版可略)．出版地：出版社，出版年∶起止页码.
[序号] 论文集作者．题名〔C〕．编者．论文集名．出版地∶出版社，出版年∶起止页码.
[序号] 学位论文作者．题名〔D〕．保存地点：保存单位，年份.
[序号] 专利所有者.专利文献题名〔P〕．国别：专利号．发布日期.
[序号] 标准编号，标准名称〔S〕.出版地：出版者，出版年.
[序号] 报纸作者．题名〔N〕．报纸名，出版日期(版次).
[序号] 报告作者．题名〔R〕．报告地：报告会主办单位,年份.
[序号] 电子文献作者．题名〔电子文献及载体类型标识〕．文献出处，日期.
```

## Validation Checklist

### Per-Reference Checks
1. **Document type code** - Must be present and correct: `[J]`, `[M]`, `[D]`, etc.
2. **Author format** - Chinese: `姓名`; English: `Last, First.`
3. **Author count** - Max 3, then `等` (CN) / `et al.` (EN)
4. **Punctuation width** - English refs: half-width only; Chinese refs: full-width
5. **No accidental spaces** - Especially in English references
6. **Required fields** by type:
   - Journal [J]: author, title, journal, year, volume(issue), pages
   - Book [M]: author, title, publisher, city, year
   - Thesis [D]: author, title, institution, year
   - Web [EB/OL]: author, title, URL, access date

### Cross-Check Process
```bash
# Extract in-text citation numbers
grep -oP '\[(\d+)\]' paper.md | sort -un > cited.txt

# Compare against reference list
# Flag: cited but missing in references
# Flag: in references but never cited (unused)
```

### Reference Renumbering
When restructuring documents, maintain a mapping table:

| Old # | New # | Change | Note |
|-------|-------|--------|------|
| [1] | [1] | - | |
| [30] | [28] | changed | moved from section X |

Update all in-text citations to match the new numbering.

## CNKI Literature Extraction

### Browser Console Script
**File**: `cnki_literature_extractor.js`

Paste in browser console on CNKI pages:

```javascript
const extractor = new CNKILiteratureExtractor();

// On list page:
extractor.extractListPageInfo()     // Extract basic info (title, authors, source, dates, citations)

// On detail page:
extractor.extractCurrentDetailPage() // Full info + citation formats
extractor.getQuotes()                // Get GB/T 7714, elearning, EndNote formats

// Export:
extractor.exportToCSV()
extractor.exportToJSON()
```

Extracts: title, authors, source, publishDate, citationCount, downloadCount, DOI, abstract, keywords, institutions, classification, pageRange.

Citation formats retrieved via CNKI API (`/dm8/API/GetExport`):
- **GBTREFER**: GB/T 7714-2015 format
- **elearning**: CNKI study format
- **EndNote**: EndNote import format

### Playwright Automation
**File**: `python/cnki_playwright_extractor.py`

```python
extractor = CNKIPlaywrightExtractor(headless=False, delay=2000)
await extractor.init_browser()
await extractor.extract_list_page(url="https://...")
await extractor.close_browser()
```

Features:
- Automated Chromium browser with anti-detection UA
- Batch extraction from list pages
- Configurable delay to avoid rate limiting

### CNKI MCP Server
**Location**: `lunwen/cnki-mcp-server/`

Model Context Protocol server for integrating CNKI literature extraction with Claude. Node.js/TypeScript with Playwright.

## Integration with Document Pipeline

### Apply citations via Pandoc
```bash
pandoc paper.md --citeproc --bibliography=refs.bib --csl=gb-t-7714-2015-numeric.csl -o paper.docx
```

### Common CSL files
- `gb-t-7714-2015-numeric.csl` - GB/T 7714 (numeric, most common for Chinese theses)
- `gb-t-7714-2015-author-date.csl` - GB/T 7714 (author-date variant)
- `apa.csl`, `ieee.csl`, `chicago-fullnote-bibliography.csl`

CSL repository: https://github.com/citation-style-language/styles

## File Locations

```
Desktop/
├── cnki_literature_extractor.js          # Browser console CNKI extractor
├── python/
│   ├── cnki_playwright_extractor.py      # Playwright automation extractor
│   └── cnki_literature.json              # Sample extracted data
├── lunwen/cnki-mcp-server/               # MCP server for Claude integration
├── 预答辩/cite.md                         # GB/T 7714 formatting reference
└── 正式答辩/内容拆分/参考文献_调整后.md    # Reference renumbering map
```

## Dependencies

- **pandoc**: For citation processing (`--citeproc`)
- **playwright**: `pip install playwright` + `playwright install chromium` (for automated extraction)
- **Node.js**: For browser extractor script and MCP server
