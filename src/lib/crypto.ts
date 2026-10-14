// Cifratura lato client con Web Crypto: PBKDF2-SHA256 -> AES-256-GCM. La master password e la chiave non lasciano mai il browser.
const enc = new TextEncoder(), dec = new TextDecoder();
export interface EncPayload { v: 1; iv: string; ct: string }
export const ITERATIONS = 600_000;

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const newSalt = () => crypto.getRandomValues(new Uint8Array(16));
export const saltToB64 = (s: Uint8Array) => b64(s);
export const saltFromB64 = unb64;

export async function deriveKey(password: string, salt: BufferSource, iterations = ITERATIONS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); // non esportabile
}

/** Nonce (IV) da 12 byte casuale per ogni cifratura. */
export async function encryptJson(key: CryptoKey, data: unknown): Promise<EncPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)));
  return { v: 1, iv: b64(iv), ct: b64(ct) };
}

export async function decryptJson<T>(key: CryptoKey, p: EncPayload): Promise<T> {
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(p.iv) }, key, unb64(p.ct));
    return JSON.parse(dec.decode(pt)) as T;
  } catch { throw new Error('Decifratura non riuscita: master password errata o dati alterati.'); }
}
