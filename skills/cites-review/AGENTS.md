# Citation & Reference Review

Review, format, and organize academic references following GB/T 7714-2015. Extract literature from CNKI. Cross-check and renumber citations.

## When to Use

- User needs to check/fix reference formatting
- User wants to extract references from CNKI (知网)
- User needs to renumber references after document restructuring
- User wants to cross-check in-text citations vs reference list

## GB/T 7714-2015 Quick Reference

Document codes: `[J]` journal, `[M]` book, `[D]` thesis, `[C]` conference, `[R]` report, `[S]` standard, `[P]` patent, `[N]` newspaper, `[EB/OL]` web

Format:
```
[序号] 作者．题名[类型]．刊名/出版社．出版年，卷(期): 页码.
```

Rules:
- Citation order numbering `[1], [2], [3]...`
- English: half-width punctuation; Chinese: full-width
- Max 3 authors, then `等` (CN) / `et al.` (EN)
- No abbreviated author names
- Watch for accidental spaces in English refs

## Validation Checklist

Required fields: author, title, type code, year + type-specific fields (journal/volume/pages for [J], publisher/city for [M], institution for [D], URL+access date for [EB/OL])

Cross-check: `grep -oP '\[(\d+)\]' paper.md | sort -un` then compare against reference list.

## CNKI Extraction Tools

### Browser script (`cnki_literature_extractor.js`):
```javascript
const extractor = new CNKILiteratureExtractor();
extractor.extractListPageInfo()       // list page
extractor.extractCurrentDetailPage()  // detail page + citations
extractor.getQuotes()                 // GB/T 7714, elearning, EndNote formats
extractor.exportToCSV() / .exportToJSON()
```

### Playwright (`python/cnki_playwright_extractor.py`):
```python
extractor = CNKIPlaywrightExtractor(headless=False, delay=2000)
await extractor.init_browser()
await extractor.extract_list_page(url="...")
```

### MCP Server (`lunwen/cnki-mcp-server/`):
Node.js MCP server for Claude integration with CNKI.

## Pandoc Citation Integration

```bash
pandoc paper.md --citeproc --bibliography=refs.bib --csl=gb-t-7714-2015-numeric.csl -o paper.docx
```

## Dependencies

- pandoc (citeproc), playwright (Python), Node.js
