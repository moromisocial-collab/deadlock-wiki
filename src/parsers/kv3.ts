/**
 * Valve KV3 (text encoding) パーサー
 *
 * GameTracking-Deadlock の *.vdata / *.vdata_inc は
 *   <!-- kv3 encoding:text:version{...} format:generic:version{...} -->
 * で始まる KV3 テキスト形式。必要な範囲を自前でパースする。
 *
 * 対応:
 *   - オブジェクト { key = value }  / 配列 [ v, v, ]
 *   - 文字列 "..." と複数行文字列 """..."""
 *   - 数値(整数/小数/指数/符号) / true / false / null
 *   - 型プレフィックス resource_name:"..." / panorama:"..." / subclass:{...} など
 *   - バイナリブロブ #[ ... ]
 *   - 行コメント // と ブロックコメント / * * /
 *   - 末尾カンマ、カンマ省略
 */

export type Kv3Value =
  | string
  | number
  | boolean
  | null
  | Kv3Value[]
  | { [key: string]: Kv3Value };

export interface Kv3Object {
  [key: string]: Kv3Value;
}

export interface ParseOptions {
  /** 型プレフィックスを "resource_name:xxx" のように値へ残す(既定: false = 捨てる) */
  keepTypePrefix?: boolean;
}

class Kv3Parser {
  private s: string;
  private i = 0;
  private keepPrefix: boolean;

  constructor(source: string, opts: ParseOptions = {}) {
    this.s = source;
    this.keepPrefix = opts.keepTypePrefix ?? false;
  }

  parse(): Kv3Value {
    this.skipHeader();
    this.skipTrivia();
    const v = this.parseValue();
    this.skipTrivia();
    return v;
  }

  // ---- 位置・エラー -------------------------------------------------------

  private fail(msg: string): never {
    const upto = this.s.slice(0, this.i);
    const line = upto.split("\n").length;
    const col = this.i - (upto.lastIndexOf("\n") + 1) + 1;
    const near = JSON.stringify(this.s.slice(this.i, this.i + 60));
    throw new Error(`KV3 parse error at ${line}:${col}: ${msg} near ${near}`);
  }

  private eof(): boolean {
    return this.i >= this.s.length;
  }

  // ---- 前処理 -------------------------------------------------------------

  /** 先頭の <!-- kv3 ... --> を読み飛ばす */
  private skipHeader(): void {
    this.skipTrivia();
    if (this.s.startsWith("<!--", this.i)) {
      const end = this.s.indexOf("-->", this.i);
      if (end < 0) this.fail("unterminated KV3 header");
      this.i = end + 3;
    }
  }

  /** 空白・コメント・カンマを読み飛ばす */
  private skipTrivia(): void {
    for (;;) {
      const c = this.s.charCodeAt(this.i);
      // 空白 / 改行 / カンマ
      if (c === 32 || c === 9 || c === 10 || c === 13 || c === 44) {
        this.i++;
        continue;
      }
      if (c === 47 /* / */) {
        const n = this.s.charCodeAt(this.i + 1);
        if (n === 47 /* // */) {
          const nl = this.s.indexOf("\n", this.i);
          this.i = nl < 0 ? this.s.length : nl + 1;
          continue;
        }
        if (n === 42 /* /* */) {
          const end = this.s.indexOf("*/", this.i + 2);
          this.i = end < 0 ? this.s.length : end + 2;
          continue;
        }
      }
      return;
    }
  }

  // ---- 値 -----------------------------------------------------------------

  private parseValue(): Kv3Value {
    this.skipTrivia();
    if (this.eof()) this.fail("unexpected end of input");

    const c = this.s[this.i];

    if (c === "{") return this.parseObject();
    if (c === "[") return this.parseArray();
    if (c === '"') return this.parseString();
    if (c === "#" && this.s[this.i + 1] === "[") return this.parseBlob();

    // 数値 (符号付き)
    if (c === "-" || c === "+" || (c >= "0" && c <= "9")) return this.parseNumber();
    if (c === "." && /[0-9]/.test(this.s[this.i + 1] ?? "")) return this.parseNumber();

    // 識別子: true / false / null / 型プレフィックス(name:value)
    if (/[A-Za-z_]/.test(c)) return this.parseIdentifierLike();

    this.fail(`unexpected character ${JSON.stringify(c)}`);
  }

  private parseObject(): Kv3Object {
    this.i++; // {
    const obj: Kv3Object = {};
    for (;;) {
      this.skipTrivia();
      if (this.eof()) this.fail("unterminated object");
      if (this.s[this.i] === "}") {
        this.i++;
        return obj;
      }
      const key = this.parseKey();
      this.skipTrivia();
      if (this.s[this.i] !== "=") this.fail(`expected '=' after key ${JSON.stringify(key)}`);
      this.i++;
      obj[key] = this.parseValue();
    }
  }

  private parseArray(): Kv3Value[] {
    this.i++; // [
    const arr: Kv3Value[] = [];
    for (;;) {
      this.skipTrivia();
      if (this.eof()) this.fail("unterminated array");
      if (this.s[this.i] === "]") {
        this.i++;
        return arr;
      }
      arr.push(this.parseValue());
    }
  }

  private parseKey(): string {
    if (this.s[this.i] === '"') return this.parseString();
    const start = this.i;
    while (!this.eof() && /[A-Za-z0-9_.\-+]/.test(this.s[this.i])) this.i++;
    if (this.i === start) this.fail("expected object key");
    return this.s.slice(start, this.i);
  }

  private parseString(): string {
    // 複数行文字列 """ ... """
    if (this.s.startsWith('"""', this.i)) {
      const end = this.s.indexOf('"""', this.i + 3);
      if (end < 0) this.fail("unterminated multi-line string");
      let body = this.s.slice(this.i + 3, end);
      this.i = end + 3;
      // 開き """ 直後の改行は内容に含めない(KV3 の慣習)
      if (body.startsWith("\r\n")) body = body.slice(2);
      else if (body.startsWith("\n")) body = body.slice(1);
      return body;
    }

    this.i++; // "
    let out = "";
    for (;;) {
      if (this.eof()) this.fail("unterminated string");
      const c = this.s[this.i];
      if (c === '"') {
        this.i++;
        return out;
      }
      if (c === "\\") {
        const e = this.s[this.i + 1];
        this.i += 2;
        switch (e) {
          case "n": out += "\n"; break;
          case "t": out += "\t"; break;
          case "r": out += "\r"; break;
          case '"': out += '"'; break;
          case "\\": out += "\\"; break;
          case "'": out += "'"; break;
          default: out += e ?? ""; break;
        }
        continue;
      }
      out += c;
      this.i++;
    }
  }

  private parseNumber(): number {
    const start = this.i;
    if (this.s[this.i] === "-" || this.s[this.i] === "+") this.i++;
    while (!this.eof() && /[0-9]/.test(this.s[this.i])) this.i++;
    if (this.s[this.i] === ".") {
      this.i++;
      while (!this.eof() && /[0-9]/.test(this.s[this.i])) this.i++;
    }
    if (this.s[this.i] === "e" || this.s[this.i] === "E") {
      this.i++;
      if (this.s[this.i] === "-" || this.s[this.i] === "+") this.i++;
      while (!this.eof() && /[0-9]/.test(this.s[this.i])) this.i++;
    }
    const text = this.s.slice(start, this.i);
    const n = Number(text);
    if (Number.isNaN(n)) this.fail(`invalid number ${JSON.stringify(text)}`);
    return n;
  }

  /** #[ 00 11 22 ] 形式のバイナリブロブ。中身は使わないので文字列として保持する */
  private parseBlob(): string {
    const end = this.s.indexOf("]", this.i);
    if (end < 0) this.fail("unterminated binary blob");
    const text = this.s.slice(this.i, end + 1);
    this.i = end + 1;
    return text;
  }

  /** true / false / null / 型プレフィックス付きの値 (resource_name:"..." など) */
  private parseIdentifierLike(): Kv3Value {
    const start = this.i;
    while (!this.eof() && /[A-Za-z0-9_]/.test(this.s[this.i])) this.i++;
    const word = this.s.slice(start, this.i);

    if (this.s[this.i] === ":") {
      // 型プレフィックス。次の値を読んで返す
      this.i++;
      const inner = this.parseValue();
      if (!this.keepPrefix) return inner;
      return typeof inner === "string" ? `${word}:${inner}` : inner;
    }

    switch (word) {
      case "true": return true;
      case "false": return false;
      case "null": return null;
    }
    // 想定外の裸トークンは文字列として拾っておく(壊れずに前へ進むため)
    return word;
  }
}

/** KV3 テキストをパースしてプレーンなオブジェクトを返す */
export function parseKv3(source: string, opts: ParseOptions = {}): Kv3Value {
  // BOM 除去
  const src = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  return new Kv3Parser(src, opts).parse();
}

/** ルートがオブジェクトであることを前提にパースする */
export function parseKv3Object(source: string, opts: ParseOptions = {}): Kv3Object {
  const v = parseKv3(source, opts);
  if (v === null || typeof v !== "object" || Array.isArray(v)) {
    throw new Error("KV3 root is not an object");
  }
  return v as Kv3Object;
}
