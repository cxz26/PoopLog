/**
 * Canonical header serialization — deterministic, sorted keys, UTF-8.
 * Used for AES-GCM AAD. Same bytes must be used for encrypt and decrypt.
 */

import type { BackupHeaderWithoutPayload } from "./backupTypes";

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>).sort();
    for (const k of keys) out[k] = sortKeys((value as Record<string, unknown>)[k]);
    return out;
  }
  return value;
}

export function canonicalizeHeader(header: BackupHeaderWithoutPayload): Uint8Array {
  const sorted = sortKeys(header);
  const json = JSON.stringify(sorted);
  return new TextEncoder().encode(json);
}

export function canonicalHeaderJson(header: BackupHeaderWithoutPayload): string {
  const sorted = sortKeys(header);
  return JSON.stringify(sorted);
}
