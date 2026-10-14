import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Monitor, Moon, Smartphone, Sun, SunMoon, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { adoptVault, changeMasterPassword, loadMeta, lock, MIN_PW, useVaultKey } from '../lib/vault';
import { buildBackup, readBackup } from '../lib/backup';
import { importAccounts, listAccounts } from '../lib/services';
import { setPrefs, usePrefs, type Prefs } from '../lib/prefs';
import { addTemplate, deleteTemplate, listTemplates, seedDefaults, swapOrder, updateTemplate, type Template } from '../lib/templates';

const TABS = ['Generali', 'Step progetto', 'Connessione', 'Account'] as const;
type Tab = (typeof TABS)[number];

export default function Settings() {
  const [tab, setTab] = useState<Tab>('Generali'); const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold text-white">Impostazioni</h1>
      <nav className="flex gap-1 overflow-x-auto border-b border-edge" role="tablist">
        {TABS.map(t => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
          className={`whitespace-nowrap px-4 py-2.5 text-sm ${tab === t ? 'border-b-2 border-accent text-white' : 'text-slate-400'}`}>{t}</button>)}
      </nav>
      {err && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}
      {tab === 'Generali' && <General setErr={setErr} />}
      {tab === 'Step progetto' && <Steps setErr={setErr} />}
      {tab === 'Connessione' && <Connection />}
      {tab === 'Account' && <><Account setErr={setErr} /><ChangePassword setErr={setErr} /><Backup setErr={setErr} /></>}
    </div>
  );
}

function General({ setErr }: { setErr: (s: string | null) => void }) {
  const prefs = usePrefs(); const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  async function change(p: Partial<Prefs>) {
    setState('saving'); setErr(null);
    try { await setPrefs(p); setState('saved'); } catch (e) { setState('error'); setErr('Salvato su questo dispositivo, ma non sul server: ' + (e as Error).message); }
  }
  const opt = (active: boolean, onClick: () => void, Icon: typeof Sun, label: string) => (
    <button aria-pressed={active} onClick={onClick} className={`flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 text-sm ${active ? 'border-accent bg-accent/15 text-white' : 'border-edge hover:bg-white/5'}`}><Icon size={16} />{label}</button>);
  return (
    <div className="space-y-5 rounded-xl border border-edge bg-panel p-4">
      <div><h2 className="mb-2 font-medium text-white">Tema</h2>
        <div className="flex gap-2">{opt(prefs.theme === 'light', () => change({ theme: 'light' }), Sun, 'Chiaro')}{opt(prefs.theme === 'dark', () => change({ theme: 'dark' }), Moon, 'Scuro')}{opt(prefs.theme === 'auto', () => change({ theme: 'auto' }), SunMoon, 'Automatico')}</div></div>
      <div><h2 className="mb-2 font-medium text-white">Anteprima layout</h2>
        <div className="flex gap-2">{opt(prefs.preview === 'pc', () => change({ preview: 'pc' }), Monitor, 'PC')}{opt(prefs.preview === 'phone', () => change({ preview: 'phone' }), Smartphone, 'Smartphone')}</div>
        <p className="mt-2 text-xs text-slate-500">"PC" usa l'adattamento reale al dispositivo. "Smartphone" simula il layout da telefono in una colonna stretta, senza cambiare l'adattamento reale.</p></div>
      <p role="status" className="text-xs text-slate-400">{{ idle: '', saving: 'Salvataggio…', saved: 'Salvato', error: 'Errore di salvataggio' }[state]}</p>
    </div>
  );
}

function Steps({ setErr }: { setErr: (s: string | null) => void }) {
  const [list, setList] = useState<Template[] | null>(null); const [edit, setEdit] = useState<Partial<Template> | null>(null);
  const load = useCallback(async () => { try { setList(await listTemplates()); } catch (e) { setErr((e as Error).message); } }, [setErr]);
  useEffect(() => { load(); }, [load]);
  const run = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); await load(); } catch (e) { setErr((e as Error).message); } };
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!edit?.name?.trim()) return setErr('Il nome dello step è obbligatorio.');
    const f = { name: edit.name.trim(), description: edit.description || null, category: edit.category || null, icon: edit.icon || null, is_required: !!edit.is_required };
    await run(() => edit.id ? updateTemplate(edit.id, f) : addTemplate(f, (list && list.length ? list[list.length - 1].sort_order : -1) + 1)); setEdit(null);
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">Questi modelli vengono copiati nei <b>nuovi</b> progetti. Modificarli non cambia gli step dei progetti già creati.</p>
      {list?.length === 0 && <div className="rounded-xl border border-dashed border-edge p-4 text-sm">Nessun modello: i nuovi progetti usano i 15 step predefiniti. <button className="ml-2 text-accent" onClick={() => run(seedDefaults)}>Carica i predefiniti per modificarli</button></div>}
      <ul className="space-y-2">{list?.map((t, i) => (
        <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-edge bg-panel p-3">
          <div className="min-w-0 flex-1"><p className={t.is_enabled ? '' : 'text-slate-500 line-through'}>{t.icon} {t.name}{t.is_required && <span className="ml-2 text-xs text-amber-300">obbligatorio</span>}</p><p className="truncate text-xs text-slate-500">{t.category}</p></div>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={t.is_enabled} onChange={e => run(() => updateTemplate(t.id, { is_enabled: e.target.checked }))} />Attivo</label>
          <button aria-label="Sposta su" disabled={i === 0} className="p-1 disabled:opacity-30" onClick={() => run(() => swapOrder(t, list[i - 1]))}><ArrowUp size={16} /></button>
          <button aria-label="Sposta giù" disabled={i === list.length - 1} className="p-1 disabled:opacity-30" onClick={() => run(() => swapOrder(t, list[i + 1]))}><ArrowDown size={16} /></button>
          <button className="btn-ghost !py-1.5" onClick={() => setEdit(t)}>Modifica</button>
          <button aria-label="Elimina step" className="p-1 text-red-400" onClick={() => { if (confirm(`Eliminare il modello "${t.name}"? Gli step già presenti nei progetti restano.`)) run(() => deleteTemplate(t.id)); }}><Trash2 size={16} /></button>
        </li>))}</ul>
      <button className="btn-primary" onClick={() => setEdit({ is_required: false })}>+ Aggiungi step</button>
      {edit && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
          <form onSubmit={save} className="w-full max-w-md space-y-3 rounded-t-2xl border border-edge bg-panel p-5 sm:rounded-2xl">
            <h3 className="text-lg font-semibold text-white">{edit.id ? 'Modifica step' : 'Nuovo step'}</h3>
            <label className="block text-sm">Nome *<input className="field mt-1" value={edit.name ?? ''} onChange={e => setEdit({ ...edit, name: e.target.value })} /></label>
            <label className="block text-sm">Descrizione<textarea rows={2} className="field mt-1" value={edit.description ?? ''} onChange={e => setEdit({ ...edit, description: e.target.value })} /></label>
            <div className="flex gap-2"><label className="flex-1 text-sm">Categoria<input className="field mt-1" value={edit.category ?? ''} onChange={e => setEdit({ ...edit, category: e.target.value })} /></label>
              <label className="w-24 text-sm">Icona<input className="field mt-1" maxLength={16} value={edit.icon ?? ''} onChange={e => setEdit({ ...edit, icon: e.target.value })} /></label></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!edit.is_required} onChange={e => setEdit({ ...edit, is_required: e.target.checked })} />Obbligatorio</label>
            <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setEdit(null)}>Annulla</button><button className="btn-primary">Salva</button></div>
          </form>
        </div>)}
    </div>
  );
}

type Conn = { s: 'checking' | 'ok' | 'offline' | 'auth' | 'error'; at?: Date; detail?: string };
function Connection() {
  const [c, setC] = useState<Conn>({ s: 'checking' });
  const host = (() => { try { return new URL(import.meta.env.VITE_SUPABASE_URL as string).host; } catch { return '—'; } })();
  const test = useCallback(async () => {
    setC({ s: 'checking' });
    try {
      const { error, status } = await supabase.from('projects').select('id', { count: 'exact', head: true });
      if (!error) return setC({ s: 'ok', at: new Date() });
      setC({ s: status === 401 || status === 403 || /jwt|apikey|permission/i.test(error.message) ? 'auth' : 'error', at: new Date(), detail: error.message });
    } catch (e) { setC({ s: 'offline', at: new Date(), detail: (e as Error).message }); }
  }, []);
  useEffect(() => { test(); }, [test]);
  const label = { checking: 'Verifica in corso', ok: 'Connesso', offline: 'Errore di rete (non connesso)', auth: 'Errore di autorizzazione', error: 'Errore' }[c.s];
  return (
    <div className="space-y-3 rounded-xl border border-edge bg-panel p-4 text-sm">
      <p className={c.s === 'ok' ? 'text-emerald-400' : c.s === 'checking' ? 'text-slate-300' : 'text-red-400'}>{label}</p>
      <p className="text-slate-400">Progetto Supabase: {host}{c.at && <> · ultimo controllo {c.at.toLocaleTimeString('it-IT')}</>}</p>
      {c.detail && <p className="text-xs text-red-300">{c.detail}</p>}
      <button className="btn-ghost" disabled={c.s === 'checking'} onClick={test}>Testa connessione</button>
    </div>
  );
}

function Account({ setErr }: { setErr: (s: string | null) => void }) {
  const [email, setEmail] = useState(''); const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? '')); }, []);
  async function reset() {
    setErr(null); setMsg(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    error ? setErr(error.message) : setMsg('Email di reimpostazione inviata, se l\'indirizzo è corretto.');
  }
  return (
    <div className="space-y-3 rounded-xl border border-edge bg-panel p-4 text-sm">
      <p>Account: <b className="text-white">{email || '…'}</b></p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-ghost" onClick={reset}>Reimposta password</button>
        <button className="btn-ghost" onClick={lock}>Blocca archivio credenziali</button>
        <button className="btn-ghost" onClick={() => { lock(); supabase.auth.signOut(); }}>Esci</button>
      </div>
      {msg && <p role="status" className="text-emerald-400">{msg}</p>}
    </div>
  );
}

function Backup({ setErr }: { setErr: (s: string | null) => void }) {
  const key = useVaultKey(); const [file, setFile] = useState<File | null>(null); const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function exportIt() {
    setErr(null); setMsg(null);
    try {
      const meta = await loadMeta(); if (!meta || !key) throw new Error('Sblocca l\'archivio credenziali dalla scheda "Servizi e account" di un progetto.');
      const blob = new Blob([await buildBackup(key, meta, await listAccounts())], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `apppilot-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
      setMsg('Backup esportato. Il file è cifrato: serve la master password per leggerlo.');
    } catch (e) { setErr((e as Error).message); }
  }
  async function importIt() {
    if (!file) return; setErr(null); setMsg(null); setBusy(true);
    try {
      const { meta, accounts } = await readBackup(await file.text(), pw);
      const cur = await loadMeta();
      if (cur && cur.salt !== meta.salt) throw new Error('Questo backup appartiene a un archivio con un\'altra master password: non può essere importato qui.');
      if (!cur) await adoptVault(pw, meta);
      const r = await importAccounts(accounts); setMsg(`Importati ${r.added} account (${r.skipped} già presenti).`); setPw('');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-edge bg-panel p-4 text-sm">
      <h2 className="font-medium text-white">Backup cifrato dell'archivio credenziali</h2>
      <p className="text-xs text-slate-400">Contiene gli account dei servizi (non i progetti), interamente cifrati. Senza master password il file è illeggibile: conservalo insieme alla password, in luoghi separati.</p>
      <button className="btn-ghost" onClick={exportIt}>Esporta backup</button>
      <div className="space-y-2 border-t border-edge pt-3">
        <input aria-label="File di backup" type="file" accept="application/json,.json" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <input aria-label="Master password del backup" type="password" autoComplete="off" className="field" placeholder="Master password del backup" value={pw} onChange={e => setPw(e.target.value)} />
        <button className="btn-ghost" disabled={!file || !pw || busy} onClick={importIt}>{busy ? 'Importazione…' : 'Importa backup'}</button>
      </div>
      {msg && <p role="status" className="text-emerald-400">{msg}</p>}
    </div>
  );
}

function ChangePassword({ setErr }: { setErr: (s: string | null) => void }) {
  const [o, setO] = useState(''); const [n, setN] = useState(''); const [n2, setN2] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setMsg(null);
    if (n !== n2) return setErr('Le due nuove master password non coincidono.');
    setBusy(true);
    try { await changeMasterPassword(o, n); setO(''); setN(''); setN2(''); setMsg('Master password cambiata. I vecchi backup richiedono ancora la vecchia password: esegui un nuovo backup.'); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={go} className="mt-4 space-y-2 rounded-xl border border-edge bg-panel p-4 text-sm">
      <h2 className="font-medium text-white">Cambia master password dell'archivio</h2>
      <input aria-label="Master password attuale" type="password" autoComplete="off" className="field" placeholder="Master password attuale" value={o} onChange={e => setO(e.target.value)} />
      <input aria-label="Nuova master password" type="password" autoComplete="off" className="field" placeholder={`Nuova (min. ${MIN_PW} caratteri)`} value={n} onChange={e => setN(e.target.value)} />
      <input aria-label="Ripeti nuova master password" type="password" autoComplete="off" className="field" placeholder="Ripeti la nuova" value={n2} onChange={e => setN2(e.target.value)} />
      <button className="btn-ghost" disabled={busy || !o || !n}>{busy ? 'Ricifratura…' : 'Cambia password'}</button>
      {msg && <p role="status" className="text-emerald-400">{msg}</p>}
    </form>
  );
}
