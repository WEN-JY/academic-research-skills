#!/usr/bin/env node
import { createRequire } from 'module';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, extname, resolve } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const JSZip = require('../markdown-to-word/node_modules/jszip');
const { xml2js, js2xml } = require('../markdown-to-word/node_modules/xml-js');

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_RULES = resolve(SCRIPT_DIR, 'rules/ningbo-mpa.json');
const SPACE_MARK = '\uE000';
const FIGURE_ANCHOR_LINE_TWIPS = 1;
const XML_OPTIONS = {
  compact: false,
  ignoreDeclaration: false,
  ignoreInstruction: false,
  ignoreComment: false,
  alwaysChildren: true,
  trim: false,
};

const MODE = process.argv[2];
const args = process.argv.slice(3);

if (!['check', 'fix', 'format'].includes(MODE)) {
  usage();
  process.exit(MODE === '-h' || MODE === '--help' ? 0 : 2);
}

const cli = parseArgs(args);
if (!cli.input) {
  usage();
  process.exit(2);
}

const inputPath = resolve(cli.input);
if (!existsSync(inputPath)) {
  fail(`输入文件不存在：${inputPath}`);
}
if (extname(inputPath).toLowerCase() !== '.docx') {
  fail('仅支持 .docx 文件');
}

const rulesPath = resolve(cli.rules || DEFAULT_RULES);
const rules = JSON.parse(readFileSync(rulesPath, 'utf-8'));

if (MODE === 'check') {
  const result = await runCheck(inputPath, rules, { title: cli.title, referencesJson: cli.referencesJson });
  writeReports(result, cli.out, cli.json);
  printSummary(result);
} else if (MODE === 'fix') {
  const outputPath = resolve(cli.output || inputPath.replace(/\.docx$/i, '.formatted.docx'));
  const result = await runFix(inputPath, outputPath, rules, { title: cli.title, referencesJson: cli.referencesJson });
  writeReports(result, cli.report, cli.json);
  printSummary(result);
  console.log(`输出文档：${outputPath}`);
} else {
  const outputPath = resolve(cli.output || inputPath.replace(/\.docx$/i, '.formatted.docx'));
  const before = await runCheck(inputPath, rules, { title: cli.title, referencesJson: cli.referencesJson });
  const fixed = await runFix(inputPath, outputPath, rules, { title: cli.title, referencesJson: cli.referencesJson });
  const after = await runCheck(outputPath, rules, { title: cli.title, referencesJson: cli.referencesJson });
  const combinedIssues = [
    ...before.issues.map((issue) => ({ ...issue, phase: 'before' })),
    ...fixed.issues.map((issue) => ({ ...issue, phase: 'fix' })),
    ...after.issues.map((issue) => ({ ...issue, phase: 'after' })),
  ].map((issue, index) => ({ ...issue, id: index + 1 }));
  const result = {
    mode: 'format',
    input: inputPath,
    output: outputPath,
    issues: combinedIssues,
    stats: {
      before: before.stats,
      fixed: fixed.stats,
      after: after.stats,
    },
  };
  writeReports(result, cli.report, cli.json);
  printSummary(result);
  console.log(`输出文档：${outputPath}`);
}

function usage() {
  console.log(`用法：
  node skills/markdown-to-nbu-mpa/nbu-docx-format.mjs check [--rules rules.json] [--out report.md] [--json report.json] [--title "论文中文题目"] [--references-json refs.json] input.docx
  node skills/markdown-to-nbu-mpa/nbu-docx-format.mjs fix   [--rules rules.json] [--out output.docx] [--report report.md] [--json report.json] [--title "论文中文题目"] [--references-json refs.json] input.docx
  node skills/markdown-to-nbu-mpa/nbu-docx-format.mjs format [--rules rules.json] [--out output.docx] [--report report.md] [--json report.json] [--title "论文中文题目"] [--references-json refs.json] input.docx`);
}

function parseArgs(values) {
  const parsed = {};
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value === '--rules' && values[i + 1]) parsed.rules = values[++i];
    else if ((value === '--out' || value === '-o') && values[i + 1]) {
      if (MODE === 'check') parsed.out = values[++i];
      else parsed.output = values[++i];
    } else if (value === '--report' && values[i + 1]) parsed.report = values[++i];
    else if (value === '--json' && values[i + 1]) parsed.json = values[++i];
    else if (value === '--title' && values[i + 1]) parsed.title = values[++i];
    else if (value === '--references-json' && values[i + 1]) parsed.referencesJson = values[++i];
    else if (value === '-h' || value === '--help') {
      usage();
      process.exit(0);
    } else if (!parsed.input) parsed.input = value;
    else fail(`无法识别参数：${value}`);
  }
  return parsed;
}

function fail(message) {
  console.error(`错误：${message}`);
  process.exit(1);
}

async function runCheck(inputPath, rules, options = {}) {
  const docx = await loadDocx(inputPath);
  const issues = [];
  const context = createContext(rules, false, issues, options);
  analyzeDocument(docx, context);
  insertMissingCaptions(docx, context);
  analyzeHeadersAndFooters(docx, context);
  return makeResult('check', inputPath, '', issues, context.stats);
}

async function runFix(inputPath, outputPath, rules, options = {}) {
  const docx = await loadDocx(inputPath);
  const issues = [];
  const context = createContext(rules, true, issues, options);
  normalizeDocumentStyles(docx, rules);
  analyzeDocument(docx, context);
  insertMissingCaptions(docx, context);
  analyzeHeadersAndFooters(docx, context);
  await saveDocx(docx, outputPath);
  return makeResult('fix', inputPath, outputPath, issues, context.stats);
}

function makeResult(mode, input, output, issues, stats) {
  return {
    mode,
    input,
    output,
    generatedAt: new Date().toISOString(),
    stats,
    issues,
  };
}

async function loadDocx(inputPath) {
  const buffer = readFileSync(inputPath);
  const zip = await JSZip.loadAsync(buffer);
  const xmlFiles = {};
  await loadXml(zip, xmlFiles, 'word/document.xml');
  await loadXml(zip, xmlFiles, 'word/styles.xml', false);
  await loadXml(zip, xmlFiles, 'word/numbering.xml', false);
  await loadXml(zip, xmlFiles, 'word/footnotes.xml', false);
  await loadXml(zip, xmlFiles, 'word/settings.xml', false);
  await loadXml(zip, xmlFiles, 'word/_rels/document.xml.rels', false);
  await loadXml(zip, xmlFiles, '[Content_Types].xml', false);

  for (const name of Object.keys(zip.files)) {
    if (/^word\/header\d+\.xml$/.test(name) || /^word\/footer\d+\.xml$/.test(name)) {
      await loadXml(zip, xmlFiles, name, false);
    }
  }
  return { zip, xmlFiles };
}

async function loadXml(zip, xmlFiles, name, required = true) {
  const file = zip.file(name);
  if (!file) {
    if (required) fail(`docx 缺少 ${name}`);
    return;
  }
  const text = protectPreservedSpaces(await file.async('string'));
  xmlFiles[name] = xml2js(text, XML_OPTIONS);
}

async function saveDocx(docx, outputPath) {
  for (const [name, parsed] of Object.entries(docx.xmlFiles)) {
    docx.zip.file(name, restorePreservedSpaces(js2xml(parsed, { compact: false, spaces: 0 })));
  }
  const buffer = await docx.zip.generateAsync({ type: 'nodebuffer' });
  writeFileSync(outputPath, buffer);
}

function protectPreservedSpaces(xml) {
  return xml.replace(/(<w:t\b[^>]*\bxml:space="preserve"[^>]*>)( +)(<\/w:t>)/g, (_, open, spaces, close) => (
    `${open}${SPACE_MARK.repeat(spaces.length)}${close}`
  ));
}

function restorePreservedSpaces(xml) {
  return xml.replaceAll(SPACE_MARK, ' ');
}

function computeBodyWidthTwips(rules) {
  if (!rules.page) return 0;
  const profile = rules.page.allowedMarginProfiles?.[0];
  return rules.page.widthTwips - (profile?.left || 0) - (profile?.right || 0);
}

function loadSourceReferences(referencesJson) {
  if (!referencesJson) return new Map();
  const path = resolve(referencesJson);
  if (!existsSync(path)) return new Map();
  try {
    const items = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(items)) return new Map();
    return new Map(items.map((item) => [String(item.label), normalizeReferenceSourceText(item.content || '')]));
  } catch {
    return new Map();
  }
}

function createContext(rules, fix, issues, options = {}) {
  return {
    rules,
    fix,
    issues,
    currentChapter: 0,
    currentAppendix: '',
    figureIndex: 0,
    tableIndex: 0,
    equationIndex: 0,
    referenceIndex: 0,
    inReferences: false,
    inToc: false,
    inFigureCatalog: false,
    inTableCatalog: false,
    mainBodyStarted: false,
    lastHeadingLevel: 0,
    lastSectionNumber: '',
    lastSubsectionParent: '',
    bodyWidthTwips: computeBodyWidthTwips(rules),
    documentTitle: options.title || rules.headersFooters?.evenHeaderText || rules.headersFooters?.thesisTitle || '',
    sourceReferences: loadSourceReferences(options.referencesJson),
    autoReferences: new Map(),
    stats: {
      paragraphs: 0,
      tables: 0,
      sections: 0,
      headings: 0,
      equations: 0,
      figures: 0,
      references: 0,
      fixed: 0,
    },
  };
}

function analyzeDocument(docx, context) {
  const body = getBody(docx.xmlFiles['word/document.xml']);
  if (!body?.elements) return;
  context.docx = docx;

  cleanupMeaninglessBlankParagraphs(body, context);
  cleanupDuplicateImageCaptions(body, context);
  cleanupEnglishTableCaptions(body, context);
  ensureTocPage(body, context);
  const bodyElements = body.elements.filter((element) => isElement(element));
  for (let i = 0; i < bodyElements.length; i++) {
    const element = bodyElements[i];
    if (element.name === 'w:p') {
      context.stats.paragraphs++;
      analyzeParagraph(element, context, i, bodyElements);
      const sectPr = findChild(findChild(element, 'w:pPr'), 'w:sectPr');
      if (sectPr) analyzeSection(sectPr, context, i);
    } else if (element.name === 'w:tbl') {
      context.stats.tables++;
      analyzeTable(element, context, i);
    } else if (element.name === 'w:sectPr') {
      analyzeSection(element, context, i);
    }
  }
  finalizeTocBookmarks(bodyElements);
  analyzeToc(bodyElements, context);
  processMarkdownFootnotes(body, context);
  appendReferencesFromFootnotes(body, context);
}

function getBody(documentXml) {
  const document = findChild(documentXml, 'w:document');
  return findChild(document, 'w:body');
}

function cleanupMeaninglessBlankParagraphs(body, context) {
  const elements = body.elements || [];
  let logicalIndex = 0;
  body.elements = elements.filter((element) => {
    if (!isElement(element)) return true;
    logicalIndex++;
    if (element.name !== 'w:p') return true;
    if (!isMeaninglessBlankParagraph(element)) return true;
    addIssue(context, {
      type: '无意义空行',
      location: paragraphLocation(logicalIndex - 1),
      current: '空白段落',
      expected: '删除无意义空行',
      fixable: true,
    });
    if (context.fix) {
      context.stats.fixed++;
      return false;
    }
    return true;
  });
}

function cleanupDuplicateImageCaptions(body, context) {
  const elements = body.elements || [];
  const elementList = elements.filter(isElement);
  let logicalIndex = 0;
  body.elements = elements.filter((element) => {
    if (!isElement(element)) return true;
    logicalIndex++;
    if (element.name !== 'w:p') return true;
    const styleId = paragraphStyleId(element);
    if (styleId !== 'ImageCaption') return true;
    const text = normalizeSpaces(getParagraphText(element)).trim();
    if (!/^图\s*\S+/.test(text)) return true;

    const currentIndex = elementList.indexOf(element);
    const nextIndex = findNextNonBlankParagraphSiblingIndex(elementList, currentIndex);
    const next = nextIndex >= 0 ? elementList[nextIndex] : null;
    const nextText = next?.name === 'w:p' ? normalizeSpaces(getParagraphText(next)).trim() : '';
    if (!nextText || !/^图\s*\S+/.test(nextText)) return true;
    if (!sameCaptionMeaning(text, nextText)) return true;

    addIssue(context, {
      type: '重复图题',
      location: paragraphLocation(logicalIndex - 1),
      current: text,
      expected: '删除由图片替代文本生成的重复图题，仅保留正文中的正式图题',
      fixable: true,
    });
    if (context.fix) {
      context.stats.fixed++;
      return false;
    }
    return true;
  });
}

function sameCaptionMeaning(a, b) {
  return normalizeCaptionMeaning(a) === normalizeCaptionMeaning(b);
}

function normalizeCaptionMeaning(text) {
  return normalizeSpaces(text)
    .replace(/[.-]/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

function processMarkdownFootnotes(body, context) {
  const elements = body.elements || [];
  const definitions = new Map();
  let logicalIndex = 0;

  body.elements = elements.filter((element) => {
    if (!isElement(element)) return true;
    logicalIndex++;
    if (element.name !== 'w:p') return true;
    const text = normalizeSpaces(getParagraphText(element)).trim();
    const match = text.match(/^\[\^([^\]]+)\]:\s*(.+)$/);
    if (!match) return true;
    definitions.set(match[1], match[2].trim());
    addIssue(context, {
      type: 'Markdown脚注定义',
      location: paragraphLocation(logicalIndex - 1),
      current: text,
      expected: '转换为 Word 页脚脚注内容',
      fixable: true,
    });
    if (context.fix) {
      context.stats.fixed++;
      return false;
    }
    return true;
  });

  processPandocFootnoteHyperlinks(body, context);

  if (!definitions.size) return;
  for (const [index, element] of (body.elements || []).entries()) {
    if (!isElement(element) || element.name !== 'w:p') continue;
    const text = getParagraphText(element);
    const markers = [...text.matchAll(/\[\^([^\]]+)\]/g)].map((match) => match[1]);
    if (!markers.length) continue;
    const missing = markers.filter((label) => !definitions.has(label));
    addIssue(context, {
      type: 'Markdown脚注引用',
      location: paragraphLocation(index),
      current: text.slice(0, 100),
      expected: '正文脚注编号以上标形式显示，并在页脚列出脚注内容',
      fixable: missing.length === 0,
      note: missing.length ? `缺少定义：${missing.map((label) => `[^${label}]`).join('、')}` : '',
    });
    if (!context.fix || missing.length || !paragraphIsPlainText(element)) continue;
    replaceMarkdownFootnoteMarkers(element, definitions, context);
    context.stats.fixed++;
  }
}

function processPandocFootnoteHyperlinks(body, context) {
  if (!context.fix) return;
  for (const [index, paragraph] of (body.elements || []).entries()) {
    if (!isElement(paragraph) || paragraph.name !== 'w:p' || !paragraph.elements) continue;
    let changed = false;
    const nextElements = [];
    for (const element of paragraph.elements) {
      if (!isPandocFootnoteHyperlink(element)) {
        nextElements.push(element);
        continue;
      }
      const label = getPandocFootnoteLabel(element);
      const content = getRelationshipTargetText(context.docx, element.attributes?.['r:id']);
      if (!label || !content) {
        nextElements.push(element);
        continue;
      }
      const id = createFootnoteDefinition(context.docx, label, cleanReferenceText(content), context.rules);
      registerAutoReference(context, label, content);
      nextElements.push(makeFootnoteReferenceRun(id));
      changed = true;
      addIssue(context, {
        type: 'Pandoc脚注超链接',
        location: paragraphLocation(index),
        current: `^${label}`,
        expected: '转换为 Word 原生脚注引用和页脚脚注内容',
        fixable: true,
      });
    }
    if (changed) {
      paragraph.elements = nextElements;
      context.stats.fixed++;
    }
  }
}

function isPandocFootnoteHyperlink(element) {
  if (!isElement(element) || element.name !== 'w:hyperlink') return false;
  if (!element.attributes?.['r:id']) return false;
  return Boolean(getPandocFootnoteLabel(element));
}

function getPandocFootnoteLabel(element) {
  const text = normalizeSpaces(getParagraphText(element)).trim();
  const match = text.match(/^\^([A-Za-z0-9_.-]+)$/);
  return match?.[1] || '';
}

function getRelationshipTargetText(docx, relId) {
  if (!relId) return '';
  const rels = docx.xmlFiles['word/_rels/document.xml.rels'];
  const root = findChild(rels, 'Relationships');
  const rel = findChildren(root, 'Relationship').find((item) => item.attributes?.Id === relId);
  const target = rel?.attributes?.Target || '';
  if (!target || /^(?:https?|mailto|ftp):/i.test(target) || target.startsWith('#')) return '';
  try {
    return decodeURIComponent(target).trim();
  } catch {
    return target.trim();
  }
}

function replaceMarkdownFootnoteMarkers(paragraph, definitions, context) {
  const original = normalizeChineseSymbolWidth(getParagraphText(paragraph));
  const parts = [];
  let cursor = 0;
  for (const match of original.matchAll(/\[\^([^\]]+)\]/g)) {
    if (match.index > cursor) {
      parts.push({ type: 'text', text: original.slice(cursor, match.index) });
    }
    const label = match[1];
    const id = createFootnoteDefinition(context.docx, label, cleanReferenceText(definitions.get(label)), context.rules);
    registerAutoReference(context, label, definitions.get(label));
    parts.push({ type: 'footnote', id });
    cursor = match.index + match[0].length;
  }
  if (cursor < original.length) {
    parts.push({ type: 'text', text: original.slice(cursor) });
  }

  const pPr = findChild(paragraph, 'w:pPr');
  const runs = [];
  for (const part of parts) {
    if (part.type === 'footnote') {
      runs.push(makeFootnoteReferenceRun(part.id));
      continue;
    }
    for (const split of splitMixedTextRuns(part.text)) {
      runs.push(makeRun(textRun(
        split.text,
        context.rules.body.eastAsiaFont,
        context.rules.body.latinFont,
        context.rules.body.fontSizeHalfPoints,
        false,
        split.isCjk ? context.rules.body.cjkCharacterSpacingTwentiethPoints : context.rules.body.latinCharacterSpacingTwentiethPoints,
        split.isCjk ? context.rules.body.cjkCharacterSpacingTwentiethPoints : context.rules.body.latinCharacterSpacingTwentiethPoints,
      )));
    }
  }
  paragraph.elements = [
    ...(pPr ? [pPr] : []),
    ...runs,
  ];
}

function registerAutoReference(context, label, content) {
  if (!label || !content) return;
  if (!/^\d+$/.test(String(label))) return;
  if (!context.autoReferences.has(String(label))) {
    context.autoReferences.set(String(label), context.sourceReferences.get(String(label)) || normalizeReferenceSourceText(content));
  }
}

function appendReferencesFromFootnotes(body, context) {
  if (!context.fix || !context.autoReferences.size) return;
  if (bodyHasReferencesHeading(body, context.rules.references.heading)) return;
  const references = [...context.autoReferences.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([label, content]) => ({ label, content }));
  if (!references.length) return;

  const insertAt = findBodySectPrIndex(body);
  const paragraphs = [
    makePageBreakParagraph(),
    makeReferenceHeadingParagraph(context.rules),
    makeReferenceBlankParagraph(context.rules),
    ...references.map((reference, index) => makeReferenceParagraph(index + 1, reference.content, context.rules)),
  ];
  body.elements.splice(insertAt, 0, ...paragraphs);
  context.stats.fixed += references.length + 1;
  addIssue(context, {
    type: '参考文献',
    location: '文末',
    current: '脚注定义已生成页底脚注',
    expected: '同时根据脚注定义自动生成“参考文献”章节',
    fixable: true,
    note: `已生成 ${references.length} 条参考文献`,
  });
}

function bodyHasReferencesHeading(body, heading) {
  return (body.elements || []).some((element) => (
    isElement(element) && element.name === 'w:p' && normalizeSpaces(getParagraphText(element)).trim() === heading
  ));
}

function findBodySectPrIndex(body) {
  const elements = body.elements || [];
  const index = elements.findIndex((element) => isElement(element) && element.name === 'w:sectPr');
  return index >= 0 ? index : elements.length;
}

function makeReferenceHeadingParagraph(rules) {
  return {
    type: 'element',
    name: 'w:p',
    elements: [
      {
        type: 'element',
        name: 'w:pPr',
        elements: [
          { type: 'element', name: 'w:pStyle', attributes: { 'w:val': 'Heading1' }, elements: [] },
          { type: 'element', name: 'w:ind', attributes: { 'w:firstLine': '0' }, elements: [] },
          { type: 'element', name: 'w:jc', attributes: { 'w:val': 'center' }, elements: [] },
          { type: 'element', name: 'w:spacing', attributes: { 'w:before': '0', 'w:after': '0', 'w:line': String(rules.headings.chapter.lineTwips), 'w:lineRule': 'auto' }, elements: [] },
        ],
      },
      makeRun(textRun(
        rules.references.heading,
        rules.headings.chapter.font,
        rules.headings.chapter.font,
        rules.headings.chapter.fontSizeHalfPoints,
        false,
      )),
    ],
  };
}

function makeReferenceBlankParagraph(rules) {
  return {
    type: 'element',
    name: 'w:p',
    elements: [
      {
        type: 'element',
        name: 'w:pPr',
        elements: [
          { type: 'element', name: 'w:spacing', attributes: { 'w:before': '0', 'w:after': '0', 'w:line': String(rules.headings.chapter.lineTwips), 'w:lineRule': 'auto' }, elements: [] },
          { type: 'element', name: 'w:ind', attributes: { 'w:firstLine': '0', 'w:left': '0' }, elements: [] },
        ],
      },
      makeRun(textRun('', rules.headings.chapter.font, rules.headings.chapter.font, rules.headings.chapter.fontSizeHalfPoints, false)),
    ],
  };
}

function makeReferenceParagraph(index, content, rules) {
  const runs = [];
  const normalized = stripReferencePages(normalizeReferenceSourceText(content));
  const referenceText = `[${index}] ${normalized}`;
  const foreign = isForeignReference(referenceText);
  const font = foreign ? rules.references.latinFont : rules.references.font;
  const latinFont = foreign ? rules.references.latinFont : rules.references.font;
  for (const part of splitMarkdownItalic(referenceText)) {
    runs.push(makeRun({
      text: part.text,
      font,
      latinFont,
      size: rules.references.fontSizeHalfPoints,
      bold: false,
      italic: part.italic,
      cjkSpacing: 0,
      latinSpacing: 0,
    }));
  }
  return {
    type: 'element',
    name: 'w:p',
    elements: [
      {
        type: 'element',
        name: 'w:pPr',
        elements: [
          { type: 'element', name: 'w:ind', attributes: { 'w:firstLine': '0', 'w:hanging': '420' }, elements: [] },
          { type: 'element', name: 'w:jc', attributes: { 'w:val': 'left' }, elements: [] },
          { type: 'element', name: 'w:spacing', attributes: { 'w:before': '0', 'w:after': '0', 'w:line': String(rules.references.lineTwips), 'w:lineRule': 'auto' }, elements: [] },
        ],
      },
      ...runs,
    ],
  };
}

function normalizeReferenceSourceText(text) {
  return normalizeChineseSymbolWidth(String(text || ''))
    .replace(/\s+/g, ' ')
    .replace(/\s+([，。；：、])/g, '$1')
    .replace(/([《（])\s+/g, '$1')
    .replace(/\s+([》）])/g, '$1')
    .replace(/([》）])\s+(?=\d{4}|第)/g, '$1')
    .trim();
}

function cleanReferenceText(text) {
  return normalizeReferenceSourceText(text)
    .replace(/\*/g, '')
    .trim();
}

function stripReferencePages(text) {
  return text
    .replace(/[，,]\s*第?\s*\d+\s*[–—-]\s*\d+\s*页[。.]?$/u, '。')
    .replace(/:\s*\d+\s*[–—-]\s*\d+\s*[。.]?$/u, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

function isForeignReference(text) {
  return !/[\u4e00-\u9fff]/.test(text);
}

function splitMarkdownItalic(text) {
  const parts = [];
  const re = /\*([^*]+)\*/g;
  let cursor = 0;
  for (const match of text.matchAll(re)) {
    if (match.index > cursor) parts.push({ text: text.slice(cursor, match.index), italic: false });
    parts.push({ text: match[1], italic: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), italic: false });
  return parts.filter((part) => part.text.length);
}

function ensureFootnoteDefinition(docx, label, content, rules) {
  const footnotesXml = ensureFootnotesXml(docx);
  const root = findChild(footnotesXml, 'w:footnotes');
  docx.__nbuFootnoteLabelToId ||= new Map();
  const normalizedLabel = String(label);
  if (docx.__nbuFootnoteLabelToId.has(normalizedLabel)) return docx.__nbuFootnoteLabelToId.get(normalizedLabel);
  const id = nextFootnoteId(root);
  const footnote = makeFootnoteXml(id, normalizedLabel, content, rules);
  root.elements.push(footnote);
  docx.__nbuFootnoteLabelToId.set(normalizedLabel, id);
  ensureDocumentRelationship(docx, 'footnotes', 'footnotes.xml');
  ensureContentTypeOverride(docx, '/word/footnotes.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml');
  return id;
}

function createFootnoteDefinition(docx, label, content, rules) {
  const footnotesXml = ensureFootnotesXml(docx);
  const root = findChild(footnotesXml, 'w:footnotes');
  const id = nextFootnoteId(root);
  root.elements.push(makeFootnoteXml(id, String(label), content, rules));
  ensureDocumentRelationship(docx, 'footnotes', 'footnotes.xml');
  ensureContentTypeOverride(docx, '/word/footnotes.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml');
  return id;
}

function ensureFootnotesXml(docx) {
  const name = 'word/footnotes.xml';
  if (!docx.xmlFiles[name]) {
    docx.xmlFiles[name] = {
      declaration: { attributes: { version: '1.0', encoding: 'UTF-8', standalone: 'yes' } },
      elements: [{
        type: 'element',
        name: 'w:footnotes',
        attributes: {
          'xmlns:w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
        },
        elements: [
          makeFootnoteSeparator('-1', 'separator'),
          makeFootnoteSeparator('0', 'continuationSeparator'),
        ],
      }],
    };
  }
  normalizeFootnoteSeparators(docx.xmlFiles[name]);
  return docx.xmlFiles[name];
}

function normalizeFootnoteSeparators(footnotesXml) {
  const root = findChild(footnotesXml, 'w:footnotes');
  if (!root?.elements) return;
  for (const footnote of findChildren(root, 'w:footnote')) {
    const type = footnote.attributes?.['w:type'];
    if (type !== 'separator' && type !== 'continuationSeparator') continue;
    footnote.elements = makeFootnoteSeparator(footnote.attributes?.['w:id'] || (type === 'separator' ? '-1' : '0'), type).elements;
  }
}

function makeFootnoteSeparator(id, type) {
  const marker = type === 'continuationSeparator' ? 'w:continuationSeparator' : 'w:separator';
  return {
    type: 'element',
    name: 'w:footnote',
    attributes: { 'w:type': type, 'w:id': String(id) },
    elements: [{
      type: 'element',
      name: 'w:p',
      elements: [{
        type: 'element',
        name: 'w:r',
        elements: [{ type: 'element', name: marker, elements: [] }],
      }],
    }],
  };
}

function nextFootnoteId(root) {
  return findChildren(root, 'w:footnote').reduce((max, footnote) => {
    const id = Number(footnote.attributes?.['w:id']);
    return id > max ? id : max;
  }, 0) + 1;
}

function makeFootnoteXml(id, label, content, rules) {
  const font = rules.pageNumbering?.footerFont || '宋体';
  const latinFont = rules.body?.latinFont || 'Times New Roman';
  const size = rules.pageNumbering?.footerFontSizeHalfPoints || 18;
  return {
    type: 'element',
    name: 'w:footnote',
    attributes: { 'w:id': String(id) },
    elements: [{
      type: 'element',
      name: 'w:p',
      elements: [
        {
          type: 'element',
          name: 'w:pPr',
          elements: [
            { type: 'element', name: 'w:pStyle', attributes: { 'w:val': 'FootnoteText' }, elements: [] },
            { type: 'element', name: 'w:spacing', attributes: { 'w:before': '0', 'w:after': '0', 'w:line': '240', 'w:lineRule': 'auto' }, elements: [] },
            { type: 'element', name: 'w:ind', attributes: { 'w:firstLine': '0', 'w:left': '0' }, elements: [] },
            { type: 'element', name: 'w:jc', attributes: { 'w:val': 'left' }, elements: [] },
          ],
        },
        makeFootnoteTextRun('', font, latinFont, size, true),
        makeFootnoteTextRun(' ', font, latinFont, size, false),
        ...splitMixedTextRuns(content).map((part) => makeFootnoteTextRun(part.text, font, latinFont, size, false)),
      ],
    }],
  };
}

function makeFootnoteTextRun(text, font, latinFont, size, isReference) {
  const run = {
    type: 'element',
    name: 'w:r',
    elements: [
      {
        type: 'element',
        name: 'w:rPr',
        elements: [
          { type: 'element', name: 'w:rFonts', attributes: {
            'w:ascii': latinFont,
            'w:hAnsi': latinFont,
            'w:eastAsia': font,
            'w:cs': latinFont,
          }, elements: [] },
          { type: 'element', name: 'w:sz', attributes: { 'w:val': String(size) }, elements: [] },
          { type: 'element', name: 'w:szCs', attributes: { 'w:val': String(size) }, elements: [] },
          { type: 'element', name: 'w:spacing', attributes: { 'w:val': '0' }, elements: [] },
        ],
      },
    ],
  };
  if (isReference) {
    findChild(run, 'w:rPr').elements.unshift({ type: 'element', name: 'w:rStyle', attributes: { 'w:val': 'FootnoteReference' }, elements: [] });
    findChild(run, 'w:rPr').elements.push({ type: 'element', name: 'w:vertAlign', attributes: { 'w:val': 'superscript' }, elements: [] });
    run.elements.push({ type: 'element', name: 'w:footnoteRef', elements: [] });
  } else {
    run.elements.push({ type: 'element', name: 'w:t', attributes: { 'xml:space': 'preserve' }, elements: [{ type: 'text', text }] });
  }
  return run;
}

function makeFootnoteReferenceRun(id) {
  return {
    type: 'element',
    name: 'w:r',
    elements: [
      {
        type: 'element',
        name: 'w:rPr',
        elements: [
          { type: 'element', name: 'w:rStyle', attributes: { 'w:val': 'FootnoteReference' }, elements: [] },
          { type: 'element', name: 'w:rFonts', attributes: {
            'w:ascii': '宋体',
            'w:hAnsi': '宋体',
            'w:eastAsia': '宋体',
            'w:cs': '宋体',
          }, elements: [] },
          { type: 'element', name: 'w:sz', attributes: { 'w:val': '18' }, elements: [] },
          { type: 'element', name: 'w:szCs', attributes: { 'w:val': '18' }, elements: [] },
          { type: 'element', name: 'w:vertAlign', attributes: { 'w:val': 'superscript' }, elements: [] },
        ],
      },
      { type: 'element', name: 'w:footnoteReference', attributes: { 'w:id': String(id) }, elements: [] },
    ],
  };
}

function cleanupEnglishTableCaptions(body, context) {
  if (!context.rules.tables?.removeEnglishCaptions) return;
  const elements = body.elements || [];
  let logicalIndex = 0;
  body.elements = elements.filter((element) => {
    if (!isElement(element)) return true;
    logicalIndex++;
    if (element.name !== 'w:p') return true;
    const text = normalizeSpaces(getParagraphText(element)).trim();
    if (!isEnglishTableCaptionText(text)) return true;
    addIssue(context, {
      type: '英文表题',
      location: paragraphLocation(logicalIndex - 1),
      current: text,
      expected: '表序和表题不用英文翻译，删除英文表题',
      fixable: true,
    });
    if (context.fix) {
      context.stats.fixed++;
      return false;
    }
    return true;
  });
}

function finalizeTocBookmarks(elements) {
  const tocAnchors = [];
  const headingParagraphs = [];
  for (const element of elements || []) {
    if (!isElement(element) || element.name !== 'w:p') continue;
    if (isTocEntryParagraph(element)) {
      const hyperlink = findChildren(element, 'w:hyperlink')[0];
      const anchor = hyperlink?.attributes?.['w:anchor'];
      if (anchor) tocAnchors.push(anchor);
      continue;
    }
    const text = normalizeSpaces(getParagraphText(element)).trim();
    if (text && tocHeadingLevel(element, text)) headingParagraphs.push(element);
  }
  let bookmarkId = nextBookmarkId(elements || []);
  for (let i = 0; i < tocAnchors.length && i < headingParagraphs.length; i++) {
    ensureParagraphBookmark(headingParagraphs[i], bookmarkId, tocAnchors[i]);
    bookmarkId += 1;
  }
}

function ensureTocPage(body, context) {
  const rule = context.rules.toc;
  if (!rule?.autoGenerate) return;
  const elements = body.elements || [];
  const hasToc = elements.some((element) => (
    element.name === 'w:p' && /^目\s*录$/.test(getParagraphText(element).trim())
  ));
  if (hasToc) return;
  addIssue(context, {
    type: '目录',
    location: '文档前置部分',
    current: '未识别到目录标题',
    expected: '自动插入“目    录”页和 TOC 自动目录域',
    fixable: true,
    note: '目录域已标记为 dirty，并设置打开文档时更新域；若 Word 未自动刷新，请全选后更新域',
  });
  if (!context.fix) return;
  const insertAt = findFirstBodyContentIndex(elements);
  const tocElements = makeTocPageElements(rule, context.rules, collectTocEntries(elements, context.rules));
  elements.splice(insertAt, 0, ...tocElements);
  ensureUpdateFieldsSetting(context.docx || null);
  context.stats.fixed++;
}

function findFirstBodyContentIndex(elements) {
  const firstContent = elements.findIndex((element) => {
    if (!isElement(element)) return false;
    if (element.name === 'w:sectPr') return false;
    if (element.name !== 'w:p') return true;
    return !isMeaninglessBlankParagraph(element);
  });
  return firstContent >= 0 ? firstContent : 0;
}

function makeTocPageElements(rule, rules, entries = []) {
  return [
    makeTextParagraph(rule.headingText || '目    录', {
      alignment: 'center',
      font: rule.headingFont || '黑体',
      latinFont: rules.body?.latinFont || 'Times New Roman',
      size: rule.headingFontSizeHalfPoints || 32,
      firstLine: 0,
      spacingLine: 240,
      before: 0,
      after: 0,
    }),
    makeTextParagraph('', {
      alignment: 'center',
      font: rule.headingFont || '黑体',
      latinFont: rules.body?.latinFont || 'Times New Roman',
      size: rule.blankLineFontSizeHalfPoints || 30,
      firstLine: 0,
      spacingLine: 240,
      before: 0,
      after: 0,
    }),
    ...makeTocEntryParagraphs(entries, rule, rules),
    makePageBreakParagraph(),
  ];
}


function collectTocEntries(elements, rules) {
  const entries = [];
  let estimatedPage = 1;
  let bodyStarted = false;
  let bookmarkId = nextBookmarkId(elements || []);
  for (const element of elements || []) {
    if (!isElement(element)) continue;
    if (element.name === 'w:p') {
      if (paragraphHasPageBreak(element)) estimatedPage += 1;
      const text = normalizeSpaces(getParagraphText(element)).trim();
      if (!text || isCatalogHeading(text)) continue;
      const level = tocHeadingLevel(element, text);
      if (level) {
        bodyStarted = true;
        const anchor = `NBU_TOC_${bookmarkId}`;
        const entryText = level === 1 ? normalizeChapterHeadingText(text, { currentChapter: parseChapterTitle(text) }) : text;
        entries.push({ level, text: entryText, page: Math.max(1, Math.round(estimatedPage)), anchor });
        bookmarkId += 1;
      } else if (bodyStarted) {
        estimatedPage += estimateParagraphPageShare(text, rules);
      }
    } else if (bodyStarted && element.name === 'w:tbl') {
      estimatedPage += 0.35;
    }
  }
  return entries;
}

function nextBookmarkId(elements) {
  let max = 0;
  for (const element of elements) {
    walk(element, (node) => {
      if (node.name !== 'w:bookmarkStart') return;
      const id = Number(node.attributes?.['w:id']);
      if (Number.isFinite(id) && id > max) max = id;
    });
  }
  return max + 1;
}

function ensureParagraphBookmark(paragraph, id, name) {
  if (!paragraph?.elements) paragraph.elements = [];
  const existing = findChildren(paragraph, 'w:bookmarkStart').find((node) => node.attributes?.['w:name'] === name);
  if (existing) return;
  const pPr = findChild(paragraph, 'w:pPr');
  const insertAt = pPr ? paragraph.elements.indexOf(pPr) + 1 : 0;
  paragraph.elements.splice(insertAt, 0, {
    type: 'element',
    name: 'w:bookmarkStart',
    attributes: { 'w:id': String(id), 'w:name': name },
    elements: [],
  });
  paragraph.elements.push({
    type: 'element',
    name: 'w:bookmarkEnd',
    attributes: { 'w:id': String(id) },
    elements: [],
  });
}

function tocHeadingLevel(paragraph, text) {
  if (/^第\s*[0-9一二三四五六七八九十]+\s*章(?:\s|$)/.test(text) || /^([1-9]\d?)\s+\S+/.test(text) || isMajorBackMatterHeading(text)) return 1;
  if (looksLikeSectionHeadingText(text)) return 2;
  if (looksLikeSubsectionHeadingText(text)) return 3;
  return 0;
}

function paragraphHasPageBreak(paragraph) {
  let found = false;
  walk(paragraph, (node) => {
    if (node.name === 'w:br' && node.attributes?.['w:type'] === 'page') found = true;
    if (node.name === 'w:pageBreakBefore') found = true;
  });
  return found;
}

function estimateParagraphPageShare(text, rules) {
  const charsPerPage = rules.toc?.estimateCharsPerPage || 950;
  return Math.max(0.03, normalizeSpaces(text).length / charsPerPage);
}

function makeTocEntryParagraphs(entries, rule, rules) {
  if (!entries.length) {
    return [makeTocEntryParagraph({ level: 1, text: '目录生成失败，请在 Word 中更新目录', page: 1 }, rule, rules)];
  }
  return entries.map((entry) => makeTocEntryParagraph(entry, rule, rules));
}

function normalizeTocEntryText(text) {
  return String(text)
    .replace(/^([1-9]\d?)\s+/, '$1')
    .replace(/^([1-9]\d?\.\d{1,2})\s+/, '$1')
    .replace(/^([1-9]\d?\.\d{1,2}\.\d{1,2})\s+/, '$1');
}

function makeTocEntryParagraph(entry, rule, rules) {
  const font = rule.entryFont || rules.body?.eastAsiaFont || '宋体';
  const latinFont = rule.entryLatinFont || rules.body?.latinFont || 'Times New Roman';
  const size = rule.entryFontSizeHalfPoints || 24;
  const left = entry.level === 3 ? (rule.level3IndentTwips || 960) : entry.level === 2 ? (rule.level2IndentTwips || 480) : 0;
  const paragraph = makeTextParagraph('', {
    alignment: 'left',
    font,
    latinFont,
    size,
    firstLine: 0,
    spacingLine: rule.entryLineTwips || rules.body?.lineTwips || 312,
    before: 0,
    after: 0,
  });
  const tocText = `${normalizeTocEntryText(entry.text)}\t${entry.page}`;
  const bold = entry.level <= 2 ? Boolean(rule.level1Bold ?? true) : Boolean(rule.level3Bold);
  const pPr = ensureChild(paragraph, 'w:pPr');
  removeChildren(pPr, ['w:pStyle', 'w:tabs']);
  pPr.elements.unshift({ type: 'element', name: 'w:pStyle', attributes: { 'w:val': `TOC${entry.level}` }, elements: [] });
  pPr.elements.push({ type: 'element', name: 'w:tabs', elements: [
    { type: 'element', name: 'w:tab', attributes: { 'w:val': 'right', 'w:leader': 'dot', 'w:pos': String(rule.pageNumberTabTwips || 9000) }, elements: [] },
  ] });
  const runs = splitMixedTextRuns(tocText).map((part) => makeRun(textRun(part.text, font, latinFont, size, bold, 0, 0)));
  paragraph.elements = [pPr, {
    type: 'element',
    name: 'w:hyperlink',
    attributes: { 'w:anchor': entry.anchor || '', 'w:history': '1' },
    elements: runs,
  }];
  setParagraphProps(paragraph, { left, firstLine: 0, resetInd: true });
  return paragraph;
}

function makeTocFieldParagraph(rule, rules) {
  const font = rule.entryFont || rules.body?.eastAsiaFont || '宋体';
  const latinFont = rule.entryLatinFont || rules.body?.latinFont || 'Times New Roman';
  const size = rule.entryFontSizeHalfPoints || 24;
  const instr = rule.fieldCode || 'TOC \\\\o "1-3" \\\\h \\\\z \\\\u';
  const runProps = () => ({
    type: 'element',
    name: 'w:rPr',
    elements: [
      { type: 'element', name: 'w:rFonts', attributes: {
        'w:ascii': latinFont,
        'w:hAnsi': latinFont,
        'w:eastAsia': font,
        'w:cs': latinFont,
      }, elements: [] },
      { type: 'element', name: 'w:sz', attributes: { 'w:val': String(size) }, elements: [] },
      { type: 'element', name: 'w:szCs', attributes: { 'w:val': String(size) }, elements: [] },
      { type: 'element', name: 'w:spacing', attributes: { 'w:val': '0' }, elements: [] },
    ],
  });
  return {
    type: 'element',
    name: 'w:p',
    elements: [
      {
        type: 'element',
        name: 'w:pPr',
        elements: [
          { type: 'element', name: 'w:jc', attributes: { 'w:val': 'left' }, elements: [] },
          { type: 'element', name: 'w:rPr', elements: runProps().elements },
        ],
      },
      makeFieldRun(runProps, [{ type: 'element', name: 'w:fldChar', attributes: { 'w:fldCharType': 'begin', 'w:dirty': 'true' }, elements: [] }]),
      makeFieldRun(runProps, [{ type: 'element', name: 'w:instrText', attributes: { 'xml:space': 'preserve' }, elements: [{ type: 'text', text: ` ${instr} ` }] }]),
      makeFieldRun(runProps, [{ type: 'element', name: 'w:fldChar', attributes: { 'w:fldCharType': 'separate' }, elements: [] }]),
      makeFieldRun(runProps, [{ type: 'element', name: 'w:t', attributes: { 'xml:space': 'preserve' }, elements: [{ type: 'text', text: '' }] }]),
      makeFieldRun(runProps, [{ type: 'element', name: 'w:fldChar', attributes: { 'w:fldCharType': 'end' }, elements: [] }]),
    ],
  };
}

function makePageBreakParagraph() {
  return {
    type: 'element',
    name: 'w:p',
    elements: [
      { type: 'element', name: 'w:pPr', elements: [] },
      { type: 'element', name: 'w:r', elements: [{ type: 'element', name: 'w:br', attributes: { 'w:type': 'page' }, elements: [] }] },
    ],
  };
}

function isTocEntryParagraph(paragraph) {
  return /^TOC[1-9]$/.test(paragraphStyleId(paragraph));
}

function analyzeParagraph(paragraph, context, index, siblings) {
  const text = normalizeSpaces(getParagraphText(paragraph));
  const trimmed = text.trim();
  if (isTocEntryParagraph(paragraph)) return;
  if (!trimmed && !hasMath(paragraph) && !hasDrawing(paragraph)) return;

  if (/^目\s*录$/.test(trimmed)) {
    context.inToc = true;
    context.inFigureCatalog = false;
    context.inTableCatalog = false;
    return;
  }
  if (context.inToc) {
    if (trimmed === '图目录') {
      context.inToc = false;
      context.inFigureCatalog = true;
      return;
    }
    if (!isChapterHeadingParagraph(paragraph, trimmed) && !isFirstLevelHeading(paragraph, trimmed)) {
      return;
    }
    context.inToc = false;
  }
  if (context.inFigureCatalog) {
    if (trimmed === '表目录') {
      context.inFigureCatalog = false;
      context.inTableCatalog = true;
      return;
    }
    return;
  }
  if (context.inTableCatalog) {
    if (trimmed === '中英文对照及缩略表') {
      return;
    }
    if (trimmed === '绪论') {
      context.inTableCatalog = false;
      context.mainBodyStarted = true;
      context.currentChapter = 1;
      resetChapterCounters(context);
      return;
    }
    return;
  }

  const appendix = trimmed.match(/^附\s*录\s*([A-Z])\b/i);
  if (appendix) {
    context.currentAppendix = appendix[1].toUpperCase();
    context.currentChapter = 0;
    resetChapterCounters(context);
  }

  const chapter = parseChapterTitle(trimmed);
  if (chapter && isChapterHeadingParagraph(paragraph, trimmed)) {
    context.currentChapter = chapter;
    context.currentAppendix = '';
    resetChapterCounters(context);
    context.mainBodyStarted = true;
    context.stats.headings++;
    checkAndFixChapter(paragraph, trimmed, context, index, siblings);
    context.inReferences = false;
    return;
  }

  if (isFirstLevelHeading(paragraph, trimmed)) {
    const inferredChapter = inferChapterNumberFromFirstLevelHeading(trimmed, context);
    if (inferredChapter) {
      context.currentChapter = inferredChapter;
      context.currentAppendix = '';
      resetChapterCounters(context);
    }
    context.currentAppendix = '';
    context.mainBodyStarted = true;
    context.stats.headings++;
    checkAndFixChapter(paragraph, trimmed, context, index, siblings);
    context.inReferences = false;
    return;
  }

  if (trimmed === context.rules.references.heading) {
    context.inReferences = true;
    context.referenceIndex = 0;
    setParagraphStyle(paragraph, {
      alignment: 'center',
      font: context.rules.body.eastAsiaFont,
      latinFont: context.rules.body.latinFont,
      size: context.rules.headings.chapter.fontSizeHalfPoints,
      bold: true,
      fix: context.fix,
    });
    return;
  }

  if (isMajorBackMatterHeading(trimmed)) {
    context.inReferences = false;
  }

  if (checkAndFixSubsection(paragraph, trimmed, context, index)) return;
  if (checkAndFixSection(paragraph, trimmed, context, index)) return;
  if (checkAndFixMarkdownSubsection(paragraph, trimmed, context, index)) return;
  if (checkAndFixMarkdownSection(paragraph, trimmed, context, index)) return;
  if (checkAndFixFigureLayout(paragraph, context, index)) return;
  if (checkAndFixFigureCaption(paragraph, trimmed, context, index, siblings)) return;
  if (checkAndFixTableCaption(paragraph, trimmed, context, index, siblings)) return;
  if (checkImageBasedEquation(paragraph, trimmed, context, index)) return;
  if (checkAndFixEquation(paragraph, trimmed, context, index)) return;
  if (context.inReferences && checkAndFixReference(paragraph, trimmed, context, index)) return;
  checkAndFixAbstract(paragraph, trimmed, context, index);
  checkAndFixBodyParagraph(paragraph, context, index);
}

function resetChapterCounters(context) {
  context.figureIndex = 0;
  context.tableIndex = 0;
  context.equationIndex = 0;
}

function parseChapterTitle(text) {
  const match = text.match(/^第\s*([0-9一二三四五六七八九十]+)\s*章/);
  if (match) return parseChineseNumber(match[1]);
  const numeric = text.match(/^([1-9]\d?)\s+\S+/);
  return numeric ? Number(numeric[1]) : 0;
}

function isChapterHeadingParagraph(paragraph, text) {
  if (isFirstLevelHeading(paragraph, text)) return true;
  if (text.length > 60) return false;
  if (!/^第\s*[0-9一二三四五六七八九十]+\s*章(?:\s+\S+|$)/.test(text)) return false;
  return !/[，。；：！？,.!?]/.test(text);
}

function parseChineseNumber(value) {
  if (/^\d+$/.test(value)) return Number(value);
  const digits = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (value === '十') return 10;
  if (value.startsWith('十')) return 10 + (digits[value[1]] || 0);
  if (value.includes('十')) {
    const [tens, ones] = value.split('十');
    return (digits[tens] || 1) * 10 + (digits[ones] || 0);
  }
  return digits[value] || 0;
}

function parseLeadingChineseHeadingNumber(text) {
  const match = text.match(/^([一二三四五六七八九十]+)、/);
  if (!match) return 0;
  return parseChineseNumber(match[1]);
}

function inferChapterNumberFromFirstLevelHeading(text, context) {
  const explicit = parseChapterTitle(text);
  if (explicit) return explicit;
  const leadingChinese = parseLeadingChineseHeadingNumber(text);
  if (leadingChinese) return leadingChinese;
  if (context.mainBodyStarted) return Math.max(1, context.currentChapter + 1);
  return 0;
}

function syncChapterFromHeadingNumber(numberText, context) {
  const chapter = Number(String(numberText).split('.')[0]);
  if (!chapter || chapter === context.currentChapter) return;
  context.currentChapter = chapter;
  context.currentAppendix = '';
  resetChapterCounters(context);
  context.mainBodyStarted = true;
}

function normalizeChapterHeadingText(text, context) {
  const explicit = text.match(/^第\s*([0-9一二三四五六七八九十]+)\s*章\s*(.*)$/);
  if (explicit) {
    const chapter = parseChineseNumber(explicit[1]);
    const title = explicit[2].trim();
    return `${chapter || context.currentChapter || explicit[1]}${title ? ` ${title}` : ''}`;
  }
  const numbered = text.match(/^([1-9]\d?)\s+(.+)$/);
  if (numbered) return `${Number(numbered[1])} ${numbered[2].trim()}`;
  if (context.currentChapter) return `${context.currentChapter} ${text.replace(/^[一二三四五六七八九十]+、\s*/, '').trim()}`;
  return text;
}

function checkAndFixChapter(paragraph, text, context, index, siblings = []) {
  const rule = context.rules.headings.chapter;
  const pageBreakBefore = shouldApplyChapterPageBreak(rule, index, siblings);
  context.lastSectionNumber = '';
  context.lastSubsectionParent = '';
  const expectedText = normalizeChapterHeadingText(text, context);
  const ok = text === expectedText && paragraphHasStyle(paragraph, {
    alignment: rule.alignment,
    font: rule.font,
    size: rule.fontSizeHalfPoints,
    line: rule.lineTwips,
    before: rule.spacingBefore,
    after: rule.spacingAfter,
    bold: rule.bold,
    pageBreakBefore,
  });
  if (!ok) {
    addIssue(context, {
      type: '章标题格式',
      location: paragraphLocation(index),
      current: text,
      expected: `${expectedText}，${describeHeadingStyle(rule, { pageBreakBefore })}`,
      fixable: true,
    });
    setParagraphMixedText(paragraph, expectedText, rule.font, rule.latinFont, rule.fontSizeHalfPoints, rule.bold, rule.cjkCharacterSpacingTwentiethPoints, rule.latinCharacterSpacingTwentiethPoints);
    setParagraphStyle(paragraph, {
      alignment: rule.alignment,
      font: rule.font,
      latinFont: rule.latinFont,
      size: rule.fontSizeHalfPoints,
      line: rule.lineTwips,
      before: rule.spacingBefore,
      after: rule.spacingAfter,
      bold: rule.bold,
      cjkSpacing: rule.cjkCharacterSpacingTwentiethPoints,
      latinSpacing: rule.latinCharacterSpacingTwentiethPoints,
      firstLine: 0,
      resetInd: true,
      pageBreakBefore,
      fix: context.fix,
    });
    if (context.fix) context.stats.fixed++;
  }
  context.lastHeadingLevel = 1;
}

function shouldApplyChapterPageBreak(rule, index, siblings) {
  if (!rule.pageBreakBefore) return false;
  return hasPreviousDocumentContent(siblings, index);
}

function hasPreviousDocumentContent(siblings, index) {
  for (let i = 0; i < index; i++) {
    const element = siblings[i];
    if (!isElement(element)) continue;
    if (element.name === 'w:tbl') return true;
    if (element.name !== 'w:p') return true;
    if (isMeaninglessBlankParagraph(element)) continue;
    return true;
  }
  return false;
}

function checkAndFixSubsection(paragraph, text, context, index) {
  const match = text.match(/^([1-9]\d?\.\d{1,2}\.\d{1,2})([ \u3000]+)(.+)$/);
  if (!match) return false;
  syncChapterFromHeadingNumber(match[1], context);
  context.stats.headings++;
  const parentSection = match[1].split('.').slice(0, 2).join('.');
  if (context.rules.headings?.enforceHierarchyCheck !== false
    && context.mainBodyStarted
    && context.lastSectionNumber !== parentSection
    && context.lastSubsectionParent !== parentSection) {
    addIssue(context, {
      type: '标题跳级',
      location: paragraphLocation(index),
      current: `第 3 级小节标题"${match[1]}"，最近一级节标题为"${context.lastSectionNumber || '无'}"`,
      expected: '第 3 级小节标题前应先出现第 2 级节标题（如 N.N  节标题）',
      fixable: false,
    });
  }
  context.lastHeadingLevel = 3;
  context.lastSubsectionParent = parentSection;
  const rule = context.rules.headings.subsection;
  const expected = `${match[1]}${' '.repeat(rule.spacesAfterNumber)}${match[3].trim()}`;
  const ok = match[2].length === rule.spacesAfterNumber && paragraphHasStyle(paragraph, {
    alignment: rule.alignment,
    font: rule.font,
    size: rule.fontSizeHalfPoints,
    line: rule.lineTwips,
    before: rule.spacingBefore,
    after: rule.spacingAfter,
    bold: rule.bold,
  }) && hasSpaceRunFontAfterPrefix(paragraph, match[1], rule.spacesAfterNumber, rule.spaceFont);
  if (!ok) {
    addIssue(context, {
      type: '小节标题格式',
      location: paragraphLocation(index),
      current: text,
      expected: `${match[1]} 后 ${rule.spacesAfterNumber} 个${rule.spaceFont}空格，${describeHeadingStyle(rule)}`,
      fixable: true,
    });
    if (context.fix) {
      setParagraphRuns(paragraph, [
        textRun(match[1], rule.font, rule.latinFont, rule.fontSizeHalfPoints, rule.bold, rule.cjkCharacterSpacingTwentiethPoints, rule.latinCharacterSpacingTwentiethPoints),
        textRun(' '.repeat(rule.spacesAfterNumber), rule.spaceFont, rule.spaceFont, rule.fontSizeHalfPoints, rule.bold, 0, 0),
        textRun(match[3].trim(), rule.font, rule.latinFont, rule.fontSizeHalfPoints, rule.bold, rule.cjkCharacterSpacingTwentiethPoints, rule.latinCharacterSpacingTwentiethPoints),
      ]);
      setParagraphProps(paragraph, {
        alignment: rule.alignment,
        spacingLine: rule.lineTwips,
        before: rule.spacingBefore,
        after: rule.spacingAfter,
        firstLine: 0,
        resetInd: true,
      });
      context.stats.fixed++;
    }
  }
  return true;
}

function checkAndFixSection(paragraph, text, context, index) {
  const match = text.match(/^([1-9]\d?\.\d{1,2})(?!\.)([ \u3000]+)(.+)$/);
  if (!match) return false;
  syncChapterFromHeadingNumber(match[1], context);
  context.stats.headings++;
  context.lastHeadingLevel = 2;
  context.lastSectionNumber = match[1];
  context.lastSubsectionParent = '';
  const rule = context.rules.headings.section;
  const ok = match[2].length === rule.spacesAfterNumber && paragraphHasStyle(paragraph, {
    alignment: rule.alignment,
    font: rule.font,
    size: rule.fontSizeHalfPoints,
    line: rule.lineTwips,
    before: rule.spacingBefore,
    after: rule.spacingAfter,
    bold: rule.bold,
  }) && hasSpaceRunFontAfterPrefix(paragraph, match[1], rule.spacesAfterNumber, rule.spaceFont);
  if (!ok) {
    addIssue(context, {
      type: '节标题格式',
      location: paragraphLocation(index),
      current: text,
      expected: `${match[1]} 后 ${rule.spacesAfterNumber} 个${rule.spaceFont}空格，${describeHeadingStyle(rule)}`,
      fixable: true,
    });
    if (context.fix) {
      setParagraphRuns(paragraph, [
        textRun(match[1], rule.font, rule.latinFont, rule.fontSizeHalfPoints, rule.bold, rule.cjkCharacterSpacingTwentiethPoints, rule.latinCharacterSpacingTwentiethPoints),
        textRun(' '.repeat(rule.spacesAfterNumber), rule.spaceFont, rule.spaceFont, rule.fontSizeHalfPoints, rule.bold, 0, 0),
        textRun(match[3].trim(), rule.font, rule.latinFont, rule.fontSizeHalfPoints, rule.bold, rule.cjkCharacterSpacingTwentiethPoints, rule.latinCharacterSpacingTwentiethPoints),
      ]);
      setParagraphProps(paragraph, {
        alignment: rule.alignment,
        spacingLine: rule.lineTwips,
        before: rule.spacingBefore,
        after: rule.spacingAfter,
        firstLine: 0,
        resetInd: true,
      });
      context.stats.fixed++;
    }
  }
  return true;
}

function checkAndFixMarkdownSection(paragraph, text, context, index) {
  if (!text || !isSecondLevelHeading(paragraph) || looksLikeSectionHeadingText(text) || looksLikeSubsectionHeadingText(text)) return false;
  context.stats.headings++;
  context.lastHeadingLevel = 2;
  context.lastSectionNumber = '';
  context.lastSubsectionParent = '';
  const rule = context.rules.headings.section;
  checkAndFixUnnumberedHeading(paragraph, text, context, index, rule, '节标题格式');
  return true;
}

function checkAndFixMarkdownSubsection(paragraph, text, context, index) {
  if (!text || !isThirdLevelHeading(paragraph) || looksLikeSubsectionHeadingText(text)) return false;
  context.stats.headings++;
  context.lastHeadingLevel = 3;
  const rule = context.rules.headings.subsection;
  checkAndFixUnnumberedHeading(paragraph, text, context, index, rule, '小节标题格式');
  return true;
}

function checkAndFixUnnumberedHeading(paragraph, text, context, index, rule, issueType) {
  const ok = paragraphHasStyle(paragraph, {
    alignment: rule.alignment,
    font: rule.font,
    size: rule.fontSizeHalfPoints,
    line: rule.lineTwips,
    before: rule.spacingBefore,
    after: rule.spacingAfter,
    bold: rule.bold,
  }) && paragraphRunsMatchStyle(paragraph, {
    font: rule.font,
    size: rule.fontSizeHalfPoints,
    bold: rule.bold,
  });
  if (ok) return;
  addIssue(context, {
    type: issueType,
    location: paragraphLocation(index),
    current: text,
    expected: describeHeadingStyle(rule),
    fixable: true,
  });
  setParagraphStyle(paragraph, {
    alignment: rule.alignment,
    font: rule.font,
    latinFont: rule.latinFont,
    size: rule.fontSizeHalfPoints,
    line: rule.lineTwips,
    before: rule.spacingBefore,
    after: rule.spacingAfter,
    firstLine: 0,
    resetInd: true,
    cjkSpacing: rule.cjkCharacterSpacingTwentiethPoints,
    latinSpacing: rule.latinCharacterSpacingTwentiethPoints,
    bold: rule.bold,
    fix: context.fix,
  });
  if (context.fix) context.stats.fixed++;
}

function checkAndFixFigureLayout(paragraph, context, index) {
  if (!hasDrawing(paragraph)) return false;
  if (!context.bodyWidthTwips) return true;
  const expectedWidthEmu = Math.round(context.bodyWidthTwips * 635 * ((context.rules.figures?.widthPercent || 100) / 100));
  const drawings = collectDrawingLayouts(paragraph);
  if (!drawings.length) return true;
  const layoutOk = drawings.every((drawing) => drawing.kind === 'anchor' && Boolean(findChild(drawing.node, 'wp:wrapTopAndBottom')));
  const widthOk = drawings.every((drawing) => {
    const extent = findChild(drawing.node, 'wp:extent');
    return Math.abs(Number(extent?.attributes?.cx || 0) - expectedWidthEmu) <= 8;
  });
  const paragraphOk = paragraphLayoutMatches(paragraph, {
    alignment: context.rules.figures.alignment || 'center',
    line: FIGURE_ANCHOR_LINE_TWIPS,
    lineRule: 'exact',
    before: 0,
    after: 0,
  });
  if (layoutOk && widthOk && paragraphOk) return true;
  addIssue(context, {
    type: '图片版式',
    location: paragraphLocation(index),
    current: [
      layoutOk ? '' : '图片不是上下环绕型',
      widthOk ? '' : '图片宽度不是版心 100%',
      paragraphOk ? '' : '图片段落与图题之间存在额外段前/段后间距',
    ].filter(Boolean).join('；'),
    expected: '图片上下环绕，宽度为版心 100%，图片段落居中且段前段后为 0',
    fixable: true,
  });
  if (context.fix) {
    setParagraphProps(paragraph, {
      alignment: context.rules.figures.alignment || 'center',
      spacingLine: FIGURE_ANCHOR_LINE_TWIPS,
      lineRule: 'exact',
      before: 0,
      after: 0,
      firstLine: 0,
      resetInd: true,
    });
    normalizeFigureDrawings(paragraph, expectedWidthEmu);
    context.stats.fixed++;
  }
  return true;
}

function checkAndFixFigureCaption(paragraph, text, context, index, siblings) {
  if (text === '图目录') return false;
  if (hasDrawing(paragraph)) return false;
  if (!isChineseFigureCaptionText(text)) return false;
  const belowImage = hasNearbyDrawingBefore(siblings, index);
  if (!belowImage) return false;
  context.figureIndex++;
  context.stats.figures++;
  const chapter = context.currentAppendix || context.currentChapter || '?';
  const expectedNumber = `图${chapter}.${context.figureIndex}`;
  const title = text.replace(/^图\s*[A-Z0-9一二三四五六七八九十]+[.-]\d+\s*/i, '').replace(/^图\s*/, '').trim();
  const expected = `${expectedNumber}${title ? ` ${title}` : ''}`;
  const numberOk = text.startsWith(expectedNumber);
  const styleOk = paragraphHasStyle(paragraph, {
    alignment: context.rules.figures.alignment,
    font: context.rules.figures.font,
    size: context.rules.figures.fontSizeHalfPoints,
    line: context.rules.figures.lineTwips,
    bold: false,
  }) && paragraphRunsMatchStyle(paragraph, {
    font: context.rules.figures.font,
    size: context.rules.figures.fontSizeHalfPoints,
  });

  const separatorOk = !/^[图表]\d+(?:\.\d+)*\u3000/.test(text);
  if (!numberOk || !styleOk || !belowImage || !separatorOk) {
    addIssue(context, {
      type: '图题格式',
      location: paragraphLocation(index),
      current: text,
      expected: `${expectedNumber}，图题位于图下方并${alignmentName(context.rules.figures.alignment)}对齐，${describeCaptionStyle(context.rules.figures.font, context.rules.figures.latinFont, context.rules.figures.fontSizeHalfPoints, context.rules.figures.lineTwips)}`,
      fixable: true,
      note: belowImage ? '' : '未在图题前近邻位置识别到图片，需人工确认图题位置',
    });
    if (context.fix) {
      setParagraphText(paragraph, expected, context.rules.figures.font, context.rules.figures.latinFont, context.rules.figures.fontSizeHalfPoints);
      setParagraphProps(paragraph, { alignment: context.rules.figures.alignment, spacingLine: context.rules.figures.lineTwips, before: 0, after: 0 });
      context.stats.fixed++;
    }
  }
  return true;
}

function checkAndFixTableCaption(paragraph, text, context, index, siblings) {
  if (text === '表目录') return false;
  if (isEnglishTableCaptionText(text)) {
    checkAndFixEnglishTableCaption(paragraph, text, context, index, siblings);
    return true;
  }
  if (!isChineseTableCaptionText(text)) return false;
  const nextContentIndex = findNextNonBlankParagraphSiblingIndex(siblings, index);
  const aboveTable = nextContentIndex >= 0 && siblings[nextContentIndex]?.name === 'w:tbl';
  if (!aboveTable) return false;
  context.tableIndex++;
  const chapter = context.currentAppendix || context.currentChapter || '?';
  const expectedNumber = `表${chapter}.${context.tableIndex}`;
  const title = text.replace(/^表\s*[A-Z0-9一二三四五六七八九十]+[.-]\d+\s*/i, '').replace(/^表\s*/, '').trim();
  const expected = `${expectedNumber}${title ? ` ${title}` : ''}`;
  const numberOk = text.startsWith(expectedNumber);
  const styleOk = paragraphHasStyle(paragraph, {
    alignment: context.rules.tables.alignment,
    font: context.rules.tables.captionFont,
    size: context.rules.tables.captionFontSizeHalfPoints,
    line: context.rules.tables.captionLineTwips,
    bold: false,
  }) && paragraphRunsMatchStyle(paragraph, {
    font: context.rules.tables.captionFont,
    size: context.rules.tables.captionFontSizeHalfPoints,
  });

  if (!numberOk || !styleOk || !aboveTable) {
    addIssue(context, {
      type: '表题格式',
      location: paragraphLocation(index),
      current: text,
      expected: `${expectedNumber}，表题位于表上方并${alignmentName(context.rules.tables.alignment)}对齐，${describeCaptionStyle(context.rules.tables.captionFont, context.rules.tables.captionLatinFont, context.rules.tables.captionFontSizeHalfPoints, context.rules.tables.captionLineTwips)}`,
      fixable: true,
      note: aboveTable ? '' : '未在表题后紧邻位置识别到表格，需人工确认表题位置',
    });
    if (context.fix) {
      setCaptionParagraphText(paragraph, expected, context.rules.tables.captionFont, context.rules.tables.captionLatinFont, context.rules.tables.captionFontSizeHalfPoints);
      setParagraphProps(paragraph, { alignment: context.rules.tables.alignment, spacingLine: context.rules.tables.captionLineTwips, before: 0, after: 0 });
      context.stats.fixed++;
    }
  }
  return true;
}

function checkAndFixEnglishTableCaption(paragraph, text, context, index, siblings) {
  const nextContentIndex = findNextNonBlankParagraphSiblingIndex(siblings, index);
  const aboveTable = nextContentIndex >= 0 && siblings[nextContentIndex]?.name === 'w:tbl';
  const prevContentIndex = findPrevNonBlankParagraphSiblingIndex(siblings, index);
  const prevText = normalizeSpaces(getParagraphText(siblings[prevContentIndex] || {})).trim();
  const precededByChinese = isChineseTableCaptionText(prevText);
  const styleOk = paragraphHasStyle(paragraph, {
    alignment: context.rules.tables.alignment,
    font: context.rules.tables.captionFont,
    size: context.rules.tables.captionFontSizeHalfPoints,
    line: context.rules.tables.captionLineTwips,
    bold: false,
  }) && paragraphRunsMatchStyle(paragraph, {
    font: context.rules.tables.captionFont,
    size: context.rules.tables.captionFontSizeHalfPoints,
  });
  if (!styleOk || !aboveTable || !precededByChinese) {
    addIssue(context, {
      type: '英文表题格式',
      location: paragraphLocation(index),
      current: text,
      expected: `英文表题应紧随中文表题、位于表上方，并${alignmentName(context.rules.tables.alignment)}对齐，${describeCaptionStyle(context.rules.tables.captionFont, context.rules.tables.captionLatinFont, context.rules.tables.captionFontSizeHalfPoints, context.rules.tables.captionLineTwips)}`,
      fixable: true,
      note: [
        precededByChinese ? '' : '前一段未识别到对应中文表题',
        aboveTable ? '' : '下一正文元素未识别到表格',
      ].filter(Boolean).join('；'),
    });
    if (context.fix) {
      setParagraphStyle(paragraph, {
        alignment: context.rules.tables.alignment,
        font: context.rules.tables.captionFont,
        latinFont: context.rules.tables.captionLatinFont,
        size: context.rules.tables.captionFontSizeHalfPoints,
        line: context.rules.tables.captionLineTwips,
        bold: false,
        fix: true,
      });
      context.stats.fixed++;
    }
  }
}

function checkAndFixEquation(paragraph, text, context, index) {
  const hasEquation = hasDisplayMathPara(paragraph) || looksLikeDisplayedEquationText(text);
  if (!hasEquation) return false;
  context.equationIndex++;
  context.stats.equations++;
  const prefix = context.currentAppendix || context.currentChapter || '?';
  const expected = context.currentAppendix
    ? context.rules.equations.appendixNumberFormat.replace('{appendix}', prefix).replace('{index}', context.equationIndex)
    : context.rules.equations.numberFormat.replace('{chapter}', prefix).replace('{index}', context.equationIndex);
  const numberOk = text.includes(expected);
  const alignOk =
    paragraphAlignment(paragraph) === (context.rules.equations.paragraphAlignment || 'left') &&
    mathAlignment(paragraph) === context.rules.equations.equationAlignment &&
    hasEquationTabLayout(paragraph, context.rules.equations) &&
    !paragraphHasFirstLineIndent(paragraph);

  if (!numberOk || !alignOk) {
    addIssue(context, {
      type: '公式编号与排版',
      location: paragraphLocation(index),
      current: text || '[公式对象]',
      expected: `公式居中，编号右对齐：${expected}`,
      fixable: true,
    });
    if (context.fix) {
      stripEquationNumber(paragraph);
      ensureEquationLeadingCenterTab(paragraph);
      appendEquationNumber(paragraph, expected, context.rules);
      setParagraphProps(paragraph, {
        alignment: context.rules.equations.paragraphAlignment || 'left',
        spacingLine: 360,
        firstLine: 0,
        hanging: 0,
        resetInd: true,
        tabs: [
          { val: 'center', pos: context.rules.equations.centerTabTwips || Math.round((context.rules.equations.rightTabTwips || 9000) / 2) },
          { val: 'right', pos: context.rules.equations.rightTabTwips },
        ],
      });
      setMathParagraphAlignment(paragraph, context.rules.equations.equationAlignment);
      context.stats.fixed++;
    }
  }
  return true;
}

function checkAndFixReference(paragraph, text, context, index) {
  if (!text) return false;
  if (isMajorBackMatterHeading(text)) {
    context.inReferences = false;
    return false;
  }
  context.referenceIndex++;
  context.stats.references++;
  const expectedPrefix = `[${context.referenceIndex}]`;
  const typeRe = new RegExp(context.rules.references.typePattern);
  const numberOk = text.startsWith(expectedPrefix);
  const typeOk = typeRe.test(text);
  const styleOk = paragraphHasStyle(paragraph, {
    alignment: 'left',
    font: context.rules.references.font,
    size: context.rules.references.fontSizeHalfPoints,
    line: context.rules.references.lineTwips,
  }) && paragraphRunsMatchStyle(paragraph, {
    font: context.rules.references.font,
    size: context.rules.references.fontSizeHalfPoints,
  });
  if (!numberOk || !typeOk || !styleOk) {
    addIssue(context, {
      type: '参考文献格式',
      location: paragraphLocation(index),
      current: text,
      expected: `${expectedPrefix} 开头，${describeBodyLikeStyle(context.rules.references.font, context.rules.references.latinFont, context.rules.references.fontSizeHalfPoints, context.rules.references.lineTwips)}，并包含 [M]/[J]/[D]/[EB/OL] 等类型标识`,
      fixable: !typeOk ? numberOk && styleOk : true,
      note: typeOk ? '' : '文献类型标识缺失或无法识别，需人工复核',
    });
    if (context.fix && typeOk) {
      const body = text.replace(/^\s*\[?\d+\]?\s*/, '').trim();
      const normalized = `${expectedPrefix} ${body}`;
      if (!numberOk) {
        setParagraphText(
          paragraph,
          normalized,
          context.rules.references.font,
          context.rules.references.latinFont,
          context.rules.references.fontSizeHalfPoints,
        );
      }
      setParagraphStyle(paragraph, {
        alignment: 'left',
        font: context.rules.references.font,
        latinFont: context.rules.references.latinFont,
        size: context.rules.references.fontSizeHalfPoints,
        line: context.rules.references.lineTwips,
        bold: false,
        fix: true,
      });
      setParagraphProps(paragraph, { alignment: 'left', spacingLine: context.rules.references.lineTwips, firstLine: 0, hanging: 420 });
      context.stats.fixed++;
    }
  }
  return true;
}

function checkAndFixAbstract(paragraph, text, context, index) {
  if (!/^(关键词|Keywords)\s*[:：]/.test(text)) return false;
  if (text.startsWith('关键词')) {
    const keywords = text.replace(/^关键词\s*[:：]\s*/, '').split(/[；;，,]/).map((item) => item.trim()).filter(Boolean);
    if (keywords.length < context.rules.abstract.chineseKeywordsMin || keywords.length > context.rules.abstract.chineseKeywordsMax) {
      addIssue(context, {
        type: '中文关键词数量',
        location: paragraphLocation(index),
        current: `${keywords.length} 个关键词`,
        expected: '4–8 个关键词',
        fixable: false,
      });
    }
  }
  if (context.fix) {
    const latinOnly = text.startsWith('Keywords');
    setParagraphStyle(paragraph, {
      alignment: 'left',
      font: latinOnly ? context.rules.abstract.englishFont : context.rules.body.eastAsiaFont,
      latinFont: context.rules.abstract.englishFont,
      size: context.rules.abstract.fontSizeHalfPoints,
      bold: false,
      fix: true,
    });
    context.stats.fixed++;
  }
  return true;
}

function checkAndFixBodyParagraph(paragraph, context, index) {
  if (context.inReferences) return;
  const text = normalizeChineseSymbolWidth(getParagraphText(paragraph).trim());
  if (!shouldTreatAsBodyParagraph(paragraph, text, context)) return;
  const ok = paragraphHasStyle(paragraph, {
    alignment: context.rules.body.alignment,
    font: context.rules.body.eastAsiaFont,
    latinFont: context.rules.body.latinFont,
    size: context.rules.body.fontSizeHalfPoints,
    line: context.rules.body.lineTwips,
    before: context.rules.body.spacingBefore,
    after: context.rules.body.spacingAfter,
    firstLine: context.rules.body.firstLineTwips,
  }) && paragraphRunsMatchStyle(paragraph, {
    font: context.rules.body.eastAsiaFont,
    latinFont: context.rules.body.latinFont,
    size: context.rules.body.fontSizeHalfPoints,
    bold: false,
  });
  if (!ok) {
    addIssue(context, {
      type: '正文段落格式',
      location: paragraphLocation(index),
      current: text.slice(0, 80),
      expected: describeBodyParagraphStyle(context.rules.body),
      fixable: true,
    });
    setParagraphStyle(paragraph, {
      alignment: context.rules.body.alignment,
      font: context.rules.body.eastAsiaFont,
      latinFont: context.rules.body.latinFont,
      size: context.rules.body.fontSizeHalfPoints,
      line: context.rules.body.lineTwips,
      before: context.rules.body.spacingBefore,
      after: context.rules.body.spacingAfter,
      firstLine: context.rules.body.firstLineTwips,
      resetInd: true,
      clearShading: true,
      cjkSpacing: context.rules.body.cjkCharacterSpacingTwentiethPoints,
      latinSpacing: context.rules.body.latinCharacterSpacingTwentiethPoints,
      fix: context.fix,
    });
    if (context.fix && paragraphIsPlainText(paragraph) && !hasMath(paragraph)) {
      setParagraphMixedText(
        paragraph,
        text,
        context.rules.body.eastAsiaFont,
        context.rules.body.latinFont,
        context.rules.body.fontSizeHalfPoints,
        false,
        context.rules.body.cjkCharacterSpacingTwentiethPoints,
        context.rules.body.latinCharacterSpacingTwentiethPoints,
      );
    }
    if (context.fix) context.stats.fixed++;
  }
}

function isSpecialSectionHeading(text) {
  return /^(绪论|图目录|表目录|中英文对照及缩略表)$/.test(text);
}

function looksLikeDateTimelineItem(text) {
  return /^20\d{2}\.(0?[1-9]|1[0-2])(\.\d{1,2})?\s+/.test(text);
}

function shouldTreatAsBodyParagraph(paragraph, text, context) {
  if (!text || hasDisplayMathPara(paragraph) || looksLikeDisplayedEquationText(text) || looksLikeTocLine(text) || hasDrawing(paragraph)) return false;
  if (isSpecialSectionHeading(text) || isMajorBackMatterHeading(text)) return false;
  if (isChapterHeadingParagraph(paragraph, text) || looksLikeSectionHeadingText(text) || looksLikeSubsectionHeadingText(text)) return false;
  if (isChineseFigureCaptionText(text) || isChineseTableCaptionText(text)) return false;
  if (looksLikePureUrlLine(text)) return false;
  if (context.currentChapter || context.currentAppendix || context.mainBodyStarted || looksLikeDateTimelineItem(text)) return true;
  return looksLikeLikelyBodyText(paragraph, text);
}

function looksLikeLikelyBodyText(paragraph, text) {
  const alignment = paragraphAlignment(paragraph);
  if (alignment === 'center' || alignment === 'right') return false;
  if (text.length < 16) return false;
  if (/^[A-Z0-9 ./:_-]+$/.test(text)) return false;
  if ((text.match(/[，。；：！？,.!?]/g) || []).length > 0) return true;
  return text.length >= 28;
}

function looksLikePureUrlLine(text) {
  return /^https?:\/\/\S+$/i.test(text) || /^www\.\S+$/i.test(text);
}

function isCatalogHeading(text) {
  return /^(目\s*录|图目录|表目录)$/.test(text);
}

function isFirstLevelHeading(paragraph, text) {
  if (!text || text.length > 40) return false;
  if (isCatalogHeading(text)) return false;
  if (looksLikeSectionHeadingText(text) || looksLikeSubsectionHeadingText(text)) return false;
  const styleId = paragraphStyleId(paragraph);
  if (styleId === '1' || styleId === 'Heading1') return true;
  return /^[一二三四五六七八九十]+、\S+/.test(text);
}

function isSecondLevelHeading(paragraph) {
  const styleId = paragraphStyleId(paragraph);
  return styleId === '2' || styleId === 'Heading2';
}

function isThirdLevelHeading(paragraph) {
  const styleId = paragraphStyleId(paragraph);
  return styleId === '3' || styleId === 'Heading3';
}

function looksLikeSectionHeadingText(text) {
  return Boolean(matchSectionHeadingText(text));
}

function looksLikeSubsectionHeadingText(text) {
  return Boolean(matchSubsectionHeadingText(text));
}

function matchSectionHeadingText(text) {
  return text.match(/^([1-9]\d?\.\d{1,2})(?!\.)([ \u3000]+)(.+)$/);
}

function matchSubsectionHeadingText(text) {
  return text.match(/^([1-9]\d?\.\d{1,2}\.\d{1,2})([ \u3000]+)(.+)$/);
}

function looksLikeDisplayedEquationText(text) {
  if (!text) return false;
  const numberRe = /[（(]\s*[A-Z0-9]+[-.]\d+\s*[）)]/g;
  if (!numberRe.test(text)) return false;
  const stripped = text.replace(numberRe, '').trim();
  if (!stripped) return true;
  if (/[\u4e00-\u9fff]/.test(stripped)) return false;
  if (/[=+\-×÷/*∑∏√≤≥<>]/.test(stripped)) return true;
  return /^[A-Za-z0-9_()[\]\s.,]+$/.test(stripped) && stripped.length <= 24;
}

function insertMissingCaptions(docx, context) {
  const body = getBody(docx.xmlFiles['word/document.xml']);
  if (!body?.elements) return;

  const elements = body.elements;
  const items = elements.filter(isElement);
  let currentChapter = 0;
  let tableIndex = 0;
  let figureIndex = 0;
  const insertions = [];

  for (let i = 0; i < items.length; i++) {
    const el = items[i];

    if (el.name === 'w:p') {
      const text = normalizeSpaces(getParagraphText(el)).trim();
      const ch = parseChapterTitle(text);
      if (ch) {
        currentChapter = ch; tableIndex = 0; figureIndex = 0;
      } else if (isFirstLevelHeading(el, text)) {
        currentChapter++; tableIndex = 0; figureIndex = 0;
      } else {
        const secMatch = text.match(/^([1-9]\d?\.\d{1,2})(?!\.)(\s*)(.+)$/);
        if (secMatch) {
          const secCh = Number(String(secMatch[1]).split('.')[0]);
          if (secCh && secCh !== currentChapter) { currentChapter = secCh; tableIndex = 0; figureIndex = 0; }
        }
      }

      if (hasDrawing(el)) {
        figureIndex++;
        const nextEl = items[i + 1];
        const nextText = nextEl?.name === 'w:p' ? normalizeSpaces(getParagraphText(nextEl)).trim() : '';
        if (!/^图\s*\S+/.test(nextText)) {
          const prefix = currentChapter || '?';
          const label = `图${prefix}.${figureIndex} （待补充）`;
          addIssue(context, {
            type: '图题缺失',
            location: `正文第 ${i + 1} 个元素`,
            current: '图片缺少图题',
            expected: `在图下方插入：${label}`,
            fixable: true,
          });
          if (context.fix) {
            insertions.push({ refElement: el, position: 'after', newElement: makeCaptionParagraph(label, context.rules.figures, 'figure') });
            context.stats.fixed++;
          }
        }
      }
    }

    if (el.name === 'w:tbl' && !isEquationLayoutTable(el)) {
      tableIndex++;
      if (!hasTableCaptionBlockAbove(items, i)) {
        const prefix = currentChapter || '?';
        const label = `表${prefix}.${tableIndex} （待补充）`;
        addIssue(context, {
          type: '表题缺失',
          location: `正文第 ${i + 1} 个元素`,
          current: '表格缺少表题',
          expected: `在表格上方插入：${label}`,
          fixable: true,
        });
        if (context.fix) {
          insertions.push({ refElement: el, position: 'before', newElement: makeCaptionParagraph(label, context.rules.tables, 'caption') });
          context.stats.fixed++;
        }
      }
    }
  }

  for (const ins of [...insertions].reverse()) {
    const pos = elements.indexOf(ins.refElement);
    if (pos === -1) continue;
    elements.splice(ins.position === 'before' ? pos : pos + 1, 0, ins.newElement);
  }
}

function hasTableCaptionBlockAbove(items, tableIndex) {
  const prevIndex = findPrevNonBlankParagraphSiblingIndex(items, tableIndex);
  const prevEl = items[prevIndex];
  const prevText = prevEl?.name === 'w:p' ? normalizeSpaces(getParagraphText(prevEl)).trim() : '';
  if (isChineseTableCaptionText(prevText)) return true;
  if (isEnglishTableCaptionText(prevText)) {
    const prevPrevIndex = findPrevNonBlankParagraphSiblingIndex(items, prevIndex);
    const prevPrevEl = items[prevPrevIndex];
    const prevPrevText = prevPrevEl?.name === 'w:p' ? normalizeSpaces(getParagraphText(prevPrevEl)).trim() : '';
    return isChineseTableCaptionText(prevPrevText);
  }
  return false;
}

function isEquationLayoutTable(table) {
  const rows = findChildren(table, 'w:tr');
  if (rows.length !== 1) return false;
  const cells = findChildren(rows[0], 'w:tc');
  if (cells.length !== 3) return false;
  const text = normalizeSpaces(getTableCellText(table)).trim();
  if (!/[（(]\s*[A-Z0-9]+[-.]\d+\s*[）)]/.test(text)) return false;
  let hasMathNode = false;
  walk(table, (node) => {
    if (node.name === 'm:oMath' || node.name === 'm:oMathPara') hasMathNode = true;
  });
  if (hasMathNode) return true;
  return looksLikeDisplayedEquationText(text);
}

function makeCaptionParagraph(text, rules, type) {
  const font = type === 'caption' ? (rules.captionFont || '仿宋') : (rules.font || '仿宋');
  const latinFont = type === 'caption' ? (rules.captionLatinFont || 'Times New Roman') : (rules.latinFont || 'Times New Roman');
  const size = type === 'caption' ? (rules.captionFontSizeHalfPoints || 21) : (rules.fontSizeHalfPoints || 21);
  const lineTwips = type === 'caption' ? (rules.captionLineTwips || 240) : (rules.lineTwips || 240);
  const para = { type: 'element', name: 'w:p', elements: [] };
  setCaptionParagraphText(para, text, font, latinFont, size);
  setParagraphProps(para, { alignment: 'center', spacingLine: lineTwips, before: 0, after: 0 });
  return para;
}

function isChineseTableCaptionText(text) {
  return /^表\s*[A-Z0-9一二三四五六七八九十]+[.-]\d+[ \u3000]+\S+/i.test(text);
}

function isEnglishTableCaptionText(text) {
  return /^Table\s+\d+\.\d+\b/i.test(text);
}

function isChineseFigureCaptionText(text) {
  return /^图\s*[A-Z0-9一二三四五六七八九十]+[.-]\d+[ \u3000]+\S+/i.test(text);
}

function findPrevNonBlankParagraphSiblingIndex(items, startIndex) {
  for (let i = startIndex - 1; i >= 0; i--) {
    const item = items[i];
    if (item?.name === 'w:tbl') return i;
    if (item?.name !== 'w:p') return i;
    if (!isMeaninglessBlankParagraph(item)) return i;
  }
  return -1;
}

function findNextNonBlankParagraphSiblingIndex(items, startIndex) {
  for (let i = startIndex + 1; i < items.length; i++) {
    const item = items[i];
    if (item?.name === 'w:tbl') return i;
    if (item?.name !== 'w:p') return i;
    if (!isMeaninglessBlankParagraph(item)) return i;
  }
  return -1;
}

function analyzeTable(table, context, index) {
  if (isEquationLayoutTable(table)) return;
  const expectedCellAlignment = context.rules.tables?.cellAlignment || 'left';
  const expectedCellVerticalAlignment = context.rules.tables?.cellVerticalAlignment || 'center';
  const expectGridTable = (context.rules.tables?.style || '') !== 'three-line-table';
  const expectRepeatHeader = Boolean(context.rules.tables?.repeatHeaderRow);
  const tableOk = expectGridTable ? isBorderedGridTable(table) : isThreeLineTable(table);
  const alignmentOk = tableCellsHaveParagraphAlignment(table, expectedCellAlignment);
  const verticalAlignmentOk = tableCellsHaveVerticalAlignment(table, expectedCellVerticalAlignment);
  const bodyStyleOk = tableCellsHaveBodyStyle(table, context.rules.tables || {});
  const repeatHeaderOk = expectRepeatHeader ? tableHasRepeatHeaderRow(table) : true;
  if (!tableOk || !alignmentOk || !verticalAlignmentOk || !bodyStyleOk || !repeatHeaderOk) {
    addIssue(context, {
      type: '表格边框样式',
      location: `第 ${index + 1} 个正文元素附近`,
      current: [
        tableOk ? '' : (expectGridTable ? '表格边框不是常规全边框表格' : '表格边框不是标准三线表'),
        alignmentOk ? '' : `单元格内容未统一${alignmentName(expectedCellAlignment)}对齐`,
        verticalAlignmentOk ? '' : `单元格内容未统一垂直${verticalAlignmentName(expectedCellVerticalAlignment)}`,
        bodyStyleOk ? '' : `表文字号或字体不符合${describeFontSizeAndFamily(context.rules.tables?.bodyFontSizeHalfPoints, context.rules.tables?.bodyFont, context.rules.tables?.bodyLatinFont)}`,
        repeatHeaderOk ? '' : '未设置跨页续表表头（重复标题行）',
      ].filter(Boolean).join('；'),
      expected: [
        expectGridTable
          ? '常规全边框表格'
          : '顶线、表头下线、底线；不使用竖线',
        `单元格内容水平${alignmentName(expectedCellAlignment)}对齐`,
        `单元格内容垂直${verticalAlignmentName(expectedCellVerticalAlignment)}`,
        `表文${describeFontSizeAndFamily(context.rules.tables?.bodyFontSizeHalfPoints, context.rules.tables?.bodyFont, context.rules.tables?.bodyLatinFont)}`,
        expectRepeatHeader ? '跨页时重复表头' : '跨页时不重复表头',
      ].join('；'),
      fixable: true,
    });
    if (context.fix) {
      applyImplicitVerticalMerges(table);
      if (expectGridTable) applyBorderedGridTable(table, expectedCellAlignment, expectedCellVerticalAlignment);
      else applyThreeLineTable(table, expectedCellAlignment, expectedCellVerticalAlignment);
      applyTableBodyStyle(table, context.rules.tables || {});
      if (expectRepeatHeader) applyRepeatHeaderRow(table);
      else clearRepeatHeaderRow(table);
      context.stats.fixed++;
    }
  }
  checkTableWidth(table, context, index);
  checkTableMergedCells(table, context, index);
}

function checkTableWidth(table, context, index) {
  if (!context.bodyWidthTwips) return;
  const tblPr = findChild(table, 'w:tblPr');
  const tblW = findChild(tblPr, 'w:tblW');
  if (!tblW) return;
  const type = attr(tblW, 'type');
  const w = Number(attr(tblW, 'w') || 0);
  if (type === 'dxa' && w > context.bodyWidthTwips) {
    const cmW = Math.round(w * 2.54 / 1440 * 10) / 10;
    const cmLimit = Math.round(context.bodyWidthTwips * 2.54 / 1440 * 10) / 10;
    addIssue(context, {
      type: '表格超宽',
      location: `第 ${index + 1} 个正文元素附近`,
      current: `表格宽度 ${w} twips（约 ${cmW} cm）`,
      expected: `不超过版心宽度 ${context.bodyWidthTwips} twips（约 ${cmLimit} cm）`,
      fixable: false,
      note: '表格宽度超出版心，需人工调整列宽或表格缩进',
    });
  }
}

function checkTableMergedCells(table, context, index) {
  let hasHMerge = false;
  let hasVMerge = false;
  for (const row of findChildren(table, 'w:tr')) {
    for (const cell of findChildren(row, 'w:tc')) {
      const tcPr = findChild(cell, 'w:tcPr');
      if (Number(attr(findChild(tcPr, 'w:gridSpan'), 'val') || 1) > 1) hasHMerge = true;
      if (findChild(tcPr, 'w:vMerge')) hasVMerge = true;
    }
  }
  if (hasHMerge || hasVMerge) {
    addIssue(context, {
      type: '表格合并单元格',
      location: `第 ${index + 1} 个正文元素附近`,
      current: [hasHMerge ? '含横向合并单元格' : '', hasVMerge ? '含纵向合并单元格' : ''].filter(Boolean).join('，'),
      expected: '合并单元格表格需人工核查格式与内容一致性',
      fixable: false,
      note: '三线表转换和单元格样式修复对合并单元格表格可能不完整，建议人工复核',
    });
  }
}

function applyImplicitVerticalMerges(table) {
  const rows = findChildren(table, 'w:tr');
  if (rows.length < 2) return;

  const maxCols = Math.max(...rows.map((row) => findChildren(row, 'w:tc').length), 0);
  for (let colIndex = 0; colIndex < maxCols; colIndex++) {
    let anchorCell = null;
    let anchorMerged = false;

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
      const cells = findChildren(rows[rowIndex], 'w:tc');
      const cell = cells[colIndex];
      if (!cell) {
        anchorCell = null;
        anchorMerged = false;
        continue;
      }

      const text = normalizeSpaces(getTableCellText(cell)).trim();
      if (text) {
        clearVerticalMerge(cell);
        anchorCell = cell;
        anchorMerged = false;
        continue;
      }

      if (!anchorCell) {
        clearVerticalMerge(cell);
        continue;
      }

      if (!isImplicitVerticalMergeContinuation(cells, colIndex)) {
        clearVerticalMerge(cell);
        anchorCell = null;
        anchorMerged = false;
        continue;
      }

      if (!anchorMerged) {
        setVerticalMerge(anchorCell, 'restart');
        anchorMerged = true;
      }
      setVerticalMerge(cell, 'continue');
    }
  }
}

function isImplicitVerticalMergeContinuation(cells, colIndex) {
  if (!cells.some((cell, index) => index > colIndex && normalizeSpaces(getTableCellText(cell)).trim())) return false;
  for (let i = 0; i <= colIndex; i++) {
    if (normalizeSpaces(getTableCellText(cells[i])).trim()) return false;
  }
  return true;
}

function setVerticalMerge(cell, value) {
  const tcPr = ensureChild(cell, 'w:tcPr');
  const vMerge = ensureChild(tcPr, 'w:vMerge');
  vMerge.attributes = { 'w:val': value };
}

function clearVerticalMerge(cell) {
  const tcPr = findChild(cell, 'w:tcPr');
  if (!tcPr) return;
  removeChildren(tcPr, ['w:vMerge']);
}

function getTableCellText(cell) {
  return findChildren(cell, 'w:p').map((paragraph) => getParagraphText(paragraph)).join('');
}

function analyzeSection(section, context, index) {
  context.stats.sections++;
  const page = context.rules.page;
  if (!page) return;

  const pgSz = findChild(section, 'w:pgSz');
  const width = Number(attr(pgSz, 'w') || 0);
  const height = Number(attr(pgSz, 'h') || 0);
  const orient = attr(pgSz, 'orient') || 'portrait';
  if (width !== page.widthTwips || height !== page.heightTwips || orient !== page.orientation) {
    addIssue(context, {
      type: '页面大小',
      location: `第 ${context.stats.sections} 个分节`,
      current: `${width}×${height}, ${orient}`,
      expected: `A4 纵向：${page.widthTwips}×${page.heightTwips}`,
      fixable: true,
    });
    if (context.fix) {
      const target = ensureChild(section, 'w:pgSz');
      target.attributes = { ...(target.attributes || {}), 'w:w': String(page.widthTwips), 'w:h': String(page.heightTwips) };
      delete target.attributes['w:orient'];
      context.stats.fixed++;
    }
  }

  const pgMar = findChild(section, 'w:pgMar');
  const margin = {
    top: Number(attr(pgMar, 'top') || 0),
    right: Number(attr(pgMar, 'right') || 0),
    bottom: Number(attr(pgMar, 'bottom') || 0),
    left: Number(attr(pgMar, 'left') || 0),
    header: Number(attr(pgMar, 'header') || 0),
    footer: Number(attr(pgMar, 'footer') || 0),
    gutter: Number(attr(pgMar, 'gutter') || 0),
  };
  const matched = page.allowedMarginProfiles?.find((profile) => marginMatches(margin, profile));
  if (!matched) {
    addIssue(context, {
      type: '页面边距',
      location: `第 ${context.stats.sections} 个分节`,
      current: marginToText(margin),
      expected: describeMarginExpectation(page.allowedMarginProfiles?.[0]),
      fixable: true,
      note: `来自样本文档的允许配置：${(page.allowedMarginProfiles || []).map((profile) => profile.name).join('、')}`,
    });
    if (context.fix && page.allowedMarginProfiles?.[0]) {
      const target = ensureChild(section, 'w:pgMar');
      target.attributes = marginProfileToAttributes(page.allowedMarginProfiles[0]);
      context.stats.fixed++;
    }
  }

  const docGrid = findChild(section, 'w:docGrid');
  if (page.docGridLinePitch && attr(docGrid, 'linePitch') !== String(page.docGridLinePitch)) {
    addIssue(context, {
      type: '文档网格',
      location: `第 ${context.stats.sections} 个分节`,
      current: attr(docGrid, 'linePitch') || '未设置',
      expected: `linePitch=${page.docGridLinePitch}`,
      fixable: true,
    });
    if (context.fix) {
      ensureChild(section, 'w:docGrid').attributes = { 'w:linePitch': String(page.docGridLinePitch) };
      context.stats.fixed++;
    }
  }

  checkPageNumbering(section, context);
}

function checkPageNumbering(section, context) {
  const rule = context.rules.pageNumbering;
  if (!rule) return;
  const pgNumType = findChild(section, 'w:pgNumType');
  const fmt = attr(pgNumType, 'fmt') || 'decimal';
  const start = attr(pgNumType, 'start');
  const isFront = context.stats.sections <= 8;
  if (isFront && context.stats.sections >= 3 && fmt !== rule.frontMatterFormat) {
    addIssue(context, {
      type: '前置页码格式',
      location: `第 ${context.stats.sections} 个分节`,
      current: fmt,
      expected: `前置部分页码使用 ${rule.frontMatterFormat}`,
      fixable: true,
    });
    if (context.fix) {
      const target = ensureChild(section, 'w:pgNumType');
      target.attributes = { ...(target.attributes || {}), 'w:fmt': rule.frontMatterFormat };
      if (context.stats.sections === 3) target.attributes['w:start'] = String(rule.frontMatterStart);
      context.stats.fixed++;
    }
  }
  if (!isFront && fmt !== rule.bodyFormat) {
    addIssue(context, {
      type: '正文页码格式',
      location: `第 ${context.stats.sections} 个分节`,
      current: fmt,
      expected: `正文部分页码使用 ${rule.bodyFormat}`,
      fixable: true,
    });
    if (context.fix && pgNumType) {
      delete pgNumType.attributes['w:fmt'];
      context.stats.fixed++;
    }
  }
  if (context.stats.sections === 3 && start && Number(start) !== rule.frontMatterStart) {
    addIssue(context, {
      type: '前置页码起始值',
      location: '前置部分第一个页码分节',
      current: start,
      expected: String(rule.frontMatterStart),
      fixable: true,
    });
  }
}

function analyzeToc(bodyElements, context) {
  const rule = context.rules.toc;
  if (!rule) return;
  const paragraphs = bodyElements
    .map((element, index) => ({ index, text: element.name === 'w:p' ? normalizeSpaces(getParagraphText(element)).trim() : '' }))
    .filter((item) => item.text);
  const tocHeading = paragraphs.find((item) => /^目\s*录$/.test(item.text));
  if (!tocHeading) {
    addIssue(context, {
      type: '目录',
      location: '文档前置部分',
      current: '未识别到目录标题',
      expected: '应包含“目  录”',
      fixable: false,
    });
    return;
  }

  const tocEntries = [];
  for (const item of paragraphs.filter((p) => p.index > tocHeading.index)) {
    if (item.text === '图目录') break;
    tocEntries.push(normalizeTocEntry(item.text));
    if (tocEntries.length > 140) break;
  }

  let cursor = -1;
  const missing = [];
  const outOfOrder = [];
  for (const required of rule.requiredOrder || []) {
    const found = tocEntries.findIndex((entry, entryIndex) => entryIndex > cursor && entry.startsWith(required));
    if (found === -1) {
      const anywhere = tocEntries.findIndex((entry) => entry.startsWith(required));
      if (anywhere >= 0) outOfOrder.push(required);
      else missing.push(required);
    } else {
      cursor = found;
    }
  }
  if (missing.length || outOfOrder.length) {
    addIssue(context, {
      type: '目录顺序',
      location: '目  录',
      current: tocEntries.slice(0, 20).join(' / '),
      expected: `顺序包含：${(rule.requiredOrder || []).join(' → ')}`,
      fixable: false,
      note: [
        missing.length ? `缺失：${missing.join('、')}` : '',
        outOfOrder.length ? `顺序异常：${outOfOrder.join('、')}` : '',
      ].filter(Boolean).join('；'),
    });
  }

  if (!documentHasInstrText(bodyElements, 'TOC')) {
    addIssue(context, {
      type: '目录域',
      location: '目  录',
      current: '未检测到 TOC 域代码',
      expected: rule.fieldCode || 'TOC 域',
      fixable: false,
      note: '建议在 Word 中插入自动目录或更新整个目录',
    });
  }
}

function analyzeHeadersAndFooters(docx, context) {
  let files = Object.keys(docx.xmlFiles).filter((name) => /^word\/(header|footer)\d+\.xml$/.test(name));
  const headerRule = context.rules.headersFooters || {};
  const expectedOddHeader = headerRule.oddHeaderText || headerRule.headerPrefix || '';
  const expectedEvenHeader = context.documentTitle || headerRule.evenHeaderText || '';
  const headerFilesBefore = files.filter((name) => name.includes('/header'));
  const footerFilesBefore = files.filter((name) => name.includes('/footer'));
  const headerTextsBefore = headerFilesBefore.map((name) => firstNonEmptyParagraphText(docx.xmlFiles[name]));
  const missingRequiredHeaders = Boolean(expectedOddHeader && !headerTextsBefore.includes(expectedOddHeader))
    || Boolean(expectedEvenHeader && !headerTextsBefore.includes(expectedEvenHeader));
  const missingPageFooter = headerRule.requirePageFieldInFooters
    && !footerFilesBefore.some((name) => containsPageField(docx.xmlFiles[name]));

  if (files.length === 0 || missingRequiredHeaders || missingPageFooter) {
    addIssue(context, {
      type: '页眉页脚',
      location: '文档节属性',
      current: files.length === 0 ? '未检测到页眉或页脚文件' : '页眉页脚不完整',
      expected: `奇数页页眉“${expectedOddHeader}”，偶数页页眉“${expectedEvenHeader}”，页脚居中 PAGE 页码域`,
      fixable: true,
      note: '页码不设置起始值，默认延续前一节继续编号',
    });
    if (context.fix) {
      ensureHeadersAndFooters(docx, context);
      context.stats.fixed++;
      files = Object.keys(docx.xmlFiles).filter((name) => /^word\/(header|footer)\d+\.xml$/.test(name));
    }
  }

  const headerFiles = files.filter((name) => name.includes('/header'));
  const headerTexts = headerFiles.map((name) => firstNonEmptyParagraphText(docx.xmlFiles[name]));
  if (expectedOddHeader && !headerTexts.includes(expectedOddHeader)) {
    addIssue(context, {
      type: '奇数页页眉文字',
      location: '页眉',
      current: headerTexts.join(' / ') || '未检测到页眉文字',
      expected: expectedOddHeader,
      fixable: true,
    });
  }
  if (expectedEvenHeader && !headerTexts.includes(expectedEvenHeader)) {
    addIssue(context, {
      type: '偶数页页眉文字',
      location: '页眉',
      current: headerTexts.join(' / ') || '未检测到页眉文字',
      expected: expectedEvenHeader,
      fixable: true,
    });
  }
  for (const name of headerFiles) {
    const headerText = firstNonEmptyParagraphText(docx.xmlFiles[name]);
    if (!headerText) continue;
    if (expectedOddHeader && expectedEvenHeader && ![expectedOddHeader, expectedEvenHeader].includes(headerText)) {
      addIssue(context, {
        type: '页眉文字',
        location: name,
        current: headerText,
        expected: `奇数页“${expectedOddHeader}”，偶数页“${expectedEvenHeader}”`,
        fixable: true,
      });
    }
    const style = firstNonEmptyParagraphRunStyle(docx.xmlFiles[name]);
    if (headerRule.headerAlignment && style.alignment && style.alignment !== headerRule.headerAlignment) {
      addIssue(context, {
        type: '页眉对齐',
        location: name,
        current: style.alignment,
        expected: `${headerRule.headerAlignment}，页眉居中`,
        fixable: true,
      });
      if (context.fix && style.paragraph) {
        setParagraphProps(style.paragraph, { alignment: headerRule.headerAlignment });
        context.stats.fixed++;
      }
    }
    if (headerRule.headerFontSizeHalfPoints && style.size && style.size !== String(headerRule.headerFontSizeHalfPoints)) {
      addIssue(context, {
        type: '页眉字号',
        location: name,
        current: style.size,
        expected: `${headerRule.headerFontSizeHalfPoints} half-points`,
        fixable: true,
      });
      if (context.fix) {
        style.runs.forEach((run) => setRunStyle(run, headerRule.headerFont || context.rules.body.eastAsiaFont, headerRule.headerFont || context.rules.body.eastAsiaFont, headerRule.headerFontSizeHalfPoints, false));
        context.stats.fixed++;
      }
    }
  }
  const footerFiles = files.filter((name) => name.includes('/footer'));
  const hasPageField = footerFiles.some((name) => containsPageField(docx.xmlFiles[name]));
  if (headerRule.requirePageFieldInFooters && !hasPageField) {
    addIssue(context, {
      type: '页脚页码',
      location: '页脚',
      current: '未检测到 PAGE 页码域',
      expected: '页脚应包含居中 PAGE 页码域，并延续前页继续编号',
      fixable: true,
      note: '页码不设置起始值，默认延续前一节继续编号',
    });
    if (context.fix && footerFiles.length > 0) {
      ensureFooterPageField(docx.xmlFiles[footerFiles[0]], context.rules.pageNumbering?.footerAlignment || 'center', context.rules);
      context.stats.fixed++;
    }
  }
  for (const name of footerFiles) {
    if (!containsPageField(docx.xmlFiles[name])) continue;
    const style = firstNonEmptyParagraphRunStyle(docx.xmlFiles[name]);
    const expectedAlignment = context.rules.pageNumbering?.footerAlignment;
    if (expectedAlignment && style.alignment && style.alignment !== expectedAlignment) {
      addIssue(context, {
        type: '页脚对齐',
        location: name,
        current: style.alignment,
        expected: `${expectedAlignment}，页码一般置于页脚中部`,
        fixable: true,
      });
      if (context.fix && style.paragraph) {
        setParagraphProps(style.paragraph, { alignment: expectedAlignment });
        context.stats.fixed++;
      }
    }
  }
}

function attr(node, localName) {
  return node?.attributes?.[`w:${localName}`] ?? node?.attributes?.[localName];
}

function marginMatches(margin, profile) {
  return ['top', 'right', 'bottom', 'left', 'header', 'footer', 'gutter'].every((key) => (
    Math.abs(Number(margin[key] || 0) - Number(profile[key] || 0)) <= 2
  ));
}

function marginToText(margin) {
  return Object.entries(margin).map(([key, value]) => `${key}=${value}`).join(', ');
}

function marginProfileToAttributes(profile) {
  const attrs = {};
  for (const key of ['top', 'right', 'bottom', 'left', 'header', 'footer', 'gutter']) {
    attrs[`w:${key}`] = String(profile[key] || 0);
  }
  return attrs;
}

function normalizeTocEntry(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[.·…\s]*[IVXLCDMⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ\d]+$/i, '')
    .trim();
}

function documentHasInstrText(elements, pattern) {
  const re = new RegExp(pattern);
  return elements.some((element) => {
    let found = false;
    walk(element, (node) => {
      if (node.name === 'w:instrText' && node.elements?.some((child) => child.type === 'text' && re.test(child.text || ''))) {
        found = true;
      }
    });
    return found;
  });
}

function firstNonEmptyParagraphText(xml) {
  const root = findChild(xml, 'w:hdr') || findChild(xml, 'w:ftr') || xml;
  for (const paragraph of findChildren(root, 'w:p')) {
    const text = getParagraphText(paragraph).trim();
    if (text) return text;
  }
  return '';
}

function firstNonEmptyParagraphRunStyle(xml) {
  const root = findChild(xml, 'w:hdr') || findChild(xml, 'w:ftr') || xml;
  for (const paragraph of findChildren(root, 'w:p')) {
    if (!getParagraphText(paragraph).trim()) continue;
    const runs = findChildren(paragraph, 'w:r');
    const firstRun = runs.find((run) => getParagraphText(run).trim()) || runs[0];
    const rPr = findChild(firstRun, 'w:rPr');
    const fonts = findChild(rPr, 'w:rFonts');
    const sz = findChild(rPr, 'w:sz');
    return {
      paragraph,
      runs,
      font: attr(fonts, 'eastAsia'),
      size: attr(sz, 'val'),
      alignment: paragraphAlignment(paragraph),
    };
  }
  return { paragraph: null, runs: [], font: '', size: '', alignment: '' };
}

function containsPageField(xml) {
  return /PAGE/.test(js2xml(xml, { compact: false, spaces: 0 }));
}

function ensureHeadersAndFooters(docx, context) {
  const rule = context.rules.headersFooters || {};
  const oddHeaderText = rule.oddHeaderText || rule.headerPrefix || '宁波大学硕士学位论文';
  const evenHeaderText = context.documentTitle || rule.evenHeaderText || '论文中文题目';
  const headerFont = rule.headerFont || context.rules.body.eastAsiaFont;
  const headerLatinFont = rule.headerLatinFont || context.rules.body.latinFont;
  const headerSize = rule.headerFontSizeHalfPoints || 21;
  const alignment = rule.headerAlignment || 'center';
  const footerAlignment = context.rules.pageNumbering?.footerAlignment || 'center';

  const oddHeaderRelId = ensureDocumentRelationship(docx, 'header', 'header1.xml');
  const evenHeaderRelId = ensureDocumentRelationship(docx, 'header', 'header2.xml');
  const defaultFooterRelId = ensureDocumentRelationship(docx, 'footer', 'footer1.xml');
  const evenFooterRelId = ensureDocumentRelationship(docx, 'footer', 'footer2.xml');

  docx.xmlFiles['word/header1.xml'] = makeHeaderXml(oddHeaderText, alignment, headerFont, headerLatinFont, headerSize);
  docx.xmlFiles['word/header2.xml'] = makeHeaderXml(evenHeaderText, alignment, headerFont, headerLatinFont, headerSize);
  docx.xmlFiles['word/footer1.xml'] = makeFooterXml(footerAlignment, context.rules);
  docx.xmlFiles['word/footer2.xml'] = makeFooterXml(footerAlignment, context.rules);

  ensureContentTypeOverride(docx, '/word/header1.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml');
  ensureContentTypeOverride(docx, '/word/header2.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml');
  ensureContentTypeOverride(docx, '/word/footer1.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml');
  ensureContentTypeOverride(docx, '/word/footer2.xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml');
  ensureEvenAndOddHeadersSetting(docx);
  applyHeaderFooterReferences(docx, {
    oddHeaderRelId,
    evenHeaderRelId,
    defaultFooterRelId,
    evenFooterRelId,
  });
}

function ensureFooterPageField(xml, alignment = 'center', rules = {}) {
  const root = findChild(xml, 'w:ftr');
  if (!root) return;
  root.elements = findChildren(root, 'w:p').length ? root.elements : [];
  root.elements.push(makePageFieldParagraph(alignment, rules));
}

function makeHeaderXml(text, alignment, font, latinFont, size) {
  return makePartXml('w:hdr', [
    makeTextParagraph(text, {
      alignment,
      font,
      latinFont,
      size,
      firstLine: 0,
      spacingLine: 240,
      before: 0,
      after: 0,
      bottomBorder: { val: 'single', size: 4, space: 1, color: '000000' },
    }),
  ]);
}

function makeFooterXml(alignment, rules) {
  return makePartXml('w:ftr', [makePageFieldParagraph(alignment, rules)]);
}

function makePartXml(rootName, elements) {
  return {
    declaration: { attributes: { version: '1.0', encoding: 'UTF-8', standalone: 'yes' } },
    elements: [{
      type: 'element',
      name: rootName,
      attributes: {
        'xmlns:w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
        'xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      },
      elements,
    }],
  };
}

function makeTextParagraph(text, options) {
  const paragraph = {
    type: 'element',
    name: 'w:p',
    elements: [
      {
        type: 'element',
        name: 'w:pPr',
        elements: [
          { type: 'element', name: 'w:jc', attributes: { 'w:val': options.alignment || 'center' }, elements: [] },
        ],
      },
      makeRun(textRun(text, options.font, options.latinFont, options.size, false)),
    ],
  };
  if (options.firstLine !== undefined) {
    setParagraphProps(paragraph, { firstLine: options.firstLine, resetInd: true });
  }
  if (options.spacingLine || options.before !== undefined || options.after !== undefined) {
    setParagraphProps(paragraph, {
      spacingLine: options.spacingLine,
      before: options.before,
      after: options.after,
    });
  }
  if (options.bottomBorder) {
    setParagraphBottomBorder(paragraph, options.bottomBorder);
  }
  return paragraph;
}

function setParagraphBottomBorder(paragraph, borderOptions = {}) {
  const pPr = ensureChild(paragraph, 'w:pPr');
  const pBdr = ensureChild(pPr, 'w:pBdr');
  removeChildren(pBdr, ['w:bottom']);
  pBdr.elements.push({
    type: 'element',
    name: 'w:bottom',
    attributes: {
      'w:val': borderOptions.val || 'single',
      'w:sz': String(borderOptions.size || 4),
      'w:space': String(borderOptions.space || 1),
      'w:color': borderOptions.color || '000000',
    },
    elements: [],
  });
}

function makePageFieldParagraph(alignment = 'center', rules = {}) {
  const font = rules.pageNumbering?.footerFont || rules.body?.eastAsiaFont || '宋体';
  const latinFont = rules.pageNumbering?.footerLatinFont || rules.body?.latinFont || 'Times New Roman';
  const size = rules.pageNumbering?.footerFontSizeHalfPoints || 21;
  const runProps = () => ({
    type: 'element',
    name: 'w:rPr',
    elements: [
      { type: 'element', name: 'w:rFonts', attributes: {
        'w:ascii': latinFont,
        'w:hAnsi': latinFont,
        'w:eastAsia': font,
        'w:cs': latinFont,
      }, elements: [] },
      { type: 'element', name: 'w:sz', attributes: { 'w:val': String(size) }, elements: [] },
      { type: 'element', name: 'w:szCs', attributes: { 'w:val': String(size) }, elements: [] },
      { type: 'element', name: 'w:spacing', attributes: { 'w:val': '0' }, elements: [] },
    ],
  });
  return {
    type: 'element',
    name: 'w:p',
    elements: [
      {
        type: 'element',
        name: 'w:pPr',
        elements: [
          {
            type: 'element',
            name: 'w:jc',
            attributes: { 'w:val': alignment },
            elements: [],
          },
          {
            type: 'element',
            name: 'w:rPr',
            elements: [
              { type: 'element', name: 'w:rFonts', attributes: {
                'w:ascii': latinFont,
                'w:hAnsi': latinFont,
                'w:eastAsia': font,
                'w:cs': latinFont,
              }, elements: [] },
              { type: 'element', name: 'w:sz', attributes: { 'w:val': String(size) }, elements: [] },
              { type: 'element', name: 'w:szCs', attributes: { 'w:val': String(size) }, elements: [] },
              { type: 'element', name: 'w:spacing', attributes: { 'w:val': '0' }, elements: [] },
            ],
          },
        ],
      },
      makeFieldRun(runProps, [{ type: 'element', name: 'w:fldChar', attributes: { 'w:fldCharType': 'begin' }, elements: [] }]),
      makeFieldRun(runProps, [{ type: 'element', name: 'w:instrText', attributes: { 'xml:space': 'preserve' }, elements: [{ type: 'text', text: ' PAGE ' }] }]),
      makeFieldRun(runProps, [{ type: 'element', name: 'w:fldChar', attributes: { 'w:fldCharType': 'separate' }, elements: [] }]),
      makeFieldRun(runProps, [{ type: 'element', name: 'w:t', elements: [{ type: 'text', text: '1' }] }]),
      makeFieldRun(runProps, [{ type: 'element', name: 'w:fldChar', attributes: { 'w:fldCharType': 'end' }, elements: [] }]),
    ],
  };
}

function makeFieldRun(runProps, elements) {
  return {
    type: 'element',
    name: 'w:r',
    elements: [runProps(), ...elements],
  };
}

function ensureDocumentRelationship(docx, kind, target) {
  const rels = ensureDocumentRelsXml(docx);
  const root = findChild(rels, 'Relationships');
  const type = `http://schemas.openxmlformats.org/officeDocument/2006/relationships/${kind}`;
  const existing = findChildren(root, 'Relationship').find((rel) => rel.attributes?.Type === type && rel.attributes?.Target === target);
  if (existing) return existing.attributes.Id;
  const id = nextRelationshipId(root);
  root.elements.push({
    type: 'element',
    name: 'Relationship',
    attributes: { Id: id, Type: type, Target: target },
    elements: [],
  });
  return id;
}

function ensureDocumentRelsXml(docx) {
  const name = 'word/_rels/document.xml.rels';
  if (!docx.xmlFiles[name]) {
    docx.xmlFiles[name] = {
      declaration: { attributes: { version: '1.0', encoding: 'UTF-8' } },
      elements: [{
        type: 'element',
        name: 'Relationships',
        attributes: { xmlns: 'http://schemas.openxmlformats.org/package/2006/relationships' },
        elements: [],
      }],
    };
  }
  return docx.xmlFiles[name];
}

function nextRelationshipId(root) {
  const max = findChildren(root, 'Relationship').reduce((current, rel) => {
    const match = String(rel.attributes?.Id || '').match(/^rId(\d+)$/);
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `rId${max + 1}`;
}

function ensureContentTypeOverride(docx, partName, contentType) {
  const contentTypes = ensureContentTypesXml(docx);
  const root = findChild(contentTypes, 'Types');
  const existing = findChildren(root, 'Override').find((item) => item.attributes?.PartName === partName);
  if (existing) {
    existing.attributes.ContentType = contentType;
    return;
  }
  root.elements.push({
    type: 'element',
    name: 'Override',
    attributes: { PartName: partName, ContentType: contentType },
    elements: [],
  });
}

function ensureContentTypesXml(docx) {
  const name = '[Content_Types].xml';
  if (!docx.xmlFiles[name]) {
    docx.xmlFiles[name] = {
      declaration: { attributes: { version: '1.0', encoding: 'UTF-8' } },
      elements: [{
        type: 'element',
        name: 'Types',
        attributes: { xmlns: 'http://schemas.openxmlformats.org/package/2006/content-types' },
        elements: [],
      }],
    };
  }
  return docx.xmlFiles[name];
}

function ensureEvenAndOddHeadersSetting(docx) {
  const settings = ensureSettingsXml(docx);
  const root = findChild(settings, 'w:settings');
  const evenAndOdd = findChild(root, 'w:evenAndOddHeaders');
  if (evenAndOdd) {
    evenAndOdd.attributes = { ...(evenAndOdd.attributes || {}), 'w:val': 'true' };
  } else {
    root.elements.push({ type: 'element', name: 'w:evenAndOddHeaders', attributes: { 'w:val': 'true' }, elements: [] });
  }
}

function ensureUpdateFieldsSetting(docx) {
  if (!docx) return;
  const settings = ensureSettingsXml(docx);
  const root = findChild(settings, 'w:settings');
  const updateFields = findChild(root, 'w:updateFields');
  if (updateFields) {
    updateFields.attributes = { ...(updateFields.attributes || {}), 'w:val': 'true' };
  } else {
    root.elements.push({ type: 'element', name: 'w:updateFields', attributes: { 'w:val': 'true' }, elements: [] });
  }
}

function ensureSettingsXml(docx) {
  const name = 'word/settings.xml';
  if (!docx.xmlFiles[name]) {
    docx.xmlFiles[name] = {
      declaration: { attributes: { version: '1.0', encoding: 'UTF-8', standalone: 'yes' } },
      elements: [{
        type: 'element',
        name: 'w:settings',
        attributes: {
          'xmlns:w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
        },
        elements: [],
      }],
    };
  }
  return docx.xmlFiles[name];
}

function applyHeaderFooterReferences(docx, refs) {
  const body = getBody(docx.xmlFiles['word/document.xml']);
  const sections = [];
  walk(body, (node) => {
    if (node.name === 'w:sectPr') sections.push(node);
  });
  for (const section of sections) {
    removeChildren(section, ['w:headerReference', 'w:footerReference']);
    section.elements ||= [];
    section.elements.unshift(
      headerFooterReference('w:headerReference', 'default', refs.oddHeaderRelId),
      headerFooterReference('w:headerReference', 'even', refs.evenHeaderRelId),
      headerFooterReference('w:footerReference', 'default', refs.defaultFooterRelId),
      headerFooterReference('w:footerReference', 'even', refs.evenFooterRelId),
    );
  }
}

function headerFooterReference(name, type, relId) {
  return {
    type: 'element',
    name,
    attributes: { 'w:type': type, 'r:id': relId },
    elements: [],
  };
}

function addIssue(context, issue) {
  context.issues.push({
    id: context.issues.length + 1,
    fixApplied: Boolean(context.fix && issue.fixable),
    ...issue,
  });
}

function paragraphLocation(index) {
  return `正文第 ${index + 1} 个元素`;
}

function isElement(node) {
  return node && node.type === 'element';
}

function findChild(node, name) {
  return node?.elements?.find((child) => child.name === name);
}

function findChildren(node, name) {
  return node?.elements?.filter((child) => child.name === name) || [];
}

function ensureChild(node, name) {
  let child = findChild(node, name);
  if (!child) {
    child = { type: 'element', name, elements: [] };
    node.elements ||= [];
    node.elements.unshift(child);
  }
  return child;
}

function removeChildren(node, names) {
  if (!node?.elements) return;
  node.elements = node.elements.filter((child) => !names.includes(child.name));
}

function getParagraphText(paragraph) {
  const parts = [];
  walk(paragraph, (node) => {
    if (node.name === 'w:t' && node.elements) {
      for (const child of node.elements) {
        if (child.type === 'text') parts.push(child.text || '');
      }
    } else if (node.name === 'w:tab') {
      parts.push('\t');
    }
  });
  return parts.join('').replaceAll(SPACE_MARK, ' ');
}

function normalizeSpaces(text) {
  return text.replace(/\u00a0/g, ' ').replace(/\t/g, ' ');
}

function walk(node, visitor) {
  if (!node) return;
  visitor(node);
  for (const child of node.elements || []) {
    walk(child, visitor);
  }
}

function hasMath(paragraph) {
  let found = false;
  walk(paragraph, (node) => {
    if (node.name === 'm:oMath' || node.name === 'm:oMathPara') found = true;
  });
  return found;
}

function hasDisplayMathPara(paragraph) {
  // 1. 明确的块公式容器 <m:oMathPara>：始终算展示公式
  let hasPara = false;
  walk(paragraph, (node) => { if (node.name === 'm:oMathPara') hasPara = true; });
  if (hasPara) return true;

  // 2. 无 <m:oMathPara> 但段落直接子节点有 <m:oMath>（独立展示公式段）
  //    判据：段落内中文字符少于 4 个（排除"正文里顺带提到公式"的情况）
  const hasTopLevelMath = (paragraph.elements || []).some((child) => child.name === 'm:oMath');
  if (!hasTopLevelMath) return false;
  const text = getParagraphText(paragraph);
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  return chineseChars < 4;
}

function hasDrawing(node) {
  let found = false;
  walk(node, (child) => {
    if (child.name === 'w:drawing' || child.name === 'w:pict') found = true;
  });
  return found;
}

function collectDrawingLayouts(node) {
  const drawings = [];
  walk(node, (child) => {
    if (child.name === 'wp:inline') drawings.push({ kind: 'inline', node: child });
    if (child.name === 'wp:anchor') drawings.push({ kind: 'anchor', node: child });
  });
  return drawings;
}

function normalizeFigureDrawings(node, expectedWidthEmu) {
  if (!node?.elements) return;
  node.elements = node.elements.map((child) => {
    if (child.name === 'wp:inline' || child.name === 'wp:anchor') {
      return normalizeDrawingContainer(child, expectedWidthEmu);
    }
    normalizeFigureDrawings(child, expectedWidthEmu);
    return child;
  });
}

function normalizeDrawingContainer(container, expectedWidthEmu) {
  const originalExtent = findChild(container, 'wp:extent');
  const oldCx = Number(originalExtent?.attributes?.cx || 0);
  const oldCy = Number(originalExtent?.attributes?.cy || 0);
  const expectedHeightEmu = oldCx > 0 && oldCy > 0
    ? Math.max(1, Math.round(oldCy * expectedWidthEmu / oldCx))
    : oldCy || expectedWidthEmu;
  const extent = { type: 'element', name: 'wp:extent', attributes: { cx: String(expectedWidthEmu), cy: String(expectedHeightEmu) }, elements: [] };
  const graphic = findChild(container, 'a:graphic');
  if (graphic) setGraphicExtent(graphic, expectedWidthEmu, expectedHeightEmu);
  const effectExtent = findChild(container, 'wp:effectExtent') || {
    type: 'element',
    name: 'wp:effectExtent',
    attributes: { l: '0', t: '0', r: '0', b: '0' },
    elements: [],
  };
  effectExtent.attributes = { ...(effectExtent.attributes || {}), l: '0', t: '0', r: '0', b: '0' };
  const docPr = findChild(container, 'wp:docPr');
  const cNvGraphicFramePr = findChild(container, 'wp:cNvGraphicFramePr');
  return {
    type: 'element',
    name: 'wp:anchor',
    attributes: {
      distT: '0',
      distB: '0',
      distL: '0',
      distR: '0',
      simplePos: '0',
      relativeHeight: container.attributes?.relativeHeight || '251658240',
      behindDoc: '0',
      locked: '0',
      layoutInCell: '1',
      allowOverlap: '0',
    },
    elements: [
      { type: 'element', name: 'wp:simplePos', attributes: { x: '0', y: '0' }, elements: [] },
      { type: 'element', name: 'wp:positionH', attributes: { relativeFrom: 'column' }, elements: [{ type: 'element', name: 'wp:align', elements: [{ type: 'text', text: 'center' }] }] },
      { type: 'element', name: 'wp:positionV', attributes: { relativeFrom: 'paragraph' }, elements: [{ type: 'element', name: 'wp:posOffset', elements: [{ type: 'text', text: '0' }] }] },
      extent,
      effectExtent,
      { type: 'element', name: 'wp:wrapTopAndBottom', elements: [] },
      ...(docPr ? [docPr] : []),
      ...(cNvGraphicFramePr ? [cNvGraphicFramePr] : []),
      ...(graphic ? [graphic] : []),
    ],
  };
}

function setGraphicExtent(graphic, cx, cy) {
  walk(graphic, (child) => {
    if (child.name === 'a:ext' && child.attributes && child.attributes.cx !== undefined && child.attributes.cy !== undefined) {
      child.attributes.cx = String(cx);
      child.attributes.cy = String(cy);
    }
  });
}

function checkImageBasedEquation(paragraph, text, context, index) {
  if (!hasDrawing(paragraph)) return false;
  if (!looksLikeDisplayedEquationText(text)) return false;
  context.equationIndex++;
  context.stats.equations++;
  addIssue(context, {
    type: '图片公式',
    location: paragraphLocation(index),
    current: text || '[图片+公式编号]',
    expected: '公式应使用可编辑的数学对象（OMML），不应以图片代替',
    fixable: false,
    note: '检测到段落同时包含图片与公式编号，请将图片替换为 Word 数学公式对象',
  });
  return true;
}

function hasExplicitBreak(node) {
  let found = false;
  walk(node, (child) => {
    if (child.name === 'w:br' || child.name === 'w:cr' || child.name === 'w:lastRenderedPageBreak') found = true;
  });
  return found;
}

function isMeaninglessBlankParagraph(paragraph) {
  const text = normalizeSpaces(getParagraphText(paragraph)).trim();
  if (text) return false;
  if (hasMath(paragraph) || hasDrawing(paragraph) || hasExplicitBreak(paragraph)) return false;
  const pPr = findChild(paragraph, 'w:pPr');
  if (findChild(pPr, 'w:sectPr') || findChild(pPr, 'w:pageBreakBefore')) return false;
  return true;
}

function hasNearbyDrawingBefore(siblings, index) {
  for (let i = Math.max(0, index - 3); i < index; i++) {
    if (hasDrawing(siblings[i])) return true;
  }
  return false;
}

function paragraphAlignment(paragraph) {
  const pPr = findChild(paragraph, 'w:pPr');
  const jc = findChild(pPr, 'w:jc');
  return jc?.attributes?.['w:val'] || '';
}

function paragraphHasStyle(paragraph, expected) {
  const pPr = findChild(paragraph, 'w:pPr');
  if (expected.alignment && paragraphAlignment(paragraph) !== expected.alignment) return false;
  if (expected.pageBreakBefore !== undefined) {
    const hasPageBreakBefore = Boolean(findChild(pPr, 'w:pageBreakBefore'));
    if (hasPageBreakBefore !== expected.pageBreakBefore) return false;
  }
  const spacing = findChild(pPr, 'w:spacing');
  if (expected.line && spacing?.attributes?.['w:line'] !== String(expected.line)) return false;
  if (expected.before !== undefined && (spacing?.attributes?.['w:before'] || '0') !== String(expected.before)) return false;
  if (expected.after !== undefined && (spacing?.attributes?.['w:after'] || '0') !== String(expected.after)) return false;
  const ind = findChild(pPr, 'w:ind');
  if (expected.firstLine !== undefined && ind?.attributes?.['w:firstLine'] !== String(expected.firstLine)) return false;

  const runs = findChildren(paragraph, 'w:r');
  const firstRun = runs.find((run) => getParagraphText(run).trim()) || runs[0];
  const rPr = findChild(firstRun, 'w:rPr');
  if (!rPr) return false;
  const fonts = findChild(rPr, 'w:rFonts');
  if (expected.font && fonts?.attributes?.['w:eastAsia'] !== expected.font) return false;
  if (expected.latinFont && fonts?.attributes?.['w:ascii'] !== expected.latinFont) return false;
  if (expected.latinFont && fonts?.attributes?.['w:hAnsi'] !== expected.latinFont) return false;
  const sz = findChild(rPr, 'w:sz');
  if (expected.size && sz?.attributes?.['w:val'] !== String(expected.size)) return false;
  if (expected.bold !== undefined) {
    const hasBold = Boolean(findChild(rPr, 'w:b'));
    if (hasBold !== expected.bold) return false;
  }
  return true;
}

function paragraphLayoutMatches(paragraph, expected) {
  const pPr = findChild(paragraph, 'w:pPr');
  if (expected.alignment && paragraphAlignment(paragraph) !== expected.alignment) return false;
  const spacing = findChild(pPr, 'w:spacing');
  if (expected.line && spacing?.attributes?.['w:line'] !== String(expected.line)) return false;
  if (expected.lineRule && spacing?.attributes?.['w:lineRule'] !== expected.lineRule) return false;
  if (expected.before !== undefined && (spacing?.attributes?.['w:before'] || '0') !== String(expected.before)) return false;
  if (expected.after !== undefined && (spacing?.attributes?.['w:after'] || '0') !== String(expected.after)) return false;
  return true;
}

function paragraphRunsMatchStyle(paragraph, expected) {
  const runs = findChildren(paragraph, 'w:r');
  const nonEmptyRuns = runs.filter((run) => getParagraphText(run).trim());
  if (!nonEmptyRuns.length) return true;
  return nonEmptyRuns.every((run) => runMatchesStyle(run, expected));
}

function runMatchesStyle(run, expected) {
  const rPr = findChild(run, 'w:rPr');
  if (!rPr) return false;
  const fonts = findChild(rPr, 'w:rFonts');
  const sz = findChild(rPr, 'w:sz');
  if (expected.font && fonts?.attributes?.['w:eastAsia'] !== expected.font) return false;
  if (expected.latinFont && fonts?.attributes?.['w:ascii'] !== expected.latinFont) return false;
  if (expected.latinFont && fonts?.attributes?.['w:hAnsi'] !== expected.latinFont) return false;
  if (expected.size && sz?.attributes?.['w:val'] !== String(expected.size)) return false;
  if (expected.bold !== undefined) {
    const hasBold = Boolean(findChild(rPr, 'w:b'));
    if (hasBold !== expected.bold) return false;
  }
  return true;
}

function hasSpaceRunFontAfterPrefix(paragraph, prefix, spaces, expectedFont) {
  const runs = findChildren(paragraph, 'w:r').map((run) => ({
    run,
    text: getParagraphText(run),
  }));
  let offset = 0;
  const start = prefix.length;
  const end = start + spaces;
  let covered = 0;

  for (const item of runs) {
    const runStart = offset;
    const runEnd = offset + item.text.length;
    if (runEnd > start && runStart < end) {
      const fonts = findChild(findChild(item.run, 'w:rPr'), 'w:rFonts');
      if (fonts?.attributes?.['w:eastAsia'] !== expectedFont) return false;
      covered += Math.min(runEnd, end) - Math.max(runStart, start);
    }
    offset = runEnd;
  }
  return covered === spaces;
}

function setParagraphStyle(paragraph, options) {
  if (!options.fix) return;
  setParagraphProps(paragraph, {
    alignment: options.alignment,
    spacingLine: options.line,
    before: options.before,
    after: options.after,
    firstLine: options.firstLine,
    resetInd: options.resetInd,
    clearShading: options.clearShading,
    pageBreakBefore: options.pageBreakBefore,
  });
  setParagraphDefaultRunStyle(paragraph, options.font, options.latinFont, options.size, options.bold);
  for (const run of findChildren(paragraph, 'w:r')) {
    setRunStyle(run, options.font, options.latinFont, options.size, options.bold, options.cjkSpacing ?? options.spacing, options.latinSpacing ?? options.spacing);
  }
}

function setParagraphProps(paragraph, options = {}) {
  const pPr = ensureChild(paragraph, 'w:pPr');
  if (options.clearShading) removeChildren(pPr, ['w:shd']);
  if (options.alignment) {
    const jc = ensureChild(pPr, 'w:jc');
    jc.attributes = { 'w:val': options.alignment };
  }
  if (options.spacingLine) {
    const spacing = ensureChild(pPr, 'w:spacing');
    spacing.attributes = { ...(spacing.attributes || {}), 'w:line': String(options.spacingLine), 'w:lineRule': options.lineRule || 'auto' };
  }
  if (options.before !== undefined || options.after !== undefined) {
    const spacing = ensureChild(pPr, 'w:spacing');
    spacing.attributes = { ...(spacing.attributes || {}) };
    if (options.before !== undefined) spacing.attributes['w:before'] = String(options.before);
    if (options.after !== undefined) spacing.attributes['w:after'] = String(options.after);
  }
  if (options.firstLine !== undefined || options.hanging !== undefined) {
    const ind = ensureChild(pPr, 'w:ind');
    ind.attributes = options.resetInd ? {} : { ...(ind.attributes || {}) };
    if (options.firstLine !== undefined) ind.attributes['w:firstLine'] = String(options.firstLine);
    if (options.hanging !== undefined) ind.attributes['w:hanging'] = String(options.hanging);
  } else if (options.resetInd) {
    removeChildren(pPr, ['w:ind']);
  }
  if (options.pageBreakBefore !== undefined) {
    removeChildren(pPr, ['w:pageBreakBefore']);
    if (options.pageBreakBefore) {
      pPr.elements.push({ type: 'element', name: 'w:pageBreakBefore', elements: [] });
    }
  }
  if (options.tabs?.length) {
    const tabs = ensureChild(pPr, 'w:tabs');
    removeChildren(tabs, ['w:tab']);
    tabs.elements.push(...options.tabs.map((tab) => ({
      type: 'element',
      name: 'w:tab',
      attributes: { 'w:val': tab.val, 'w:pos': String(tab.pos) },
      elements: [],
    })));
  } else if (options.rightTabTwips) {
    const tabs = ensureChild(pPr, 'w:tabs');
    removeChildren(tabs, ['w:tab']);
    tabs.elements.push({
      type: 'element',
      name: 'w:tab',
      attributes: { 'w:val': 'right', 'w:pos': String(options.rightTabTwips) },
      elements: [],
    });
  }
}

function paragraphStyleId(paragraph) {
  return findChild(findChild(paragraph, 'w:pPr'), 'w:pStyle')?.attributes?.['w:val'] || '';
}

function paragraphHasFirstLineIndent(paragraph) {
  const ind = findChild(findChild(paragraph, 'w:pPr'), 'w:ind');
  return Boolean(ind?.attributes?.['w:firstLine'] && ind.attributes['w:firstLine'] !== '0');
}

function mathAlignment(paragraph) {
  const mathPara = findChild(paragraph, 'm:oMathPara');
  const mathParaPr = findChild(mathPara, 'm:oMathParaPr');
  const jc = findChild(mathParaPr, 'm:jc');
  return jc?.attributes?.['m:val'] || jc?.attributes?.['w:val'] || (mathPara ? 'left' : '');
}

function setMathParagraphAlignment(paragraph, alignment) {
  const mathPara = findChild(paragraph, 'm:oMathPara');
  if (!mathPara) return;
  const mathParaPr = ensureChild(mathPara, 'm:oMathParaPr');
  const jc = ensureChild(mathParaPr, 'm:jc');
  jc.attributes = { 'm:val': alignment };
}

function hasEquationTabLayout(paragraph, equationRules) {
  const tabs = findChildren(findChild(findChild(paragraph, 'w:pPr'), 'w:tabs'), 'w:tab');
  const centerPos = String(equationRules.centerTabTwips || Math.round((equationRules.rightTabTwips || 9000) / 2));
  const rightPos = String(equationRules.rightTabTwips || 9000);
  const hasCenter = tabs.some((tab) => tab.attributes?.['w:val'] === 'center' && tab.attributes?.['w:pos'] === centerPos);
  const hasRight = tabs.some((tab) => tab.attributes?.['w:val'] === 'right' && tab.attributes?.['w:pos'] === rightPos);
  return hasCenter && hasRight && hasLeadingTabRun(paragraph);
}

function hasLeadingTabRun(paragraph) {
  const content = (paragraph.elements || []).filter((element) => element.name !== 'w:pPr');
  const first = content[0];
  return first?.name === 'w:r' && Boolean(findChild(first, 'w:tab'));
}

function ensureEquationLeadingCenterTab(paragraph) {
  paragraph.elements ||= [];
  const pPr = findChild(paragraph, 'w:pPr');
  const content = paragraph.elements.filter((element) => element !== pPr);
  if (content[0]?.name === 'w:r' && findChild(content[0], 'w:tab')) return;
  const tabRun = {
    type: 'element',
    name: 'w:r',
    elements: [
      { type: 'element', name: 'w:rPr', elements: [] },
      { type: 'element', name: 'w:tab', elements: [] },
    ],
  };
  paragraph.elements = [
    ...(pPr ? [pPr] : []),
    tabRun,
    ...content,
  ];
}

function setRunStyle(run, font, latinFont, size, bold, cjkSpacing = 0, latinSpacing = 0) {
  const rPr = ensureChild(run, 'w:rPr');
  const text = getParagraphText(run);
  const cjkLike = containsCjkLikeText(text);
  const spacing = cjkLike ? cjkSpacing : latinSpacing;
  setRunProperties(rPr, font, cjkLike ? font : latinFont, size, bold, spacing);
  if (run.__italic) {
    rPr.elements.push({ type: 'element', name: 'w:i', elements: [] });
    rPr.elements.push({ type: 'element', name: 'w:iCs', elements: [] });
  }
}

function setCaptionParagraphText(paragraph, text, font, latinFont, size, bold = false) {
  const normalized = String(text).replace(/\u3000/g, ' ');
  const match = normalized.match(/^([图表])([0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)(\s*)(.*)$/);
  if (!match) {
    setParagraphMixedText(paragraph, normalized, font, latinFont, size, bold);
    return;
  }
  const runs = [
    textRun(match[1], font, latinFont, size, bold),
    textRun(match[2], font, latinFont, size, bold),
  ];
  if (match[3]) runs.push(textRun(match[3], font, latinFont, size, bold));
  if (match[4]) runs.push(...splitMixedTextRuns(match[4]).map((part) => textRun(part.text, font, latinFont, size, bold)));
  setParagraphRuns(paragraph, runs);
}

function setParagraphText(paragraph, text, font, latinFont, size, bold = false) {
  setParagraphRuns(paragraph, [textRun(String(text).replace(/\u3000/g, ' '), font, latinFont, size, bold)]);
}

function setParagraphMixedText(paragraph, text, font, latinFont, size, bold = false, cjkSpacing = 0, latinSpacing = 0) {
  const runs = splitMixedTextRuns(text).map((part) => (
    textRun(part.text, font, latinFont, size, bold, part.isCjk ? cjkSpacing : latinSpacing, part.isCjk ? cjkSpacing : latinSpacing)
  ));
  setParagraphRuns(paragraph, runs);
}

function paragraphIsPlainText(paragraph) {
  const content = (paragraph.elements || []).filter((element) => element.name !== 'w:pPr');
  return content.every((element) => element.name === 'w:r' && !findChild(element, 'w:tab') && !hasDrawing(element) && !hasMath(element));
}

function splitMixedTextRuns(text) {
  const parts = [];
  let current = '';
  let currentIsCjk = null;
  for (const char of text) {
    const isCjk = isCjkLikeChar(char);
    if (current && isCjk !== currentIsCjk) {
      parts.push({ text: current, isCjk: currentIsCjk });
      current = '';
    }
    current += char;
    currentIsCjk = isCjk;
  }
  if (current) parts.push({ text: current, isCjk: currentIsCjk });
  return parts;
}

function normalizeChineseSymbolWidth(text) {
  return text
    .replace(/\*\*/g, '')
    .replace(/([\u4e00-\u9fff\u3000-\u303f\uff00-\uffef])\+([\u4e00-\u9fff\u3000-\u303f\uff00-\uffef])/g, '$1＋$2')
    .replace(/([\u4e00-\u9fff\u3000-\u303f\uff00-\uffef])\(([^)]*[\u4e00-\u9fff][^)]*)\)/g, '$1（$2）')
    .replace(/\(([^)]*[\u4e00-\u9fff][^)]*)\)([\u4e00-\u9fff\u3000-\u303f\uff00-\uffef])/g, '（$1）$2')
    .replace(/([\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]):/g, '$1：')
    .replace(/;([\u4e00-\u9fff\u3000-\u303f\uff00-\uffef])/g, '；$1')
    .replace(/([\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]);/g, '$1；')
    .replace(/([\u4e00-\u9fff])\*([\u4e00-\u9fff])/g, '$1×$2')
    .replace(/([\u4e00-\u9fff])\/([\u4e00-\u9fff])/g, '$1／$2');
}

function containsCjkLikeText(text) {
  return Array.from(text || '').some(isCjkLikeChar);
}

function isCjkLikeChar(char) {
  return /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef\u2014\u2018-\u201d\u2026]/.test(char);
}

function setParagraphRuns(paragraph, runs) {
  const pPr = findChild(paragraph, 'w:pPr');
  paragraph.elements = [
    ...(pPr ? [pPr] : []),
    ...runs.map((run) => makeRun(run)),
  ];
}

function textRun(text, font, latinFont, size, bold = false, cjkSpacing = 0, latinSpacing = 0, italic = false) {
  return { text, font, latinFont: containsCjkLikeText(text) ? font : latinFont, size, bold, cjkSpacing, latinSpacing, italic };
}

function makeRun(run) {
  const r = {
    type: 'element',
    name: 'w:r',
    elements: [
      { type: 'element', name: 'w:rPr', elements: [] },
      { type: 'element', name: 'w:t', attributes: { 'xml:space': 'preserve' }, elements: [{ type: 'text', text: run.text }] },
    ],
  };
  if (run.italic) r.__italic = true;
  setRunStyle(r, run.font, run.latinFont, run.size, run.bold, run.cjkSpacing, run.latinSpacing);
  delete r.__italic;
  return r;
}

function stripEquationNumber(paragraph) {
  const numberRe = /[（(]\s*[A-Z0-9]+[-.]\d+\s*[）)]/g;
  walk(paragraph, (node) => {
    if (node.name === 'w:t' && node.elements) {
      for (const child of node.elements) {
        if (child.type === 'text') child.text = child.text.replace(numberRe, '').trimEnd();
      }
    }
  });
  pruneTrailingEquationNumberRuns(paragraph);
}

function pruneTrailingEquationNumberRuns(paragraph) {
  const pPr = findChild(paragraph, 'w:pPr');
  const content = (paragraph.elements || []).filter((element) => element !== pPr);
  let lastMathIndex = -1;
  for (let i = 0; i < content.length; i++) {
    if (content[i].name === 'm:oMath' || content[i].name === 'm:oMathPara') lastMathIndex = i;
  }
  if (lastMathIndex < 0) return;

  const trailing = content.slice(lastMathIndex + 1);
  const trailingText = normalizeSpaces(trailing.map((element) => getParagraphText(element)).join('')).trim();
  if (trailing.length && /^[（）()A-Z0-9.\-\s]*$/.test(trailingText || '')) {
    paragraph.elements = [
      ...(pPr ? [pPr] : []),
      ...content.slice(0, lastMathIndex + 1),
    ];
    return;
  }

  const kept = [...content];
  while (kept.length) {
    const last = kept[kept.length - 1];
    if (last.name !== 'w:r') break;
    const text = normalizeSpaces(getParagraphText(last)).trim();
    const hasOnlyTab = !text && Boolean(findChild(last, 'w:tab'));
    const isEquationNumber = /^[（(]\s*[A-Z0-9]+[-.]\d+\s*[）)]$/.test(text);
    const isEmptyRun = !text && !findChild(last, 'w:tab');
    if (!hasOnlyTab && !isEquationNumber && !isEmptyRun) break;
    kept.pop();
  }
  paragraph.elements = [
    ...(pPr ? [pPr] : []),
    ...kept,
  ];
}

function appendEquationNumber(paragraph, number, rules) {
  paragraph.elements ||= [];
  paragraph.elements.push({
    type: 'element',
    name: 'w:r',
    elements: [
      { type: 'element', name: 'w:rPr', elements: [
        { type: 'element', name: 'w:rFonts', attributes: {
          'w:ascii': rules.body.latinFont,
          'w:hAnsi': rules.body.latinFont,
          'w:eastAsia': rules.body.eastAsiaFont,
          'w:cs': rules.body.latinFont,
        }, elements: [] },
        { type: 'element', name: 'w:sz', attributes: { 'w:val': String(rules.body.fontSizeHalfPoints) }, elements: [] },
      ] },
      { type: 'element', name: 'w:tab', elements: [] },
      { type: 'element', name: 'w:t', attributes: { 'xml:space': 'preserve' }, elements: [{ type: 'text', text: number }] },
    ],
  });
}

function setParagraphDefaultRunStyle(paragraph, font, latinFont, size, bold, spacing = 0) {
  const pPr = ensureChild(paragraph, 'w:pPr');
  const rPr = ensureChild(pPr, 'w:rPr');
  setRunProperties(rPr, font, latinFont, size, bold, spacing);
}

function setRunProperties(rPr, font, latinFont, size, bold, spacingTwentiethPoints = 0) {
  const fonts = ensureChild(rPr, 'w:rFonts');
  const hint = fonts.attributes?.['w:hint'];
  fonts.attributes = {
    'w:ascii': latinFont || font,
    'w:hAnsi': latinFont || font,
    'w:eastAsia': font,
    'w:cs': latinFont || font,
    ...(hint ? { 'w:hint': hint } : {}),
  };
  const sz = ensureChild(rPr, 'w:sz');
  sz.attributes = { 'w:val': String(size) };
  const szCs = ensureChild(rPr, 'w:szCs');
  szCs.attributes = { 'w:val': String(size) };
  const spacing = ensureChild(rPr, 'w:spacing');
  spacing.attributes = { 'w:val': String(spacingTwentiethPoints || 0) };
  removeChildren(rPr, ['w:position']);
  removeChildren(rPr, ['w:b', 'w:bCs']);
  if (bold) {
    rPr.elements.push({ type: 'element', name: 'w:b', elements: [] });
    rPr.elements.push({ type: 'element', name: 'w:bCs', elements: [] });
  }
}

function normalizeDocumentStyles(docx, rules) {
  const stylesXml = docx.xmlFiles['word/styles.xml'];
  const stylesRoot = findChild(stylesXml, 'w:styles');
  if (!stylesRoot) return;

  const docDefaults = ensureChild(stylesRoot, 'w:docDefaults');
  const rPrDefault = ensureChild(ensureChild(docDefaults, 'w:rPrDefault'), 'w:rPr');
  setRunProperties(rPrDefault, rules.body.eastAsiaFont, rules.body.latinFont, rules.body.fontSizeHalfPoints, false);

  const pPrDefault = ensureChild(ensureChild(docDefaults, 'w:pPrDefault'), 'w:pPr');
  const spacing = ensureChild(pPrDefault, 'w:spacing');
  spacing.attributes = {
    ...(spacing.attributes || {}),
    'w:line': String(rules.body.lineTwips),
    'w:lineRule': 'auto',
  };
  const jc = ensureChild(pPrDefault, 'w:jc');
  jc.attributes = { 'w:val': rules.body.alignment };
  ensureTocStyles(stylesRoot, rules);
}

function ensureTocStyles(stylesRoot, rules) {
  const rule = rules.toc;
  if (!rule) return;
  const font = rule.entryFont || rules.body?.eastAsiaFont || '宋体';
  const latinFont = rule.entryLatinFont || rules.body?.latinFont || 'Times New Roman';
  const size = rule.entryFontSizeHalfPoints || 24;
  upsertParagraphStyle(stylesRoot, {
    styleId: 'TOC1',
    name: 'toc 1',
    font,
    latinFont,
    size,
    bold: Boolean(rule.entryBold),
    left: 0,
    hanging: 0,
    line: rules.body?.lineTwips || 312,
  });
  upsertParagraphStyle(stylesRoot, {
    styleId: 'TOC2',
    name: 'toc 2',
    font,
    latinFont,
    size,
    bold: Boolean(rule.entryBold),
    left: rule.level2IndentTwips || 480,
    hanging: 0,
    line: rules.body?.lineTwips || 312,
  });
  upsertParagraphStyle(stylesRoot, {
    styleId: 'TOC3',
    name: 'toc 3',
    font,
    latinFont,
    size,
    bold: Boolean(rule.entryBold),
    left: rule.level3IndentTwips || 960,
    hanging: 0,
    line: rules.body?.lineTwips || 312,
  });
}

function upsertParagraphStyle(stylesRoot, options) {
  let style = findChildren(stylesRoot, 'w:style').find((item) => item.attributes?.['w:styleId'] === options.styleId);
  if (!style) {
    style = {
      type: 'element',
      name: 'w:style',
      attributes: { 'w:type': 'paragraph', 'w:styleId': options.styleId },
      elements: [],
    };
    stylesRoot.elements.push(style);
  }
  removeChildren(style, ['w:name', 'w:basedOn', 'w:next', 'w:pPr', 'w:rPr']);
  style.elements.push(
    { type: 'element', name: 'w:name', attributes: { 'w:val': options.name }, elements: [] },
    { type: 'element', name: 'w:basedOn', attributes: { 'w:val': 'Normal' }, elements: [] },
    { type: 'element', name: 'w:next', attributes: { 'w:val': 'Normal' }, elements: [] },
    {
      type: 'element',
      name: 'w:pPr',
      elements: [
        { type: 'element', name: 'w:spacing', attributes: { 'w:before': '0', 'w:after': '0', 'w:line': String(options.line), 'w:lineRule': 'auto' }, elements: [] },
        { type: 'element', name: 'w:ind', attributes: { 'w:left': String(options.left || 0), 'w:hanging': String(options.hanging || 0) }, elements: [] },
      ],
    },
    {
      type: 'element',
      name: 'w:rPr',
      elements: [],
    },
  );
  setRunProperties(findChild(style, 'w:rPr'), options.font, options.latinFont, options.size, options.bold, 0);
}

function looksLikeTocLine(text) {
  return /…{2,}|\.{4,}\s*[IVXLC\d]+$/.test(text);
}

function isMajorBackMatterHeading(text) {
  return /^(附\s*录|作者简历|索引|致谢|摘要|Abstract|目\s*录|图目录|表目录)$/.test(text);
}

function isThreeLineTable(table) {
  const borders = findChild(findChild(table, 'w:tblPr'), 'w:tblBorders');
  if (!borders) return false;
  const left = findChild(borders, 'w:left')?.attributes?.['w:val'];
  const right = findChild(borders, 'w:right')?.attributes?.['w:val'];
  const insideV = findChild(borders, 'w:insideV')?.attributes?.['w:val'];
  const verticalBorderValues = ['dotted', 'dashDotStroked', 'dashSmallGap'];
  return verticalBorderValues.includes(left) && verticalBorderValues.includes(right) && verticalBorderValues.includes(insideV);
}

function isBorderedGridTable(table) {
  const borders = findChild(findChild(table, 'w:tblPr'), 'w:tblBorders');
  if (!borders) return false;
  const needed = ['w:top', 'w:bottom', 'w:left', 'w:right', 'w:insideH', 'w:insideV'];
  return needed.every((name) => {
    const val = findChild(borders, name)?.attributes?.['w:val'];
    return val && !['nil', 'none'].includes(val);
  });
}

function tableCellsHaveParagraphAlignment(table, expectedAlignment) {
  for (const row of findChildren(table, 'w:tr')) {
    for (const cell of findChildren(row, 'w:tc')) {
      for (const paragraph of findChildren(cell, 'w:p')) {
        const text = getParagraphText(paragraph).trim();
        if (!text) continue;
        const alignment = paragraphAlignment(paragraph) || expectedAlignment;
        if (alignment !== expectedAlignment) return false;
      }
    }
  }
  return true;
}

function tableCellsHaveVerticalAlignment(table, expectedAlignment) {
  for (const row of findChildren(table, 'w:tr')) {
    for (const cell of findChildren(row, 'w:tc')) {
      const tcPr = findChild(cell, 'w:tcPr');
      const actual = attr(findChild(tcPr, 'w:vAlign'), 'val') || 'top';
      if (actual !== expectedAlignment) return false;
    }
  }
  return true;
}

function tableCellsHaveBodyStyle(table, rules) {
  for (const row of findChildren(table, 'w:tr')) {
    for (const cell of findChildren(row, 'w:tc')) {
      for (const paragraph of findChildren(cell, 'w:p')) {
        const text = getParagraphText(paragraph).trim();
        if (!text) continue;
        if (!paragraphHasStyle(paragraph, {
          font: rules.bodyFont,
          latinFont: rules.bodyLatinFont,
          size: rules.bodyFontSizeHalfPoints,
        })) return false;
        if (!paragraphRunsMatchStyle(paragraph, {
          font: rules.bodyFont,
          latinFont: rules.bodyLatinFont,
          size: rules.bodyFontSizeHalfPoints,
        })) return false;
      }
    }
  }
  return true;
}

function tableHasRepeatHeaderRow(table) {
  const firstRow = findChildren(table, 'w:tr')[0];
  if (!firstRow) return true;
  const trPr = findChild(firstRow, 'w:trPr');
  return Boolean(findChild(trPr, 'w:tblHeader'));
}

function alignmentName(value) {
  return ({ left: '居左', center: '居中', right: '居右', both: '两端' })[value] || value;
}

function verticalAlignmentName(value) {
  return ({ top: '居上', center: '居中', bottom: '居下' })[value] || value;
}

function sizeNameFromHalfPoints(value) {
  const size = Number(value || 0);
  return ({
    42: '二号',
    36: '小二号',
    30: '小三号',
    28: '四号',
    24: '小四号',
    21: '五号',
    18: '小五号',
    16: '六号',
  })[size] || `${size / 2}pt`;
}

function describeFontFamily(font, latinFont) {
  if (!font && !latinFont) return '';
  if (!latinFont || latinFont === font) return font;
  return `${font}/${latinFont}`;
}

function describeFontSizeAndFamily(size, font, latinFont) {
  return `${sizeNameFromHalfPoints(size)}${describeFontFamily(font, latinFont)}`;
}

function describeLineSpacing(lineTwips) {
  const line = Number(lineTwips || 0);
  if (!line) return '';
  if (line === 240) return '单倍行距';
  const factor = Math.round((line / 240) * 10) / 10;
  return `${factor} 倍行距`;
}

function describeFirstLineIndent(firstLineTwips, fontSizeHalfPoints) {
  const firstLine = Number(firstLineTwips || 0);
  if (!firstLine) return '首行不缩进';
  const size = Number(fontSizeHalfPoints || 24);
  const chars = Math.round((firstLine / (size * 10)) * 10) / 10;
  return `首行缩进 ${chars} 字符`;
}

function describeHeadingStyle(rule, options = {}) {
  const parts = [
    `标题${describeFontSizeAndFamily(rule.fontSizeHalfPoints, rule.font, rule.latinFont)}${rule.bold ? '加粗' : ''}`,
    `${alignmentName(rule.alignment)}对齐`,
  ];
  if (options.pageBreakBefore) parts.push('段前分页');
  return parts.join('，');
}

function describeCaptionStyle(font, latinFont, size, lineTwips) {
  return `${describeFontSizeAndFamily(size, font, latinFont)}，${describeLineSpacing(lineTwips)}`;
}

function describeBodyLikeStyle(font, latinFont, size, lineTwips) {
  return `${describeFontSizeAndFamily(size, font, latinFont)}，${describeLineSpacing(lineTwips)}`;
}

function describeBodyParagraphStyle(rule) {
  return `${describeFontSizeAndFamily(rule.fontSizeHalfPoints, rule.eastAsiaFont, rule.latinFont)}，${describeLineSpacing(rule.lineTwips)}，${describeFirstLineIndent(rule.firstLineTwips, rule.fontSizeHalfPoints)}，${alignmentName(rule.alignment)}对齐`;
}

function twipsToCm(value) {
  return `${(Number(value || 0) * 2.54 / 1440).toFixed(2).replace(/\.?0+$/, '')}cm`;
}

function describeMarginExpectation(profile) {
  if (!profile) return '页边距应符合模板要求';
  return `页边距：上 ${twipsToCm(profile.top)}、下 ${twipsToCm(profile.bottom)}、左 ${twipsToCm(profile.left)}、右 ${twipsToCm(profile.right)}；页眉 ${twipsToCm(profile.header)}；页脚 ${twipsToCm(profile.footer)}`;
}

function applyThreeLineTable(table, cellAlignment = 'left', cellVerticalAlignment = 'center') {
  const tblPr = ensureChild(table, 'w:tblPr');
  setTableCellMargins(tblPr);
  const borders = ensureChild(tblPr, 'w:tblBorders');
  borders.elements = [
    border('w:top', 'single', 6),
    border('w:left', 'dotted', 4),
    border('w:bottom', 'single', 6),
    border('w:right', 'dotted', 4),
    border('w:insideH', 'nil', 0),
    border('w:insideV', 'dotted', 4),
  ];

  const rows = findChildren(table, 'w:tr');
  rows.forEach((row, rowIndex) => {
    const isHeader = rowIndex === 0;
    const isLast = rowIndex === rows.length - 1;
    for (const cell of findChildren(row, 'w:tc')) {
      const tcPr = ensureChild(cell, 'w:tcPr');
      setCellVerticalAlignment(tcPr, cellVerticalAlignment);
      setCellMarginsAndWrapping(tcPr);
      const tcBorders = ensureChild(tcPr, 'w:tcBorders');
      tcBorders.elements = [
        border('w:top', rowIndex === 0 ? 'single' : 'nil', rowIndex === 0 ? 6 : 0),
        border('w:bottom', isHeader || isLast ? 'single' : 'nil', isHeader || isLast ? 6 : 0),
      ];
      for (const paragraph of findChildren(cell, 'w:p')) {
        setParagraphProps(paragraph, { alignment: cellAlignment });
      }
    }
  });
}

function applyBorderedGridTable(table, cellAlignment = 'left', cellVerticalAlignment = 'center') {
  const tblPr = ensureChild(table, 'w:tblPr');
  removeChildren(tblPr, ['w:tblStyle']);
  setTableCellMargins(tblPr);
  const borders = ensureChild(tblPr, 'w:tblBorders');
  borders.elements = [
    border('w:top', 'single', 8),
    border('w:left', 'single', 8),
    border('w:bottom', 'single', 8),
    border('w:right', 'single', 8),
    border('w:insideH', 'single', 8),
    border('w:insideV', 'single', 8),
  ];
  for (const row of findChildren(table, 'w:tr')) {
    for (const cell of findChildren(row, 'w:tc')) {
      const tcPr = ensureChild(cell, 'w:tcPr');
      setCellVerticalAlignment(tcPr, cellVerticalAlignment);
      setCellMarginsAndWrapping(tcPr);
      const tcBorders = ensureChild(tcPr, 'w:tcBorders');
      tcBorders.elements = [
        border('w:top', 'single', 8),
        border('w:left', 'single', 8),
        border('w:bottom', 'single', 8),
        border('w:right', 'single', 8),
      ];
      for (const paragraph of findChildren(cell, 'w:p')) {
        setParagraphProps(paragraph, { alignment: cellAlignment });
      }
    }
  }
}

function applyTableBodyStyle(table, rules) {
  const tblPr = ensureChild(table, 'w:tblPr');
  setTableCellMargins(tblPr);
  const cellVerticalAlignment = rules.cellVerticalAlignment || 'center';
  for (const row of findChildren(table, 'w:tr')) {
    for (const cell of findChildren(row, 'w:tc')) {
      const tcPr = ensureChild(cell, 'w:tcPr');
      setCellVerticalAlignment(tcPr, cellVerticalAlignment);
      setCellMarginsAndWrapping(tcPr);
      for (const paragraph of findChildren(cell, 'w:p')) {
        const text = getParagraphText(paragraph).trim();
        if (!text) continue;
        setParagraphDefaultRunStyle(paragraph, rules.bodyFont, rules.bodyLatinFont, rules.bodyFontSizeHalfPoints, false);
        setParagraphProps(paragraph, { alignment: rules.cellAlignment || 'left' });
        for (const run of findChildren(paragraph, 'w:r')) {
          setRunStyle(run, rules.bodyFont, rules.bodyLatinFont, rules.bodyFontSizeHalfPoints, false);
        }
      }
    }
  }
}

function setCellVerticalAlignment(tcPr, alignment = 'center') {
  const vAlign = ensureChild(tcPr, 'w:vAlign');
  vAlign.attributes = { 'w:val': alignment };
}

function setTableCellMargins(tblPr) {
  const marginTwips = 108; // 0.19 cm
  const tblCellMar = ensureChild(tblPr, 'w:tblCellMar');
  tblCellMar.elements = [
    tableCellMargin('w:top', 0),
    tableCellMargin('w:left', marginTwips),
    tableCellMargin('w:bottom', 0),
    tableCellMargin('w:right', marginTwips),
  ];
}

function setCellMarginsAndWrapping(tcPr) {
  const marginTwips = 108; // 0.19 cm
  removeChildren(tcPr, ['w:noWrap']);
  const tcMar = ensureChild(tcPr, 'w:tcMar');
  tcMar.elements = [
    tableCellMargin('w:top', 0),
    tableCellMargin('w:left', marginTwips),
    tableCellMargin('w:bottom', 0),
    tableCellMargin('w:right', marginTwips),
  ];
}

function tableCellMargin(name, widthTwips) {
  return {
    type: 'element',
    name,
    attributes: { 'w:w': String(widthTwips), 'w:type': 'dxa' },
    elements: [],
  };
}

function applyRepeatHeaderRow(table) {
  const firstRow = findChildren(table, 'w:tr')[0];
  if (!firstRow) return;
  const trPr = ensureChild(firstRow, 'w:trPr');
  if (!findChild(trPr, 'w:tblHeader')) {
    trPr.elements.push({ type: 'element', name: 'w:tblHeader', elements: [] });
  }
}

function clearRepeatHeaderRow(table) {
  for (const row of findChildren(table, 'w:tr')) {
    const trPr = findChild(row, 'w:trPr');
    if (!trPr) continue;
    removeChildren(trPr, ['w:tblHeader']);
  }
}

function border(name, value, size) {
  return {
    type: 'element',
    name,
    attributes: { 'w:val': value, 'w:sz': String(size), 'w:space': '0', 'w:color': '000000' },
    elements: [],
  };
}

function writeReports(result, markdownPath, jsonPath) {
  if (markdownPath) writeFileSync(resolve(markdownPath), renderMarkdownReport(result), 'utf-8');
  if (jsonPath) writeFileSync(resolve(jsonPath), JSON.stringify(result, null, 2), 'utf-8');
}

function printSummary(result) {
  const issues = result.issues || [];
  const fixApplied = issues.filter((issue) => issue.fixApplied).length;
  console.log(`模式：${result.mode}`);
  console.log(`检测问题：${issues.length}`);
  if (fixApplied) console.log(`已自动修复：${fixApplied}`);
  const notFixable = issues.filter((issue) => !issue.fixable).length;
  if (notFixable) console.log(`需人工复核：${notFixable}`);
}

function renderMarkdownReport(result) {
  const lines = [
    '# Word 学位论文格式检测报告',
    '',
    `- 模式：${result.mode}`,
    `- 输入：${result.input}`,
    result.output ? `- 输出：${result.output}` : '',
    `- 生成时间：${result.generatedAt || new Date().toISOString()}`,
    `- 问题总数：${result.issues.length}`,
    '',
    '## 统计',
    '',
  ].filter(Boolean);

  for (const [key, value] of Object.entries(result.stats || {})) {
    if (typeof value === 'object' && value) {
      const summary = Object.entries(value).map(([subKey, subValue]) => `${subKey}=${subValue}`).join(', ');
      lines.push(`- ${key}: ${summary}`);
    } else {
      lines.push(`- ${key}: ${value}`);
    }
  }

  lines.push('', '## 不合规项', '');
  if (result.issues.length === 0) {
    lines.push('未发现可检测范围内的不合规项。');
  }
  for (const issue of result.issues) {
    lines.push(
      `### ${issue.id}. ${issue.type}`,
      '',
      `- 位置：${issue.location}`,
      `- 当前：${issue.current}`,
      `- 要求：${issue.expected}`,
      `- 可自动修复：${issue.fixable ? '是' : '否'}`,
      `- 已自动修复：${issue.fixApplied ? '是' : '否'}`,
    );
    if (issue.phase) lines.push(`- 阶段：${issue.phase}`);
    if (issue.note) lines.push(`- 备注：${issue.note}`);
    lines.push('');
  }
  return lines.join('\n');
}
