#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const START_MARKER = "<!-- html-slide-keyboard-nav:start -->";
const END_MARKER = "<!-- html-slide-keyboard-nav:end -->";

function printHelp() {
  console.log(`Usage:
  node scripts/add-slide-keyboard-nav.mjs slides

Injects invisible keyboard-only page switching into each HTML slide:
  Enter / ArrowDown  -> next slide
  ArrowUp            -> previous slide
`);
}

function naturalCompare(left, right) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function removeExistingBlock(html) {
  const start = html.indexOf(START_MARKER);
  const end = html.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    return html;
  }
  return html.slice(0, start) + html.slice(end + END_MARKER.length);
}

function buildKeyboardScript(previousFile, nextFile) {
  const previousValue = previousFile ? JSON.stringify(previousFile) : "null";
  const nextValue = nextFile ? JSON.stringify(nextFile) : "null";

  return `${START_MARKER}
<script>
(() => {
  const previousSlide = ${previousValue};
  const nextSlide = ${nextValue};

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const tagName = target && target.tagName ? target.tagName.toLowerCase() : "";
    if (tagName === "input" || tagName === "textarea" || tagName === "select" || target?.isContentEditable) {
      return;
    }

    if ((event.key === "Enter" || event.key === "ArrowDown") && nextSlide) {
      event.preventDefault();
      window.location.href = nextSlide;
    }

    if (event.key === "ArrowUp" && previousSlide) {
      event.preventDefault();
      window.location.href = previousSlide;
    }
  });
})();
</script>
${END_MARKER}`;
}

function injectKeyboardNav(filePath, previousFile, nextFile) {
  const html = fs.readFileSync(filePath, "utf8");
  const cleanHtml = removeExistingBlock(html).trimEnd();
  const block = buildKeyboardScript(previousFile, nextFile);

  if (cleanHtml.includes("</body>")) {
    const updatedHtml = cleanHtml.replace("</body>", `${block}\n</body>`);
    fs.writeFileSync(filePath, `${updatedHtml}\n`);
    return;
  }

  fs.writeFileSync(filePath, `${cleanHtml}\n${block}\n`);
}

function main() {
  const [slidesDirArg] = process.argv.slice(2);
  if (!slidesDirArg || slidesDirArg === "--help" || slidesDirArg === "-h") {
    printHelp();
    process.exit(slidesDirArg ? 0 : 1);
  }

  const slidesDir = path.resolve(slidesDirArg);
  if (!fs.existsSync(slidesDir) || !fs.statSync(slidesDir).isDirectory()) {
    throw new Error(`Slides directory not found: ${slidesDir}`);
  }

  const slideFiles = fs
    .readdirSync(slidesDir)
    .filter((fileName) => fileName.toLowerCase().endsWith(".html"))
    .filter((fileName) => fileName.toLowerCase() !== "index.html")
    .sort(naturalCompare);

  if (slideFiles.length === 0) {
    throw new Error(`No slide HTML files found in: ${slidesDir}`);
  }

  slideFiles.forEach((fileName, index) => {
    injectKeyboardNav(
      path.join(slidesDir, fileName),
      slideFiles[index - 1] ?? null,
      slideFiles[index + 1] ?? null
    );
  });

  console.log(`Injected keyboard navigation into ${slideFiles.length} slide(s).`);
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
