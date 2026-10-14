import { describe, it, expect } from 'vitest';
import { decryptJson, deriveKey, encryptJson, newSalt } from './crypto';

const ITER = 1000; // veloce nei test
describe('cifratura credenziali', () => {
  it('cifra e decifra', async () => {
    const salt = newSalt(); const k = await deriveKey('master-password-1', salt, ITER);
    const p = await encryptJson(k, { password: 'segreto', apiKey: 'abc' });
    expect(p.ct).not.toContain('segreto');
    expect(await decryptJson(await deriveKey('master-password-1', salt, ITER), p)).toEqual({ password: 'segreto', apiKey: 'abc' });
  });
  it('fallisce con master password errata', async () => {
    const salt = newSalt(); const p = await encryptJson(await deriveKey('giusta-12345', salt, ITER), { a: 1 });
    await expect(decryptJson(await deriveKey('sbagliata-12', salt, ITER), p)).rejects.toThrow(/Decifratura non riuscita/);
  });
  it('fallisce se il testo cifrato è alterato', async () => {
    const salt = newSalt(); const k = await deriveKey('pw-lunga-123', salt, ITER); const p = await encryptJson(k, { a: 1 });
    const bad = { ...p, ct: (p.ct[0] === 'A' ? 'B' : 'A') + p.ct.slice(1) };
    await expect(decryptJson(k, bad)).rejects.toThrow();
  });
  it('usa un IV diverso a ogni cifratura', async () => {
    const k = await deriveKey('pw-lunga-123', newSalt(), ITER);
    expect((await encryptJson(k, 'x')).iv).not.toBe((await encryptJson(k, 'x')).iv);
  });
});
