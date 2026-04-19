#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SKILL_ROOT = path.resolve(__dirname, "..");
const SOURCE_LOGO = path.join(SKILL_ROOT, "assets", "logo.png");

function printHelp() {
  console.log(`Usage:
  node scripts/copy-slide-assets.mjs slides

Copies bundled skill assets into the generated deck:
  slides/assets/logo.png
`);
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function main() {
  const [slidesDirArg] = process.argv.slice(2);
  if (!slidesDirArg || slidesDirArg === "--help" || slidesDirArg === "-h") {
    printHelp();
    process.exit(slidesDirArg ? 0 : 1);
  }

  if (!fs.existsSync(SOURCE_LOGO)) {
    throw new Error(`Bundled logo not found: ${SOURCE_LOGO}`);
  }

  const slidesDir = path.resolve(slidesDirArg);
  if (!fs.existsSync(slidesDir) || !fs.statSync(slidesDir).isDirectory()) {
    throw new Error(`Slides directory not found: ${slidesDir}`);
  }

  const assetsDir = path.join(slidesDir, "assets");
  const targetLogo = path.join(assetsDir, "logo.png");

  ensureDirectory(assetsDir);
  fs.copyFileSync(SOURCE_LOGO, targetLogo);

  console.log(`Copied logo to ${targetLogo}`);
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
