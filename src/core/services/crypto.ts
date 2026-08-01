export class CryptoService {
  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  static async encrypt(text: string, password: string): Promise<string> {
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(password, salt);

    const encryptedContent = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      enc.encode(text)
    );

    const encryptedBytes = new Uint8Array(encryptedContent);
    const combined = new Uint8Array(salt.length + iv.length + encryptedBytes.length);
    
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(encryptedBytes, salt.length + iv.length);

    let binary = '';
    for (let offset = 0; offset < combined.length; offset += 8192) {
      binary += String.fromCharCode(...combined.subarray(offset, offset + 8192));
    }
    return btoa(binary);
  }

  static async decrypt(base64Data: string, password: string): Promise<string> {
    const binary = atob(base64Data);
    const combined = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      combined[i] = binary.charCodeAt(i);
    }
    
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 16 + 12);
    const data = combined.slice(16 + 12);

    const key = await this.deriveKey(password, salt);

    const decryptedContent = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      data
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedContent);
  }
  
  static generateSecureKey(): string {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}
