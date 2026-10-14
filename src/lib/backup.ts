import { decryptJson, deriveKey, encryptJson, saltFromB64, type EncPayload } from './crypto';
import type { Account } from './services';
import type { VaultMeta } from './vault';

// Backup interamente cifrato (anche email e URL) con la chiave dell'archivio; nessun dato in chiaro nel file.
export type BackupAccount = Pick<Account, 'service_type' | 'label' | 'email' | 'username' | 'login_url' | 'project_reference' | 'encrypted_payload'>;
interface BackupFile { app: 'apppilot-backup'; v: 1; created: string; meta: VaultMeta; data: EncPayload }

export async function buildBackup(key: CryptoKey, meta: VaultMeta, accounts: Account[]): Promise<string> {
  const list: BackupAccount[] = accounts.map(a => ({ service_type: a.service_type, label: a.label, email: a.email, username: a.username, login_url: a.login_url, project_reference: a.project_reference, encrypted_payload: a.encrypted_payload }));
  const f: BackupFile = { app: 'apppilot-backup', v: 1, created: new Date().toISOString(), meta, data: await encryptJson(key, { accounts: list }) };
  return JSON.stringify(f);
}

export async function readBackup(text: string, password: string): Promise<{ meta: VaultMeta; accounts: BackupAccount[] }> {
  let f: BackupFile;
  try { f = JSON.parse(text); } catch { throw new Error('File di backup non valido.'); }
  if (f?.app !== 'apppilot-backup' || f.v !== 1 || !f.meta || !f.data) throw new Error('Il file non è un backup di AppPilot.');
  const key = await deriveKey(password, saltFromB64(f.meta.salt), f.meta.iter);
  const { accounts } = await decryptJson<{ accounts: BackupAccount[] }>(key, f.data); // errore chiaro se la password è errata
  return { meta: f.meta, accounts };
}
