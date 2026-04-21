#!/usr/bin/env node

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULTS = {
  viewportWidth: 1280,
  viewportHeight: 720,
  selector: ".slide",
  scale: 2,
  wait: 300,
  imageFormat: "png",
  jpegQuality: 90,
  outputName: "deck.pptx",
};

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_FILE);
const SKILL_ROOT = path.resolve(SCRIPT_DIR, "..");
const skillRequire = createRequire(path.join(SKILL_ROOT, "package.json"));

function printHelp() {
  console.log(`Usage:
  node scripts/export-slides-to-pptx.mjs slides [options]

Description:
  Batch render slides/slide-*.html to screenshots, then pack them into a 16:9 PPTX.
  This is a high-fidelity screenshot-based export mode. The resulting PPTX is display-first,
  not a fully editable PowerPoint reconstruction.

Options:
  --output <file>          Output PPTX path. Default: slides/export/${DEFAULTS.outputName}
  --images-dir <dir>       Screenshot output directory. Default: slides/export/images
  --from <n>               Start from slide number n
  --to <n>                 End at slide number n
  --only <list>            Comma-separated filenames, e.g. slide-01.html,slide-03.html
  --scale <n>              Device scale factor. Default: ${DEFAULTS.scale}
  --wait <ms>              Extra wait for fonts/math/layout. Default: ${DEFAULTS.wait}
  --selector <css>         Slide selector to capture. Default: ${DEFAULTS.selector}
  --viewport-width <px>    Browser viewport width. Default: ${DEFAULTS.viewportWidth}
  --viewport-height <px>   Browser viewport height. Default: ${DEFAULTS.viewportHeight}
  --image-format <type>    png | jpeg. Default: ${DEFAULTS.imageFormat}
  --jpeg-quality <1-100>   JPEG quality. Default: ${DEFAULTS.jpegQuality}
  -h, --help               Show this help
`);
}

function parseArgs(argv) {
  const args = {
    slidesDir: null,
    output: null,
    imagesDir: null,
    from: null,
    to: null,
    only: null,
    scale: DEFAULTS.scale,
    wait: DEFAULTS.wait,
    selector: DEFAULTS.selector,
    viewportWidth: DEFAULTS.viewportWidth,
    viewportHeight: DEFAULTS.viewportHeight,
    imageFormat: DEFAULTS.imageFormat,
    jpegQuality: DEFAULTS.jpegQuality,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "-h" || token === "--help") {
      printHelp();
      process.exit(0);
    } else if (token === "--output") {
      args.output = argv[++index];
    } else if (token === "--images-dir") {
      args.imagesDir = argv[++index];
    } else if (token === "--from") {
      args.from = Number(argv[++index]);
    } else if (token === "--to") {
      args.to = Number(argv[++index]);
    } else if (token === "--only") {
      args.only = argv[++index]
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    } else if (token === "--scale") {
      args.scale = Number(argv[++index]);
    } else if (token === "--wait") {
      args.wait = Number(argv[++index]);
    } else if (token === "--selector") {
      args.selector = argv[++index];
    } else if (token === "--viewport-width") {
      args.viewportWidth = Number(argv[++index]);
    } else if (token === "--viewport-height") {
      args.viewportHeight = Number(argv[++index]);
    } else if (token === "--image-format") {
      args.imageFormat = String(argv[++index] || "").toLowerCase();
    } else if (token === "--jpeg-quality") {
      args.jpegQuality = Number(argv[++index]);
    } else if (!args.slidesDir) {
      args.slidesDir = token;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (!args.slidesDir) {
    printHelp();
    process.exit(1);
  }

  if (!Number.isFinite(args.scale) || args.scale <= 0) {
    throw new Error("--scale must be a positive number.");
  }
  if (!Number.isFinite(args.wait) || args.wait < 0) {
    throw new Error("--wait must be a non-negative number.");
  }
  if (!Number.isFinite(args.viewportWidth) || args.viewportWidth <= 0) {
    throw new Error("--viewport-width must be a positive number.");
  }
  if (!Number.isFinite(args.viewportHeight) || args.viewportHeight <= 0) {
    throw new Error("--viewport-height must be a positive number.");
  }
  if (args.from !== null && (!Number.isInteger(args.from) || args.from <= 0)) {
    throw new Error("--from must be a positive integer.");
  }
  if (args.to !== null && (!Number.isInteger(args.to) || args.to <= 0)) {
    throw new Error("--to must be a positive integer.");
  }
  if (args.from !== null && args.to !== null && args.from > args.to) {
    throw new Error("--from cannot be greater than --to.");
  }
  if (!["png", "jpeg"].includes(args.imageFormat)) {
    throw new Error("--image-format must be png or jpeg.");
  }
  if (
    !Number.isInteger(args.jpegQuality) ||
    args.jpegQuality < 1 ||
    args.jpegQuality > 100
  ) {
    throw new Error("--jpeg-quality must be an integer between 1 and 100.");
  }

  const slidesDir = path.resolve(args.slidesDir);
  const exportDir = path.join(slidesDir, "export");

  return {
    ...args,
    slidesDir,
    output: path.resolve(args.output || path.join(exportDir, DEFAULTS.outputName)),
    imagesDir: path.resolve(args.imagesDir || path.join(exportDir, "images")),
  };
}

async function loadPlaywright() {
  try {
    const resolvedEntry = skillRequire.resolve("playwright");
    return await import(pathToFileURL(resolvedEntry).href);
  } catch (error) {
    throw new Error(
      `Playwright is required for slide rendering. Install it in the skill directory first, for example: npm install --prefix "${SKILL_ROOT}" && npx --prefix "${SKILL_ROOT}" playwright install chromium`
    );
  }
}

function findChromeExecutable() {
  const candidates = [
    process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

async function loadPptxGenJs() {
  try {
    const resolvedEntry = skillRequire.resolve("pptxgenjs");
    const module = await import(pathToFileURL(resolvedEntry).href);
    return module.default ?? module;
  } catch (error) {
    throw new Error(
      `pptxgenjs is required for PPTX export. Install it in the skill directory first, for example: npm install --prefix "${SKILL_ROOT}"`
    );
  }
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function parseSlideNumber(filename) {
  const match = filename.match(/slide-(\d+)/i);
  return match ? Number(match[1]) : null;
}

function collectHtmlSlides(options) {
  if (!fs.existsSync(options.slidesDir)) {
    throw new Error(`Slides directory not found: ${options.slidesDir}`);
  }

  const htmlFiles = fs
    .readdirSync(options.slidesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /^slide-.*\.html$/i.test(name))
    .sort(naturalSort);

  if (htmlFiles.length === 0) {
    throw new Error(`No slide HTML files found in ${options.slidesDir}`);
  }

  const selectedByName = options.only
    ? new Set(options.only.map((item) => item.trim()))
    : null;

  const filtered = htmlFiles.filter((filename) => {
    if (selectedByName && !selectedByName.has(filename)) {
      return false;
    }

    const slideNumber = parseSlideNumber(filename);
    if (options.from !== null && slideNumber !== null && slideNumber < options.from) {
      return false;
    }
    if (options.to !== null && slideNumber !== null && slideNumber > options.to) {
      return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    throw new Error("No slide HTML files matched the current filters.");
  }

  return filtered.map((filename) => ({
    filename,
    htmlPath: path.join(options.slidesDir, filename),
    imagePath: path.join(
      options.imagesDir,
      filename.replace(/\.html$/i, options.imageFormat === "png" ? ".png" : ".jpg")
    ),
  }));
}

async function waitForRendering(page, waitMs) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  });
  if (waitMs > 0) {
    await page.waitForTimeout(waitMs);
  }
}

async function renderSlideToImage(page, slideFile, options) {
  await page.goto(pathToFileURL(slideFile.htmlPath).href, { waitUntil: "networkidle" });
  await waitForRendering(page, options.wait);

  const target = page.locator(options.selector).first();
  if ((await target.count()) === 0) {
    throw new Error(`Selector "${options.selector}" not found in ${slideFile.filename}.`);
  }

  ensureDirectory(path.dirname(slideFile.imagePath));

  const screenshotOptions =
    options.imageFormat === "jpeg"
      ? { path: slideFile.imagePath, type: "jpeg", quality: options.jpegQuality }
      : { path: slideFile.imagePath, type: "png" };

  await target.screenshot(screenshotOptions);
}

async function renderSlides(slideFiles, options) {
  const playwright = await loadPlaywright();
  const chromeExecutable = findChromeExecutable();
  const browser = await playwright.chromium.launch(
    chromeExecutable ? { executablePath: chromeExecutable } : {}
  );
  const context = await browser.newContext({
    viewport: {
      width: options.viewportWidth,
      height: options.viewportHeight,
    },
    deviceScaleFactor: options.scale,
  });
  const page = await context.newPage();

  try {
    for (const slideFile of slideFiles) {
      console.log(
        `Rendering ${slideFile.filename} -> ${path.relative(process.cwd(), slideFile.imagePath)}`
      );
      await renderSlideToImage(page, slideFile, options);
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

async function packSlidesToPptx(slideFiles, options) {
  const PptxGenJS = await loadPptxGenJs();
  const pptx = new PptxGenJS();

  pptx.defineLayout({ name: "HTMLSLIDE_16X9", width: 13.333, height: 7.5 });
  pptx.layout = "HTMLSLIDE_16X9";
  pptx.author = "OpenAI Codex";
  pptx.company = "OpenAI";
  pptx.subject = "HTML slide screenshot export";
  pptx.title = path.basename(options.output, ".pptx");
  pptx.lang = "zh-CN";

  for (const slideFile of slideFiles) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addImage({
      path: slideFile.imagePath,
      x: 0,
      y: 0,
      w: 13.333,
      h: 7.5,
    });
    slide.addNotes(`[${slideFile.filename}] Screenshot-based export from HTML slide.`);
  }

  ensureDirectory(path.dirname(options.output));
  await pptx.writeFile({ fileName: options.output });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const slideFiles = collectHtmlSlides(options);

  console.log(`Selected ${slideFiles.length} slide(s) from ${path.relative(process.cwd(), options.slidesDir) || "."}`);
  console.log(`Images directory: ${path.relative(process.cwd(), options.imagesDir)}`);
  console.log(`PPTX output: ${path.relative(process.cwd(), options.output)}`);

  await renderSlides(slideFiles, options);
  await packSlidesToPptx(slideFiles, options);

  console.log("Done.");
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
