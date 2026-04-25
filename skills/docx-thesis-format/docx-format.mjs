#!/usr/bin/env node
import { createRequire } from 'module';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, extname, resolve } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const JSZip = require('../markdown-to-word/node_modules/jszip');
const { xml2js, js2xml } = require('../markdown-to-word/node_modules/xml-js');

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_RULES = resolve(SCRIPT_DIR, 'rules/engineering-college.json');
const SPACE_MARK = '\uE000';
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
  const result = await runCheck(inputPath, rules);
  writeReports(result, cli.out, cli.json);
  printSummary(result);
} else if (MODE === 'fix') {
  const outputPath = resolve(cli.output || inputPath.replace(/\.docx$/i, '.formatted.docx'));
  const result = await runFix(inputPath, outputPath, rules);
  writeReports(result, cli.report, cli.json);
  printSummary(result);
  console.log(`输出文档：${outputPath}`);
} else {
  const outputPath = resolve(cli.output || inputPath.replace(/\.docx$/i, '.formatted.docx'));
  const before = await runCheck(inputPath, rules);
  const fixed = await runFix(inputPath, outputPath, rules);
  const after = await runCheck(outputPath, rules);
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
  node skills/docx-thesis-format/docx-format.mjs check [--rules rules.json] [--out report.md] [--json report.json] input.docx
  node skills/docx-thesis-format/docx-format.mjs fix   [--rules rules.json] [--out output.docx] [--report report.md] [--json report.json] input.docx
  node skills/docx-thesis-format/docx-format.mjs format [--rules rules.json] [--out output.docx] [--report report.md] [--json report.json] input.docx`);
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

async function runCheck(inputPath, rules) {
  const docx = await loadDocx(inputPath);
  const issues = [];
  const context = createContext(rules, false, issues);
  analyzeDocument(docx, context);
  insertMissingCaptions(docx, context);
  analyzeHeadersAndFooters(docx, context);
  return makeResult('check', inputPath, '', issues, context.stats);
}

async function runFix(inputPath, outputPath, rules) {
  const docx = await loadDocx(inputPath);
  const issues = [];
  const context = createContext(rules, true, issues);
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

function createContext(rules, fix, issues) {
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
    bodyWidthTwips: computeBodyWidthTwips(rules),
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

  cleanupMeaninglessBlankParagraphs(body, context);
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
  analyzeToc(bodyElements, context);
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

function analyzeParagraph(paragraph, context, index, siblings) {
  const text = normalizeSpaces(getParagraphText(paragraph));
  const trimmed = text.trim();
  if (!trimmed && !hasMath(paragraph)) return;

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
    return;
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
  if (chapter) {
    context.currentChapter = chapter;
    context.currentAppendix = '';
    resetChapterCounters(context);
    context.mainBodyStarted = true;
    context.stats.headings++;
    checkAndFixChapter(paragraph, trimmed, context, index);
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
    checkAndFixChapter(paragraph, trimmed, context, index);
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
  if (!match) return 0;
  return parseChineseNumber(match[1]);
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

function checkAndFixChapter(paragraph, text, context, index) {
  const rule = context.rules.headings.chapter;
  const ok = paragraphHasStyle(paragraph, {
    alignment: rule.alignment,
    font: rule.font,
    size: rule.fontSizeHalfPoints,
    bold: rule.bold,
    pageBreakBefore: rule.pageBreakBefore,
  });
  if (!ok) {
    addIssue(context, {
      type: '章标题格式',
      location: paragraphLocation(index),
      current: text,
      expected: '小三号仿宋加粗居中，段前分页',
      fixable: true,
    });
    setParagraphStyle(paragraph, {
      alignment: rule.alignment,
      font: rule.font,
      latinFont: rule.latinFont,
      size: rule.fontSizeHalfPoints,
      bold: rule.bold,
      pageBreakBefore: rule.pageBreakBefore,
      fix: context.fix,
    });
    if (context.fix) context.stats.fixed++;
  }
  context.lastHeadingLevel = 1;
}

function checkAndFixSubsection(paragraph, text, context, index) {
  const match = text.match(/^([1-9]\d?\.\d{1,2}\.\d{1,2})(\s*)(.+)$/);
  if (!match) return false;
  syncChapterFromHeadingNumber(match[1], context);
  context.stats.headings++;
  if (context.mainBodyStarted && context.lastHeadingLevel > 0 && context.lastHeadingLevel < 2) {
    addIssue(context, {
      type: '标题跳级',
      location: paragraphLocation(index),
      current: `第 3 级小节标题"${match[1]}"，上一标题为第 ${context.lastHeadingLevel} 级`,
      expected: '第 3 级小节标题前应先出现第 2 级节标题（如 N.N  节标题）',
      fixable: false,
    });
  }
  context.lastHeadingLevel = 3;
  const rule = context.rules.headings.subsection;
  const expected = `${match[1]}${' '.repeat(rule.spacesAfterNumber)}${match[3].trim()}`;
  const ok = match[2].length === rule.spacesAfterNumber && paragraphHasStyle(paragraph, {
    alignment: rule.alignment,
    font: rule.font,
    size: rule.fontSizeHalfPoints,
    bold: rule.bold,
  }) && hasSpaceRunFontAfterPrefix(paragraph, match[1], rule.spacesAfterNumber, rule.spaceFont);
  if (!ok) {
    addIssue(context, {
      type: '小节标题格式',
      location: paragraphLocation(index),
      current: text,
      expected: `${match[1]} 后 1 个宋体空格，标题小四号仿宋`,
      fixable: true,
    });
    if (context.fix) {
      setParagraphRuns(paragraph, [
        textRun(match[1], rule.font, rule.latinFont, rule.fontSizeHalfPoints, rule.bold),
        textRun(' '.repeat(rule.spacesAfterNumber), rule.spaceFont, rule.spaceFont, rule.fontSizeHalfPoints, rule.bold),
        textRun(match[3].trim(), rule.font, rule.latinFont, rule.fontSizeHalfPoints, rule.bold),
      ]);
      setParagraphProps(paragraph, { alignment: rule.alignment, spacingLine: 360 });
      context.stats.fixed++;
    }
  }
  return true;
}

function checkAndFixSection(paragraph, text, context, index) {
  const match = text.match(/^([1-9]\d?\.\d{1,2})(?!\.)(\s*)(.+)$/);
  if (!match) return false;
  syncChapterFromHeadingNumber(match[1], context);
  context.stats.headings++;
  context.lastHeadingLevel = 2;
  const rule = context.rules.headings.section;
  const ok = match[2].length === rule.spacesAfterNumber && paragraphHasStyle(paragraph, {
    alignment: rule.alignment,
    font: rule.font,
    size: rule.fontSizeHalfPoints,
    bold: rule.bold,
  }) && hasSpaceRunFontAfterPrefix(paragraph, match[1], rule.spacesAfterNumber, rule.spaceFont);
  if (!ok) {
    addIssue(context, {
      type: '节标题格式',
      location: paragraphLocation(index),
      current: text,
      expected: `${match[1]} 后 2 个宋体空格，标题四号仿宋加粗`,
      fixable: true,
    });
    if (context.fix) {
      setParagraphRuns(paragraph, [
        textRun(match[1], rule.font, rule.latinFont, rule.fontSizeHalfPoints, rule.bold),
        textRun(' '.repeat(rule.spacesAfterNumber), rule.spaceFont, rule.spaceFont, rule.fontSizeHalfPoints, rule.bold),
        textRun(match[3].trim(), rule.font, rule.latinFont, rule.fontSizeHalfPoints, rule.bold),
      ]);
      setParagraphProps(paragraph, { alignment: rule.alignment, spacingLine: 360 });
      context.stats.fixed++;
    }
  }
  return true;
}

function checkAndFixFigureCaption(paragraph, text, context, index, siblings) {
  if (text === '图目录') return false;
  if (!/^图\s*\S+/.test(text)) return false;
  context.figureIndex++;
  context.stats.figures++;
  const chapter = context.currentAppendix || context.currentChapter || '?';
  const expectedNumber = `图${chapter}.${context.figureIndex}`;
  const title = text.replace(/^图\s*[A-Z0-9一二三四五六七八九十]+[.-]\d+\s*/i, '').replace(/^图\s*/, '').trim();
  const expected = `${expectedNumber}${title ? ` ${title}` : ''}`;
  const belowImage = hasNearbyDrawingBefore(siblings, index);
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

  if (!numberOk || !styleOk || !belowImage) {
    addIssue(context, {
      type: '图题格式',
      location: paragraphLocation(index),
      current: text,
      expected: `${expectedNumber}，图题位于图下方并居中，五号仿宋/Times New Roman，单倍行距`,
      fixable: true,
      note: belowImage ? '' : '未在图题前近邻位置识别到图片，需人工确认图题位置',
    });
    if (context.fix) {
      setParagraphText(paragraph, expected, context.rules.figures.font, context.rules.figures.latinFont, context.rules.figures.fontSizeHalfPoints);
      setParagraphProps(paragraph, { alignment: context.rules.figures.alignment, spacingLine: context.rules.figures.lineTwips });
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
  context.tableIndex++;
  const chapter = context.currentAppendix || context.currentChapter || '?';
  const expectedNumber = `表${chapter}.${context.tableIndex}`;
  const title = text.replace(/^表\s*[A-Z0-9一二三四五六七八九十]+[.-]\d+\s*/i, '').replace(/^表\s*/, '').trim();
  const expected = `${expectedNumber}${title ? ` ${title}` : ''}`;
  const nextContentIndex = findNextNonBlankParagraphSiblingIndex(siblings, index);
  const aboveTable = nextContentIndex >= 0 && siblings[nextContentIndex]?.name === 'w:tbl';
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
      expected: `${expectedNumber}，表题位于表上方并居中，五号仿宋/Times New Roman，单倍行距`,
      fixable: true,
      note: aboveTable ? '' : '未在表题后紧邻位置识别到表格，需人工确认表题位置',
    });
    if (context.fix) {
      setParagraphText(paragraph, expected, context.rules.tables.captionFont, context.rules.tables.captionLatinFont, context.rules.tables.captionFontSizeHalfPoints);
      setParagraphProps(paragraph, { alignment: context.rules.tables.alignment, spacingLine: context.rules.tables.captionLineTwips });
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
      expected: '英文表题应紧随中文表题、位于表上方，并使用五号仿宋/Times New Roman、单倍行距、居中',
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
      expected: `${expectedPrefix} 开头，小四仿宋/Times New Roman，1.5 倍行距，并包含 [M]/[J]/[D]/[EB/OL] 等类型标识`,
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
  const text = getParagraphText(paragraph).trim();
  if (!shouldTreatAsBodyParagraph(paragraph, text, context)) return;
  const ok = paragraphHasStyle(paragraph, {
    alignment: context.rules.body.alignment,
    font: context.rules.body.eastAsiaFont,
    size: context.rules.body.fontSizeHalfPoints,
    line: context.rules.body.lineTwips,
    before: context.rules.body.spacingBefore,
    after: context.rules.body.spacingAfter,
    firstLine: context.rules.body.firstLineTwips,
  });
  if (!ok) {
    addIssue(context, {
      type: '正文段落格式',
      location: paragraphLocation(index),
      current: text.slice(0, 80),
      expected: '小四仿宋/Times New Roman，1.5 倍行距，首行缩进 2 字符，两端对齐',
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
      fix: context.fix,
    });
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
  if (!text || hasMath(paragraph) || looksLikeTocLine(text) || hasDrawing(paragraph)) return false;
  if (isSpecialSectionHeading(text) || isMajorBackMatterHeading(text)) return false;
  if (looksLikeChapterHeadingText(text) || looksLikeSectionHeadingText(text) || looksLikeSubsectionHeadingText(text)) return false;
  if (/^(图|表)\s*\S+/.test(text)) return false;
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

function looksLikeChapterHeadingText(text) {
  return Boolean(parseChapterTitle(text) || parseLeadingChineseHeadingNumber(text));
}

function isFirstLevelHeading(paragraph, text) {
  if (!text || text.length > 40) return false;
  if (isMajorBackMatterHeading(text)) return false;
  const styleId = paragraphStyleId(paragraph);
  if (styleId === '1') return true;
  return /^[一二三四五六七八九十]+、\S+/.test(text);
}

function looksLikeSectionHeadingText(text) {
  return /^([1-9]\d?\.\d{1,2})(?!\.)(\s*)(.+)$/.test(text);
}

function looksLikeSubsectionHeadingText(text) {
  return /^([1-9]\d?\.\d{1,2}\.\d{1,2})(\s*)(.+)$/.test(text);
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

    if (el.name === 'w:tbl') {
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

function makeCaptionParagraph(text, rules, type) {
  const font = type === 'caption' ? (rules.captionFont || '仿宋') : (rules.font || '仿宋');
  const latinFont = type === 'caption' ? (rules.captionLatinFont || 'Times New Roman') : (rules.latinFont || 'Times New Roman');
  const size = type === 'caption' ? (rules.captionFontSizeHalfPoints || 21) : (rules.fontSizeHalfPoints || 21);
  const lineTwips = type === 'caption' ? (rules.captionLineTwips || 240) : (rules.lineTwips || 240);
  const para = { type: 'element', name: 'w:p', elements: [] };
  setParagraphRuns(para, [textRun(text, font, latinFont, size, false)]);
  setParagraphProps(para, { alignment: 'center', spacingLine: lineTwips });
  return para;
}

function isChineseTableCaptionText(text) {
  return /^表\s*\S+/.test(text);
}

function isEnglishTableCaptionText(text) {
  return /^Table\s+\d+\.\d+\b/i.test(text);
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
  const expectedCellAlignment = context.rules.tables?.cellAlignment || 'left';
  const tableOk = isThreeLineTable(table);
  const alignmentOk = tableCellsHaveParagraphAlignment(table, expectedCellAlignment);
  const bodyStyleOk = tableCellsHaveBodyStyle(table, context.rules.tables || {});
  const repeatHeaderOk = context.rules.tables?.repeatHeaderRow ? tableHasRepeatHeaderRow(table) : true;
  if (!tableOk || !alignmentOk || !bodyStyleOk || !repeatHeaderOk) {
    addIssue(context, {
      type: '表格三线表',
      location: `第 ${index + 1} 个正文元素附近`,
      current: [
        tableOk ? '' : '表格边框不是标准三线表',
        alignmentOk ? '' : `单元格内容未统一${alignmentName(expectedCellAlignment)}对齐`,
        bodyStyleOk ? '' : '表文字号或字体不符合五号仿宋/Times New Roman',
        repeatHeaderOk ? '' : '未设置跨页续表表头（重复标题行）',
      ].filter(Boolean).join('；'),
      expected: `顶线、表头下线、底线；不使用竖线；单元格内容水平${alignmentName(expectedCellAlignment)}对齐；表文五号仿宋/Times New Roman；跨页时重复表头`,
      fixable: true,
    });
    if (context.fix) {
      applyThreeLineTable(table, expectedCellAlignment);
      applyTableBodyStyle(table, context.rules.tables || {});
      if (context.rules.tables?.repeatHeaderRow) applyRepeatHeaderRow(table);
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
      expected: 'A4 常规边距：上/下 2.54cm，左/右 3.17cm；页眉页脚按模板分节配置',
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
  const files = Object.keys(docx.xmlFiles).filter((name) => /^word\/(header|footer)\d+\.xml$/.test(name));
  if (files.length === 0) {
    addIssue(context, {
      type: '页眉页脚',
      location: '文档节属性',
      current: '未检测到页眉或页脚文件',
      expected: '应按学院模板设置页眉页脚与页码',
      fixable: false,
      note: '页眉具体文字、页码格式和前置页码规则需学院模板确认',
    });
    return;
  }
  const headerRule = context.rules.headersFooters || {};
  const headerFiles = files.filter((name) => name.includes('/header'));
  for (const name of headerFiles) {
    const headerText = firstNonEmptyParagraphText(docx.xmlFiles[name]);
    if (!headerText) continue;
    if (headerRule.headerPrefix && !headerText.startsWith(headerRule.headerPrefix)) {
      addIssue(context, {
        type: '页眉文字',
        location: name,
        current: headerText,
        expected: `以“${headerRule.headerPrefix}”开头`,
        fixable: false,
      });
    }
    const style = firstNonEmptyParagraphRunStyle(docx.xmlFiles[name]);
    if (headerRule.headerAlignment && style.alignment && style.alignment !== headerRule.headerAlignment) {
      addIssue(context, {
        type: '页眉对齐',
        location: name,
        current: style.alignment,
        expected: `两端对齐：左侧“${headerRule.headerPrefix}”，右侧当前部分标题`,
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
      expected: '页脚应包含页码域',
      fixable: footerFiles.length > 0,
      note: '当前版本先检测提示，待页码位置规则确认后再自动写入',
    });
    if (context.fix && footerFiles.length > 0) {
      ensureFooterPageField(docx.xmlFiles[footerFiles[0]], context.rules.pageNumbering?.footerAlignment || 'center');
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

function ensureFooterPageField(xml, alignment = 'center') {
  const root = findChild(xml, 'w:ftr');
  if (!root) return;
  root.elements = findChildren(root, 'w:p').length ? root.elements : [];
  root.elements.push(makePageFieldParagraph(alignment));
}

function makePageFieldParagraph(alignment = 'center') {
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
        ],
      },
      {
        type: 'element',
        name: 'w:fldSimple',
        attributes: { 'w:instr': ' PAGE ' },
        elements: [
          {
            type: 'element',
            name: 'w:r',
            elements: [
              {
                type: 'element',
                name: 'w:t',
                elements: [{ type: 'text', text: '1' }],
              },
            ],
          },
        ],
      },
    ],
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
  const sz = findChild(rPr, 'w:sz');
  if (expected.size && sz?.attributes?.['w:val'] !== String(expected.size)) return false;
  if (expected.bold !== undefined) {
    const hasBold = Boolean(findChild(rPr, 'w:b'));
    if (hasBold !== expected.bold) return false;
  }
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
    setRunStyle(run, options.font, options.latinFont, options.size, options.bold);
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
    spacing.attributes = { ...(spacing.attributes || {}), 'w:line': String(options.spacingLine), 'w:lineRule': 'auto' };
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

function setRunStyle(run, font, latinFont, size, bold) {
  const rPr = ensureChild(run, 'w:rPr');
  setRunProperties(rPr, font, latinFont, size, bold);
}

function setParagraphText(paragraph, text, font, latinFont, size, bold = false) {
  setParagraphRuns(paragraph, [textRun(text, font, latinFont, size, bold)]);
}

function setParagraphRuns(paragraph, runs) {
  const pPr = findChild(paragraph, 'w:pPr');
  paragraph.elements = [
    ...(pPr ? [pPr] : []),
    ...runs.map((run) => makeRun(run)),
  ];
}

function textRun(text, font, latinFont, size, bold = false) {
  return { text, font, latinFont, size, bold };
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
  setRunStyle(r, run.font, run.latinFont, run.size, run.bold);
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

function setParagraphDefaultRunStyle(paragraph, font, latinFont, size, bold) {
  const pPr = ensureChild(paragraph, 'w:pPr');
  const rPr = ensureChild(pPr, 'w:rPr');
  setRunProperties(rPr, font, latinFont, size, bold);
}

function setRunProperties(rPr, font, latinFont, size, bold) {
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
  return ['nil', 'none'].includes(left) && ['nil', 'none'].includes(right) && ['nil', 'none'].includes(insideV);
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

function tableCellsHaveBodyStyle(table, rules) {
  for (const row of findChildren(table, 'w:tr')) {
    for (const cell of findChildren(row, 'w:tc')) {
      for (const paragraph of findChildren(cell, 'w:p')) {
        const text = getParagraphText(paragraph).trim();
        if (!text) continue;
        if (!paragraphHasStyle(paragraph, {
          font: rules.bodyFont,
          size: rules.bodyFontSizeHalfPoints,
        })) return false;
        if (!paragraphRunsMatchStyle(paragraph, {
          font: rules.bodyFont,
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

function applyThreeLineTable(table, cellAlignment = 'left') {
  const tblPr = ensureChild(table, 'w:tblPr');
  const borders = ensureChild(tblPr, 'w:tblBorders');
  borders.elements = [
    border('w:top', 'single', 6),
    border('w:left', 'nil', 0),
    border('w:bottom', 'single', 6),
    border('w:right', 'nil', 0),
    border('w:insideH', 'nil', 0),
    border('w:insideV', 'nil', 0),
  ];

  const rows = findChildren(table, 'w:tr');
  rows.forEach((row, rowIndex) => {
    const isHeader = rowIndex === 0;
    const isLast = rowIndex === rows.length - 1;
    for (const cell of findChildren(row, 'w:tc')) {
      const tcPr = ensureChild(cell, 'w:tcPr');
      const tcBorders = ensureChild(tcPr, 'w:tcBorders');
      tcBorders.elements = [
        border('w:top', rowIndex === 0 ? 'single' : 'nil', rowIndex === 0 ? 6 : 0),
        border('w:left', 'nil', 0),
        border('w:bottom', isHeader || isLast ? 'single' : 'nil', isHeader || isLast ? 6 : 0),
        border('w:right', 'nil', 0),
      ];
      for (const paragraph of findChildren(cell, 'w:p')) {
        setParagraphProps(paragraph, { alignment: cellAlignment });
      }
    }
  });
}

function applyTableBodyStyle(table, rules) {
  for (const row of findChildren(table, 'w:tr')) {
    for (const cell of findChildren(row, 'w:tc')) {
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

function applyRepeatHeaderRow(table) {
  const firstRow = findChildren(table, 'w:tr')[0];
  if (!firstRow) return;
  const trPr = ensureChild(firstRow, 'w:trPr');
  if (!findChild(trPr, 'w:tblHeader')) {
    trPr.elements.push({ type: 'element', name: 'w:tblHeader', elements: [] });
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
