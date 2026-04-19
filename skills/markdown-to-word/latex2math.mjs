/**
 * LaTeX math → docx Math objects converter.
 * Handles: fractions, super/subscripts, sum/product, radicals,
 * delimiters (\left \right), accents (\bar \hat), Greek letters, operators.
 */
import {
  Math as DocxMath, MathRun, MathFraction, MathSuperScript, MathSubScript,
  MathSubSuperScript, MathRadical, MathRoundBrackets, MathSquareBrackets,
} from 'docx';

// ── Symbol table ──
const SYMBOLS = {
  '\\alpha':'α','\\beta':'β','\\gamma':'γ','\\delta':'δ','\\epsilon':'ε',
  '\\varepsilon':'ε','\\zeta':'ζ','\\eta':'η','\\theta':'θ','\\vartheta':'ϑ',
  '\\iota':'ι','\\kappa':'κ','\\lambda':'λ','\\mu':'μ','\\nu':'ν',
  '\\xi':'ξ','\\pi':'π','\\rho':'ρ','\\sigma':'σ','\\tau':'τ',
  '\\upsilon':'υ','\\phi':'φ','\\varphi':'φ','\\chi':'χ','\\psi':'ψ','\\omega':'ω',
  '\\Gamma':'Γ','\\Delta':'Δ','\\Theta':'Θ','\\Lambda':'Λ','\\Xi':'Ξ',
  '\\Pi':'Π','\\Sigma':'Σ','\\Phi':'Φ','\\Psi':'Ψ','\\Omega':'Ω',
  '\\times':'×','\\cdot':'⋅','\\div':'÷','\\pm':'±','\\mp':'∓',
  '\\le':'≤','\\leq':'≤','\\ge':'≥','\\geq':'≥','\\ne':'≠','\\neq':'≠',
  '\\approx':'≈','\\equiv':'≡','\\sim':'∼','\\propto':'∝',
  '\\in':'∈','\\notin':'∉','\\subset':'⊂','\\supset':'⊃',
  '\\subseteq':'⊆','\\supseteq':'⊇','\\cup':'∪','\\cap':'∩',
  '\\infty':'∞','\\partial':'∂','\\nabla':'∇','\\forall':'∀','\\exists':'∃',
  '\\to':'→','\\rightarrow':'→','\\leftarrow':'←','\\leftrightarrow':'↔',
  '\\Rightarrow':'⇒','\\Leftarrow':'⇐','\\Leftrightarrow':'⇔',
  '\\ldots':'…','\\cdots':'⋯','\\vdots':'⋮','\\ddots':'⋱',
  '\\quad':'  ','\\qquad':'    ','\\,':' ','\\;':' ','\\:':' ','\\!':'',
  '\\space':' ',
};

// ── Tokenizer ──
function tokenize(latex) {
  const tokens = [];
  let i = 0;
  while (i < latex.length) {
    const ch = latex[i];
    if (ch === '\\') {
      let cmd = '\\';
      i++;
      if (i < latex.length && /[a-zA-Z]/.test(latex[i])) {
        while (i < latex.length && /[a-zA-Z]/.test(latex[i])) cmd += latex[i++];
      } else if (i < latex.length) {
        cmd += latex[i++];
      }
      tokens.push({ type: 'CMD', value: cmd });
    } else if (ch === '{') { tokens.push({ type: 'LBRACE' }); i++; }
    else if (ch === '}') { tokens.push({ type: 'RBRACE' }); i++; }
    else if (ch === '^') { tokens.push({ type: 'CARET' }); i++; }
    else if (ch === '_') { tokens.push({ type: 'UNDER' }); i++; }
    else if (/\s/.test(ch)) { i++; } // skip whitespace (math mode)
    else { tokens.push({ type: 'CHAR', value: ch }); i++; }
  }
  return tokens;
}

// ── Parser → AST ──
class Parser {
  constructor(tokens) { this.tokens = tokens; this.pos = 0; }
  peek() { return this.pos < this.tokens.length ? this.tokens[this.pos] : null; }
  advance() { return this.tokens[this.pos++]; }

  parseExpr() {
    const nodes = [];
    while (this.pos < this.tokens.length) {
      const tok = this.peek();
      if (!tok || tok.type === 'RBRACE') break;
      const node = this.parseAtomWithScripts();
      if (node) nodes.push(node);
    }
    return mergeTextNodes(nodes);
  }

  parseAtomWithScripts() {
    const base = this.parseAtom();
    if (!base) return null;
    let sub = null, sup = null;
    while (this.peek()?.type === 'UNDER' || this.peek()?.type === 'CARET') {
      if (this.peek().type === 'UNDER') { this.advance(); sub = this.parseAtom(); }
      else { this.advance(); sup = this.parseAtom(); }
    }
    if (sub && sup) return { type: 'subsup', base, sub, sup };
    if (sub) return { type: 'sub', base, sub };
    if (sup) return { type: 'sup', base, sup };
    return base;
  }

  parseAtom() {
    const tok = this.peek();
    if (!tok || tok.type === 'RBRACE') return null;
    if (tok.type === 'LBRACE') {
      this.advance();
      const children = this.parseExpr();
      if (this.peek()?.type === 'RBRACE') this.advance();
      return children.length === 1 ? children[0] : { type: 'group', children };
    }
    if (tok.type === 'CMD') return this.parseCommand();
    if (tok.type === 'CHAR') { this.advance(); return { type: 'text', value: tok.value }; }
    this.advance();
    return null;
  }

  parseCommand() {
    const tok = this.advance();
    const cmd = tok.value;
    switch (cmd) {
      case '\\frac': return { type: 'frac', num: this.parseAtom(), den: this.parseAtom() };
      case '\\dfrac': return { type: 'frac', num: this.parseAtom(), den: this.parseAtom() };
      case '\\sqrt': return { type: 'radical', arg: this.parseAtom() };
      case '\\bar': case '\\overline': return { type: 'accent', style: 'bar', arg: this.parseAtom() };
      case '\\hat': return { type: 'accent', style: 'hat', arg: this.parseAtom() };
      case '\\tilde': return { type: 'accent', style: 'tilde', arg: this.parseAtom() };
      case '\\vec': return { type: 'accent', style: 'vec', arg: this.parseAtom() };
      case '\\text': case '\\mathrm': case '\\textbf': case '\\mathbf':
        return { type: 'textbox', cmd, arg: this.parseAtom() };
      case '\\left': {
        const ld = this.advance()?.value || '(';
        const content = [];
        while (this.pos < this.tokens.length) {
          if (this.peek()?.type === 'CMD' && this.peek()?.value === '\\right') {
            this.advance();
            const rd = this.advance()?.value || ')';
            return { type: 'delim', left: ld, right: rd, content: mergeTextNodes(content) };
          }
          const n = this.parseAtomWithScripts();
          if (n) content.push(n);
        }
        return { type: 'delim', left: ld, right: '', content: mergeTextNodes(content) };
      }
      case '\\sum': return { type: 'nary', op: '∑' };
      case '\\prod': return { type: 'nary', op: '∏' };
      case '\\int': return { type: 'nary', op: '∫' };
      case '\\lim': return { type: 'func', name: 'lim' };
      case '\\log': return { type: 'func', name: 'log' };
      case '\\sin': return { type: 'func', name: 'sin' };
      case '\\cos': return { type: 'func', name: 'cos' };
      case '\\tan': return { type: 'func', name: 'tan' };
      case '\\max': return { type: 'func', name: 'max' };
      case '\\min': return { type: 'func', name: 'min' };
      default: {
        const sym = SYMBOLS[cmd];
        if (sym !== undefined) return { type: 'text', value: sym };
        return { type: 'text', value: cmd.slice(1) };
      }
    }
  }
}

// ── Merge consecutive text nodes ──
function mergeTextNodes(nodes) {
  const out = [];
  for (const n of nodes) {
    if (n?.type === 'text' && out.length > 0 && out[out.length - 1]?.type === 'text') {
      out[out.length - 1].value += n.value;
    } else if (n) {
      out.push(n);
    }
  }
  return out;
}

// ── AST → docx Math objects ──
function nodesToDocx(nodes) {
  return nodes.flatMap(n => nodeToDocx(n));
}

function nodeToDocx(node) {
  if (!node) return [new MathRun('')];
  switch (node.type) {
    case 'text':
      return [new MathRun(node.value)];

    case 'group':
      return nodesToDocx(node.children);

    case 'frac':
      return [new MathFraction({
        numerator: nodeToDocxFlat(node.num),
        denominator: nodeToDocxFlat(node.den),
      })];

    case 'sup':
      return [new MathSuperScript({
        children: nodeToDocxFlat(node.base),
        superScript: nodeToDocxFlat(node.sup),
      })];

    case 'sub':
      return [new MathSubScript({
        children: nodeToDocxFlat(node.base),
        subScript: nodeToDocxFlat(node.sub),
      })];

    case 'subsup':
      return [new MathSubSuperScript({
        children: nodeToDocxFlat(node.base),
        subScript: nodeToDocxFlat(node.sub),
        superScript: nodeToDocxFlat(node.sup),
      })];

    case 'nary':
      return [new MathRun(node.op)];

    case 'radical':
      if (MathRadical) {
        return [new MathRadical({ children: nodeToDocxFlat(node.arg) })];
      }
      return [new MathRun('√'), ...nodeToDocxFlat(node.arg)];

    case 'accent': {
      const inner = nodeToText(node.arg);
      const ch = { bar: '\u0304', hat: '\u0302', tilde: '\u0303', vec: '\u20D7' }[node.style] || '\u0304';
      return [new MathRun(inner.split('').map(c => c + ch).join(''))];
    }

    case 'delim': {
      const children = nodesToDocx(node.content);
      if (node.left === '(' && (node.right === ')' || !node.right)) {
        if (MathRoundBrackets) return [new MathRoundBrackets({ children })];
      }
      if (node.left === '[' && (node.right === ']' || !node.right)) {
        if (MathSquareBrackets) return [new MathSquareBrackets({ children })];
      }
      return [new MathRun(node.left), ...children, new MathRun(node.right || '')];
    }

    case 'textbox':
      return [new MathRun(nodeToText(node.arg))];

    case 'func':
      return [new MathRun(node.name)];

    default:
      return [new MathRun('')];
  }
}

function nodeToDocxFlat(node) {
  if (!node) return [new MathRun('')];
  return nodeToDocx(node);
}

function nodeToText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.value;
  if (node.type === 'group') return node.children.map(nodeToText).join('');
  return '';
}

// ── Public API ──
export function latexToMathChildren(latex) {
  const tokens = tokenize(latex.trim());
  const parser = new Parser(tokens);
  return nodesToDocx(parser.parseExpr());
}

export function latexToInlineMath(latex) {
  return new DocxMath({ children: latexToMathChildren(latex) });
}
