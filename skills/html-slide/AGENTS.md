# HTML Slide Presentation Generator

Generate standalone HTML slide files (1280×720px) for academic defense and professional sharing presentations. Prefer the V2 grand templates for new decks: deep-blue/gold keynote-style covers, full-height top-right logos, large white cards, and professional typography.

## When to Use

- User needs to create HTML presentation slides for thesis defense
- User needs professional experience-sharing slides with stronger technology / future feeling
- User wants new slides following the established design system
- User needs to modify or add content to existing HTML slides

## Mandatory Workflow

Support two workflows:

- If the user does **not** provide an outline, first create a `slide-outline`, then show the outline page by page to the user for confirmation, save the confirmed outline to `slides/大纲.md`, then generate HTML, then run acceptance checks.
- If the user **already provides** a page-by-page outline, `slides/大纲.md`, or equivalent structured slide plan, skip the planning stage, normalize and save that outline to `slides/大纲.md`, then generate HTML directly and run acceptance checks.

Output one HTML file per slide by default. Put all slide pages in `slides/` using names like `slide-01.html`, `slide-02.html`, etc. Also copy the logo into `slides/assets/logo.png` so the deck is self-contained. Do not create one giant multi-slide HTML file unless the user explicitly asks for single-file output.

Do not add visible navigation buttons or navigation overlays. Add only keyboard page switching: `Enter` / `ArrowDown` for next slide, `ArrowUp` for previous slide.

Each planned slide should have:

- One title
- For most content slides, one clear core argument or communication purpose
- Support points arranged with clear hierarchy
- Matching chart, visual, case, data, or reasoning that supports the core argument

Cover, section, agenda, Q&A transition, closing, and thank-you slides do not need a formal core argument if the page purpose is already clear.

Split content when multiple core arguments compete, support points become crowded, different evidence forms compete for attention, timeline/checklist items exceed six, or a table is larger than 4×4.

Before generating HTML, output the outline to the user page by page and get confirmation when the outline is newly generated from source material. If the user already provides a usable outline, treat it as the source of truth unless the user asks for restructuring. In both cases, write the working outline to `slides/大纲.md` and generate slides from `slides/大纲.md` rather than directly from the source Markdown.

## Visual Modes

- `academic-defense`: formal, calm, thesis/report oriented.
- `tech-share`: technology/future feeling for AI workflow, engineering practice, and experience-sharing decks. Use deep navy/cyan/purple gradients, glass panels, subtle glow, HUD lines, metric strips, and illuminated timeline nodes. Keep it premium and academic, not exaggerated cyberpunk.

## Design Tokens

```
--navy:#003366  --blue:#004488  --accent:#3498db
--teal:#0abde3  --gold:#7fb3d5  --red:#c0392b
--orange:#e67e22  --purple:#6c5ce7  --green:#27ae60
--sub:#5b6472  --muted:#8a94a6  --border:#d8e2ee  --soft:#f4f6f9
```

Font: `PingFang SC, Microsoft YaHei, sans-serif`. Body/card/list/table text must be at least 14px. Footer, badges, metadata, and decorative labels may use 12–13px.

The outermost `.slide` container must not have rounded corners. Keep only internal cards and panels rounded.

## Recommended V2 Templates

| Template | Use | File |
|-----------|-----|------|
| V2 Grand Cover | Opening / section-title slide | `templates/v2-cover-grand.html` |
| V2 Grand Content | Main content slide with full-height top-right logo | `templates/v2-content-grand.html` |

V2 content headers use an 86px topbar. The logo block is mandatory, `268px × 86px`, positioned at `top:0; right:0;`, and the image fills the block with `object-fit:contain`.

## Page Structure

```
.slide 1280×720px (dot-pattern bg #ffffff)
├── .slide-header 72px
│   ├── .header-left (navy→blue gradient + accent bottom bar + deco-ring + h1)
│   └── .header-right 268px (`assets/logo.png` 230×65)
├── .slide-body flex:1, padding 12px 28px, gap 9px
└── .slide-footer 34px (#f4f6f9, paper title / defense occasion)
```

## Component Quick Reference

| Component | Use | Key Classes |
|-----------|-----|-------------|
| Intro Banner | Page intro + KPI numbers | `.intro-banner`, `.intro-kpi`, `.ik-num` |
| Finding Card | Key findings with badge | `.finding-card`, `.fc-badge`, `.badge-sli/.badge-sgi` |
| Formula Card | KaTeX math display | `.formula-card` (teal left border) |
| Data Table | Grid rows with Top-N | `.csi-row`, `.top1/.top2/.top3`, `.csi-bar` |
| History Table | Traditional `<table>` | `.hist-table`, `.row-delayed`, `.ev-badge` |
| Two-Column | Main split layout | `.main-split`, `.left-col`, `.right-col` |
| Bento Grid | Card grid layout | `.bento-row`, `.bento-main` (accent left border) |
| Challenge Card | Icon + colored top bar | `.chal-card .c1/.c2/.c3` |
| Problem 2×2 | Four-quadrant issues | `.problem-cards-2x2`, `.pcard`, `.pi-blue/.pi-red` |
| Cause Banner | Navy root-cause strip | `.cause-banner`, `.cause-item` |

## New Slide Steps

1. If needed, create `slide-outline`
2. If needed, output the outline page by page and confirm it with the user
3. Save the confirmed or user-provided outline to `slides/大纲.md`
4. Apply split rules and select page types
5. Choose `academic-defense` or `tech-share`
6. Build body from component library
7. Run acceptance checks
8. Save each page as `slides/slide-{nn}.html`
9. Run `node scripts/copy-slide-assets.mjs slides` to copy `slides/assets/logo.png`
10. Run `node scripts/add-slide-keyboard-nav.mjs slides` to add keyboard-only page switching

## Acceptance Checks

- Body/card/list/table text below 14px fails validation.
- Sparse slides fail density review; fill pages with content hierarchy and visual layers rather than plain empty space.
- Overloaded slides fail review; split pages instead of combining table + checklist + KPI + long note.
- Use `node scripts/validate-html-slide.mjs path/to/slides.html` for computed font-size and approximate density checks.
- Slides must reference the bundled deck logo with `src="assets/logo.png"`.
- Use `node scripts/add-slide-keyboard-nav.mjs slides` after generation so every slide supports `Enter` / `ArrowDown` next and `ArrowUp` previous.

## Assets

- `assets/logo.png` - University logo (230×65px)

## CDN Dependencies (in `<head>`)

- Font Awesome 6.4.0 (icons)
- KaTeX 0.16.10 (optional, for math)
