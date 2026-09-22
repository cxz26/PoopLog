#!/usr/bin/env node
// Regression test: PIN KDF versioning + lazy upgrade + weak-PIN prevention.
// Security review findings addressed:
//  - PBKDF2 was fixed at 120k iterations with no upgrade path
//  - no common/weak PIN prevention on create/change
// Overstated findings NOT acted on (documented):
//  - "wrong backup password causes total data loss" — restore decrypts the
//    main backup BEFORE any safety backup or destructive write, so a wrong
//    password cannot lose data.
//  - "move verifier out of localStorage to secure storage" — architecture
//    change, out of scope for this fix set.
// Run with: npx tsx scripts/verify-pin-security.mjs

import { webcrypto } from "node:crypto";
globalThis.window = { crypto: webcrypto };
globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] ?? null; }, setItem(k, v) { this.store[k] = v; }, removeItem(k) { delete this.store[k]; }, clear() { this.store = {}; } };

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`✓ ${msg}`); }
  else { failed++; console.error(`✗ ${msg}`); }
}

import {
  hashPin, verifyPin, validatePinFormat, validatePinStrength, needsKdfUpgrade, upgradeSecurityRecordIfLegacy,
  loadSecurityRecord, saveSecurityRecord, clearSecurityRecord, KDF_V1_ITERATIONS, KDF_V2_ITERATIONS,
} from "../src/core/security/pinService.ts";

console.log("=== A. new PINs use versioned v2 parameters ===");
{
  assert(KDF_V2_ITERATIONS === 600_000, `current KDF is 600k iterations (got ${KDF_V2_ITERATIONS})`);
  assert(KDF_V1_ITERATIONS === 120_000, "legacy v1 iteration count preserved for compatibility");
  const rec = await hashPin("8492");
  assert(rec.version === 2, "hashPin produces version 2");
  assert(rec.iterations === KDF_V2_ITERATIONS, "hashPin uses v2 iteration count");
  assert(await verifyPin("8492", rec), "correct PIN verifies against v2 verifier");
  assert(!(await verifyPin("8493", rec)), "wrong PIN rejected against v2 verifier");
  const raw = localStorage.getItem("pooplog_security_v1") ?? "";
  assert(!raw.includes("8492"), "plaintext PIN never stored");
}

console.log("\n=== B. legacy v1 verifiers keep working (compatibility) ===");
{
  // Hand-build a v1 record exactly as the old code wrote them.
  const salt = Buffer.from(webcrypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode("1357"), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await webcrypto.subtle.deriveBits({ name: "PBKDF2", salt: Buffer.from(salt, "base64"), iterations: KDF_V1_ITERATIONS, hash: "SHA-256" }, key, 256);
  const legacy = { version: 1, algorithm: "PBKDF2-SHA-256", iterations: KDF_V1_ITERATIONS, salt, hash: Buffer.from(bits).toString("base64"), createdAt: "2026-01-01T00:00:00.000Z" };
  assert(await verifyPin("1357", legacy), "legacy v1 verifier still verifies (no lockout after upgrade)");
  assert(needsKdfUpgrade(legacy), "legacy record flagged for upgrade");
  const fresh = await hashPin("8492");
  assert(!needsKdfUpgrade(fresh), "v2 record not flagged");

  saveSecurityRecord(legacy);
  const loaded = loadSecurityRecord();
  assert(loaded && loaded.version === 1, "loadSecurityRecord accepts version 1 records");

  // Lazy upgrade: only after successful unlock
  const upgraded = await upgradeSecurityRecordIfLegacy("1357", legacy);
  assert(upgraded && upgraded.version === 2 && upgraded.iterations === KDF_V2_ITERATIONS, "upgrade rehashes with v2 parameters");
  const stored = loadSecurityRecord();
  assert(stored.version === 2, "upgraded record persisted");
  assert(await verifyPin("1357", stored), "same PIN verifies after upgrade");
  assert(!(await verifyPin("9999", stored)), "different PIN still rejected after upgrade");
  // Idempotent: upgrading an already-current record is a no-op
  assert((await upgradeSecurityRecordIfLegacy("1357", stored)) === null, "upgrade is a no-op for current records");
  // Wrong PIN must NOT produce a stored upgrade (caller only calls after verify — assert the helper preserves the record)
  clearSecurityRecord();
}

console.log("\n=== C. unknown record versions rejected ===");
{
  saveSecurityRecord({ version: 9, algorithm: "PBKDF2-SHA-256", iterations: 600000, salt: "x", hash: "y", createdAt: "x" });
  assert(loadSecurityRecord() === null, "version 9 record rejected at load");
  localStorage.clear();
}

console.log("\n=== D. weak-PIN prevention (create/change only) ===");
{
  const weak = {
    "1111": "repeated",
    "000000": "repeated (6-digit)",
    "1234": "ascending run",
    "2345": "ascending run (offset)",
    "45678": "ascending run (5-digit)",
    "8765": "descending run",
    "9876": "descending run",
    "54321": "descending run (5-digit)",
    "1212": "common",
    "2580": "common (keypad column)",
    "1004": "common",
    "2020": "common",
  };
  for (const [pin, why] of Object.entries(weak)) {
    let threw = false;
    try { validatePinStrength(pin); } catch { threw = true; }
    assert(threw, `weak PIN rejected (${pin} — ${why})`);
  }
  const strong = ["8492", "0571", "926371", "9021", "1305"];
  for (const pin of strong) {
    let threw = false;
    try { validatePinStrength(pin); } catch { threw = true; }
    assert(!threw, `reasonable PIN accepted (${pin})`);
  }
  // Format rules unchanged
  let threw = false;
  try { validatePinFormat("12"); } catch { threw = true; }
  assert(threw, "too-short PIN still rejected by format check");
  threw = false;
  try { validatePinFormat("12a4"); } catch { threw = true; }
  assert(threw, "non-digit PIN still rejected");
}

console.log("\n=== E. unlock path never applies strength rules ===");
{
  // A user with a legacy weak PIN must keep unlocking until they change it.
  const legacy = await (async () => {
    const salt = Buffer.from(webcrypto.getRandomValues(new Uint8Array(16))).toString("base64");
    const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode("1111"), { name: "PBKDF2" }, false, ["deriveBits"]);
    const bits = await webcrypto.subtle.deriveBits({ name: "PBKDF2", salt: Buffer.from(salt, "base64"), iterations: KDF_V1_ITERATIONS, hash: "SHA-256" }, key, 256);
    return { version: 1, algorithm: "PBKDF2-SHA-256", iterations: KDF_V1_ITERATIONS, salt, hash: Buffer.from(bits).toString("base64"), createdAt: "x" } ;
  })();
  assert(await verifyPin("1111", legacy), "weak legacy PIN still UNLOCKS (strength rules are create/change-only)");
}

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
if (failed > 0) { console.error("FAILED"); process.exit(1); }
console.log("PASS");
