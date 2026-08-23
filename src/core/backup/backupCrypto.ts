/**
 * Backup crypto — Web Crypto only (Tauri WebView2 = Chromium, Node 20 has webcrypto).
 * PBKDF2 250k + AES-256-GCM 12B nonce + AAD (canonical header).
 * No Rust, no Argon2, no hardcoded key/salt.
 */

import { BACKUP_MAGIC, BACKUP_FORMAT_VERSION, type BackupHeaderWithoutPayload, type BackupFile } from "./backupTypes";
import { canonicalizeHeader } from "./canonical";

export const BACKUP_KDF_ITERATIONS = 250_000;
export const BACKUP_SALT_BYTES = 16;
export const BACKUP_NONCE_BYTES = 12;
export const BACKUP_KEY_BITS = 256;
export const BACKUP_TAG_BITS = 128;

function getCrypto(): SubtleCrypto {
  // Tauri WebView: window.crypto.subtle, Node: globalThis.crypto.subtle
  const c: Crypto | undefined =
    (typeof window !== "undefined" && (window as unknown as { crypto?: Crypto }).crypto) ||
    (typeof globalThis !== "undefined" && (globalThis as unknown as { crypto?: Crypto }).crypto) ||
    undefined;
  if (!c?.subtle) throw new Error("Web Crypto unavailable — cannot perform backup encryption");
  return c.subtle;
}

function getRandomBytes(len: number): Uint8Array {
  const c: Crypto | undefined =
    (typeof window !== "undefined" && (window as unknown as { crypto?: Crypto }).crypto) ||
    (typeof globalThis !== "undefined" && (globalThis as unknown as { crypto?: Crypto }).crypto) ||
    undefined;
  if (!c?.getRandomValues) throw new Error("Web Crypto getRandomValues unavailable");
  const buf = new Uint8Array(len);
  c.getRandomValues(buf);
  return buf;
}

function bufToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
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

function validatePassword(password: string): void {
  if (!password || typeof password !== "string") throw new Error("Backup password is required");
  // Backup password is separate from PIN: require 8+ chars for real backup (PIN is 4-8 digits)
  if (password.length < 8) throw new Error("Backup password must be at least 8 characters");
}

export function validateHeader(header: BackupHeaderWithoutPayload): void {
  if (!header || typeof header !== "object") throw new Error("Invalid backup header");
  if (header.magic !== BACKUP_MAGIC) throw new Error("Invalid backup magic");
  if (header.formatVersion !== BACKUP_FORMAT_VERSION) throw new Error("Unsupported backup format version");
  if (header.encryption.algorithm !== "AES-256-GCM") throw new Error("Unsupported encryption algorithm");
  if (header.encryption.kdf !== "PBKDF2-SHA-256") throw new Error("Unsupported KDF");
  const it = header.encryption.kdfParams.iterations;
  if (typeof it !== "number" || it < 100_000 || it > 1_000_000) throw new Error("Unsupported KDF iterations");
  // salt 16B
  try {
    const saltBytes = base64ToBuf(header.encryption.salt);
    if (saltBytes.length !== BACKUP_SALT_BYTES) throw new Error("Invalid salt length");
  } catch {
    throw new Error("Invalid salt encoding");
  }
  // nonce 12B
  try {
    const nonceBytes = base64ToBuf(header.encryption.nonce);
    if (nonceBytes.length !== BACKUP_NONCE_BYTES) throw new Error("Invalid nonce length");
  } catch {
    throw new Error("Invalid nonce encoding");
  }
  if (typeof header.appVersion !== "string" || !header.appVersion) throw new Error("Invalid appVersion");
  if (typeof header.schemaVersion !== "number") throw new Error("Invalid schemaVersion");
  if (typeof header.createdAt !== "string" || isNaN(Date.parse(header.createdAt))) throw new Error("Invalid createdAt");
}

async function deriveKey(password: string, saltB64: string, iterations: number): Promise<CryptoKey> {
  const subtle = getCrypto();
  const enc = new TextEncoder();
  const pinBuf = enc.encode(password);
  const saltBuf = base64ToBuf(saltB64);
  const baseKey = await subtle.importKey("raw", pinBuf as unknown as BufferSource, { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]);
  // Use deriveBits to get raw 256-bit, then import as AES-GCM key
  const bits = await subtle.deriveBits({ name: "PBKDF2", salt: saltBuf as unknown as BufferSource, iterations, hash: "SHA-256" }, baseKey, BACKUP_KEY_BITS);
  return subtle.importKey("raw", bits, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptPayload(
  plaintext: string,
  password: string,
  headerWithoutPayload: Omit<BackupHeaderWithoutPayload, "encryption"> & { encryption: Omit<BackupHeaderWithoutPayload["encryption"], "salt" | "nonce"> },
): Promise<BackupFile> {
  validatePassword(password);
  // Generate random salt + nonce
  const saltBytes = getRandomBytes(BACKUP_SALT_BYTES);
  const nonceBytes = getRandomBytes(BACKUP_NONCE_BYTES);
  const saltB64 = bufToBase64(saltBytes);
  const nonceB64 = bufToBase64(nonceBytes);

  const fullHeader: BackupHeaderWithoutPayload = {
    magic: BACKUP_MAGIC,
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: headerWithoutPayload.createdAt,
    appVersion: headerWithoutPayload.appVersion,
    schemaVersion: headerWithoutPayload.schemaVersion,
    encryption: {
      algorithm: "AES-256-GCM",
      kdf: "PBKDF2-SHA-256",
      kdfParams: { iterations: BACKUP_KDF_ITERATIONS },
      salt: saltB64,
      nonce: nonceB64,
    },
  };

  validateHeader(fullHeader);

  const key = await deriveKey(password, saltB64, BACKUP_KDF_ITERATIONS);
  const aad = canonicalizeHeader(fullHeader);
  const enc = new TextEncoder();
  const plaintextBuf = enc.encode(plaintext);

  const subtle = getCrypto();
  const ciphertextBuf = await subtle.encrypt({ name: "AES-GCM", iv: nonceBytes as unknown as BufferSource, additionalData: aad as unknown as BufferSource, tagLength: BACKUP_TAG_BITS }, key, plaintextBuf as unknown as BufferSource);

  const payloadB64 = bufToBase64(ciphertextBuf);

  return {
    magic: fullHeader.magic,
    formatVersion: fullHeader.formatVersion,
    createdAt: fullHeader.createdAt,
    appVersion: fullHeader.appVersion,
    schemaVersion: fullHeader.schemaVersion,
    encryption: fullHeader.encryption,
    payload: payloadB64,
  };
}

// Simpler helper for tests: encrypt with given header (already has salt/nonce)
export async function encryptWithHeader(plaintext: string, password: string, header: BackupHeaderWithoutPayload): Promise<string> {
  validatePassword(password);
  validateHeader(header);
  const key = await deriveKey(password, header.encryption.salt, header.encryption.kdfParams.iterations);
  const aad = canonicalizeHeader(header);
  const nonceBytes = base64ToBuf(header.encryption.nonce);
  const enc = new TextEncoder();
  const plaintextBuf = enc.encode(plaintext);
  const subtle = getCrypto();
  const ciphertextBuf = await subtle.encrypt({ name: "AES-GCM", iv: nonceBytes as unknown as BufferSource, additionalData: aad as unknown as BufferSource, tagLength: BACKUP_TAG_BITS }, key, plaintextBuf as unknown as BufferSource);
  return bufToBase64(ciphertextBuf);
}

export async function decryptPayload(backupFile: BackupFile, password: string): Promise<string> {
  validatePassword(password);
  // Reconstruct header without payload
  const header: BackupHeaderWithoutPayload = {
    magic: backupFile.magic,
    formatVersion: backupFile.formatVersion,
    createdAt: backupFile.createdAt,
    appVersion: backupFile.appVersion,
    schemaVersion: backupFile.schemaVersion,
    encryption: backupFile.encryption,
  };
  validateHeader(header);

  const key = await deriveKey(password, header.encryption.salt, header.encryption.kdfParams.iterations);
  const aad = canonicalizeHeader(header);
  const nonceBytes = base64ToBuf(header.encryption.nonce);
  const ciphertextBytes = base64ToBuf(backupFile.payload);

  const subtle = getCrypto();
  try {
    const plaintextBuf = await subtle.decrypt({ name: "AES-GCM", iv: nonceBytes as unknown as BufferSource, additionalData: aad as unknown as BufferSource, tagLength: BACKUP_TAG_BITS }, key, ciphertextBytes as unknown as BufferSource);
    const dec = new TextDecoder();
    return dec.decode(plaintextBuf);
  } catch {
    // Generic error — do not distinguish wrong password vs corrupted vs header tampered
    throw new Error("Wrong password or corrupted backup.");
  }
}

export async function decryptWithHeader(ciphertextB64: string, password: string, header: BackupHeaderWithoutPayload): Promise<string> {
  const fakeFile: BackupFile = { ...header, payload: ciphertextB64 };
  return decryptPayload(fakeFile, password);
}

// For testing: helpers to generate random salt/nonce without encryption
export function generateSaltB64(): string {
  return bufToBase64(getRandomBytes(BACKUP_SALT_BYTES));
}
export function generateNonceB64(): string {
  return bufToBase64(getRandomBytes(BACKUP_NONCE_BYTES));
}
