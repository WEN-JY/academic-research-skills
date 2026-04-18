# HTML Slide Presentation Generator

Generate standalone HTML slide files (1280×720px) for academic defense presentations. Navy-blue/gold design system with dot-pattern backgrounds, white content cards, and professional typography.

## When to Use

- User needs to create HTML presentation slides for thesis defense
- User wants new slides following the established design system
- User needs to modify or add content to existing HTML slides

## Design Tokens

```
--navy:#002952  --blue:#1a6fa8  --accent:#2980b9
--teal:#0097b2  --gold:#c8a84b  --red:#c0392b
--orange:#d35400  --purple:#7d3c98  --green:#1e8449
--sub:#4a5568  --muted:#8090a0  --border:#dde4ee  --soft:#f5f8fc
```

Font: `PingFang SC, Microsoft YaHei, sans-serif`. Min size: 11px.

## Page Structure

```
.slide 1280×720px (dot-pattern bg #eef2f7)
├── .slide-header 72px
│   ├── .header-left (navy gradient + gold bottom bar + deco-ring + h1)
│   └── .header-right 268px (logo.png 230×65)
├── .slide-body flex:1, padding 12px 28px, gap 9px
└── .slide-footer 34px (#e4eaf3, paper title / defense occasion)
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

1. Copy boilerplate (see SKILL.md for full template)
2. Set header h1 + page title
3. Add page-specific CSS
4. Build body from component library
5. Save as `slide-{id}.html`

## Assets

- `assets/logo.png` - University logo (230×65px)

## CDN Dependencies (in `<head>`)

- Font Awesome 6.4.0 (icons)
- KaTeX 0.16.10 (optional, for math)
