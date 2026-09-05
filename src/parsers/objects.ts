/** npc_units.vdata → objects.json */

import type { Kv3Object } from "./kv3.ts";
import { readVdata, resolveEntry } from "./vdata.ts";
import { str } from "./properties.ts";
import type { GameObject, ObjectsFile } from "../types/object.ts";

/**
 * m_flMaxHealth → maxHealth のように、m_ とハンガリアン接頭辞を外す。
 * 接頭辞が無いものはそのまま先頭を小文字にする。
 */
export function normalizeFieldName(raw: string): string {
  let name = raw.startsWith("m_") ? raw.slice(2) : raw;
  // fl(float) n/i(int) b(bool) un(unsigned) e(enum) h(handle) など
  const m = /^(fl|un|str|sz|vec|ar|map|col|[nibseh])(?=[A-Z])/.exec(name);
  if (m) name = name.slice(m[0].length);
  return name.charAt(0).toLowerCase() + name.slice(1);
}

export function parseObjects(npcUnitsPath: string, upstreamCommit: string): ObjectsFile {
  const root = readVdata(npcUnitsPath);

  const objects: Record<string, GameObject> = {};
  for (const key of Object.keys(root)) {
    const raw = root[key];
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue;

    let e: Kv3Object;
    try {
      e = resolveEntry(root, key);
    } catch {
      // 継承元が解決できないエントリは飛ばす
      continue;
    }

    const stats: Record<string, number> = {};
    const flags: Record<string, boolean> = {};
    for (const [field, value] of Object.entries(e)) {
      // 内部フィールドは出力しない
      if (field.startsWith("_")) continue;
      // 文字列(モデル・パーティクル・サウンドのパス)とオブジェクトは落とす
      if (typeof value === "number") stats[normalizeFieldName(field)] = value;
      else if (typeof value === "boolean") flags[normalizeFieldName(field)] = value;
    }

    // 数値もフラグも持たないエントリは実質空なので出力しない
    if (Object.keys(stats).length === 0 && Object.keys(flags).length === 0) continue;

    objects[key] = {
      id: key,
      className: str(e["_class"]),
      baseKey: str(root[key] !== null && typeof root[key] === "object" ? (root[key] as Kv3Object)["_base"] : undefined),
      stats,
      flags,
    };
  }

  return {
    schemaVersion: 1,
    upstreamCommit,
    generatedAt: new Date().toISOString(),
    objects,
  };
}
