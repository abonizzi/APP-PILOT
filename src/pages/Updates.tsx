import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { publishGate } from '../lib/domain';
import type { ProjectFull, ProjLink } from '../lib/detail';
import { listReleases, markPublished, saveDraft, startUpdate, type Release } from '../lib/releases';

const EMPTY = { changes: '', improvements: '', fixes: '', extra: '' };

export default function Updates({ p, links, onChanged, setErr }: { p: ProjectFull; links: ProjLink[]; onChanged: () => void; setErr: (s: string | null) => void }) {
  const [releases, setReleases] = useState<Release[] | null>(null);
  const [title, setTitle] = useState(''); const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false); const [confirming, setConfirming] = useState(false);

  const current = useMemo(() => releases?.find(r => r.status === 'draft') ?? null, [releases]);
  const last = useMemo(() => releases?.find(r => r.status === 'published') ?? null, [releases]);
  const reload = async () => { try { setReleases(await listReleases(p.id)); } catch (e) { setErr((e as Error).message); } };
  useEffect(() => { reload(); }, [p.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (current) { setTitle(current.patch_title ?? ''); setF({ changes: current.patch_changes ?? '', improvements: current.patch_improvements ?? '', fixes: current.patch_fixes ?? '', extra: current.patch_extra ?? '' }); }
    else { setTitle(''); setF(EMPTY); }
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const netlify = links.find(l => /netlify/i.test(l.category ?? '') || /netlify/i.test(l.url));
  const saved = !!current && (current.patch_title ?? '') === title && (current.patch_changes ?? '') === f.changes && (current.patch_improvements ?? '') === f.improvements
    && (current.patch_fixes ?? '') === f.fixes && (current.patch_extra ?? '') === f.extra;
  const gate = publishGate({ status: p.status, patch: f, draftSaved: saved, hasNetlifyLink: !!netlify });

  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setErr(null);
    try { await fn(); await reload(); onChanged(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  const field = (k: keyof typeof f, label: string, rows = 3) => (
    <label className="block text-sm">{label}<textarea rows={rows} className="field mt-1" value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} /></label>);

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-edge bg-panel p-3 text-xs text-slate-400">AppPilot non pubblica nulla: è un promemoria. Pubblichi tu su Netlify e poi confermi qui.</p>

      {p.status === 'deployed' && (
        <div className="rounded-xl border border-edge bg-panel p-4">
          <p className="text-sm text-slate-300">{last ? <>Ultima versione: <b className="text-white">{last.version_label}</b> · {new Date(last.published_at!).toLocaleDateString('it-IT')}</> : 'Nessuna versione registrata.'}</p>
          <button className="btn-primary mt-3" disabled={busy} onClick={() => act(() => startUpdate(p.id))}><RefreshCw size={14} /> Avvia aggiornamento</button>
        </div>)}

      {(p.status === 'updating' || p.status === 'to_deploy') && (
        <section className="space-y-3 rounded-xl border border-edge bg-panel p-4">
          <h2 className="font-medium text-white">Patch notes</h2>
          <label className="block text-sm">Titolo della versione<input className="field mt-1" value={title} onChange={e => setTitle(e.target.value)} /></label>
          {field('changes', 'Modifiche effettuate *')}{field('improvements', 'Miglioramenti', 2)}{field('fixes', 'Correzioni', 2)}{field('extra', 'Note aggiuntive', 2)}
          <p className="text-xs text-slate-500" role="status">{saved ? `Bozza salvata (${new Date(current!.updated_at).toLocaleString('it-IT')})` : 'Bozza non salvata'}</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" disabled={busy || !f.changes.trim()} onClick={() => act(() => saveDraft(p.id, current?.id ?? null, title, f))}>Salva bozza</button>
            {gate.enabled && netlify && <a className="btn-primary" href={netlify.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Apri Netlify</a>}
            <button className="btn-ghost" disabled={!gate.enabled || busy} onClick={() => setConfirming(true)}>Ho pubblicato: segna come Deployed</button>
          </div>
          {!gate.enabled && <p className="text-xs text-amber-300">{gate.reason}</p>}
        </section>)}

      {confirming && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
          <div className="w-full max-w-md space-y-3 rounded-t-2xl border border-edge bg-panel p-5 sm:rounded-2xl">
            <h3 className="text-lg font-semibold text-white">Hai già pubblicato il sito?</h3>
            <p className="text-sm"><b>{title || 'Bozza'}</b></p><p className="whitespace-pre-wrap text-sm text-slate-300">{f.changes}</p>
            <p className="text-xs text-slate-400">Confermi tu di aver pubblicato: AppPilot non verifica il sito.</p>
            <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={() => setConfirming(false)}>Non ancora</button>
              <button className="btn-primary" onClick={() => { setConfirming(false); act(() => markPublished(p, current!.id, p.status)); }}>Sì, segna come Deployed</button></div>
          </div>
        </div>)}

      <section>
        <h2 className="mb-2 font-medium text-white">Storico versioni</h2>
        {releases?.every(r => r.status !== 'published') && <p className="text-sm text-slate-500">Nessuna versione ancora.</p>}
        <ul className="space-y-2">{releases?.filter(r => r.status === 'published').map(r => (
          <li key={r.id} className="rounded-xl border border-edge bg-panel p-3 text-sm">
            <div className="flex justify-between gap-2"><b className="text-white">{r.version_label}</b>
              <span className="text-xs text-slate-400">{new Date(r.published_at!).toLocaleString('it-IT')} · confermata da te</span></div>
            {r.patch_changes && <p className="mt-1 whitespace-pre-wrap text-slate-300">{r.patch_changes}</p>}
          </li>))}</ul>
      </section>
    </div>
  );
}
