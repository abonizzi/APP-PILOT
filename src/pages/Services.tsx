import { useCallback, useEffect, useState } from 'react';
import { Copy, ExternalLink, Eye, EyeOff, Lock, Pencil, Unlock } from 'lucide-react';
import { createVault, loadMeta, lock, MIN_PW, unlockVault, useVaultKey, type VaultMeta } from '../lib/vault';
import { safeHttps } from '../lib/detail';
import { linkService, listAccounts, listProjectServices, revealSecrets, saveAccount, SERVICES, listSupabaseLinks, SUPABASE_LIMIT, type Account, type ProjectService, type SbLink, type Secrets } from '../lib/services';

export default function Services({ projectId, setErr }: { projectId: string; setErr: (s: string | null) => void }) {
  const key = useVaultKey();
  const [accounts, setAccounts] = useState<Account[]>([]); const [links, setLinks] = useState<ProjectService[]>([]);
  const [meta, setMeta] = useState<VaultMeta | null | undefined>(undefined); const [sbLinks, setSbLinks] = useState<SbLink[]>([]);
  const [edit, setEdit] = useState<{ type: string; account: Account | null } | null>(null); const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const [a, l, m, sl] = await Promise.all([listAccounts(), listProjectServices(projectId), loadMeta(), listSupabaseLinks()]); setAccounts(a); setLinks(l); setMeta(m); setSbLinks(sl); setErr(null); }
    catch (e) { setErr((e as Error).message); }
  }, [projectId, setErr]);
  useEffect(() => { load(); }, [load]);
  const copy = (t: string) => navigator.clipboard.writeText(t).catch(() => setErr('Copia non riuscita.'));

  return (
    <div className="space-y-3">
      <VaultBar meta={meta} unlocked={!!key} onDone={load} setErr={setErr} />
      {SERVICES.map(type => {
        const link = links.find(l => l.service_type === type); const acc = accounts.find(a => a.id === link?.service_account_id) ?? null;
        const mine = accounts.filter(a => a.service_type === type); const url = acc?.login_url ? safeHttps(acc.login_url) : null;
        const missing = !acc ? 'Nessun account' : !acc.email && !acc.username ? 'Email mancante' : null;
        return (
          <section key={type} className="rounded-xl border border-edge bg-panel p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0"><p className="font-medium text-white">{type}</p>
                <p className="truncate text-sm text-slate-400">{acc ? `${acc.label} — ${acc.email ?? acc.username ?? 'dati mancanti'}` : 'Non configurato'}
                  {missing && acc && <span className="ml-2 text-amber-300">· {missing}</span>}</p></div>
              <div className="flex flex-wrap gap-2">
                {url && <a className="btn-ghost !py-1.5" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Apri servizio</a>}
                {acc?.email && <button aria-label="Copia email" className="btn-ghost !py-1.5" onClick={() => copy(acc.email!)}><Copy size={14} /></button>}
                {acc && <button className="btn-ghost !py-1.5" onClick={() => setOpen(open === type ? null : type)}>Dettagli</button>}
                {acc && <button aria-label="Modifica account" className="btn-ghost !py-1.5" onClick={() => setEdit({ type, account: acc })}><Pencil size={14} /></button>}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <select aria-label={`Account ${type}`} className="field w-auto" value={acc?.id ?? ''}
                onChange={e => linkService(projectId, type, accounts.find(a => a.id === e.target.value) ?? null).then(load).catch(x => setErr(x.message))}>
                <option value="">— nessun account —</option>{mine.map(a => { const n = type === 'Supabase' ? sbLinks.filter(x => x.service_account_id === a.id).length : 0; const full = n >= SUPABASE_LIMIT && a.id !== acc?.id; return <option key={a.id} value={a.id} disabled={full}>{a.label}{type === 'Supabase' ? ` (${n}/${SUPABASE_LIMIT})` : ''}{full ? ' — occupato' : ''}</option>; })}</select>
              <button className="btn-ghost" onClick={() => setEdit({ type, account: null })}>+ Nuovo account</button>
            </div>
            {open === type && acc && <Details acc={acc} unlocked={!!key} keyObj={key} copy={copy} setErr={setErr} />}
          </section>);
      })}
      {edit && <AccountForm {...edit} keyObj={key} onClose={() => setEdit(null)}
        onSaved={async a => { try { if (!edit.account) await linkService(projectId, edit.type, a); setEdit(null); await load(); } catch (e) { setErr((e as Error).message); } }} />}
    </div>
  );
}

export function VaultBar({ meta, unlocked, onDone, setErr }: { meta: VaultMeta | null | undefined; unlocked: boolean; onDone: () => void; setErr: (s: string | null) => void }) {
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [busy, setBusy] = useState(false);
  if (meta === undefined) return null;
  if (unlocked) return <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm"><span><Unlock size={14} className="mr-1 inline" />Archivio sbloccato (si blocca dopo 10 minuti)</span><button className="btn-ghost !py-1.5" onClick={lock}>Blocca</button></div>;
  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (!meta && pw !== pw2) return setErr('Le due master password non coincidono.');
    setBusy(true);
    try { if (meta) await unlockVault(pw, meta); else await createVault(pw); setPw(''); setPw2(''); onDone(); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={go} className="space-y-2 rounded-xl border border-edge bg-panel p-3">
      <p className="text-sm"><Lock size={14} className="mr-1 inline" />{meta ? 'Archivio credenziali bloccato' : 'Crea l\'archivio credenziali'}</p>
      {!meta && <p className="text-xs text-amber-300">La master password non è salvata da nessuna parte: se la perdi, password e chiavi cifrate non sono recuperabili. Conservala in un posto sicuro.</p>}
      <input aria-label="Master password" type="password" autoComplete="off" className="field" placeholder={`Master password (min. ${MIN_PW} caratteri)`} value={pw} onChange={e => setPw(e.target.value)} />
      {!meta && <input aria-label="Ripeti master password" type="password" autoComplete="off" className="field" placeholder="Ripeti la master password" value={pw2} onChange={e => setPw2(e.target.value)} />}
      <button className="btn-primary" disabled={busy || !pw}>{busy ? 'Attendere…' : meta ? 'Sblocca' : 'Crea archivio'}</button>
    </form>
  );
}

export function Details({ acc, unlocked, keyObj, copy, setErr }: { acc: Account; unlocked: boolean; keyObj: CryptoKey | null; copy: (t: string) => void; setErr: (s: string | null) => void }) {
  const [s, setS] = useState<Secrets | null>(null);
  useEffect(() => { if (!unlocked) setS(null); }, [unlocked]); // chiudere l'archivio cancella i valori dall'interfaccia
  const labels: [keyof Secrets, string][] = [['password', 'Password'], ['apiKey', 'API key'], ['token', 'Token']];
  async function reveal() { try { setS(await revealSecrets(acc, keyObj!)); } catch (e) { setErr((e as Error).message); } }
  return (
    <div className="mt-3 space-y-1 border-t border-edge pt-3 text-sm">
      <p className="text-slate-400">Username: {acc.username ?? '—'} · Riferimento: {acc.project_reference ?? '—'}</p>
      {!acc.encrypted_payload ? <p className="text-slate-500">Nessun dato sensibile salvato.</p>
        : !unlocked ? <p className="text-amber-300">Sblocca l'archivio per vedere i dati sensibili.</p>
        : s === null ? <button className="btn-ghost" onClick={reveal}><Eye size={14} /> Mostra dati sensibili</button>
        : <>{labels.filter(([k]) => s[k]).map(([k, l]) => (
            <div key={k} className="flex items-center gap-2"><span className="w-20 text-slate-400">{l}</span><code className="min-w-0 flex-1 truncate">{s[k]}</code>
              <button aria-label={`Copia ${l}`} onClick={() => copy(s[k]!)}><Copy size={14} /></button></div>))}
          <button className="btn-ghost" onClick={() => setS(null)}><EyeOff size={14} /> Nascondi</button></>}
    </div>
  );
}

export function AccountForm({ type, account, keyObj, onClose, onSaved }: { type: string; account: Account | null; keyObj: CryptoKey | null; onClose: () => void; onSaved: (a: Account) => void }) {
  const [f, setF] = useState({ label: account?.label ?? '', email: account?.email ?? '', username: account?.username ?? '', login_url: account?.login_url ?? '', project_reference: account?.project_reference ?? '' });
  const [sec, setSec] = useState<Secrets>({}); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!f.label.trim()) return setErr('Dai un nome all\'account.');
    const url = f.login_url.trim() ? safeHttps(f.login_url) : null; if (f.login_url.trim() && !url) return setErr('L\'URL deve iniziare con https://');
    setBusy(true); setErr(null);
    try { onSaved(await saveAccount(account?.id ?? null, type, { label: f.label.trim(), email: f.email.trim() || null, username: f.username.trim() || null, login_url: url, project_reference: f.project_reference.trim() || null }, sec, keyObj)); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  }
  const row = (k: keyof typeof f, l: string, t = 'text') => <label className="block text-sm">{l}<input type={t} className="field mt-1" value={f[k]} onChange={set(k)} /></label>;
  const secret = (k: keyof Secrets, l: string) => <label className="block text-sm">{l}<input type="password" autoComplete="new-password" disabled={!keyObj} className="field mt-1" value={sec[k] ?? ''} onChange={e => setSec({ ...sec, [k]: e.target.value })} /></label>;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <form onSubmit={submit} className="max-h-full w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl border border-edge bg-panel p-5 sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-white">{account ? 'Modifica' : 'Nuovo'} account {type}</h2>
        {row('label', 'Nome account *')}{row('email', 'Email', 'email')}{row('username', 'Username')}{row('login_url', 'URL di accesso')}{row('project_reference', 'ID progetto / organizzazione')}
        <p className="text-xs text-slate-400">{keyObj ? (account?.encrypted_payload ? 'Lascia vuoti i campi segreti per non modificarli.' : 'I campi segreti vengono cifrati prima dell\'invio.') : 'Sblocca l\'archivio per inserire password, API key o token.'}</p>
        {secret('password', 'Password')}{secret('apiKey', 'API key')}{secret('token', 'Token')}
        {err && <p role="alert" className="text-sm text-red-400">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Annulla</button><button className="btn-primary" disabled={busy}>Salva</button></div>
      </form>
    </div>
  );
}
