/**
 * PIN security service — PBKDF2 via Web Crypto (Tauri WebView2 supports SubtleCrypto).
 * Stores only derived verifier, never plaintext PIN.
 * If Web Crypto is unavailable, caller should STOP and explain (no Rust fallback without approval).
 */

const STORAGE_KEY = "pooplog_security_v1";
const ATTEMPTS_KEY = "pooplog_security_attempts_v1";
const SETUP_DONE_KEY = "pooplog_pin_setup_done_v1";

export interface SecurityRecord {
  version: 1;
  algorithm: "PBKDF2-SHA-256";
  iterations: number;
  salt: string; // base64
  hash: string; // base64
  createdAt: string;
}

const ITERATIONS = 120_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

// --- helpers ---
function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuf(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function isWebCryptoAvailable(): boolean {
  return typeof window !== "undefined" && !!window.crypto?.subtle && typeof window.crypto.getRandomValues === "function";
}

async function deriveHash(pin: string, saltB64: string, iterations: number): Promise<string> {
  if (!isWebCryptoAvailable()) throw new Error("Web Crypto unavailable — cannot derive PIN securely");
  const enc = new TextEncoder();
  const pinBuf = enc.encode(pin);
  const saltBuf = base64ToBuf(saltB64);

  const key = await window.crypto.subtle.importKey("raw", pinBuf as unknown as BufferSource, { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await window.crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBuf as unknown as BufferSource, iterations, hash: "SHA-256" },
    key,
    KEY_BITS,
  );
  return bufToBase64(bits);
}

export async function hashPin(pin: string): Promise<SecurityRecord> {
  if (!isWebCryptoAvailable()) throw new Error("Web Crypto unavailable");
  validatePinFormat(pin);
  const saltBytes = new Uint8Array(SALT_BYTES);
  window.crypto.getRandomValues(saltBytes);
  const salt = bufToBase64(saltBytes.buffer);
  const hash = await deriveHash(pin, salt, ITERATIONS);
  return {
    version: 1,
    algorithm: "PBKDF2-SHA-256",
    iterations: ITERATIONS,
    salt,
    hash,
    createdAt: new Date().toISOString(),
  };
}

export async function verifyPin(pin: string, record: SecurityRecord): Promise<boolean> {
  if (!record || !record.salt || !record.hash) return false;
  const derived = await deriveHash(pin, record.salt, record.iterations);
  // constant-time compare (simple)
  if (derived.length !== record.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < derived.length; i++) diff |= derived.charCodeAt(i) ^ record.hash.charCodeAt(i);
  return diff === 0;
}

export function validatePinFormat(pin: string): void {
  if (!pin || typeof pin !== "string") throw new Error("PIN is required");
  if (!/^\d{4,8}$/.test(pin)) throw new Error("PIN must be 4–8 digits");
}

// Storage (localStorage — Tauri WebView persists per app data; hash only, never plaintext)
export function loadSecurityRecord(): SecurityRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as SecurityRecord;
    if (rec.version !== 1 || !rec.salt || !rec.hash) return null;
    return rec;
  } catch {
    return null;
  }
}

export function saveSecurityRecord(rec: SecurityRecord): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
  markPinSetupDone();
}

export function clearSecurityRecord(): void {
  localStorage.removeItem(STORAGE_KEY);
  clearAttempts();
  markPinSetupDone();
}

export function hasPin(): boolean {
  return loadSecurityRecord() !== null;
}

export function isPinSetupDone(): boolean {
  try {
    return localStorage.getItem(SETUP_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markPinSetupDone(): void {
  try {
    localStorage.setItem(SETUP_DONE_KEY, "1");
  } catch {}
}

export function clearPinSetupDone(): void {
  try {
    localStorage.removeItem(SETUP_DONE_KEY);
  } catch {}
}

// --- failed attempts + cooldown ---
interface AttemptsState {
  count: number;
  lastFailedAt: number | null; // ms epoch
}

function loadAttempts(): AttemptsState {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY);
    if (!raw) return { count: 0, lastFailedAt: null };
    return JSON.parse(raw) as AttemptsState;
  } catch {
    return { count: 0, lastFailedAt: null };
  }
}

function saveAttempts(s: AttemptsState): void {
  localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(s));
}

export function clearAttempts(): void {
  localStorage.removeItem(ATTEMPTS_KEY);
}

export function recordFailedAttempt(): AttemptsState {
  const s = loadAttempts();
  s.count += 1;
  s.lastFailedAt = Date.now();
  saveAttempts(s);
  return s;
}

export function recordSuccess(): void {
  clearAttempts();
}

export function getCooldownSeconds(): number {
  const s = loadAttempts();
  if (s.count < 5) return 0;
  if (s.count === 5) return 30;
  if (s.count === 6) return 60;
  if (s.count === 7) return 120;
  // 8+ => 5 minutes, then cap
  return 300;
}

export function getRemainingCooldown(): number {
  const s = loadAttempts();
  const cooldown = getCooldownSeconds();
  if (cooldown === 0 || !s.lastFailedAt) return 0;
  const elapsed = (Date.now() - s.lastFailedAt) / 1000;
  const remaining = Math.ceil(cooldown - elapsed);
  return remaining > 0 ? remaining : 0;
}

export function isInCooldown(): boolean {
  return getRemainingCooldown() > 0;
}

export function getFailedCount(): number {
  return loadAttempts().count;
}
