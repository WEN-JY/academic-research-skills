#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const [, , inputArg, outputArg, referencesJsonArg] = process.argv;

if (!inputArg || !outputArg) {
  console.error('用法：node nbu-md-preprocess.mjs input.md output.md [references.json]');
  process.exit(2);
}

const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);

if (!existsSync(inputPath)) {
  console.error(`错误：输入文件不存在：${inputPath}`);
  process.exit(1);
}

const source = readFileSync(inputPath, 'utf8');
const { markdown, footnotes } = preprocessMarkdown(source);
writeFileSync(outputPath, markdown);
if (referencesJsonArg) {
  writeFileSync(resolve(referencesJsonArg), `${JSON.stringify(footnotes, null, 2)}\n`);
}

function preprocessMarkdown(sourceText) {
  const normalized = sourceText.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const withoutFrontMatter = stripYamlFrontMatter(lines);
  const withoutTitle = stripLeadingPaperTitle(withoutFrontMatter);
  const stripped = withoutTitle.map((line) => normalizeChineseQuotes(line).replace(/\*\*/g, ''));
  const { bodyLines, footnotes } = extractFootnoteDefinitions(stripped);
  const outputLines = trimTrailingBlankLines(bodyLines);

  if (footnotes.length) {
    if (outputLines.length) outputLines.push('');
    for (const note of footnotes) {
      outputLines.push(`[^${note.label}]: ${note.content}`);
      outputLines.push('');
    }
  }

  return {
    markdown: `${trimTrailingBlankLines(outputLines).join('\n')}\n`,
    footnotes,
  };
}

function stripYamlFrontMatter(lines) {
  if (lines[0] !== '---') return [...lines];
  const end = lines.findIndex((line, index) => index > 0 && line === '---');
  if (end < 0) return [...lines];
  return lines.slice(end + 1);
}

function stripLeadingPaperTitle(lines) {
  const result = [...lines];
  while (result.length && /^\s*$/.test(result[0])) result.shift();
  if (!result.length) return result;
  if (/^#\s+/.test(result[0]) && !/^#\s*第[0-9一二三四五六七八九十]+章/.test(result[0])) {
    result.shift();
    while (result.length && /^\s*$/.test(result[0])) result.shift();
    if (result[0] === '---') {
      result.shift();
      while (result.length && /^\s*$/.test(result[0])) result.shift();
    }
  }
  return result;
}

function extractFootnoteDefinitions(lines) {
  const bodyLines = [];
  const footnotes = [];
  let pendingBody = [];
  let index = 0;

  while (index < lines.length) {
    if (isFootnoteDefinitionStart(lines[index])) {
      const { notes, nextIndex } = readFootnoteDefinitionBlock(lines, index);
      const remapped = remapLocalFootnotes(pendingBody, notes, footnotes.length);
      bodyLines.push(...remapped.bodyLines);
      footnotes.push(...remapped.footnotes);
      pendingBody = [];
      index = nextIndex;
      continue;
    }

    pendingBody.push(lines[index]);
    index++;
  }

  bodyLines.push(...pendingBody);

  return {
    bodyLines,
    footnotes: footnotes.map((note) => ({
      label: note.label,
      content: normalizeReferenceContent(note.parts.join(' ')),
    })),
  };
}

function isFootnoteDefinitionStart(line) {
  return /^\[\^([^\]]+)\]:\s*(.*)$/.test(line);
}

function readFootnoteDefinitionBlock(lines, startIndex) {
  const notes = [];
  let index = startIndex;

  while (index < lines.length) {
    const start = lines[index].match(/^\[\^([^\]]+)\]:\s*(.*)$/);
    if (!start) break;

    const note = { label: start[1].trim(), parts: [start[2].trim()] };
    index++;

    while (index < lines.length && /^(?: {2,}|\t)\S/.test(lines[index])) {
      note.parts.push(lines[index].trim());
      index++;
    }

    notes.push(note);

    const afterBlanks = skipBlankLines(lines, index);
    if (afterBlanks < lines.length && isFootnoteDefinitionStart(lines[afterBlanks])) {
      index = afterBlanks;
      continue;
    }

    index = afterBlanks;
    break;
  }

  return { notes, nextIndex: index };
}

function skipBlankLines(lines, startIndex) {
  let index = startIndex;
  while (index < lines.length && /^\s*$/.test(lines[index])) index++;
  return index;
}

function remapLocalFootnotes(bodyLines, notes, existingCount) {
  const labelMap = new Map();
  const footnotes = notes.map((note, offset) => {
    const label = String(existingCount + offset + 1);
    if (!labelMap.has(note.label)) labelMap.set(note.label, label);
    return { ...note, label };
  });

  return {
    bodyLines: bodyLines.map((line) => line.replace(/\[\^([^\]]+)\]/g, (match, rawLabel) => {
      const label = rawLabel.trim();
      return labelMap.has(label) ? `[^${labelMap.get(label)}]` : match;
    })),
    footnotes,
  };
}

function normalizeReferenceContent(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([，。；：、])/g, '$1')
    .replace(/([《（])\s+/g, '$1')
    .replace(/\s+([》）])/g, '$1')
    .trim();
}

function normalizeChineseQuotes(text) {
  let result = '';
  let open = true;
  let inTag = false;
  for (const char of String(text || '')) {
    if (char === '<') {
      inTag = true;
      result += char;
      continue;
    }
    if (char === '>') {
      inTag = false;
      result += char;
      continue;
    }
    if (inTag) {
      result += char;
      continue;
    }
    if (char === '"' || char === '“' || char === '”') {
      result += open ? '“' : '”';
      open = !open;
      continue;
    }
    result += char;
  }
  return result;
}

function trimTrailingBlankLines(lines) {
  const result = [...lines];
  while (result.length && /^\s*$/.test(result[result.length - 1])) result.pop();
  return result;
}
