import { useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { decryptJson, deriveKey, encryptJson, ITERATIONS, newSalt, saltFromB64, saltToB64, type EncPayload } from './crypto';

export interface VaultMeta { v: 1; salt: string; iter: number; check: EncPayload }
const CHECK = 'apppilot-vault-ok', AUTO_LOCK_MS = 10 * 60 * 1000;
export const MIN_PW = 12;

// La chiave vive SOLO in memoria (mai in localStorage né nel database).
let key: CryptoKey | null = null, timer: ReturnType<typeof setTimeout> | undefined;
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());
const setKey = (k: CryptoKey | null) => { key = k; clearTimeout(timer); if (k) timer = setTimeout(lock, AUTO_LOCK_MS); emit(); };
export const lock = () => setKey(null);
export const useVaultKey = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f); }; }, () => key);

async function profile() {
  const { data: u } = await supabase.auth.getUser(); if (!u.user) throw new Error('Sessione non valida.');
  const { data, error } = await supabase.from('profiles').select('preferences').eq('id', u.user.id).maybeSingle();
  if (error) throw new Error(error.message);
  return { id: u.user.id, prefs: (data?.preferences ?? {}) as Record<string, unknown> };
}
export async function loadMeta(): Promise<VaultMeta | null> { return ((await profile()).prefs.vault as VaultMeta) ?? null; }

export async function createVault(password: string) {
  if (password.length < MIN_PW) throw new Error(`La master password deve avere almeno ${MIN_PW} caratteri.`);
  const salt = newSalt(); const k = await deriveKey(password, salt);
  const meta: VaultMeta = { v: 1, salt: saltToB64(salt), iter: ITERATIONS, check: await encryptJson(k, CHECK) };
  const { id, prefs } = await profile();
  const { error } = await supabase.from('profiles').upsert({ id, preferences: { ...prefs, vault: meta } });
  if (error) throw new Error(error.message);
  setKey(k); return meta;
}
export async function unlockVault(password: string, meta: VaultMeta) {
  const k = await deriveKey(password, saltFromB64(meta.salt), meta.iter);
  if ((await decryptJson<string>(k, meta.check)) !== CHECK) throw new Error('Master password errata.');
  setKey(k);
}

/** Ripristino su un database senza archivio: adotta i metadati del backup dopo aver verificato la master password. */
export async function adoptVault(password: string, meta: VaultMeta) {
  await unlockVault(password, meta);
  const { id, prefs } = await profile();
  const { error } = await supabase.from('profiles').upsert({ id, preferences: { ...prefs, vault: meta } });
  if (error) throw new Error(error.message);
}

/** Cambia la master password: ricifra tutti i segreti e aggiorna i metadati in UNA transazione (funzione SQL rekey_vault). */
export async function changeMasterPassword(oldPw: string, newPw: string) {
  if (newPw.length < MIN_PW) throw new Error(`La nuova master password deve avere almeno ${MIN_PW} caratteri.`);
  const meta = await loadMeta(); if (!meta) throw new Error('L\'archivio non è ancora stato creato.');
  const oldKey = await deriveKey(oldPw, saltFromB64(meta.salt), meta.iter);
  try { if ((await decryptJson<string>(oldKey, meta.check)) !== CHECK) throw new Error(); } catch { throw new Error('Master password attuale errata.'); }
  const { data, error } = await supabase.from('service_accounts').select('id, encrypted_payload').not('encrypted_payload', 'is', null);
  if (error) throw new Error(error.message);
  const salt = newSalt(); const nk = await deriveKey(newPw, salt);
  const payloads: { id: string; payload: EncPayload }[] = [];
  for (const r of data ?? []) payloads.push({ id: r.id, payload: await encryptJson(nk, await decryptJson(oldKey, r.encrypted_payload)) });
  const newMeta: VaultMeta = { v: 1, salt: saltToB64(salt), iter: ITERATIONS, check: await encryptJson(nk, CHECK) };
  const { error: e2 } = await supabase.rpc('rekey_vault', { new_meta: newMeta, payloads });
  if (e2) throw new Error(e2.message);
  setKey(nk);
}
