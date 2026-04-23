#!/usr/bin/env node
/**
 * Convert Markdown to Word (.docx) using markdown-it + docx.
 * Supports: headings, tables, code blocks, lists, blockquotes, math ($/$$/LaTeX).
 * Default style: 仿宋 + Times New Roman, 小四(12pt), 1.5x line spacing, 2-char indent.
 *
 * Usage: node md2docx.mjs [-o output.docx] input.md
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import MarkdownIt from 'markdown-it';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Math as DocxMath,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, convertInchesToTwip, ExternalHyperlink, ImageRun,
} from 'docx';
// Image dimensions: parse PNG/JPEG headers directly (no external dep)
import { latexToInlineMath, latexToMathChildren } from './latex2math.mjs';

// ── CLI ──
let output = '', input = '';
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-o' && args[i + 1]) { output = args[++i]; }
  else if (args[i] === '-h') { console.log('Usage: node md2docx.mjs [-o output.docx] input.md'); process.exit(0); }
  else if (!input) { input = args[i]; }
}
if (!input) { console.error('Usage: node md2docx.mjs [-o output.docx] input.md'); process.exit(2); }
if (!output) output = input.replace(/\.md$/i, '') + '.docx';

const inputDir = dirname(resolve(input));
const rawMarkdown = readFileSync(resolve(input), 'utf-8');

// ── Pre-process: convert tab-separated tables to standard Markdown tables ──
// Detection: first row must have >= 4 tab-separated columns (avoids TOC lines).
// Continuation rows need >= 2 tab columns (handles merged-cell-like rows).
// A "表 X.X" caption line immediately before lowers the threshold to >= 3 for first row.
function preprocessTabTables(text) {
  const lines = text.split('\n');
  const result = [];
  let i = 0;
  const isTabLine = (line, minCols) => line && !line.includes('|') && line.includes('\t') && line.split('\t').length >= minCols;
  const TABLE_CAPTION_RE = /^表\s*\d/;

  while (i < lines.length) {
    // Check if previous line is a table caption → lower threshold
    const prevLine = result.length > 0 ? result[result.length - 1] : '';
    const hasCaption = TABLE_CAPTION_RE.test(prevLine.trim());
    const firstRowMinCols = hasCaption ? 3 : 4;

    if (isTabLine(lines[i], firstRowMinCols)) {
      const headerCols = lines[i].split('\t').length;
      const tableLines = [lines[i]];
      i++;
      // Continuation: allow lines with >= 2 tab columns (for merged-like rows)
      // but also require at least half the header's column count
      const contMinCols = Math.max(2, Math.floor(headerCols * 0.5));
      while (i < lines.length && isTabLine(lines[i], contMinCols)) {
        tableLines.push(lines[i]);
        i++;
      }
      if (tableLines.length >= 2) {
        const rows = tableLines.map(l => l.split('\t').map(c => c.trim()));
        const colCount = Math.max(...rows.map(r => r.length));
        for (let ri = 0; ri < rows.length; ri++) {
          while (rows[ri].length < colCount) rows[ri].push('');
          result.push('| ' + rows[ri].join(' | ') + ' |');
          if (ri === 0) {
            result.push('| ' + rows[ri].map(() => '---').join(' | ') + ' |');
          }
        }
        // Ensure blank line after table so markdown-it properly closes it
        result.push('');
      } else {
        result.push(...tableLines);
      }
    } else {
      result.push(lines[i]);
      i++;
    }
  }
  return result.join('\n');
}

// ── Pre-process: ensure single newlines between non-empty lines become paragraph breaks ──
// In many Chinese academic docs, each line is a separate paragraph but lacks blank-line separation.
// Markdown requires blank lines to separate paragraphs. This adds them where missing.
function ensureParagraphBreaks(text) {
  const lines = text.split('\n');
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    result.push(lines[i]);
    // If current line is non-empty, next line is non-empty, and next line is not already blank:
    // insert blank line to create paragraph break.
    // But skip: inside markdown tables (|), consecutive list items, headings followed by content, etc.
    if (i + 1 < lines.length) {
      const cur = lines[i];
      const next = lines[i + 1];
      if (cur.trim() && next.trim()
        && !cur.startsWith('|') && !next.startsWith('|')  // not inside md table
        && !next.startsWith('#')                           // heading gets its own break
        && !/^[-*+]\s/.test(next) && !/^\d+\.\s/.test(next) // not a list item
        && !cur.startsWith('```') && !next.startsWith('```') // not code fence
      ) {
        result.push('');
      }
    }
  }
  return result.join('\n');
}

// ── Pre-process: fix half-width punctuation in Chinese context → full-width ──
function fixChinesePunctuation(text) {
  const CJK = '\u4e00-\u9fff';
  const C = `[${CJK}]`;
  // Split out code blocks and inline code to avoid replacing inside them
  // Process only non-code segments
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`|\$\$[\s\S]*?\$\$|\$[^$]+\$)/g);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) continue; // skip code/math segments
    let s = parts[i];
    // Quotes: "content" → "content" when content contains Chinese
    s = s.replace(/"([^"\n]*[\u4e00-\u9fff][^"\n]*)"/g, '\u201c$1\u201d');
    // Single quotes: 'content' → 'content' when content contains Chinese
    s = s.replace(/'([^'\n]*[\u4e00-\u9fff][^'\n]*)'/g, '\u2018$1\u2019');
    // Comma: Chinese, or ,Chinese → 全角
    s = s.replace(new RegExp(`(${C}),`, 'g'), '$1，');
    s = s.replace(new RegExp(`,(${C})`, 'g'), '，$1');
    // Colon: Chinese: → 全角 (but not after time-like patterns 12:30)
    s = s.replace(new RegExp(`(${C}):`, 'g'), '$1：');
    // Semicolon: Chinese; or ;Chinese → 全角
    s = s.replace(new RegExp(`(${C});`, 'g'), '$1；');
    s = s.replace(new RegExp(`;(${C})`, 'g'), '；$1');
    // Exclamation: Chinese! → 全角
    s = s.replace(new RegExp(`(${C})!`, 'g'), '$1！');
    // Question mark: Chinese? → 全角
    s = s.replace(new RegExp(`(${C})\\?`, 'g'), '$1？');
    // Parentheses: (content) → （content） when content contains Chinese
    s = s.replace(/\(([^)\n]*[\u4e00-\u9fff][^)\n]*)\)/g, '（$1）');
    parts[i] = s;
  }
  return parts.join('');
}

const markdown = fixChinesePunctuation(ensureParagraphBreaks(preprocessTabTables(rawMarkdown)));

// ── Style constants ──
// 仿宋字体：macOS 用 STFangsong，Windows 用 FangSong / 仿宋
// 通过 eastAsia 设多候选，name 设 ascii/hAnsi 字体
const FONT_CN = '仿宋';              // eastAsia 字体
const FONT_EN = 'Times New Roman';  // ascii / hAnsi
// docx 包要求用 { ascii, eastAsia, hAnsi, cs }，不能用 { name, eastAsia }
const FONT_BODY = { ascii: FONT_EN, eastAsia: FONT_CN, hAnsi: FONT_CN, cs: FONT_EN };
const FONT_SIZE = 24;               // 小四 = 12pt = 24 half-points
const FONT_SIZE_H1 = 30;            // 小三 = 15pt
const FONT_SIZE_H2 = 28;            // 四号 = 14pt
const FONT_SIZE_H3 = 24;            // 小四 = 12pt
const FONT_SIZE_TABLE = 21;         // 五号 = 10.5pt
const LINE_SPACING = 360;           // 1.5倍行距 (240 * 1.5)
const LINE_SPACING_SINGLE = 240;    // 单倍行距
const INDENT_2CHAR = 480;           // 首行缩进2字符 (12pt × 2 = 24pt = 480 twips)
const FONT_MONO = 'Courier New';

// ── markdown-it with math plugin ──
const md = new MarkdownIt({ html: false, typographer: false });

// Inline math: $...$
md.inline.ruler.after('escape', 'math_inline', (state, silent) => {
  if (state.src[state.pos] !== '$') return false;
  if (state.src[state.pos + 1] === '$') return false;
  const start = state.pos + 1;
  let end = start;
  while (end < state.src.length) {
    if (state.src[end] === '\\') { end += 2; continue; }
    if (state.src[end] === '$') break;
    end++;
  }
  if (end >= state.src.length || start === end) return false;
  if (!silent) {
    const token = state.push('math_inline', '', 0);
    token.content = state.src.slice(start, end);
  }
  state.pos = end + 1;
  return true;
});

// Block math: $$...$$
md.block.ruler.before('fence', 'math_block', (state, startLine, endLine, silent) => {
  const pos = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  if (pos + 1 >= max) return false;
  if (state.src[pos] !== '$' || state.src[pos + 1] !== '$') return false;

  const afterOpen = state.src.slice(pos + 2, max).trim();

  // Single-line: $$ content $$
  if (afterOpen && afterOpen.endsWith('$$')) {
    if (silent) return true;
    const token = state.push('math_block', '', 0);
    token.content = afterOpen.slice(0, -2).trim();
    token.map = [startLine, startLine + 1];
    state.line = startLine + 1;
    return true;
  }

  // Multi-line: find closing $$
  let nextLine = startLine + 1;
  while (nextLine < endLine) {
    const lp = state.bMarks[nextLine] + state.tShift[nextLine];
    if (state.src.slice(lp, state.eMarks[nextLine]).trim() === '$$') break;
    nextLine++;
  }
  if (nextLine >= endLine) return false;
  if (silent) return true;

  const lines = [];
  for (let i = startLine + 1; i < nextLine; i++) {
    lines.push(state.src.slice(state.bMarks[i] + state.tShift[i], state.eMarks[i]));
  }
  const token = state.push('math_block', '', 0);
  token.content = (afterOpen ? afterOpen + '\n' : '') + lines.join('\n');
  token.map = [startLine, nextLine + 1];
  state.line = nextLine + 1;
  return true;
});

const tokens = md.parse(markdown, {});

// ── Heading map ──
const HEADING = {
  1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3, 4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5, 6: HeadingLevel.HEADING_6,
};

// ── Default run style ──
function defaultRun(opts = {}) {
  const { font: fontOverride, ...rest } = opts;
  return { font: fontOverride || FONT_BODY, size: FONT_SIZE, ...rest };
}

// ── Heading run style ──
function headingRun(level, opts = {}) {
  const { font: fontOverride, ...rest } = opts;
  const size = level === 1 ? FONT_SIZE_H1 : level === 2 ? FONT_SIZE_H2 : FONT_SIZE_H3;
  const bold = level <= 2; // H1, H2 加黑; H3 不加黑
  return { font: fontOverride || FONT_BODY, size, bold, ...rest };
}

// ── Table run style ──
function tableRun(opts = {}) {
  const { font: fontOverride, ...rest } = opts;
  return { font: fontOverride || FONT_BODY, size: FONT_SIZE_TABLE, ...rest };
}

// ── Image support ──
const MAX_IMG_WIDTH_PX = 550;

function getImageDimensions(buf) {
  // PNG: bytes 16-23 contain width(4) and height(4) as big-endian uint32
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: scan for SOF0/SOF2 markers (0xFFC0/0xFFC2)
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] === 0xFF) {
        const marker = buf[i + 1];
        if (marker === 0xC0 || marker === 0xC2) {
          return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
        }
        const segLen = buf.readUInt16BE(i + 2);
        i += 2 + segLen;
      } else { i++; }
    }
  }
  return { width: 400, height: 300 }; // fallback
}

function createImageRun(tok) {
  const src = (tok.attrs || []).find(a => a[0] === 'src')?.[1];
  if (!src) return null;
  const imgPath = src.startsWith('/') ? src : resolve(inputDir, src);
  if (!existsSync(imgPath)) {
    console.warn(`Image not found: ${imgPath}`);
    return null;
  }
  try {
    const imgData = readFileSync(imgPath);
    const dims = getImageDimensions(imgData);
    let w = dims.width, h = dims.height;
    if (w > MAX_IMG_WIDTH_PX) {
      const scale = MAX_IMG_WIDTH_PX / w;
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    return new ImageRun({
      data: imgData,
      transformation: { width: w, height: h },
    });
  } catch (e) {
    console.warn(`Failed to load image ${imgPath}: ${e.message}`);
    return null;
  }
}

const CITE_SUPERSCRIPT_RE = /\^\[([0-9,\-–，、；;\s]+)\]/g;

function normalizeCitationLabel(label) {
  return label
    .replace(/[，、；;]/g, ',')
    .replace(/\s*[-–]\s*/g, '-')
    .replace(/\s*,\s*/g, ',')
    .trim();
}

function appendTextRunsWithCitations(runs, text, bold, italic, runFn) {
  let lastIndex = 0;
  for (const match of text.matchAll(CITE_SUPERSCRIPT_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      runs.push(new TextRun(runFn({ text: text.slice(lastIndex, index), bold, italics: italic })));
    }
    const normalized = normalizeCitationLabel(match[1]);
    runs.push(new TextRun(runFn({
      text: `[${normalized}]`,
      bold,
      italics: italic,
      superScript: true,
    })));
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    runs.push(new TextRun(runFn({ text: text.slice(lastIndex), bold, italics: italic })));
  }
}

// ── Inline tokens → children (TextRun + Math) ──
// runFn: function(opts) → TextRun options, defaults to defaultRun
function parseInline(children, extraStyle = {}, runFn = defaultRun) {
  if (!children || children.length === 0) return [new TextRun(runFn(extraStyle))];
  const runs = [];
  let bold = extraStyle.bold || false;
  let italic = extraStyle.italics || false;
  let linkHref = null;

  for (const tok of children) {
    switch (tok.type) {
      case 'text':
        if (linkHref) {
          runs.push({ type: 'link', href: linkHref, text: tok.content, bold, italic, runFn });
        } else {
          appendTextRunsWithCitations(runs, tok.content, bold, italic, runFn);
        }
        break;
      case 'strong_open': bold = true; break;
      case 'strong_close': bold = extraStyle.bold || false; break;
      case 'em_open': italic = true; break;
      case 'em_close': italic = extraStyle.italics || false; break;
      case 'code_inline':
        runs.push(new TextRun({
          text: tok.content, bold, italics: italic,
          font: { name: FONT_MONO }, size: 20,
          shading: { type: ShadingType.CLEAR, fill: 'F0F0F0' },
        }));
        break;
      case 'softbreak':
        runs.push(new TextRun(runFn({ text: ' ' })));
        break;
      case 'hardbreak':
        runs.push(new TextRun(runFn({ break: 1 })));
        break;
      case 'link_open':
        linkHref = (tok.attrs || []).find(a => a[0] === 'href')?.[1] || '';
        break;
      case 'link_close':
        linkHref = null;
        break;
      case 'math_inline':
        runs.push(latexToInlineMath(tok.content));
        break;
      case 'image': {
        const imgRun = createImageRun(tok);
        if (imgRun) {
          runs.push(imgRun);
        } else {
          // Fallback: show alt text
          const alt = tok.content || tok.children?.map(c => c.content).join('') || '[image]';
          runs.push(new TextRun(runFn({ text: `[${alt}]`, italics: true })));
        }
        break;
      }
      default:
        if (tok.content) {
          runs.push(new TextRun(runFn({ text: tok.content, bold, italics: italic })));
        }
    }
  }
  return runs.length > 0 ? runs : [new TextRun(runFn(extraStyle))];
}

function wrapLinks(runs) {
  return runs.map(r => {
    if (r.type === 'link') {
      const fn = r.runFn || defaultRun;
      return new ExternalHyperlink({
        link: r.href,
        children: [new TextRun(fn({
          text: r.text, bold: r.bold, italics: r.italic, style: 'Hyperlink',
        }))],
      });
    }
    return r;
  });
}

// ── Block tokens → elements ──
function convertTokens(tokens) {
  const elements = [];
  let i = 0;
  let listLevel = 0;
  const listTypes = [];
  let inBlockquote = false;

  while (i < tokens.length) {
    const tok = tokens[i];

    switch (tok.type) {
      case 'heading_open': {
        const level = parseInt(tok.tag[1]);
        const inline = tokens[++i];
        i += 2;
        const hRunFn = (opts) => headingRun(level, opts);
        elements.push(new Paragraph({
          heading: HEADING[level],
          children: wrapLinks(parseInline(inline.children, {}, hRunFn)),
          spacing: { before: level <= 2 ? 360 : 240, after: 120, line: LINE_SPACING },
          alignment: level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
        }));
        break;
      }

      case 'paragraph_open': {
        const inline = tokens[++i];
        i += 2;
        const opts = {
          children: wrapLinks(parseInline(inline.children)),
          spacing: { before: 0, after: 0, line: LINE_SPACING },
          alignment: AlignmentType.JUSTIFIED,
        };
        if (inBlockquote) {
          opts.indent = { left: convertInchesToTwip(0.4), firstLine: INDENT_2CHAR };
          opts.border = { left: { style: BorderStyle.SINGLE, size: 3, color: '999999', space: 8 } };
        } else if (listLevel > 0) {
          opts.numbering = {
            reference: listTypes[listTypes.length - 1] === 'ordered' ? 'ordered-list' : 'bullet-list',
            level: listLevel - 1,
          };
        } else {
          // Normal paragraph: 首行缩进2字符
          opts.indent = { firstLine: INDENT_2CHAR };
        }
        elements.push(new Paragraph(opts));
        break;
      }

      case 'math_block': {
        // Display math: centered paragraph with Math object
        elements.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new DocxMath({ children: latexToMathChildren(tok.content) })],
          spacing: { before: 120, after: 120, line: LINE_SPACING },
        }));
        i++;
        break;
      }

      case 'fence':
      case 'code_block': {
        const lines = tok.content.replace(/\n$/, '').split('\n');
        for (const line of lines) {
          elements.push(new Paragraph({
            children: [new TextRun({ text: line || ' ', font: { name: FONT_MONO }, size: 18 })],
            spacing: { before: 0, after: 0, line: 260 },
            indent: { left: convertInchesToTwip(0.3) },
            shading: { type: ShadingType.CLEAR, fill: 'F5F5F5' },
          }));
        }
        elements.push(new Paragraph({ spacing: { after: 80 } }));
        i++;
        break;
      }

      case 'blockquote_open': inBlockquote = true; i++; break;
      case 'blockquote_close': inBlockquote = false; i++; break;

      case 'bullet_list_open': listLevel++; listTypes.push('bullet'); i++; break;
      case 'bullet_list_close': listLevel--; listTypes.pop(); i++; break;
      case 'ordered_list_open': listLevel++; listTypes.push('ordered'); i++; break;
      case 'ordered_list_close': listLevel--; listTypes.pop(); i++; break;
      case 'list_item_open':
      case 'list_item_close': i++; break;

      case 'table_open': {
        i++;
        const rows = [];
        let headerRow = false;
        let currentCells = [];
        while (i < tokens.length && tokens[i].type !== 'table_close') {
          const t = tokens[i];
          if (t.type === 'thead_open') { headerRow = true; i++; continue; }
          if (t.type === 'thead_close') { headerRow = false; i++; continue; }
          if (t.type === 'tbody_open' || t.type === 'tbody_close') { i++; continue; }
          if (t.type === 'tr_open') { currentCells = []; i++; continue; }
          if (t.type === 'tr_close') { rows.push({ cells: currentCells, header: headerRow }); i++; continue; }
          if (t.type === 'th_open' || t.type === 'td_open') { i++; continue; }
          if (t.type === 'th_close' || t.type === 'td_close') { i++; continue; }
          if (t.type === 'inline') {
            currentCells.push({
              runs: parseInline(t.children, headerRow ? { bold: true } : {}, tableRun),
              header: headerRow,
            });
            i++;
            continue;
          }
          i++;
        }
        i++; // table_close
        if (rows.length > 0) {
          const colCount = Math.max(...rows.map(r => r.cells.length));
          const BORDER_THICK = { style: BorderStyle.SINGLE, size: 6, color: '000000' };  // 0.75pt
          const BORDER_THIN = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
          const BORDER_NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
          const isLastRow = (idx) => idx === rows.length - 1;
          const tableRows = rows.map((row, rowIdx) => {
            const cells = [];
            for (let c = 0; c < colCount; c++) {
              const cell = row.cells[c];
              // 三线表：顶线(首行上)、表头下线、底线(末行下)，其余无线
              const borders = {
                top: rowIdx === 0 ? BORDER_THICK : (row.header ? BORDER_NONE : BORDER_NONE),
                bottom: row.header ? BORDER_THIN : (isLastRow(rowIdx) ? BORDER_THICK : BORDER_NONE),
                left: BORDER_NONE,
                right: BORDER_NONE,
              };
              cells.push(new TableCell({
                children: [new Paragraph({
                  children: cell ? wrapLinks(cell.runs) : [new TextRun('')],
                  spacing: { before: 30, after: 30, line: LINE_SPACING_SINGLE },
                  alignment: AlignmentType.LEFT,
                })],
                borders,
              }));
            }
            return new TableRow({ children: cells, tableHeader: row.header });
          });
          elements.push(new Table({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: BORDER_THICK, bottom: BORDER_THICK,
              left: BORDER_NONE, right: BORDER_NONE,
              insideHorizontal: BORDER_NONE, insideVertical: BORDER_NONE,
            },
          }));
          elements.push(new Paragraph({ spacing: { after: 80 } }));
        }
        break;
      }

      case 'hr':
        elements.push(new Paragraph({
          children: [],
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
          spacing: { before: 200, after: 200 },
        }));
        i++;
        break;

      default:
        i++;
    }
  }
  return elements;
}

// ── Numbering config ──
const INDENT_BASE = convertInchesToTwip(0.25);
function makeLevel(level, format, text, font) {
  return {
    level, format, text,
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: INDENT_BASE * (level + 1), hanging: INDENT_BASE } } },
    ...(font ? { run: { font: { name: font } } } : {}),
  };
}
const numberingConfig = [
  {
    reference: 'bullet-list',
    levels: [
      makeLevel(0, LevelFormat.BULLET, '\u2022', 'Symbol'),
      makeLevel(1, LevelFormat.BULLET, '\u25E6', 'Symbol'),
      makeLevel(2, LevelFormat.BULLET, '\u2013', 'Symbol'),
    ],
  },
  {
    reference: 'ordered-list',
    levels: [
      makeLevel(0, LevelFormat.DECIMAL, '%1.'),
      makeLevel(1, LevelFormat.LOWER_LETTER, '%2.'),
      makeLevel(2, LevelFormat.LOWER_ROMAN, '%3.'),
    ],
  },
];

// ── Generate document ──
const elements = convertTokens(tokens);

const doc = new Document({
  numbering: { config: numberingConfig },
  styles: {
    default: {
      document: {
        run: { font: FONT_BODY, size: FONT_SIZE },
        paragraph: { spacing: { before: 0, after: 0, line: LINE_SPACING }, alignment: AlignmentType.JUSTIFIED },
      },
      heading1: {
        run: { font: FONT_BODY, size: FONT_SIZE_H1, bold: true },
        paragraph: { spacing: { before: 360, after: 120, line: LINE_SPACING }, alignment: AlignmentType.CENTER },
      },
      heading2: {
        run: { font: FONT_BODY, size: FONT_SIZE_H2, bold: true },
        paragraph: { spacing: { before: 240, after: 120, line: LINE_SPACING }, alignment: AlignmentType.LEFT },
      },
      heading3: {
        run: { font: FONT_BODY, size: FONT_SIZE_H3, bold: false },
        paragraph: { spacing: { before: 240, after: 120, line: LINE_SPACING }, alignment: AlignmentType.LEFT },
      },
    },
    paragraphStyles: [
      {
        id: 'Normal',
        name: 'Normal',
        run: { font: FONT_BODY, size: FONT_SIZE },
        paragraph: { spacing: { before: 0, after: 0, line: LINE_SPACING }, alignment: AlignmentType.JUSTIFIED },
      },
    ],
  },
  sections: [{ children: elements }],
});

const buf = await Packer.toBuffer(doc);
writeFileSync(resolve(output), buf);
console.log(`Done: ${output}`);

// Auto-open the generated document for preview
import { exec } from 'child_process';
import { platform } from 'os';
const openCmd = platform() === 'darwin' ? 'open' : platform() === 'win32' ? 'start' : 'xdg-open';
exec(`${openCmd} "${resolve(output)}"`);
