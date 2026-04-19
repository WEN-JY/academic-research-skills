#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULTS = {
  minBodyFont: 14,
  minAuxFont: 12,
  minDensity: 0.32,
  maxDensity: 0.88,
};

function parseArgs(argv) {
  const args = {
    files: [],
    minBodyFont: DEFAULTS.minBodyFont,
    minAuxFont: DEFAULTS.minAuxFont,
    minDensity: DEFAULTS.minDensity,
    maxDensity: DEFAULTS.maxDensity,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--min-body-font") {
      args.minBodyFont = Number(argv[++index]);
    } else if (token === "--min-aux-font") {
      args.minAuxFont = Number(argv[++index]);
    } else if (token === "--min-density") {
      args.minDensity = Number(argv[++index]);
    } else if (token === "--max-density") {
      args.maxDensity = Number(argv[++index]);
    } else if (token === "--help" || token === "-h") {
      printHelp();
      process.exit(0);
    } else {
      args.files.push(token);
    }
  }

  if (args.files.length === 0) {
    printHelp();
    process.exit(1);
  }

  for (const numericKey of ["minBodyFont", "minAuxFont", "minDensity", "maxDensity"]) {
    if (!Number.isFinite(args[numericKey])) {
      throw new Error(`Invalid numeric option: ${numericKey}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/validate-html-slide.mjs slides.html [more.html]

Options:
  --min-body-font <px>   Minimum font size for body/card/list/table text. Default: ${DEFAULTS.minBodyFont}
  --min-aux-font <px>    Minimum font size for footer/badge/label/meta text. Default: ${DEFAULTS.minAuxFont}
  --min-density <ratio>  Minimum approximate .slide-body visual density. Default: ${DEFAULTS.minDensity}
  --max-density <ratio>  Maximum approximate .slide-body visual density. Default: ${DEFAULTS.maxDensity}
`);
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    throw new Error(
      "Playwright is required for computed-style validation. Install it in your working environment, for example: npm install -D playwright && npx playwright install chromium"
    );
  }
}

function resolveHtmlFiles(inputFiles) {
  return inputFiles.map((inputFile) => {
    const resolvedPath = path.resolve(inputFile);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${resolvedPath}`);
    }
    if (!resolvedPath.toLowerCase().endsWith(".html")) {
      throw new Error(`Expected an .html file: ${resolvedPath}`);
    }
    return resolvedPath;
  });
}

async function validateFile(browser, filePath, options) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
  await page.goto(pathToFileURL(filePath).href, { waitUntil: "networkidle" });

  const result = await page.evaluate((browserOptions) => {
    const auxiliarySelector = [
      ".slide-footer",
      ".footer",
      ".badge",
      ".chip",
      ".tag",
      ".label",
      ".meta",
      ".caption",
      ".kpi-label",
      ".ik-lbl",
      ".axis",
      ".tick",
      ".page-num",
      ".watermark",
      "[data-aux='true']",
    ].join(",");

    const ignoredSelector = [
      "script",
      "style",
      "svg",
      "path",
      "i",
      ".fa",
      ".fas",
      ".far",
      ".fab",
      "[aria-hidden='true']",
    ].join(",");

    function isVisible(element) {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    }

    function hasOwnText(element) {
      return Array.from(element.childNodes).some((node) => {
        return node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0;
      });
    }

    function textPreview(element) {
      return element.textContent.trim().replace(/\s+/g, " ").slice(0, 80);
    }

    function isAuxiliary(element) {
      return Boolean(element.closest(auxiliarySelector));
    }

    function slideLabel(slide, slideIndex) {
      const heading = slide.querySelector("h1, .cover-title, .hero-title, .takeaway");
      if (heading && heading.textContent.trim()) {
        return heading.textContent.trim().replace(/\s+/g, " ").slice(0, 48);
      }
      return `Slide ${slideIndex + 1}`;
    }

    function clipAreaToContainer(elementRect, containerRect) {
      const left = Math.max(elementRect.left, containerRect.left);
      const right = Math.min(elementRect.right, containerRect.right);
      const top = Math.max(elementRect.top, containerRect.top);
      const bottom = Math.min(elementRect.bottom, containerRect.bottom);
      return Math.max(0, right - left) * Math.max(0, bottom - top);
    }

    function measureDensity(slide) {
      const body = slide.querySelector(".slide-body, .body, .content, main") || slide;
      const bodyRect = body.getBoundingClientRect();
      const bodyArea = Math.max(1, bodyRect.width * bodyRect.height);
      const densityElements = Array.from(
        body.querySelectorAll(
          ".panel, .card, .ctx-card, .intro-banner, .hero, .metric, .kpi, .timeline, .table, table, .grid, .row, .item, .box, .banner, .callout"
        )
      ).filter(isVisible);

      const fallbackElements = densityElements.length
        ? densityElements
        : Array.from(body.children).filter(isVisible);

      const occupiedArea = fallbackElements.reduce((totalArea, element) => {
        const elementRect = element.getBoundingClientRect();
        return totalArea + clipAreaToContainer(elementRect, bodyRect);
      }, 0);

      return Math.min(1, occupiedArea / bodyArea);
    }

    const failures = [];
    const warnings = [];
    const slides = Array.from(document.querySelectorAll(".slide"));

    if (slides.length === 0) {
      failures.push({
        slide: "Document",
        type: "structure",
        message: "No .slide elements found.",
      });
    }

    slides.forEach((slide, slideIndex) => {
      const label = slideLabel(slide, slideIndex);
      const density = measureDensity(slide);

      if (density < browserOptions.minDensity) {
        failures.push({
          slide: label,
          type: "density-low",
          message: `Visual density ${density.toFixed(2)} is below ${browserOptions.minDensity}. Add content modules or visual layers.`,
        });
      }

      if (density > browserOptions.maxDensity) {
        failures.push({
          slide: label,
          type: "density-high",
          message: `Visual density ${density.toFixed(2)} exceeds ${browserOptions.maxDensity}. Split or simplify the slide.`,
        });
      }

      const logo = slide.querySelector("img.logo, .topbar-logo img, .header-right img");
      if (!logo) {
        warnings.push({
          slide: label,
          type: "logo",
          message: "No logo image found on this slide.",
        });
      }

      const textElements = Array.from(
        slide.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,td,th,div,span,strong,em,code")
      ).filter((element) => {
        return !element.matches(ignoredSelector) && isVisible(element) && hasOwnText(element);
      });

      textElements.forEach((element) => {
        const style = window.getComputedStyle(element);
        const fontSize = Number.parseFloat(style.fontSize);
        const auxiliary = isAuxiliary(element);
        const minimumFont = auxiliary ? browserOptions.minAuxFont : browserOptions.minBodyFont;

        if (fontSize < minimumFont) {
          failures.push({
            slide: label,
            type: "font-size",
            message: `${element.tagName.toLowerCase()} "${textPreview(element)}" is ${fontSize.toFixed(1)}px; minimum is ${minimumFont}px${auxiliary ? " for auxiliary text" : " for body text"}.`,
          });
        }
      });
    });

    return { failures, warnings, slideCount: slides.length };
  }, options);

  await page.close();
  return result;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const htmlFiles = resolveHtmlFiles(options.files);
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  let failureCount = 0;
  let warningCount = 0;

  try {
    for (const htmlFile of htmlFiles) {
      const result = await validateFile(browser, htmlFile, options);
      console.log(`\n${htmlFile}`);
      console.log(`Slides checked: ${result.slideCount}`);

      for (const warning of result.warnings) {
        warningCount += 1;
        console.log(`WARN  [${warning.slide}] ${warning.message}`);
      }

      for (const failure of result.failures) {
        failureCount += 1;
        console.log(`FAIL  [${failure.slide}] ${failure.message}`);
      }

      if (result.failures.length === 0) {
        console.log("PASS");
      }
    }
  } finally {
    await browser.close();
  }

  if (warningCount > 0) {
    console.log(`\nWarnings: ${warningCount}`);
  }

  if (failureCount > 0) {
    console.error(`\nValidation failed: ${failureCount} issue(s).`);
    process.exit(1);
  }

  console.log("\nValidation passed.");
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
