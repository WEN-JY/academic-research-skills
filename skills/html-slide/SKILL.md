---
name: html-slide
description: "Generate HTML-based presentation slides for academic defense and professional presentations. This skill should be used when users need to create HTML slide pages with a consistent academic design system: navy-gold header, dot-pattern background, white content cards, KPI banners, data tables, and formula blocks. Each slide is a standalone 1280x720px HTML file that can be viewed in browser or converted to PPTX via html2pptx.js."
---

# HTML Slide Presentation Generator

## Overview

Generate standalone HTML slide files (1280×720px) following an academic defense design system. Each slide is a self-contained `.html` file with embedded CSS. The design features a navy-blue/gold color scheme, dot-pattern backgrounds, white content cards with colored accents, and professional typography.

## Design System

### Theme & Color Palette

```css
:root {
  /* Primary */
  --navy:    #002952;    /* Header, headings, dark backgrounds */
  --blue:    #1a6fa8;    /* Secondary blue */
  --accent:  #2980b9;    /* Links, highlights, borders */
  /* Semantic */
  --teal:    #0097b2;    /* Category C / formulas */
  --gold:    #c8a84b;    /* KPI numbers, decorative accents, gold bar */
  --red:     #c0392b;    /* Alerts, negative values */
  --orange:  #d35400;    /* Warnings, secondary emphasis */
  --purple:  #7d3c98;    /* Category B / SGI */
  --green:   #1e8449;    /* Positive values */
  /* Neutral */
  --text:    #1a2332;    /* Primary text */
  --sub:     #4a5568;    /* Secondary text */
  --muted:   #8090a0;    /* Labels, captions */
  --border:  #dde4ee;    /* Card borders */
  --soft:    #f5f8fc;    /* Light backgrounds */
}
```

### Slide Shell

```css
.slide {
  width: 1280px; height: 720px;
  background: #eef2f7;
  background-image: radial-gradient(#d8e0eb 1px, transparent 1px);
  background-size: 22px 22px;            /* Dot pattern */
  display: flex; flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0,41,82,.2), 0 4px 16px rgba(0,0,0,.1);
  border-radius: 4px;
}
```

### Page Structure

```
.slide  1280×720px
├── .slide-header   72px  (left: navy gradient + title / right: 268px logo area)
├── .slide-body     flex:1, padding 12px 28px, gap 9px
└── .slide-footer   34px  (left: paper title / right: defense occasion)
```

### Logo

Logo file: `assets/logo.png` (230×65px, object-fit: cover)

Place in header-right area:
```html
<img class="logo" src="logo.png" alt="浙江大学工程师学院">
```

## HTML Template (Full Boilerplate)

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Slide Title</title>
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
<!-- KaTeX (optional, for math formulas) -->
<link href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css" rel="stylesheet">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/contrib/auto-render.min.js"
  onload="renderMathInElement(document.body,{delimiters:[{left:'\\[',right:'\\]',display:true},{left:'\\(',right:'\\)',display:false}]})"></script>
<style>
:root {
  --navy:#002952; --blue:#1a6fa8; --accent:#2980b9;
  --teal:#0097b2; --gold:#c8a84b; --red:#c0392b;
  --orange:#d35400; --purple:#7d3c98; --green:#1e8449;
  --text:#1a2332; --sub:#4a5568; --muted:#8090a0;
  --border:#dde4ee; --soft:#f5f8fc;
}
* { margin:0; padding:0; box-sizing:border-box; }
body {
  font-family: 'PingFang SC','Microsoft YaHei',sans-serif;
  background: #c8d0dc;
  display: flex; flex-direction: column; align-items: center;
  gap: 48px; padding: 48px 0;
}

/* ── Slide Shell ── */
.slide { width:1280px; height:720px; background:#eef2f7;
  background-image:radial-gradient(#d8e0eb 1px,transparent 1px);
  background-size:22px 22px; display:flex; flex-direction:column;
  overflow:hidden; box-shadow:0 24px 64px rgba(0,41,82,.2),0 4px 16px rgba(0,0,0,.1);
  flex-shrink:0; border-radius:4px; }

/* ── Header ── */
.slide-header { height:72px; display:flex; align-items:stretch; flex-shrink:0; overflow:hidden; }
.slide-header .header-left {
  flex:1; background:linear-gradient(105deg,var(--navy) 0%,#003d7a 55%,#005090 100%);
  color:#fff; padding:0 32px 0 38px; display:flex; align-items:center;
  position:relative; overflow:hidden;
}
.slide-header .header-left::after {
  content:''; position:absolute; bottom:0; left:0; right:0; height:3px;
  background:linear-gradient(90deg,var(--gold) 0%,rgba(200,168,75,.25) 70%,transparent 100%);
}
.slide-header .deco-ring {
  position:absolute; right:40px; top:-28px; width:110px; height:110px;
  border-radius:50%; border:18px solid rgba(255,255,255,.05); pointer-events:none;
}
.slide-header h1 { font-size:22px; font-weight:700; letter-spacing:.6px; }
.slide-header .header-right {
  width:268px; flex-shrink:0; background:#eef2f7;
  border-left:1px solid #d0dae8; display:flex; align-items:center;
  justify-content:center; padding:0 16px;
}
.slide-header .logo { width:230px; height:65px; object-fit:cover; }

/* ── Footer ── */
.slide-footer {
  height:34px; background:#e4eaf3; border-top:1px solid #d0dae8;
  display:flex; justify-content:space-between; align-items:center;
  padding:0 38px; color:var(--muted); font-size:12px; flex-shrink:0;
}

/* ── Body ── */
.slide-body {
  flex:1; padding:12px 28px; display:flex; flex-direction:column;
  gap:9px; min-height:0;
}

/* ══ PAGE-SPECIFIC CSS BELOW ══ */

</style>
</head>
<body>

<div class="slide">
  <!-- Header -->
  <div class="slide-header">
    <div class="header-left">
      <div class="deco-ring"></div>
      <h1>X.X 章节标题</h1>
    </div>
    <div class="header-right">
      <img class="logo" src="logo.png" alt="浙江大学工程师学院">
    </div>
  </div>

  <!-- Body -->
  <div class="slide-body">
    <!-- Content goes here -->
  </div>

  <!-- Footer -->
  <div class="slide-footer">
    <span>论文标题</span>
    <span>硕士研究生学位论文答辩</span>
  </div>
</div>

</body>
</html>
```

## Component Library

### 1. Intro Banner (顶部导语横条)

Navy gradient banner with icon, text, and KPI numbers. Height: 52px.

```html
<div class="intro-banner">
  <div class="intro-icon"><i class="fas fa-layer-group"></i></div>
  <div class="intro-text">
    描述文字，<strong>加粗关键词</strong>高亮显示
  </div>
  <div class="intro-kpis">
    <div class="intro-kpi">
      <div class="ik-num">0.089</div>
      <div class="ik-lbl">指标标签</div>
    </div>
    <!-- Separator: <div style="width:1px;background:rgba(255,255,255,.2);align-self:stretch;"></div> -->
  </div>
</div>
```

```css
.intro-banner { background:linear-gradient(105deg,var(--navy) 0%,#003d7a 55%,#005090 100%);
  border-radius:10px; padding:0 20px; display:flex; align-items:center; gap:20px;
  height:52px; position:relative; overflow:hidden; }
.intro-banner::before { content:''; position:absolute; top:0;left:0;right:0; height:2px;
  background:linear-gradient(90deg,var(--gold),rgba(200,168,75,.25),transparent); }
.intro-icon { width:32px;height:32px; border-radius:9px; background:rgba(200,168,75,.2);
  border:1px solid rgba(200,168,75,.4); display:flex;align-items:center;justify-content:center;
  font-size:14px; color:var(--gold); }
.intro-text { font-size:13px; color:rgba(255,255,255,.85); line-height:1.5; flex:1; }
.intro-text strong { color:#fff; font-weight:600; }
.ik-num { font-size:20px; font-weight:900; color:var(--gold); line-height:1; }
.ik-lbl { font-size:11px; color:rgba(255,255,255,.6); margin-top:2px; }
```

### 2. Finding Card (发现卡片)

White card with badge, title, body text, and metric chips. Fixed height ~108px.

```html
<div class="finding-card">
  <div class="fc-inner">
    <div class="fc-head">
      <span class="fc-badge badge-sli"><i class="fas fa-map-pin" style="font-size:10px;"></i> SLI 视角</span>
      <h4>Card Title</h4>
    </div>
    <div class="fc-body">
      Description with <strong>bold</strong> and <em>colored emphasis</em>.
    </div>
  </div>
</div>
```

Badge variants: `.badge-sli` (accent blue), `.badge-sgi` (purple), `.badge-csi` (teal)

### 3. Formula Card (公式卡片)

White card with teal left border for displaying KaTeX formulas.

```html
<div class="formula-card">
  <div class="fc-label"><i class="fas fa-superscript" style="color:var(--teal);"></i> Formula Label</div>
  <div class="formula-block">
    \[ formula \]
  </div>
  <div class="weight-note">Note text, <strong>highlighted</strong></div>
</div>
```

### 4. Data Table (数据表)

Grid-based table with column headers, data rows, and Top-3 highlighting.

```html
<div class="csi-row tbl-head">
  <div class="ch">Col1</div><div class="ch">Col2</div>...
</div>
<div class="csi-row data-row top1"><!-- gold highlight -->
  <div class="rank-num">1</div>
  <div class="risk-code">R5</div>
  <div class="risk-name">Name</div>
  <div class="csi-val">8.082</div>
  <div><div class="csi-bar-wrap"><div class="csi-bar" style="width:100%"></div></div></div>
</div>
```

Top-N classes: `.top1` (gold), `.top2` (red), `.top3` (orange)

### 5. Two-Column Layout (主体两栏)

```html
<div class="main-split">
  <div class="left-col" style="width:390px;"><!-- Left content --></div>
  <div class="right-col" style="flex:1;"><!-- Right content --></div>
</div>
```

### 6. Bento Grid Layout

```html
<div class="bento-row">
  <div class="bento-main" style="flex:1.1;"><!-- Main card with 4px accent left border --></div>
  <div class="bento-challenges" style="flex:0.65;"><!-- Stacked cards --></div>
</div>
```

### 7. Challenge Card (挑战卡)

Card with colored top bar and icon.

```html
<div class="chal-card c1"><!-- c1=teal, c2=blue, c3=purple -->
  <div class="chal-icon"><i class="fas fa-layer-group"></i></div>
  <div class="chal-text">
    <h4>Title</h4>
    <p>Description</p>
  </div>
</div>
```

### 8. Problem Card 2x2 Grid

```html
<div class="problem-cards-2x2">
  <div class="pcard">
    <div class="pcard-head">
      <div class="picon pi-blue"><i class="fas fa-server"></i></div>
      <h3>Title</h3>
    </div>
    <!-- KPI numbers, issue lists, etc. -->
  </div>
  <!-- 3 more .pcard -->
</div>
```

Icon variants: `.pi-blue`, `.pi-red`, `.pi-orange`, `.pi-purple`

### 9. Cause Banner (根因横幅)

Navy gradient banner with 3 cause items.

```html
<div class="cause-banner">
  <div class="cause-item">
    <i class="fas fa-search-minus"></i>
    <div><h4>Title</h4><p>Description</p></div>
  </div>
  <!-- more cause-items -->
</div>
```

### 10. History Table (.hist-table)

Traditional `<table>` with sticky headers, delayed-row highlighting, and evaluation badges.

```html
<table class="hist-table">
  <thead><tr><th>Col</th>...</tr></thead>
  <tbody>
    <tr><td>Normal</td>...</tr>
    <tr class="row-delayed"><td>Delayed</td><td class="td-delay-val">+6</td>...</tr>
    <tr class="row-avg"><td>Average</td>...</tr>
  </tbody>
</table>
```

Badges: `.ev-ok` (green), `.ev-good` (blue), `.ev-normal` (orange)

## Typography Rules

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Header h1 | 22px | 700 | white |
| Card title h3/h4 | 14-16px | 700 | --navy |
| Body text | 13-14px | 400 | --sub |
| KPI number | 18-20px | 800-900 | --gold / --accent |
| KPI label | 11-12px | 400 | --muted / rgba(white,.6) |
| Table data | 11-13px | 400-600 | --sub |
| Footer | 12px | 400 | --muted |
| **Minimum font size** | **11px** | | |

## Font Stack

```css
font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
```

## File Naming

- One HTML file per slide: `slide-{section}.html`
- Examples: `slide-2.html`, `slide-10A.html`, `slide-17C.html`
- Multi-slide files (for related slides): `slides_{topic}.html`

## New Slide Workflow

1. Copy the full boilerplate template above
2. Set `<title>` and header `<h1>` to match section
3. Add page-specific CSS after the `/* PAGE-SPECIFIC CSS */` comment
4. Build body content using component library
5. Update footer text if needed
6. Save as `slide-{id}.html`

## PPTX Conversion (Optional)

```javascript
const pptxgen = require('pptxgenjs');
const html2pptx = require('./.claude/skills/pptx/scripts/html2pptx.js');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_16x9';
await html2pptx('slide-2.html', pptx);
await pptx.writeFile({ fileName: 'output.pptx' });
```

## Assets

- `assets/logo.png` - University logo (230×65px)
