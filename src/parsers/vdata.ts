/** vdata 共通ユーティリティ: 読み込みと _base / _multibase の継承解決 */

import { readFileSync } from "node:fs";
import { parseKv3Object, type Kv3Object, type Kv3Value } from "./kv3.ts";

export function readVdata(path: string): Kv3Object {
  return parseKv3Object(readFileSync(path, "utf8"));
}

function isPlainObject(v: Kv3Value): v is Kv3Object {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * base を土台に child を重ねる。
 * - 配列は「置き換え」。ゲームデータ側も差分ではなく丸ごと定義し直す前提のため。
 * - オブジェクトは再帰的にマージ。
 */
export function mergeInherit(base: Kv3Object, child: Kv3Object): Kv3Object {
  const out: Kv3Object = { ...base };
  for (const [k, v] of Object.entries(child)) {
    const b = out[k];
    out[k] = isPlainObject(b) && isPlainObject(v) ? mergeInherit(b, v) : v;
  }
  return out;
}

/**
 * _base(単一継承) と _multibase(多重継承) を解決したエントリを返す。
 * root は「エントリ名 → 定義」のマップ(heroes.vdata / abilities.vdata のルート)。
 */
export function resolveEntry(
  root: Kv3Object,
  key: string,
  seen: Set<string> = new Set(),
): Kv3Object {
  if (seen.has(key)) {
    throw new Error(`循環継承を検出しました: ${[...seen, key].join(" -> ")}`);
  }
  const entry = root[key];
  if (!isPlainObject(entry)) {
    throw new Error(`エントリが見つからないか、オブジェクトではありません: ${key}`);
  }
  seen.add(key);

  const parents: string[] = [];
  const single = entry["_base"];
  if (typeof single === "string") parents.push(single);
  const multi = entry["_multibase"];
  if (Array.isArray(multi)) {
    for (const m of multi) if (typeof m === "string") parents.push(m);
  }

  let acc: Kv3Object = {};
  for (const p of parents) {
    // 親がルートに存在しない場合は無視する(参照専用の内部クラス名が入ることがある)
    if (!isPlainObject(root[p])) continue;
    acc = mergeInherit(acc, resolveEntry(root, p, new Set(seen)));
  }
  return mergeInherit(acc, entry);
}

/** "12" や 12 を数値にする。取れなければ fallback */
export function num(v: Kv3Value | undefined, fallback = 0): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.trim());
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

/** "EModTier_3" → 3 */
export function tierNumber(v: Kv3Value | undefined): number {
  if (typeof v !== "string") return 0;
  const m = /(\d+)$/.exec(v);
  return m ? Number(m[1]) : 0;
}

/** "EItemSlotType_WeaponMod" → "WeaponMod" */
export function stripEnumPrefix(v: string, prefix: string): string {
  return v.startsWith(prefix) ? v.slice(prefix.length) : v;
}
