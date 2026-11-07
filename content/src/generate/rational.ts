/** An exact fraction, so 0.1 + 0.2 equals 0.3 and 1/3 stays 1/3. Always in lowest terms, `d > 0`. */
export class Rational {
  readonly n: bigint;
  readonly d: bigint;

  constructor(n: bigint, d: bigint = 1n) {
    if (d === 0n) throw new Error('Division by zero');
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n < 0n ? -n : n, d);
    this.n = n / g;
    this.d = d / g;
  }

  static of(value: number | bigint): Rational {
    if (typeof value === 'bigint') return new Rational(value);
    const parsed = Rational.parse(String(value));
    if (!parsed) throw new Error(`Not a finite number: ${value}`);
    return parsed;
  }

  /** Parses `12`, `-3.25`, or `1e-7`. Returns null for anything else. */
  static parse(text: string): Rational | null {
    const match = /^([-−]?)(\d+)(?:\.(\d+))?(?:e([-+]?\d+))?$/i.exec(text.trim());
    if (!match) return null;
    const [, sign, whole, fraction = '', exponent = '0'] = match;
    let n = BigInt(whole + fraction);
    let d = 10n ** BigInt(fraction.length);
    const e = Number(exponent);
    if (e > 0) n *= 10n ** BigInt(e);
    if (e < 0) d *= 10n ** BigInt(-e);
    return new Rational(sign ? -n : n, d);
  }

  add(o: Rational): Rational {
    return new Rational(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Rational): Rational {
    return new Rational(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Rational): Rational {
    return new Rational(this.n * o.n, this.d * o.d);
  }
  div(o: Rational): Rational {
    if (o.n === 0n) throw new Error('Division by zero');
    return new Rational(this.n * o.d, this.d * o.n);
  }
  neg(): Rational {
    return new Rational(-this.n, this.d);
  }
  abs(): Rational {
    return this.n < 0n ? this.neg() : this;
  }
  cmp(o: Rational): number {
    const diff = this.n * o.d - o.n * this.d;
    return diff === 0n ? 0 : diff < 0n ? -1 : 1;
  }
  eq(o: Rational): boolean {
    return this.cmp(o) === 0;
  }
  isInteger(): boolean {
    return this.d === 1n;
  }
  floor(): Rational {
    const q = this.n / this.d;
    return new Rational(this.n < 0n && q * this.d !== this.n ? q - 1n : q);
  }
  toNumber(): number {
    return Number(this.n) / Number(this.d);
  }
  toString(): string {
    return this.d === 1n ? String(this.n) : `${this.n}/${this.d}`;
  }
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a === 0n ? 1n : a;
}
