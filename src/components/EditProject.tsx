import { useState } from 'react';
import { STATUS_LABELS, type ProjectStatus } from '../lib/domain';
import { updateProject, type ProjectFull } from '../lib/detail';

export default function EditProject({ p, onClose, onSaved }: { p: ProjectFull; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(p.name); const [description, setDescription] = useState(p.description ?? ''); const [icon, setIcon] = useState(p.icon ?? '');
  const [tags, setTags] = useState(p.tags.join(', ')); const [status, setStatus] = useState<ProjectStatus>(p.status);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!name.trim()) return setErr('Il nome è obbligatorio.');
    setBusy(true); setErr(null);
    try { await updateProject(p.id, { name: name.trim(), description: description.trim() || null, icon: icon || '🚀', status, tags: tags.split(',').map(t => t.trim()).filter(Boolean) }); onSaved(); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  }
  return (
    <div role="dialog" aria-modal="true" aria-label="Modifica progetto" className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <form onSubmit={submit} className="max-h-full w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl border border-edge bg-panel p-5 sm:rounded-2xl">
        <h2 className="text-lg font-semibold text-white">Modifica progetto</h2>
        <div className="flex gap-2"><label className="w-16 text-sm">Icona<input className="field mt-1 text-center" maxLength={4} value={icon} onChange={e => setIcon(e.target.value)} /></label>
          <label className="flex-1 text-sm">Nome *<input className="field mt-1" value={name} onChange={e => setName(e.target.value)} /></label></div>
        <label className="block text-sm">Descrizione<textarea rows={2} className="field mt-1" value={description} onChange={e => setDescription(e.target.value)} /></label>
        <label className="block text-sm">Stato<select className="field mt-1" value={status} onChange={e => setStatus(e.target.value as ProjectStatus)}>
          {(Object.keys(STATUS_LABELS) as ProjectStatus[]).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></label>
        <label className="block text-sm">Tag (separati da virgola)<input className="field mt-1" value={tags} onChange={e => setTags(e.target.value)} /></label>
        {err && <p role="alert" className="text-sm text-red-400">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Annulla</button><button className="btn-primary" disabled={busy}>Salva</button></div>
      </form>
    </div>
  );
}
