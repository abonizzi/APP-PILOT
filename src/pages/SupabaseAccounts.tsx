import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, ExternalLink, Pencil, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { loadMeta, useVaultKey, type VaultMeta } from '../lib/vault';
import { safeHttps } from '../lib/detail';
import { linkService, listAccounts, listSupabaseLinks, SUPABASE_LIMIT, unlinkService, type Account, type SbLink } from '../lib/services';
import { AccountForm, Details, VaultBar } from './Services';

type Proj = { id: string; name: string; icon: string | null };

export default function SupabaseAccounts() {
  const key = useVaultKey();
  const [accounts, setAccounts] = useState<Account[]>([]); const [links, setLinks] = useState<SbLink[]>([]); const [projects, setProjects] = useState<Proj[]>([]);
  const [meta, setMeta] = useState<VaultMeta | null | undefined>(undefined); const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState<Account | null | undefined>(undefined); // undefined = chiuso, null = nuovo

  const load = useCallback(async () => {
    try {
      const [a, l, m, p] = await Promise.all([listAccounts(), listSupabaseLinks(), loadMeta(), supabase.from('projects').select('id,name,icon').is('archived_at', null).order('name')]);
      if (p.error) throw new Error(p.error.message);
      setAccounts(a.filter(x => x.service_type === 'Supabase')); setLinks(l); setMeta(m); setProjects((p.data ?? []) as Proj[]); setErr(null);
    } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const copy = (t: string) => navigator.clipboard.writeText(t).catch(() => setErr('Copia non riuscita.'));
  const linkedIds = new Set(links.filter(l => l.service_account_id).map(l => l.project_id));
  const free = projects.filter(p => !linkedIds.has(p.id));
  const used = links.filter(l => accounts.some(a => a.id === l.service_account_id)).length;

  async function assign(a: Account, projectId: string) {
    if (links.filter(l => l.service_account_id === a.id).length >= SUPABASE_LIMIT) return setErr(`L'account "${a.label}" ha già ${SUPABASE_LIMIT} progetti: è occupato.`);
    try { setErr(null); await linkService(projectId, 'Supabase', a); await load(); } catch (e) { setErr((e as Error).message); }
  }
  async function unlink(l: SbLink) {
    if (!confirm(`Togliere "${l.projects?.name ?? 'il progetto'}" da questo account?`)) return;
    try { await unlinkService(l.id); await load(); } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-xl font-semibold text-white">Account Supabase</h1>
          <p className="text-sm text-slate-400">{accounts.length} account · {used}/{accounts.length * SUPABASE_LIMIT} posti usati · massimo {SUPABASE_LIMIT} progetti per account</p></div>
        <button className="btn-primary" onClick={() => setEdit(null)}><Plus size={16} /> Nuovo account</button>
      </div>
      {err && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}
      <VaultBar meta={meta} unlocked={!!key} onDone={load} setErr={setErr} />
      {accounts.length === 0 && meta !== undefined && <p className="rounded-xl border border-dashed border-edge p-6 text-center text-sm text-slate-400">Nessun account Supabase registrato.</p>}
      {accounts.map(a => <AccountCard key={a.id} a={a} linked={links.filter(l => l.service_account_id === a.id)} candidates={free}
        unlocked={!!key} keyObj={key} onAssign={p => assign(a, p)} onUnlink={unlink} onEdit={() => setEdit(a)} copy={copy} setErr={setErr} />)}
      {edit !== undefined && <AccountForm type="Supabase" account={edit} keyObj={key} onClose={() => setEdit(undefined)} onSaved={async () => { setEdit(undefined); await load(); }} />}
    </div>
  );
}

function AccountCard({ a, linked, candidates, unlocked, keyObj, onAssign, onUnlink, onEdit, copy, setErr }: {
  a: Account; linked: SbLink[]; candidates: Proj[]; unlocked: boolean; keyObj: CryptoKey | null;
  onAssign: (projectId: string) => void; onUnlink: (l: SbLink) => void; onEdit: () => void; copy: (t: string) => void; setErr: (s: string | null) => void;
}) {
  const [sel, setSel] = useState(''); const [open, setOpen] = useState(false);
  const n = linked.length, full = n >= SUPABASE_LIMIT;
  const url = (a.login_url && safeHttps(a.login_url)) || 'https://supabase.com/dashboard';
  const badge = full ? 'bg-red-500/20 text-red-300' : n === 1 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300';
  return (
    <section className="space-y-3 rounded-xl border border-edge bg-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><p className="font-medium text-white">{a.label}</p>
          <p className="flex items-center gap-2 text-sm text-slate-300"><span className="truncate">{a.email ?? a.username ?? 'Email mancante'}</span>
            {a.email && <button aria-label="Copia email" onClick={() => copy(a.email!)}><Copy size={14} /></button>}</p></div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs ${badge}`}>{full ? 'Occupato' : 'Disponibile'} · {n}/{SUPABASE_LIMIT}</span>
      </div>
      <ul className="space-y-1 text-sm">
        {linked.map(l => <li key={l.id} className="flex items-center justify-between gap-2 rounded-lg border border-edge px-3 py-2">
          <Link to={`/progetti/${l.project_id}`} className="min-w-0 truncate hover:underline">{l.projects?.icon} {l.projects?.name ?? 'Progetto'}</Link>
          <button aria-label="Togli progetto" className="text-slate-400 hover:text-white" onClick={() => onUnlink(l)}><X size={14} /></button></li>)}
        {n === 0 && <li className="text-slate-500">Nessun progetto associato.</li>}
      </ul>
      {!full && (candidates.length ? (
        <div className="flex flex-wrap gap-2">
          <select aria-label="Progetto da associare" className="field w-auto flex-1" value={sel} onChange={e => setSel(e.target.value)}>
            <option value="">Associa un progetto…</option>{candidates.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}</select>
          <button className="btn-ghost" disabled={!sel} onClick={() => { onAssign(sel); setSel(''); }}>Associa</button>
        </div>) : <p className="text-xs text-slate-500">Tutti i progetti sono già associati a un account Supabase.</p>)}
      <div className="flex flex-wrap gap-2">
        <a className="btn-ghost !py-1.5" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Apri Supabase</a>
        <button className="btn-ghost !py-1.5" onClick={() => setOpen(!open)}>Password e dettagli</button>
        <button aria-label="Modifica account" className="btn-ghost !py-1.5" onClick={onEdit}><Pencil size={14} /></button>
      </div>
      {open && <Details acc={a} unlocked={unlocked} keyObj={keyObj} copy={copy} setErr={setErr} />}
    </section>
  );
}
