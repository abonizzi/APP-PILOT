import { supabase } from './supabase';
import { decryptJson, encryptJson, type EncPayload } from './crypto';

export const SERVICES = ['ChatGPT', 'Claude', 'Supabase', 'GitHub', 'Resend', 'Netlify'] as const;
export interface Account { id: string; service_type: string; label: string; email: string | null; username: string | null; login_url: string | null; project_reference: string | null; encrypted_payload: EncPayload | null }
export interface Secrets { password?: string; apiKey?: string; token?: string }
export interface ConfigRow { label: string; value: string; secret: boolean }
export interface ProjectService { id: string; service_type: string; service_account_id: string | null; configuration_status: string;
  public_metadata: { fields?: { label: string; value: string }[] } | null; encrypted_payload: EncPayload | null }
/** Nome servizio normalizzato: se coincide (senza maiuscole) con uno predefinito usa quello. */
export const canonService = (name: string) => SERVICES.find(s => s.toLowerCase() === name.trim().toLowerCase()) ?? name.trim();
export const defaultRows = (type: string): ConfigRow[] => type === 'Supabase'
  ? [{ label: 'URL progetto', value: '', secret: false }, { label: 'ID progetto', value: '', secret: false }, { label: 'Chiave anon/publishable', value: '', secret: false }]
  : [{ label: 'URL API', value: '', secret: false }, { label: 'API key', value: '', secret: true }];
type R<T> = { data: T | null; error: { message: string } | null };
const ok = <T,>(r: R<T>): T => { if (r.error) throw new Error(r.error.message); return r.data as T; };

export const listAccounts = async () => ok(await supabase.from('service_accounts').select('*').order('label')) as Account[];
export const listProjectServices = async (pid: string) => ok(await supabase.from('project_services').select('*').eq('project_id', pid)) as ProjectService[];

export type AccountFields = Pick<Account, 'label' | 'email' | 'username' | 'login_url' | 'project_reference'>;
/**
 * `replace` = true solo quando i segreti esistenti sono stati caricati nel form (archivio sbloccato):
 * allora il payload viene sostituito per intero (anche svuotato). Se false, il payload esistente resta intatto.
 */
export async function saveAccount(id: string | null, type: string, f: AccountFields, secrets: Secrets, key: CryptoKey | null, replace: boolean) {
  const clean = Object.fromEntries(Object.entries(secrets).filter(([, v]) => v)) as Secrets;
  const row: Record<string, unknown> = { service_type: type, ...f };
  if (Object.keys(clean).length) { if (!key) throw new Error('Sblocca l\'archivio per salvare password o chiavi.'); row.encrypted_payload = await encryptJson(key, clean); }
  else if (replace && key) row.encrypted_payload = null;
  const q = id ? supabase.from('service_accounts').update(row).eq('id', id) : supabase.from('service_accounts').insert(row);
  return ok(await q.select().single()) as Account;
}
export const revealSecrets = (a: Account, key: CryptoKey) => a.encrypted_payload ? decryptJson<Secrets>(key, a.encrypted_payload) : Promise.resolve({} as Secrets);

export async function linkService(projectId: string, type: string, a: Account | null) {
  const status = !a ? 'missing' : a.email || a.username ? 'configured' : 'partial';
  ok(await supabase.from('project_services').upsert({ project_id: projectId, service_type: type, service_account_id: a?.id ?? null, configuration_status: status }, { onConflict: 'project_id,service_type' }).select());
}

/** Reinserisce gli account del backup che non esistono già (stesso servizio, nome ed email). */
export async function importAccounts(list: Pick<Account, 'service_type' | 'label' | 'email' | 'username' | 'login_url' | 'project_reference' | 'encrypted_payload'>[]) {
  const sig = (a: { service_type: string; label: string; email: string | null }) => `${a.service_type}|${a.label}|${a.email ?? ''}`;
  const have = new Set((await listAccounts()).map(sig));
  const fresh = list.filter(a => !have.has(sig(a)));
  if (fresh.length) ok(await supabase.from('service_accounts').insert(fresh).select());
  return { added: fresh.length, skipped: list.length - fresh.length };
}

export const SUPABASE_LIMIT = 2;
export interface SbLink { id: string; project_id: string; service_account_id: string | null; projects: { id: string; name: string; icon: string | null } | null }
/** Tutte le associazioni progetto ↔ account Supabase dell'utente. */
export const listSupabaseLinks = async () =>
  ok(await supabase.from('project_services').select('id, project_id, service_account_id, projects(id, name, icon)').eq('service_type', 'Supabase')) as unknown as SbLink[];
export const unlinkService = async (id: string) => { ok(await supabase.from('project_services').delete().eq('id', id).select()); };

export const revealProjectSecrets = async (ps: ProjectService, key: CryptoKey): Promise<ConfigRow[]> =>
  ps.encrypted_payload ? (await decryptJson<{ fields: { label: string; value: string }[] }>(key, ps.encrypted_payload)).fields.map(f => ({ ...f, secret: true })) : [];

/** Salva i dati del progetto per un servizio senza toccare l'account collegato (upsert parziale). */
export async function saveProjectConfig(projectId: string, type: string, plain: ConfigRow[], secrets: ConfigRow[], key: CryptoKey | null, replace: boolean) {
  const row: Record<string, unknown> = { project_id: projectId, service_type: type, public_metadata: { fields: plain.map(({ label, value }) => ({ label: label.trim(), value })) } };
  if (replace && key) row.encrypted_payload = secrets.length ? await encryptJson(key, { fields: secrets.map(({ label, value }) => ({ label: label.trim(), value })) }) : null;
  ok(await supabase.from('project_services').upsert(row, { onConflict: 'project_id,service_type' }).select());
}
