import { useCallback, useEffect, useState } from 'react';
import { Link as RLink, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { computeProgress, STATUS_LABELS, type StepStatus } from '../lib/domain';
import * as api from '../lib/detail';
import { safeHttps, type Item, type Note, type ProjLink, type ProjectFull } from '../lib/detail';
import Updates from './Updates';
import Services from './Services';
import EditProject from '../components/EditProject';
import { applyTemplates } from '../lib/projects';
import { useAutosave, type SaveState } from '../hooks/useAutosave';

const UPD = 'Aggiornamenti e versioni';
const TABS = ['Panoramica', 'Checklist', 'Note', 'Servizi e account', 'Link utili', UPD] as const;
type Tab = (typeof TABS)[number];
const STEP_LABEL: Record<StepStatus, string> = { todo: 'Da fare', done: 'Fatto', not_applicable: 'Non da fare' };
const SAVE_LABEL: Record<SaveState, string> = { saved: 'Salvato', dirty: 'Modifiche non salvate', saving: 'Salvataggio…', error: 'Errore di salvataggio' };

export default function ProjectDetail() {
  const { id = '' } = useParams();
  const [p, setP] = useState<ProjectFull | null>(null); const [items, setItems] = useState<Item[]>([]);
  const [notes, setNotes] = useState<Note[]>([]); const [links, setLinks] = useState<ProjLink[]>([]);
  const [tab, setTab] = useState<Tab>('Panoramica'); const [editing, setEditing] = useState(false); const [info, setInfo] = useState<string | null>(null); const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const [a, b, c, d] = await Promise.all([api.getProject(id), api.listItems(id), api.listNotes(id), api.listLinks(id)]);
      setP(a); setItems(b); setNotes(c); setLinks(d); setErr(null); } catch (e) { setErr((e as Error).message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  const run = async (fn: () => Promise<unknown>) => { try { await fn(); await load(); } catch (e) { setErr((e as Error).message); } };

  if (err && !p) return <p role="alert" className="text-red-400">{err}</p>;
  if (!p) return <p className="text-slate-400">Caricamento…</p>;
  const pr = computeProgress(items);
  const tabs = TABS.filter(t => t !== UPD || ['to_deploy', 'deployed', 'updating'].includes(p.status));

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <RLink to="/" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft size={14} /> Progetti</RLink>
      <header className="rounded-xl border border-edge bg-panel p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20 text-2xl">{p.icon}</div>
          <div className="min-w-0"><h1 className="truncate text-xl font-semibold text-white">{p.name}</h1>
            <p className="text-sm text-slate-400">{STATUS_LABELS[p.status]} · creato il {new Date(p.created_at).toLocaleDateString('it-IT')}</p></div>
          <button className="btn-ghost ml-auto" onClick={() => setEditing(true)}>Modifica</button>
        </div>
        {p.description && <p className="mt-3 text-sm text-slate-300">{p.description}</p>}
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-accent" style={{ width: `${pr.percent ?? 0}%` }} /></div>
          <span className="text-sm">{pr.percent === null ? 'Nessuno step applicabile' : `${pr.done}/${pr.applicable} · ${pr.percent}%`}</span>
        </div>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b border-edge" role="tablist">
        {tabs.map(t => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
          className={`whitespace-nowrap px-4 py-2.5 text-sm ${tab === t ? 'border-b-2 border-accent text-white' : 'text-slate-400'}`}>{t}</button>)}
      </nav>
      {err && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{err}</p>}

      {tab === 'Panoramica' && <Overview p={p} onSave={patch => run(() => api.updateProject(p.id, patch))} setErr={setErr} />}

      {tab === 'Checklist' && (<div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-500">{info ?? 'Aggiunge solo gli step dei modelli che mancano; le attività già completate restano.'}</p>
          <button className="btn-ghost" onClick={() => run(async () => { const n = await applyTemplates(p.id); setInfo(n ? `Aggiunti ${n} step.` : 'Nessun nuovo step da aggiungere.'); })}>Aggiungi step dai modelli</button></div>
        <ul className="space-y-2">
          {items.map(i => (
            <li key={i.id} className={`rounded-xl border border-edge bg-panel p-3 ${i.status === 'not_applicable' ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0"><p className={i.status === 'not_applicable' ? 'line-through' : ''}>{i.name}</p>
                  <p className="text-xs text-slate-500">{i.category}</p></div>
                <div role="group" aria-label={`Stato di ${i.name}`} className="flex overflow-hidden rounded-lg border border-edge text-xs">
                  {(['todo', 'done', 'not_applicable'] as StepStatus[]).map(s => (
                    <button key={s} aria-pressed={i.status === s} onClick={() => run(() => api.setItemStatus(i.id, s))}
                      className={`px-3 py-2 ${i.status === s ? (s === 'done' ? 'bg-emerald-500/30 text-emerald-200' : 'bg-accent/30 text-white') : 'hover:bg-white/5'}`}>
                      {i.status === s && s === 'done' && <Check size={12} className="mr-1 inline" />}{STEP_LABEL[s]}</button>))}
                </div>
              </div>
            </li>))}
        </ul></div>)}

      {tab === 'Note' && (
        <div className="grid gap-4 md:grid-cols-2">
          {(['completed', 'future_improvements'] as const).map(type => (
            <section key={type} className="space-y-2">
              <div className="flex items-center justify-between"><h2 className="font-medium text-white">{type === 'completed' ? 'Cosa ho fatto' : 'Da migliorare in futuro'}</h2>
                <button className="btn-ghost !py-1.5" onClick={() => run(() => api.addNote(p.id, type))}><Plus size={14} /> Nota</button></div>
              {notes.filter(n => n.type === type).map(n => <NoteCard key={n.id} n={n} onChange={() => load()} onError={setErr} />)}
              {!notes.some(n => n.type === type) && <p className="text-sm text-slate-500">Ancora nessuna nota.</p>}
            </section>))}
        </div>)}

      {tab === UPD && <Updates p={p} links={links} onChanged={load} setErr={setErr} />}
      {tab === 'Servizi e account' && <Services projectId={p.id} setErr={setErr} />}
      {tab === 'Link utili' && <Links projectId={p.id} links={links} run={run} setErr={setErr} />}
      {editing && <EditProject p={p} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
    </div>
  );
}

function Overview({ p, onSave, setErr }: { p: ProjectFull; onSave: (x: Partial<ProjectFull>) => void; setErr: (s: string | null) => void }) {
  const [site, setSite] = useState(p.public_url ?? ''); const [repo, setRepo] = useState(p.repository_url ?? '');
  const copy = (u: string) => navigator.clipboard.writeText(u).catch(() => setErr('Copia non riuscita.'));
  function save() {
    const s = site.trim() ? safeHttps(site) : null, r = repo.trim() ? safeHttps(repo) : null;
    if ((site.trim() && !s) || (repo.trim() && !r)) return setErr('Gli URL devono iniziare con https://');
    setErr(null); onSave({ public_url: s, repository_url: r });
  }
  return (
    <div className="space-y-4 rounded-xl border border-edge bg-panel p-4">
      <div className="flex flex-wrap gap-2">
        {p.public_url && <><a className="btn-ghost" href={p.public_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Apri sito</a>
          <button className="btn-ghost" onClick={() => copy(p.public_url!)}><Copy size={14} /> Copia URL</button></>}
        {p.repository_url && <a className="btn-ghost" href={p.repository_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Repository</a>}
        {!p.public_url && !p.repository_url && <p className="text-sm text-slate-400">Aggiungi gli URL per attivare le azioni rapide.</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">URL sito pubblicato<input className="field mt-1" inputMode="url" placeholder="https://" value={site} onChange={e => setSite(e.target.value)} /></label>
        <label className="text-sm">URL repository GitHub<input className="field mt-1" inputMode="url" placeholder="https://" value={repo} onChange={e => setRepo(e.target.value)} /></label>
      </div>
      <button className="btn-primary" onClick={save}>Salva URL</button>
      <p className="text-xs text-slate-500">Ultimo aggiornamento: {new Date(p.updated_at).toLocaleString('it-IT')}</p>
    </div>
  );
}

function NoteCard({ n, onChange, onError }: { n: Note; onChange: () => void; onError: (s: string) => void }) {
  const [text, setText] = useState(n.content);
  const { state, retry } = useAutosave(text, v => api.saveNote(n.id, { content: v }));
  return (
    <div className="rounded-xl border border-edge bg-panel p-3">
      <textarea aria-label="Testo della nota" rows={3} className={`field ${n.is_resolved ? 'line-through opacity-60' : ''}`} value={text} onChange={e => setText(e.target.value)} />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span role="status" className={state === 'error' ? 'text-red-400' : state === 'saved' ? 'text-emerald-400' : 'text-amber-300'}>
          {SAVE_LABEL[state]}{state === 'error' && <button className="ml-2 underline" onClick={retry}>Riprova</button>}</span>
        <span className="flex items-center gap-3">
          {n.type === 'future_improvements' && <label className="flex items-center gap-1"><input type="checkbox" checked={n.is_resolved}
            onChange={e => api.saveNote(n.id, { is_resolved: e.target.checked }).then(onChange).catch(x => onError(x.message))} /> Risolta</label>}
          <span className="text-slate-500">{new Date(n.updated_at).toLocaleDateString('it-IT')}</span>
          <button aria-label="Elimina nota" className="text-red-400" onClick={() => { if (confirm('Eliminare la nota?')) api.deleteNote(n.id).then(onChange).catch(x => onError(x.message)); }}><Trash2 size={14} /></button>
        </span>
      </div>
    </div>
  );
}

function Links({ projectId, links, run, setErr }: { projectId: string; links: ProjLink[]; run: (f: () => Promise<unknown>) => void; setErr: (s: string | null) => void }) {
  const [title, setTitle] = useState(''); const [url, setUrl] = useState(''); const [category, setCategory] = useState('');
  function add(e: React.FormEvent) {
    e.preventDefault(); const u = safeHttps(url);
    if (!title.trim() || !u) return setErr('Inserisci un nome e un URL che inizi con https://');
    setErr(null); run(() => api.addLink(projectId, { title: title.trim(), url: u, category: category.trim() || undefined }));
    setTitle(''); setUrl(''); setCategory('');
  }
  return (
    <div className="space-y-3">
      <form onSubmit={add} className="grid gap-2 rounded-xl border border-edge bg-panel p-3 sm:grid-cols-[1fr_2fr_1fr_auto]">
        <input aria-label="Nome" className="field" placeholder="Nome" value={title} onChange={e => setTitle(e.target.value)} />
        <input aria-label="URL" className="field" inputMode="url" placeholder="https://" value={url} onChange={e => setUrl(e.target.value)} />
        <input aria-label="Categoria" className="field" placeholder="Categoria" value={category} onChange={e => setCategory(e.target.value)} />
        <button className="btn-primary"><Plus size={14} /> Aggiungi</button>
      </form>
      {links.length === 0 && <p className="text-sm text-slate-500">Nessun link salvato.</p>}
      {links.map(l => (
        <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-edge bg-panel p-3">
          <div className="min-w-0"><p>{l.title}</p><p className="truncate text-xs text-slate-500">{l.category ? l.category + ' · ' : ''}{l.url}</p></div>
          <div className="flex gap-2">
            <a className="btn-ghost !py-1.5" href={l.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Apri</a>
            <button className="btn-ghost !py-1.5" onClick={() => navigator.clipboard.writeText(l.url).catch(() => setErr('Copia non riuscita.'))}><Copy size={14} /></button>
            <button aria-label="Elimina link" className="btn-ghost !py-1.5 text-red-400" onClick={() => { if (confirm('Eliminare il link?')) run(() => api.deleteLink(l.id)); }}><Trash2 size={14} /></button>
          </div>
        </div>))}
    </div>
  );
}
