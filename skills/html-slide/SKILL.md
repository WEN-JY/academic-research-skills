---
name: html-slide
description: "Generate HTML-based presentation slides for academic defense and professional presentations. This skill should be used when users need to create HTML slide pages with a consistent academic design system: navy-gold header, dot-pattern background, white content cards, KPI banners, data tables, and formula blocks. Each slide is a standalone 1280x720px HTML file that can be viewed in browser or converted to PPTX via html2pptx.js."
---

# HTML Slide Presentation Generator

## Overview

Generate standalone HTML slide files (1280×720px) following an academic defense design system. Each slide is a self-contained `.html` file with embedded CSS. The design features a navy-blue/gold color scheme, deep-blue keynote-style covers, full-height header logos, large white content cards, and professional typography.

## Mandatory Generation Workflow

Support two entry modes:

- **No outline provided** — first create a slide-level content plan, present the page-by-page outline to the user for confirmation, save the confirmed outline, then generate HTML, then validate the rendered page.
- **Outline already provided** — if the user already provides a page-by-page `slide-outline`, `slides/大纲.md`, or an equivalent slide plan, skip outline planning and confirmation, normalize the outline if needed, then generate HTML directly from that outline and validate the rendered page.

1. **Content Planning Layer** — convert Markdown into a `slide-outline` when the user has not already provided one.
2. **User Confirmation Layer** — present the outline slide by slide and get user confirmation or revision requests when the outline is newly created from source material.
3. **Outline Persistence Layer** — save the confirmed or user-provided outline to `slides/大纲.md`.
4. **Deck Rhythm Layer** — plan page-to-page pacing so the deck alternates visual structures and does not overuse one layout skeleton.
5. **Layout Decision Layer** — choose page types and visual structure using the confirmed or user-provided outline, with a visual-first bias.
6. **Visual Generation Layer** — apply the selected visual mode and component system, prioritizing diagrams over text-heavy cards.
7. **Acceptance Layer** — validate typography, density, visual richness, overload risk, and deck-level rhythm before delivery.

Output policy:

- Generate **one HTML file per slide** by default.
- Put all slide pages under a `slides/` directory.
- Save the confirmed or user-provided page-by-page outline to `slides/大纲.md` before HTML generation.
- Copy deck assets into `slides/assets/`, especially the required logo file at `slides/assets/logo.png`.
- Do not put the whole deck into one giant HTML file unless the user explicitly requests a single-file deck.
- Add keyboard-only page switching after slide generation. Do **not** add visible navigation buttons or navigation overlays.
- When the user already has a usable outline, do not force a second outline-planning round before slide generation.

### 1. Content Planning Layer

For Markdown-based decks, first produce a `slide-outline` and use it as the source of truth:

```yaml
- title: "Page title"
  core_argument: "The main argument or message this slide should communicate"
  points:
    - "Support point or explanation"
    - "Support point or explanation"
  evidence:
    type: "timeline | metric | comparison | quote | case | checklist | table | diagram | mixed"
    note: "How the chart, visual, data, case, or argument supports the core argument"
  visual_type: "cover | agenda | section | single-insight | timeline | comparison | checklist | q-and-a | closing"
  split_if_needed: true
```

Rules:

- Most content slides must have a clear **core argument** or communication purpose.
- Cover, section, agenda, Q&A transition, closing, and thank-you slides do not need a formal core argument as long as the page purpose is clear.
- Pair the core argument with suitable evidence: chart, metric, timeline, case, comparison, quote, diagram, or structured reasoning.
- Prefer **diagram-first expression**: if the idea contains process, causality, sequence, or hierarchy, convert it into a visual structure before adding supporting text.
- Support points are flexible; use as many as the layout can carry clearly, but keep hierarchy obvious.
- Multiple evidence forms are allowed when they serve the same core argument and do not compete for visual focus.
- Do not mix timeline + KPI + table + checklist on the same slide unless their relationship is clear and one visual hierarchy dominates.
- If the source content contains narrative and analysis at the same time, split it into separate story and insight slides.
- Keep text concise. Most content slides should retain only title, takeaway, labels, and short annotations rather than paragraph-style explanation.

### 1.5 User Confirmation Layer

Before generating any HTML:

- If the outline is newly generated from source material, output it to the user **page by page**.
- Ask the user to confirm the generated outline or request changes.
- Revise the generated outline until the user is satisfied.
- Do not start HTML generation before the generated outline is confirmed, unless the user explicitly asks to skip confirmation.
- If the user already provides a page-by-page outline, treat it as confirmed input unless the user asks for optimization or restructuring.

Recommended outline display format:

```markdown
# 幻灯片大纲

## 第1页
- 标题：
- 核心论点：
- 内容要点：
- 证据/图表：
- 版式建议：

## 第2页
- 标题：
- 核心论点：
- 内容要点：
- 证据/图表：
- 版式建议：
```

### 1.6 Outline Persistence Layer

After user confirmation:

- Create the `slides/` directory if needed.
- Save the final confirmed outline or the normalized user-provided outline to `slides/大纲.md`.
- Treat `slides/大纲.md` as the deck blueprint.
- Generate all HTML slides from `slides/大纲.md`, not from the original long Markdown directly.

When the user already has an outline:

- Accept `slides/大纲.md`, pasted Markdown, YAML, or a page-by-page structured list as the source of truth.
- Normalize field names if needed, but keep the original page order and intent.
- Only ask for clarification if the outline lacks the minimum information required to distinguish slide boundaries or page purpose.

### 2. Split Rules

Split the source content into multiple slides when any of the following is true:

- Multiple core arguments compete with each other.
- Support points cannot be grouped into a clear hierarchy.
- Evidence forms compete for attention rather than supporting the same argument.
- A table has more than 4 rows or 4 columns.
- A timeline has more than 6 nodes.
- A checklist has more than 6 items.
- Main body text becomes dense enough that the slide would need small fonts or crowded spacing.
- The slide tries to both tell a personal story and make a structured comparison.

When splitting, optimize for **single-slide clarity**, not for fewer pages.

### 2.5 Visual-First Mapping Rules

When choosing how to express content, prefer the following mappings:

- **Process / method / workflow / implementation sequence** → `process-flow`
- **Causal chain / mechanism / research framework / decision path** → `logic-map`
- **Stage evolution / milestones / chronological progression** → `timeline-sequence`
- **Architecture / system composition / hierarchy / layered modules** → `structure-diagram`
- **Before-after / alternatives / trade-offs / stage comparison** → `comparison-matrix`
- **One key chart and one takeaway** → `one-chart-one-message`

Do not default to text cards when a diagram would communicate the structure more clearly.

### 3. Page Type Selection

Use page types deliberately:

| Page Type | Best For | Avoid |
|-----------|----------|-------|
| Cover | Opening, chapter title, major transition | Dense body text |
| Agenda | 4–8 modules with short labels | 10+ detailed items |
| Section | Chapter transition and mental reset | Tables or long lists |
| Single Insight | One strong claim with 2–3 proofs | Multiple unrelated claims |
| Timeline | Process, milestones, journey | More than 6 nodes |
| Comparison | Before/after, stages, alternatives | Long paragraph cells |
| Checklist | Action items, pitfalls, review criteria | More than 6 items |
| Q&A | Defense preparation and likely questions | Long answer paragraphs |
| Closing | Summary, final call-to-action | New arguments |

Preferred advanced page types for stronger expression:

| Page Type | Best For | Key Principle |
|-----------|----------|---------------|
| Process Flow | Workflow, method, implementation path | Arrows and sequence dominate; text becomes labels |
| Logic Map | Mechanism, causal chain, analytical framework | Nodes + relationships dominate; keep prose minimal |
| Timeline Sequence | Stage evolution, milestones, roadmap | Time order is primary; 3–6 nodes preferred |
| Structure Diagram | Architecture, layered system, module hierarchy | Show containment and levels before explanation |
| Comparison Matrix | Scheme trade-offs, stage contrast, before/after | Use a matrix, not repeated paragraph cards |
| One Chart One Message | One key figure plus one takeaway | Let the visual own most of the slide |

### 3.5 Deck Rhythm Rules

- Do not let 3 consecutive slides share the same main skeleton.
- Adjacent slides should differ in at least one of: dominant visual form, information structure, or evidence type.
- Diagram-centric pages should appear regularly across the deck, not just once or twice.
- Avoid using `hero + banner + two-column cards` as the default for most content slides.
- Treat deck-level rhythm as part of quality, not a cosmetic extra.

## Recommended V2 Templates

Use these templates first for new academic-defense or professional-sharing decks. They are more spacious and formal than the legacy component library.

| Template | Use | File |
|----------|-----|------|
| V2 Grand Cover | Opening slide / section title with strong visual presence | `templates/v2-cover-grand.html` |
| V2 Grand Content | Main content slide with full-height top-right logo, hero summary, main card, side panel, and bottom metrics | `templates/v2-content-grand.html` |

### V2 Design Principles

- **One visual center per slide** — use a strong cover title, hero insight, or main argument as the dominant focus.
- **Deep blue + restrained gold** — keep gold for title highlights, key numbers, dividers, and status accents only.
- **Fewer borders, stronger layering** — prefer soft shadows, glass panels, and large white cards over many thin bordered boxes.
- **Larger hierarchy gaps** — use 27–56px display titles, 18–21px lead text, and 14–15px body text.
- **Full-height logo header** — on V2 content slides, the top-right logo block must be the same height as the header and aligned to the top-right corner.

## Visual Modes

### Academic Defense Mode

Use this mode for thesis defense, research reporting, and formal academic presentations. Keep the design calm, precise, and institutionally credible.

### Tech Share Mode

Use `tech-share` for experience-sharing decks, AI workflow talks, product thinking, engineering practice, or any presentation where the user asks for a more technological / futuristic look.

Style direction:

- Use deep navy, cyan-blue, and restrained purple gradients.
- Add glassmorphism panels, subtle glow, fine grid or HUD-style decorative lines.
- Use metric strips, status chips, data badges, and illuminated timeline nodes.
- Prefer layered backgrounds: background layer + content layer + decorative technology layer.
- Avoid exaggerated cyberpunk neon; keep it as **academic technology premium**, not game UI.

Every `tech-share` slide should include:

- One clear core argument or communication purpose.
- A dominant visual module.
- Supporting evidence or argumentation that reinforces the core argument.
- One visual enhancement layer, such as glow grid, data chips, gradient rings, or HUD dividers.

Avoid plain white-card-only pages in `tech-share` mode.

### V2 Header Logo Rule

```css
.topbar { height:86px; padding:0 0 0 58px; position:relative; }
.chapter { padding-right:300px; }
.topbar-logo {
  position:absolute; top:0; right:0;
  width:268px; height:86px;
  background:rgba(255,255,255,.96);
  display:flex; align-items:center; justify-content:center;
}
.topbar-logo img {
  width:100%; height:100%;
  object-fit:contain; object-position:center;
  padding:0 14px; border-radius:0;
}
```

```html
<div class="topbar-logo">
  <img src="assets/logo.png" alt="浙江大学工程师学院">
</div>
```

## Design System

### Theme & Color Palette

```css
:root {
  /* Primary */
  --navy:    #003366;    /* Header, headings, dark backgrounds */
  --blue:    #004488;    /* Secondary blue */
  --accent:  #3498db;    /* Links, highlights, borders */
  /* Semantic */
  --teal:    #0abde3;    /* Category C / formulas */
  --gold:    #7fb3d5;    /* Decorative highlight, soft blue accent */
  --red:     #c0392b;    /* Alerts, negative values */
  --orange:  #e67e22;    /* Warnings, secondary emphasis */
  --purple:  #6c5ce7;    /* Category B / SGI */
  --green:   #27ae60;    /* Positive values */
  /* Neutral */
  --text:    #1f2937;    /* Primary text */
  --sub:     #5b6472;    /* Secondary text */
  --muted:   #8a94a6;    /* Labels, captions */
  --border:  #d8e2ee;    /* Card borders */
  --soft:    #f4f6f9;    /* Light backgrounds */
}
```

### Slide Shell

```css
.slide {
  width: 1280px; height: 720px;
  background: #ffffff;
  background-image: radial-gradient(#e0e0e0 1px, transparent 1px);
  background-size: 20px 20px;            /* Dot pattern */
  display: flex; flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,.15);
}
```

The outermost `.slide` container should **not** use rounded corners. Keep the slide edge rectangular; rounded corners are allowed only for internal cards, chips, and panels.

### Page Structure

```
.slide  1280×720px
├── .slide-header   72px  (left: navy gradient + title / right: 268px logo area)
├── .slide-body     flex:1, padding 12px 28px, gap 9px
└── .slide-footer   34px  (left: paper title / right: defense occasion)
```

### Logo

Logo file inside the generated deck: `slides/assets/logo.png` (230×65px, object-fit: cover)

**The logo is mandatory on every content slide.** Place it in the header-right area:
```html
<img class="logo" src="assets/logo.png" alt="浙江大学工程师学院">
```

> **Deck asset rule:** when outputting a slide deck, always copy the bundled logo into `slides/assets/logo.png`, then reference it from every slide with `src="assets/logo.png"`. Do not rely on assets outside the `slides/` directory.

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
  --navy:#003366; --blue:#004488; --accent:#3498db;
  --teal:#0abde3; --gold:#7fb3d5; --red:#c0392b;
  --orange:#e67e22; --purple:#6c5ce7; --green:#27ae60;
  --text:#1f2937; --sub:#5b6472; --muted:#8a94a6;
  --border:#d8e2ee; --soft:#f4f6f9;
}
* { margin:0; padding:0; box-sizing:border-box; }
body {
  font-family: 'PingFang SC','Microsoft YaHei',sans-serif;
  background: #dcdcdc;
  display: flex; flex-direction: column; align-items: center;
  gap: 48px; padding: 48px 0;
}

/* ── Slide Shell ── */
.slide { width:1280px; height:720px; background:#fff;
  background-image:radial-gradient(#e0e0e0 1px,transparent 1px);
  background-size:20px 20px; display:flex; flex-direction:column;
  overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,.15);
  flex-shrink:0; }

/* ── Header ── */
.slide-header { height:72px; display:flex; align-items:stretch; flex-shrink:0; overflow:hidden; }
.slide-header .header-left {
  flex:1; background:linear-gradient(90deg,var(--navy) 0%,var(--blue) 100%);
  color:#fff; padding:0 32px 0 38px; display:flex; align-items:center;
  position:relative; overflow:hidden;
}
.slide-header .header-left::after {
  content:''; position:absolute; bottom:0; left:0; right:0; height:3px;
  background:linear-gradient(90deg,var(--accent) 0%,rgba(52,152,219,.2) 72%,transparent 100%);
}
.slide-header .deco-ring {
  position:absolute; right:40px; top:-28px; width:110px; height:110px;
  border-radius:50%; border:18px solid rgba(255,255,255,.05); pointer-events:none;
}
.slide-header h1 { font-size:22px; font-weight:700; letter-spacing:.6px; }
.slide-header .header-right {
  width:268px; flex-shrink:0; background:#fff;
  border-left:1px solid var(--border); display:flex; align-items:center;
  justify-content:center; padding:0 16px;
}
.slide-header .logo { width:230px; height:65px; object-fit:contain; }

/* ── Footer ── */
.slide-footer {
  height:34px; background:var(--soft); border-top:1px solid var(--border);
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
      <!-- REQUIRED: logo must always be present; adjust src path as needed -->
      <img class="logo" src="assets/logo.png" alt="浙江大学工程师学院">
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
.intro-banner { background:linear-gradient(90deg,var(--navy) 0%,var(--blue) 100%);
  border-radius:10px; padding:0 20px; display:flex; align-items:center; gap:20px;
  height:52px; position:relative; overflow:hidden; }
.intro-banner::before { content:''; position:absolute; top:0;left:0;right:0; height:2px;
  background:linear-gradient(90deg,var(--accent),rgba(52,152,219,.2),transparent); }
.intro-icon { width:32px;height:32px; border-radius:9px; background:rgba(52,152,219,.18);
  border:1px solid rgba(52,152,219,.35); display:flex;align-items:center;justify-content:center;
  font-size:14px; color:var(--accent); }
.intro-text { font-size:13px; color:rgba(255,255,255,.85); line-height:1.5; flex:1; }
.intro-text strong { color:#fff; font-weight:600; }
.ik-num { font-size:20px; font-weight:900; color:#8fd3ff; line-height:1; }
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

### 11. Diagram-First Patterns

The following patterns should be preferred when appropriate:

- **Flow diagrams** — for process, operation sequence, method path, governance procedure, or implementation steps
- **Logic diagrams** — for cause-effect, hypothesis structure, mechanism explanation, analytical framework, or influence path
- **Timeline diagrams** — for phased development, research evolution, historical sequence, milestones, or scenario progression
- **Structure diagrams** — for systems, modules, layers, organizations, architecture, or decomposition

Use text only as labels, short callouts, or annotations around the diagram. Do not let the diagram become a small decoration under a large text block.

## Typography Rules

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Header h1 | 22-28px | 700 | white |
| Hero / takeaway | 27-40px | 800-900 | --navy / white |
| Card title h3/h4 | 18-22px | 700-800 | --navy |
| Body text | 14-16px | 400 | --sub |
| KPI number | 20-24px | 800-900 | --gold / --accent |
| KPI label | 12-13px | 400 | --muted / rgba(white,.6) |
| Table header | 13-14px | 600 | --navy |
| Table data | 14-15px | 400-600 | --sub |
| Footer | 12px | 400 | --muted |
| **Minimum font size** | **14px** (body/card), **12px** (footer/label) | | |

## Style Constraints

- **No emoji** — Never use emoji in slides. Use Font Awesome icons (`<i class="fas fa-xxx">`) for all iconography.
- **No card border decoration** — Cards should NOT use colored `border` or `border-left` for decoration (looks dated). Use subtle `box-shadow` or background tinting instead. Exception: the header accent bar (`::after`).
- **Minimum font size** — Body text, card content, table data, and list content must be ≥ 14px. Only footer, badges, decorative labels, axis labels, and auxiliary metadata may go down to 12px.
- **No direct Markdown dumping** — Do not paste long Markdown paragraphs into cards. Convert them into a core argument, support structure, and matching chart/evidence first.
- **Visual first** — For process, logic, timing, and structure content, prioritize diagrams over dense text cards.
- **Less text** — Most content slides should avoid paragraph blocks. Keep wording to short labels, takeaways, and compact supporting notes.
- **Avoid repetitive skeletons** — Do not let most content slides reuse the same `hero + banner + two-column cards` pattern.
- **No overloaded slides** — Avoid combining more than 3 main information modules on one page.
- **No empty slides** — The body should feel intentionally filled through content, hierarchy, and visual layers; do not leave large blank regions unless they support a strong visual center.

## Acceptance Checks

Run acceptance checks after generating or modifying slides. A slide should not be considered complete until it passes typography, density, and visual-quality checks.

### Hard Checks

- **Typography**: body/card/list/table text must be at least 14px in computed browser rendering.
- **Core argument**: most content slides should contain a clear argument, message, or communication purpose.
- **Page-type exception**: cover, section, agenda, Q&A transition, closing, and thank-you slides may omit a formal core argument if the page purpose is visually obvious.
- **Density**: the main body must contain enough visible content and visual structure; avoid sparse pages with one small card floating in empty space.
- **Overload**: a slide with table + checklist + KPI + long note is overloaded and should be split.
- **Logo**: every content slide must include the required logo.
- **Visual priority**: pages describing process, mechanism, sequence, or hierarchy should use diagrams as the dominant visual form.
- **Deck rhythm**: repeating the same main skeleton across 3 consecutive slides fails deck-level review.
- **Text control**: long paragraph-style explanation on content slides fails review unless the page is explicitly a quote or narrative transition page.
- **Primary visual center**: every slide should have one obvious dominant visual module.

### Recommended Thresholds

| Check | Target |
|-------|--------|
| Body minimum font | ≥ 14px |
| Auxiliary minimum font | ≥ 12px |
| Main modules per slide | 2–4 |
| Core argument | clear and visually emphasized on most content slides |
| Support points | enough to support the argument without crowding |
| Evidence | chart/data/case/logic must support the argument |
| Timeline nodes | ≤ 6 |
| Checklist items | ≤ 6 |
| Table size | ≤ 4 rows × 4 columns, otherwise split or convert to cards |
| Consecutive same skeleton | ≤ 2 |
| Diagram-oriented content ratio | high for process / logic / sequence / structure slides |

### Validation Script

Use the bundled validator for computed font-size and approximate visual density checks:

```bash
node scripts/validate-html-slide.mjs slides/slide-01.html slides/slide-02.html
```

Options:

```bash
node scripts/validate-html-slide.mjs slides.html --min-body-font 14 --min-density 0.32 --max-density 0.88
```

The script uses Playwright when available, because font size must be checked from computed browser styles rather than raw CSS text. Footer, badges, chips, labels, and metadata are treated as auxiliary text and may use 12–13px.

### Keyboard Page Switching Script

After generating individual slide HTML files, inject keyboard-only page switching:

```bash
node scripts/add-slide-keyboard-nav.mjs slides
```

This script:

- Scans `slides/*.html`.
- Sorts files naturally (`slide-01.html`, `slide-02.html`, ...).
- Adds no visible navigation elements.
- Enables keyboard navigation: `Enter` and `ArrowDown` go next; `ArrowUp` goes previous.
- Keeps every slide as an independent HTML page.

### Asset Copy Script

Before delivery, copy the bundled logo into the generated `slides/` directory:

```bash
node scripts/copy-slide-assets.mjs slides
```

This script:

- Creates `slides/assets/` when needed.
- Copies the bundled skill logo to `slides/assets/logo.png`.
- Ensures generated slides can travel as a self-contained folder.

## Font Stack

```css
font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
```

## File Naming

- Deck output directory: `slides/`
- Deck outline file: `slides/大纲.md`
- Deck asset directory: `slides/assets/`
- One HTML file per slide: `slides/slide-{nn}.html`
- Use zero-padded numbering: `slide-01.html`, `slide-02.html`, `slide-03.html`
- Optional chapter suffix: `slide-03-plan.html`, `slide-04-review.html`
- Do not create `slides_{topic}.html` multi-slide bundles unless explicitly requested.

## New Slide Workflow

### Route A: source material without outline

1. Create `slide-outline` from source Markdown.
2. Present the outline page by page to the user and revise it until confirmed.
3. Save the confirmed outline to `slides/大纲.md`.
4. Apply split rules and choose page types from `slides/大纲.md`.
5. Plan deck rhythm so adjacent slides do not overuse the same skeleton.
6. Choose visual mode: `academic-defense` or `tech-share`.
7. Prefer process-flow / logic-map / timeline-sequence / structure-diagram layouts before defaulting to card-heavy layouts.
8. Copy the full boilerplate template above or V2 template.
9. Set `<title>` and header `<h1>` to match the planned page.
10. Add page-specific CSS after the `/* PAGE-SPECIFIC CSS */` comment.
11. Build body content using component library and visual-mode rules, keeping text concise.
12. Run acceptance checks, especially typography, density, diagram use, and deck rhythm.
13. Save each page as `slides/slide-{nn}.html`.
14. Run `node scripts/copy-slide-assets.mjs slides` to copy `slides/assets/logo.png`.
15. Run `node scripts/add-slide-keyboard-nav.mjs slides` to add keyboard-only page switching.

### Route B: existing outline provided by user

1. Read the user-provided outline or `slides/大纲.md`.
2. Normalize the outline into the expected page-by-page structure if needed.
3. Save the normalized outline to `slides/大纲.md` when it is not already there.
4. Apply split rules only when a page is obviously overloaded or the user asks for restructuring.
5. Plan deck rhythm so adjacent slides do not overuse the same skeleton.
6. Choose visual mode: `academic-defense` or `tech-share`.
7. Prefer process-flow / logic-map / timeline-sequence / structure-diagram layouts before defaulting to card-heavy layouts.
8. Copy the full boilerplate template above or V2 template.
9. Set `<title>` and header `<h1>` to match each outline page.
10. Add page-specific CSS after the `/* PAGE-SPECIFIC CSS */` comment.
11. Build body content from the provided outline page by page, keeping text concise.
12. Run acceptance checks, especially typography, density, diagram use, and deck rhythm.
13. Save each page as `slides/slide-{nn}.html`.
14. Run `node scripts/copy-slide-assets.mjs slides` to copy `slides/assets/logo.png`.
15. Run `node scripts/add-slide-keyboard-nav.mjs slides` to add keyboard-only page switching.

## PPTX Conversion (Optional)

If the user already provides an outline and asks for PPTX, follow **Route B** to generate the slide HTML files first, then convert the generated HTML slides to PPTX. Do not force a new outline-planning round before conversion.

```javascript
const pptxgen = require('pptxgenjs');
const html2pptx = require('./.claude/skills/pptx/scripts/html2pptx.js');

const pptx = new pptxgen();
pptx.layout = 'LAYOUT_16x9';
await html2pptx('slide-2.html', pptx);
await pptx.writeFile({ fileName: 'output.pptx' });
```

## Assets

- Bundled source logo: `assets/logo.png`
- Generated deck logo: `slides/assets/logo.png`
