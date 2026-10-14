import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, CircleCheck, Hammer, Lightbulb, MoreHorizontal, Plus, RefreshCw, Rocket, Search, Trash2, Wifi, WifiOff } from 'lucide-react';
import { computeProgress, STATUS_LABELS, type ProjectStatus } from '../lib/domain';
import { archiveProject, createProject, deleteProject, duplicateProject, listProjects, setStatus, type ProjectRow } from '../lib/projects';

const META: Record<ProjectStatus, { icon: typeof Lightbulb; cls: string }> = {
  idea: { icon: Lightbulb, cls: 'bg-slate-500/20 text-slate-300' },
  work_in_progress: { icon: Hammer, cls: 'bg-blue-500/20 text-blue-300' },
  to_deploy: { icon: Rocket, cls: 'bg-amber-500/20 text-amber-300' },
  deployed: { icon: CircleCheck, cls: 'bg-emerald-500/20 text-emerald-300' },
  updating: { icon: RefreshCw, cls: 'bg-violet-500/20 text-violet-300' },
};
const STATUSES = Object.keys(META) as ProjectStatus[];
type Sort = 'updated_at' | 'created_at' | 'name' | 'progress';

const pct = (p: ProjectRow) => computeProgress(p.project_checklist_items).percent ?? -1;

export default function Dashboard() {
  const [rows, setRows] = useState<ProjectRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState<'checking' | 'ok' | 'error'>('checking');
  const [q, setQ] = useState(''); const [filter, setFilter] = useState<ProjectStatus | null>(null);
  const [sort, setSort] = useState<Sort>('updated_at'); const [modal, setModal] = useState(false); const [dup, setDup] = useState<ProjectRow | null>(null);

  const load = useCallback(async () => {
    try { setRows(await listProjects()); setError(null); setOnline('ok'); }
    catch (e) { setError((e as Error).message); setOnline('error'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(fn: () => Promise<void>) { try { await fn(); await load(); } catch (e) { setError((e as Error).message); } }

  const counts = useMemo(() => Object.fromEntries(STATUSES.map(s => [s, (rows ?? []).filter(r => r.status === s).length])), [rows]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows ?? []).filter(r => (!filter || r.status === filter) &&
      (!t || [r.name, r.description ?? '', ...r.tags].some(x => x.toLowerCase().includes(t))))
      .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'progress' ? pct(b) - pct(a) : b[sort].localeCompare(a[sort]));
  }, [rows, q, filter, sort]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-60">
          <Search size={16} className="absolute left-3 top-3 text-slate-500" />
          <input aria-label="Cerca progetti" className="field pl-9" placeholder="Cerca progetti… (nome, descrizione, tag)" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <span className={`flex items-center gap-1.5 text-xs ${online === 'ok' ? 'text-emerald-400' : online === 'error' ? 'text-red-400' : 'text-slate-400'}`}>
          {online === 'error' ? <WifiOff size={14} /> : <Wifi size={14} />}
          {online === 'ok' ? 'Supabase connesso' : online === 'error' ? 'Errore di connessione' : 'Verifica in corso'}</span>
        <button className="btn-primary" onClick={() => setModal(true)}><Plus size={16} /> Nuovo progetto</button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {STATUSES.map(s => { const M = META[s]; return (
          <button key={s} onClick={() => setFilter(filter === s ? null : s)} aria-pressed={filter === s}
            className={`rounded-xl border p-3 text-left ${filter === s ? 'border-accent bg-accent/10' : 'border-edge bg-panel hover:bg-white/5'}`}>
            <M.icon size={18} className={M.cls.split(' ')[1]} />
            <div className="mt-2 text-xs text-slate-400">{STATUS_LABELS[s]}</div>
            <div className="text-2xl font-semibold text-white">{counts[s] ?? 0}</div>
          </button>); })}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <label htmlFor="sort" className="text-slate-400">Ordina per</label>
        <select id="sort" className="field w-auto" value={sort} onChange={e => setSort(e.target.value as Sort)}>
          <option value="updated_at">Ultima modifica</option><option value="created_at">Creazione</option>
          <option value="name">Nome</option><option value="progress">Avanzamento</option></select>
        {filter && <button className="text-accent" onClick={() => setFilter(null)}>Rimuovi filtro</button>}
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      {rows === null && !error && <p className="text-slate-400">Caricamento…</p>}
      {rows?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-edge p-10 text-center">
          <Rocket className="mx-auto text-accent" size={36} />
          <p className="mt-3 text-white">Nessun progetto, per ora.</p>
          <p className="text-sm text-slate-400">Registra la tua prima idea per una web app.</p>
          <button className="btn-primary mt-4" onClick={() => setModal(true)}><Plus size={16} /> Crea il primo progetto</button>
        </div>)}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map(p => <Card key={p.id} p={p} act={act} onDup={() => setDup(p)} />)}
      </div>
      {dup && <DuplicateModal p={dup} onClose={() => setDup(null)} onDone={() => { setDup(null); load(); }} />}
      {modal && <NewProject onClose={() => setModal(false)} onCreated={() => { setModal(false); load(); }} />}
    </div>
  );
}

function Card({ p, act, onDup }: { p: ProjectRow; act: (f: () => Promise<void>) => void; onDup: () => void }) {
  const M = META[p.status]; const pr = computeProgress(p.project_checklist_items);
  return (
    <article className="rounded-xl border border-edge bg-panel p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-xl">{p.icon}</div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-white"><Link to={`/progetti/${p.id}`} className="hover:underline">{p.name}</Link></h3>
          <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${M.cls}`}><M.icon size={12} />{STATUS_LABELS[p.status]}</span>
        </div>
        <details className="relative">
          <summary aria-label="Azioni rapide" className="cursor-pointer list-none rounded p-1 hover:bg-white/10"><MoreHorizontal size={18} /></summary>
          <div className="absolute right-0 z-10 mt-1 w-48 space-y-1 rounded-lg border border-edge bg-night p-2 text-sm shadow-xl">
            <label className="block text-xs text-slate-400">Cambia stato
              <select className="field mt-1" value={p.status} onChange={e => act(() => setStatus(p.id, e.target.value as ProjectStatus))}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></label>
            <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-white/5" onClick={onDup}>Duplica</button>
            <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-white/5" onClick={() => act(() => archiveProject(p.id))}><Archive size={14} />Archivia</button>
            <button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-red-400 hover:bg-red-500/10"
              onClick={() => { if (confirm(`Eliminare definitivamente "${p.name}"?`)) act(() => deleteProject(p.id)); }}><Trash2 size={14} />Elimina</button>
          </div>
        </details>
      </div>
      {p.description && <p className="mt-3 line-clamp-2 text-sm text-slate-400">{p.description}</p>}
      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pr.percent ?? 0} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-accent" style={{ width: `${pr.percent ?? 0}%` }} /></div>
        <span className="text-xs text-slate-400">{pr.applicable ? `${pr.done}/${pr.applicable}` : '—'}</span>
      </div>
      <p className="mt-2 text-xs text-slate-500">Ultima modifica: {new Date(p.updated_at).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })}</p>
    </article>
  );
}

function NewProject({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState(''); const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🚀'); const [status, setStatus] = useState<ProjectStatus>('idea');
  const [tags, setTags] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!name.trim()) return setErr('Il nome è obbligatorio.');
    setBusy(true); setErr(null);
    try { await createProject({ name, description, icon, status, tags: tags.split(',').map(t => t.trim()).filter(Boolean) }); onCreated(); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  }
  return (
    <div role="dialog" aria-modal="true" aria-label="Nuovo progetto" className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <form onSubmit={submit} className="max-h-full w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl border border-edge bg-panel p-5 sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-white">Nuovo progetto</h2>
        <div className="flex gap-2">
          <label className="w-16 text-sm">Icona<input className="field mt-1 text-center" maxLength={4} value={icon} onChange={e => setIcon(e.target.value)} /></label>
          <label className="flex-1 text-sm">Nome *<input autoFocus className="field mt-1" value={name} onChange={e => setName(e.target.value)} /></label>
        </div>
        <label className="block text-sm">Descrizione breve<textarea rows={2} className="field mt-1" value={description} onChange={e => setDescription(e.target.value)} /></label>
        <label className="block text-sm">Stato iniziale
          <select className="field mt-1" value={status} onChange={e => setStatus(e.target.value as ProjectStatus)}>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></label>
        <label className="block text-sm">Tag (separati da virgola)<input className="field mt-1" value={tags} onChange={e => setTags(e.target.value)} /></label>
        {err && <p role="alert" className="text-sm text-red-400">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Annulla</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Creazione…' : 'Crea progetto'}</button></div>
      </form>
    </div>
  );
}

function DuplicateModal({ p, onClose, onDone }: { p: ProjectRow; onClose: () => void; onDone: () => void }) {
  const [o, setO] = useState({ notes: true, checklist: true, links: true }); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function go() { setBusy(true); setErr(null); try { await duplicateProject(p, o); onDone(); } catch (e) { setErr((e as Error).message); setBusy(false); } }
  const box = (k: keyof typeof o, l: string) => <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={o[k]} onChange={e => setO({ ...o, [k]: e.target.checked })} />{l}</label>;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div className="w-full max-w-sm space-y-3 rounded-t-2xl border border-edge bg-panel p-5 sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-white">Duplica "{p.name}"</h2>
        <p className="text-xs text-slate-400">La copia parte come Idea. Gli URL pubblicati e le versioni non vengono copiati.</p>
        {box('checklist', 'Copia la checklist (tutti gli step tornano "Da fare")')}{box('notes', 'Copia le note')}{box('links', 'Copia i link')}
        {err && <p role="alert" className="text-sm text-red-400">{err}</p>}
        <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>Annulla</button><button className="btn-primary" disabled={busy} onClick={go}>{busy ? 'Copia…' : 'Duplica'}</button></div>
      </div>
    </div>
  );
}
