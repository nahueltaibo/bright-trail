import { Rational } from './rational';

export type Value = Rational | boolean;

export interface ExprContext {
  /** What the identifier `count` means: the count the item's picture shows. */
  count?: number;
}

type Token =
  { t: 'num'; v: Rational; text: string } | { t: 'id'; v: string } | { t: 'op'; v: string };

const OPS = ['<=', '>=', '==', '!=', '<', '>', '=', '+', '-', '−', '*', '×', '/', '÷', '%', '^'];

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i);
    const space = /^\s+/.exec(rest);
    if (space) {
      i += space[0].length;
      continue;
    }
    const num = /^\d+(\.\d+)?/.exec(rest);
    if (num) {
      tokens.push({ t: 'num', v: Rational.parse(num[0])!, text: num[0] });
      i += num[0].length;
      continue;
    }
    const id = /^[a-zA-Z_]\w*/.exec(rest);
    if (id) {
      tokens.push({ t: 'id', v: id[0] });
      i += id[0].length;
      continue;
    }
    const op = OPS.find((o) => rest.startsWith(o)) ?? (/^[(),]/.test(rest) ? rest[0] : undefined);
    if (!op) throw new Error(`Unexpected "${rest[0]}" in "${source}"`);
    tokens.push({ t: 'op', v: op });
    i += op.length;
  }
  return tokens;
}

function num(v: Value, what: string): Rational {
  if (typeof v === 'boolean') throw new Error(`${what} needs a number, got ${v}`);
  return v;
}

function int(v: Value, what: string): bigint {
  const r = num(v, what);
  if (!r.isInteger()) throw new Error(`${what} needs a whole number, got ${r}`);
  return r.n;
}

function isPrime(n: bigint): boolean {
  if (n < 2n) return false;
  for (let k = 2n; k * k <= n; k++) if (n % k === 0n) return false;
  return true;
}

/** Rounds to the nearest multiple of `unit`, halves away from zero, as Ontario classes teach. */
function roundTo(x: Rational, unit: Rational): Rational {
  if (unit.cmp(new Rational(0n)) <= 0) throw new Error('roundTo needs a positive unit');
  const half = new Rational(1n, 2n);
  const steps = x.abs().div(unit).add(half).floor();
  const rounded = steps.mul(unit);
  return x.n < 0n ? rounded.neg() : rounded;
}

const FUNCTIONS: Record<string, (args: Value[]) => Value> = {
  roundTo: ([x, unit]) => roundTo(num(x, 'roundTo'), num(unit, 'roundTo')),
  floor: ([x]) => num(x, 'floor').floor(),
  ceil: ([x]) => num(x, 'ceil').neg().floor().neg(),
  abs: ([x]) => num(x, 'abs').abs(),
  min: (args) => args.map((a) => num(a, 'min')).reduce((a, b) => (a.cmp(b) <= 0 ? a : b)),
  max: (args) => args.map((a) => num(a, 'max')).reduce((a, b) => (a.cmp(b) >= 0 ? a : b)),
  isPrime: ([x]) => isPrime(int(x, 'isPrime')),
  isEven: ([x]) => int(x, 'isEven') % 2n === 0n,
  isOdd: ([x]) => int(x, 'isOdd') % 2n !== 0n,
};

const ARITY: Record<string, [number, number]> = {
  roundTo: [2, 2],
  floor: [1, 1],
  ceil: [1, 1],
  abs: [1, 1],
  min: [1, 10],
  max: [1, 10],
  isPrime: [1, 1],
  isEven: [1, 1],
  isOdd: [1, 1],
};

/**
 * A small exact-arithmetic language for answer checks: numbers, `+ - * / × ÷ % ^`, brackets,
 * comparisons, `and`/`or`/`not`, `count`, and the functions in `FUNCTIONS`.
 */
class Parser {
  private pos = 0;
  constructor(
    private readonly tokens: Token[],
    private readonly ctx: ExprContext,
    private readonly source: string,
  ) {}

  parse(): Value {
    if (this.tokens.length === 0) throw new Error('Empty expression');
    const value = this.or();
    if (this.pos < this.tokens.length) throw new Error(`Unexpected token in "${this.source}"`);
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }
  private isOp(...ops: string[]): string | null {
    const t = this.peek();
    return t && t.t === 'op' && ops.includes(t.v) ? t.v : null;
  }
  private isWord(word: string): boolean {
    const t = this.peek();
    return !!t && t.t === 'id' && t.v === word;
  }
  private expect(op: string) {
    if (!this.isOp(op)) throw new Error(`Expected "${op}" in "${this.source}"`);
    this.pos++;
  }

  private or(): Value {
    let left = this.and();
    while (this.isWord('or')) {
      this.pos++;
      const right = this.and();
      left = bool(left) || bool(right);
    }
    return left;
  }
  private and(): Value {
    let left = this.not();
    while (this.isWord('and')) {
      this.pos++;
      const right = this.not();
      left = bool(left) && bool(right);
    }
    return left;
  }
  private not(): Value {
    if (this.isWord('not')) {
      this.pos++;
      return !bool(this.not());
    }
    return this.comparison();
  }
  private comparison(): Value {
    const left = this.additive();
    const op = this.isOp('<=', '>=', '==', '!=', '<', '>', '=');
    if (!op) return left;
    this.pos++;
    const right = this.additive();
    if (op === '==' || op === '=' || op === '!=') {
      const same =
        typeof left === 'boolean' || typeof right === 'boolean' ? left === right : left.eq(right);
      return op === '!=' ? !same : same;
    }
    const c = num(left, op).cmp(num(right, op));
    return op === '<' ? c < 0 : op === '<=' ? c <= 0 : op === '>' ? c > 0 : c >= 0;
  }
  private additive(): Value {
    let left = this.multiplicative();
    for (let op = this.isOp('+', '-', '−'); op; op = this.isOp('+', '-', '−')) {
      this.pos++;
      const right = num(this.multiplicative(), op);
      left = op === '+' ? num(left, op).add(right) : num(left, op).sub(right);
    }
    return left;
  }
  private multiplicative(): Value {
    let left = this.unary();
    for (let op = this.isOp('*', '×', '/', '÷', '%'); op; op = this.isOp('*', '×', '/', '÷', '%')) {
      this.pos++;
      const right = num(this.unary(), op);
      const l = num(left, op);
      if (op === '*' || op === '×') left = l.mul(right);
      else if (op === '%') {
        if (!l.isInteger() || !right.isInteger()) throw new Error('% needs whole numbers');
        if (right.n === 0n) throw new Error('Division by zero');
        left = new Rational(((l.n % right.n) + right.n) % right.n);
      } else left = l.div(right);
    }
    return left;
  }
  private unary(): Value {
    if (this.isOp('-', '−')) {
      this.pos++;
      return num(this.unary(), 'minus').neg();
    }
    if (this.isOp('+')) {
      this.pos++;
      return this.unary();
    }
    return this.power();
  }
  private power(): Value {
    const base = this.primary();
    if (!this.isOp('^')) return base;
    this.pos++;
    const exponent = int(this.unary(), '^');
    if (exponent < 0n || exponent > 64n) throw new Error('^ needs an exponent from 0 to 64');
    let result = new Rational(1n);
    for (let k = 0n; k < exponent; k++) result = result.mul(num(base, '^'));
    return result;
  }
  private primary(): Value {
    const t = this.peek();
    if (!t) throw new Error(`Unexpected end of "${this.source}"`);
    if (t.t === 'num') {
      this.pos++;
      return t.v;
    }
    if (t.t === 'op' && t.v === '(') {
      this.pos++;
      const value = this.or();
      this.expect(')');
      return value;
    }
    if (t.t === 'id') {
      this.pos++;
      if (t.v === 'true' || t.v === 'false') return t.v === 'true';
      if (t.v === 'count') {
        if (this.ctx.count === undefined) throw new Error('count used but the item shows no count');
        return Rational.of(this.ctx.count);
      }
      const fn = FUNCTIONS[t.v];
      if (!fn) throw new Error(`Unknown name "${t.v}" in "${this.source}"`);
      this.expect('(');
      const args: Value[] = [];
      if (!this.isOp(')')) {
        args.push(this.or());
        while (this.isOp(',')) {
          this.pos++;
          args.push(this.or());
        }
      }
      this.expect(')');
      const [lo, hi] = ARITY[t.v];
      if (args.length < lo || args.length > hi) throw new Error(`Wrong argument count for ${t.v}`);
      return fn(args);
    }
    throw new Error(`Unexpected "${t.v}" in "${this.source}"`);
  }
}

function bool(v: Value): boolean {
  if (typeof v !== 'boolean') throw new Error(`Expected true or false, got ${v}`);
  return v;
}

/** Evaluates an answer-check expression. Throws on syntax errors and unknown names. */
export function evaluate(source: string, ctx: ExprContext = {}): Value {
  return new Parser(tokenize(source), ctx, source).parse();
}

/** Number literals written in an expression, e.g. `roundTo(237, 10)` → 237 and 10. */
export function literalsOf(source: string): Rational[] {
  return tokenize(source)
    .filter((t): t is Extract<Token, { t: 'num' }> => t.t === 'num')
    .map((t) => t.v);
}

/** True when the expression reads the picture's count. */
export function usesCount(source: string): boolean {
  return tokenize(source).some((t) => t.t === 'id' && t.v === 'count');
}
