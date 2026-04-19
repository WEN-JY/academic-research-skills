# markdown-to-word

Convert Markdown academic writing into Word documents. The current default output profile is tuned for the common body-text requirements of the Zhejiang University Master of Engineering Management thesis format.

## Default Formatting Baseline

- Body text: 12pt, FangSong, first-line indent of 2 characters
- Paragraphs: 1.5 line spacing, justified
- Chapter title: 15pt, FangSong, bold
- Section title: 14pt, FangSong, bold
- Third-level title: 12pt, FangSong
- Tables: three-line table style by default
- English text and digits: `Times New Roman`

## Typical Use Cases

- Convert Markdown thesis chapters into editable Word drafts
- Produce a Word draft aligned with Zhejiang University engineering-management thesis body formatting
- Preserve formulas, tables, and images during chapter export

## CLI

```bash
skills/markdown-to-word/convert_md_to_docx.sh [-o output.docx] input.md
```
